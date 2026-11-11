const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * 31 affiches d'offres restantes : script de conversion + migration de bascule (NON appliquée). Contrôles statiques : le script ne supprime rien et n'écrit pas en base,
 * la migration ne bascule une offre que si ses trois fichiers existent, chaque ligne est ciblée par l'identifiant, le retour arrière existe.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const liste = JSON.parse(lire("scripts/donnees/affiches-restantes.json"));
const sql = lire("supabase/migrations/20261029120000_affiches_restantes_webp.sql");
const down = lire("docs/rollbacks/20261029120000_affiches_restantes_webp.down.sql");
const code = (t) => t.split("\n").filter((l) => !l.trim().startsWith("--")).join(" ");

test.describe("liste des 31 offres", () => {
  test("31 offres distinctes, toutes dans le bucket public « job-offers », aucune déjà convertie", () => {
    expect(liste).toHaveLength(31);
    expect(new Set(liste.map((l) => l.offre_id)).size).toBe(31);
    for (const l of liste) {
      expect(l.offre_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(l.ancienne).toContain("/storage/v1/object/public/job-offers/");
      expect(l.ancienne).not.toMatch(/-w1280\.webp/i);
    }
  });
});

test.describe("migration de bascule", () => {
  test("une ligne par offre, ciblée par identifiant ; les 31 identifiants y figurent, avec leur adresse WebP", () => {
    for (const l of liste) {
      expect(sql, l.offre_id).toContain(`('${l.offre_id}'::uuid, '${l.ancienne}', '${l.ancienne.replace(/\.[^./]+$/, "")}-w1280.webp'`);
    }
    expect(code(sql)).toContain("WHERE o.id = c.offre_id");
  });
  test("une offre n'est basculée que si -w1280, -w960 et -w480 existent dans le stockage", () => {
    expect(sql).toContain("so.name IN (c.objet || '-w1280.webp', c.objet || '-w960.webp', c.objet || '-w480.webp')");
    expect(sql).toContain(") = 3;");
  });
  test("aucune suppression, aucun `<>` (invariant 8), une seule table modifiée", () => {
    const c = code(sql);
    expect(c).not.toMatch(/\b(DELETE|DROP|TRUNCATE|ALTER|GRANT|REVOKE)\b/i);
    expect(c).not.toContain("<>");
    expect((c.match(/\bUPDATE\b/g) || []).length).toBe(1);
    expect(c).toContain("UPDATE public.job_offers o");
  });
  test("retour arrière : mêmes 31 lignes, sens inverse", () => {
    for (const l of liste) expect(down, l.offre_id).toContain(`('${l.offre_id}'::uuid,`);
    expect(code(down)).toContain("SET image_url = replace(o.image_url, c.nouvelle, c.ancienne)");
  });
});

test.describe("script de conversion", () => {
  const s = lire("scripts/convertir-affiches-restantes.mjs");
  test("essai à blanc par défaut ; cache d'un an ; variantes toujours produites ; principal déposé en dernier", () => {
    expect(s).toContain('const ecrire = process.argv.includes("--ecrire");');
    expect(s).toContain('const CACHE_UN_AN = "31536000";');
    expect(s).toContain("for (const largeur of [480, 960, 1280])");
    expect(s).toContain("upsert: false");
  });
  test("ne supprime rien et n'écrit pas en base", () => {
    const c = code(s);
    expect(c).not.toMatch(/\.remove\(|\.delete\(|\.update\(|\.insert\(|\.from\("job_offers"\)|\.rpc\(/);
  });
});
