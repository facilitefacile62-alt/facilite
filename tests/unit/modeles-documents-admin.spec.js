const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Modèles de documents » (CV et lettres de motivation) publiés par l'administrateur : lecture par les comptes connectés, écriture réservée à la route admin
 * (service_role), story optionnelle avec la même affiche. Contrôles statiques de la migration, de la route et de la page.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test.describe("migration modeles_documents", () => {
  const sql = lire("supabase/migrations/20261029100000_modeles_documents.sql");
  const code = sql.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join(" ");
  test("aucune écriture pour le client : ni GRANT INSERT/UPDATE/DELETE, ni policy d'écriture, RLS active", () => {
    expect(sql).toContain("ALTER TABLE public.modeles_documents ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("REVOKE ALL ON public.modeles_documents FROM PUBLIC, anon, authenticated;");
    expect(code).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i);
    expect(code).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
  });
  test("lecture : comptes connectés seulement, modèles actifs seulement, colonnes publiques seulement (pas created_by ni story_id)", () => {
    expect(sql).toContain("FOR SELECT\n  TO authenticated\n  USING (actif = true)");
    const grant = /GRANT SELECT \(([^)]*)\) ON public\.modeles_documents TO authenticated;/.exec(sql);
    expect(grant, "GRANT SELECT par colonnes").not.toBeNull();
    expect(grant[1]).not.toContain("created_by");
    expect(grant[1]).not.toContain("story_id");
    expect(code).not.toMatch(/TO\s+anon/i);
  });
  test("type CV ou lettre, prix de 0 à 1 000 000, affiche en https, bucket public de 5 Mo en images", () => {
    expect(sql).toContain("CHECK (type IN ('cv', 'lettre'))");
    expect(sql).toContain("CHECK (prix_xof BETWEEN 0 AND 1000000)");
    expect(sql).toContain("image_url ~* '^https://'");
    expect(sql).toContain("'modeles-documents', 'modeles-documents', true, 5242880");
    expect(code).not.toContain("<>");
  });
  test("le rollback existe", () => {
    expect(lire("docs/rollbacks/20261029100000_modeles_documents.down.sql")).toContain("DROP TABLE IF EXISTS public.modeles_documents;");
  });
});

test.describe("route /api/admin/modeles-documents", () => {
  const r = lire("src/app/api/admin/modeles-documents/route.js");
  test("chaque méthode exige un administrateur (session, limite de débit, rôle) avant toute écriture", () => {
    expect(r).toContain("requireUser(req");
    expect(r).toContain("checkRateLimit(identifier)");
    expect(r).toContain("isCallerAdmin(admin, user.id)");
    for (const m of ["GET", "POST", "PATCH", "DELETE"]) {
      const debut = r.indexOf(`export async function ${m}(req)`);
      expect(debut, m).toBeGreaterThan(-1);
      expect(r.slice(debut, debut + 200), m).toContain("autoriserAdmin(req)");
    }
  });
  test("validation : type, nom, prix entier, affiche déposée dans le bucket", () => {
    expect(r).toContain('const TYPES_DOCUMENT = ["cv", "lettre"];');
    expect(r).toContain("Le nom doit faire entre 2 et 60 caractères.");
    expect(r).toContain("Number.isInteger(prix) || prix < 0 || prix > 1000000");
    expect(r).toContain(String.raw`/^modele-[\w.-]+\.(jpg|png|webp)$/`);
    expect(r).toContain("L'affiche n'a pas été déposée");
  });
  test("« Publier aussi en story » : story créée AVANT le modèle, annulée si le modèle échoue ; supprimée avec le modèle", () => {
    expect(r).toContain("body?.publier_story === true");
    expect(r.indexOf('.from("stories")\n      .insert(')).toBeLessThan(r.indexOf('.from("modeles_documents")\n    .insert('));
    expect(r).toContain('if (storyId) await admin.from("stories").delete().eq("id", storyId);');
    expect(r).toContain('if (ligne.story_id) await admin.from("stories").delete().eq("id", ligne.story_id);');
    expect(r).toContain('libelle_bouton: "Commander via WhatsApp"');
  });
});

test.describe("page /admin/modeles-documents", () => {
  const p = lire("src/app/admin/modeles-documents/page.js");
  test("prix de départ 1 500 (CV) et 1 000 (lettre), modifiables ; case « Publier aussi en story »", () => {
    expect(p).toContain('const PRIX_PAR_DEFAUT = { cv: "1500", lettre: "1000" };');
    expect(p).toContain("Publier aussi en story");
    expect(p).toContain("publier_story: form.publier_story");
  });
  test("réservée à l'administrateur côté page aussi, et présente dans le menu d'administration", () => {
    expect(p).toContain('ligne?.role !== "admin"');
    expect(lire("src/components/AdminSidebar.jsx")).toContain('href: "/admin/modeles-documents"');
  });
});
