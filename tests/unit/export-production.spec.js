const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

/**
 * Outils d'export complet de la production (scripts/export-production) : chiffrement par blocs, comptage des lignes d'un dump,
 * garde-fous du script PowerShell (dossier hors dépôt, secrets jamais affichés, lecture seule).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const chiffrement = () => import("../../scripts/export-production/chiffrement.mjs");
const verifier = () => import("../../scripts/export-production/verifier.mjs");
const PHRASE = "phrase-secrete-de-test-123";

function dossierTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
}

test.describe("chiffrement par blocs", () => {
  test("aller-retour sur un fichier de plusieurs blocs (9 Mo) : contenu identique, empreinte identique", async () => {
    const { chiffrer, dechiffrer, sha256Fichier } = await chiffrement();
    const d = dossierTemp();
    const clair = path.join(d, "a.bin");
    fs.writeFileSync(clair, crypto.randomBytes(9 * 1024 * 1024 + 123));
    const enc = path.join(d, "a.enc");
    const r = await chiffrer(clair, enc, PHRASE);
    expect(r.blocs).toBe(3);
    expect(fs.readFileSync(enc).includes(fs.readFileSync(clair).subarray(0, 64))).toBe(false);
    const out = path.join(d, "b.bin");
    const res = await dechiffrer(enc, out, PHRASE);
    expect(res.sha256).toBe(sha256Fichier(clair));
    expect(fs.readFileSync(out).equals(fs.readFileSync(clair))).toBe(true);
    fs.rmSync(d, { recursive: true, force: true });
  });
  test("fichier vide et fichier d'un bloc exact : aller-retour correct", async () => {
    const { chiffrer, dechiffrer } = await chiffrement();
    const d = dossierTemp();
    for (const taille of [0, 4 * 1024 * 1024]) {
      const clair = path.join(d, `f${taille}`);
      fs.writeFileSync(clair, Buffer.alloc(taille, 7));
      await chiffrer(clair, `${clair}.enc`, PHRASE);
      const res = await dechiffrer(`${clair}.enc`, null, PHRASE);
      expect(res.octets).toBe(taille);
    }
    fs.rmSync(d, { recursive: true, force: true });
  });
  test("mauvaise phrase secrète, octet modifié, fichier tronqué : refusés", async () => {
    const { chiffrer, dechiffrer } = await chiffrement();
    const d = dossierTemp();
    const clair = path.join(d, "c.bin");
    fs.writeFileSync(clair, crypto.randomBytes(5 * 1024 * 1024));
    const enc = path.join(d, "c.enc");
    await chiffrer(clair, enc, PHRASE);
    await expect(dechiffrer(enc, null, "une-autre-phrase-123")).rejects.toThrow(/refusé/);
    const octets = fs.readFileSync(enc);
    const altere = Buffer.from(octets);
    altere[altere.length - 5] ^= 1;
    fs.writeFileSync(path.join(d, "alt.enc"), altere);
    await expect(dechiffrer(path.join(d, "alt.enc"), null, PHRASE)).rejects.toThrow(/refusé/);
    // Un dernier bloc retiré (fichier tronqué à la frontière d'un bloc) : le bloc précédent n'était pas marqué « dernier ».
    const premier = 4 * 1024 * 1024 + 20 + 8 + 16 + 4;
    fs.writeFileSync(path.join(d, "tronque.enc"), octets.subarray(0, premier));
    await expect(dechiffrer(path.join(d, "tronque.enc"), null, PHRASE)).rejects.toThrow(/refusé/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe("compterCopy", () => {
  test("compte les lignes de chaque bloc COPY, y compris un bloc vide et des valeurs multi-lignes échappées", async () => {
    const { compterCopy } = await verifier();
    const dump = [
      "SET statement_timeout = 0;",
      "COPY public.profiles (id, nom) FROM stdin;",
      "1\tAda",
      "2\tLine\\nbreak",
      "\\.",
      "",
      "COPY public.vide (id) FROM stdin;",
      "\\.",
      'COPY auth.users (id) FROM stdin;',
      "a",
      "b",
      "c",
      "\\.",
      "SELECT pg_catalog.setval('public.seq', 3, true);",
    ].join("\n");
    const c = await compterCopy(Readable.from([dump]));
    expect([...c]).toEqual([["public.profiles", 2], ["public.vide", 0], ["auth.users", 3]]);
  });
});

test.describe("script exporter.ps1 : garde-fous", () => {
  const ps = lire("scripts/export-production/exporter.ps1");
  test("refuse un dossier de sortie dans le dépôt", () => {
    expect(ps).toContain("$Sortie.StartsWith($depot.TrimEnd('\\') + '\\')");
    expect(ps).toContain("Le dossier de sortie est DANS le depot");
  });
  test("adresse de connexion et phrase secrète saisies masquées, jamais affichées ni écrites", () => {
    expect(ps).toContain("Read-Host $invite -AsSecureString");
    expect(ps).not.toMatch(/Write-Host[^\n]*\$env:EXPORT_(DB_URL|PASSPHRASE)/);
    expect(ps).not.toMatch(/(Set-Content|Out-File|Add-Content|>>?)[^\n]*(EXPORT_DB_URL|EXPORT_PASSPHRASE)/);
    expect(ps).toContain("Remove-Item Env:\\EXPORT_DB_URL, Env:\\EXPORT_PASSPHRASE");
  });
  test("ne chiffre et ne supprime rien si la vérification échoue ; relit l'archive chiffrée avant de supprimer le dossier en clair", () => {
    expect(ps.indexOf("chiffrement.mjs') chiffrer $tar")).toBeGreaterThan(ps.indexOf("verifier.mjs') $clair"));
    expect(ps).toContain("La verification a trouve des ecarts : rien n'est chiffre ni supprime");
    expect(ps.indexOf("dechiffrer $enc")).toBeGreaterThan(0);
    expect(ps.indexOf("dechiffrer $enc")).toBeLessThan(ps.indexOf("Remove-Item $clair -Recurse"));
  });
  test("pg_dump 17 exigé ; trois schémas (comptes inclus) ; ASCII seulement (PowerShell 5.1)", () => {
    expect(ps).toContain("[int]$Matches[1] -lt 17");
    expect(ps).toContain("--schema=auth");
    expect(/^[\x00-\x7F]*$/.test(ps)).toBe(true);
  });
});

test.describe("exporter.ps1 -EssaiABlanc", () => {
  const ps = lire("scripts/export-production/exporter.ps1");
  const bloc = ps.slice(ps.indexOf("if ($EssaiABlanc) {"), ps.indexOf("# 2. Saisies masquees"));
  test("le mode existe, s'arrête avant toute saisie de secret et toute connexion", () => {
    expect(ps).toContain("[switch]$EssaiABlanc");
    expect(bloc.length).toBeGreaterThan(500);
    expect(bloc).toContain("exit 0");
    expect(ps.indexOf("if ($EssaiABlanc) {")).toBeLessThan(ps.indexOf("Lire-Secret \"Adresse"));
  });
  test("le bloc ne se connecte à rien : ni pg_dump sur une adresse, ni stockage, ni vérification, ni adresse de connexion", () => {
    expect(bloc).not.toMatch(/--dbname|EXPORT_DB_URL|stockage\.mjs'\)|verifier\.mjs'\)|metadonnees\.mjs'\)|Invoke-WebRequest|Invoke-RestMethod|curl/);
  });
  test("la phrase de l'essai est aléatoire, jamais affichée ; le dossier de test est supprimé", () => {
    expect(bloc).toContain("RNGCryptoServiceProvider");
    expect(bloc).not.toMatch(/Write-Host.*EXPORT_PASSPHRASE/);
    expect(bloc).toContain("Remove-Item $essai -Recurse -Force");
  });
});

test.describe("outils : lecture seule, rien d'identifiant affiché", () => {
  test("aucun outil n'écrit sur Supabase (pas d'INSERT/UPDATE/DELETE/upload/remove)", () => {
    for (const f of ["stockage.mjs", "verifier.mjs", "metadonnees.mjs"]) {
      const code = lire(`scripts/export-production/${f}`).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code, f).not.toMatch(/\.upload\(|\.remove\(|\.insert\(|\.rpc\(|from\([^)]*\)\s*\.(update|delete)\(|\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\s/);
    }
  });
  test("le script de stockage refuse un chemin qui sortirait du dossier de destination", () => {
    const s = lire("scripts/export-production/stockage.mjs");
    expect(s).toContain('throw new Error("chemin refusé")');
  });
  test("la liste des fichiers vient d'une seule requête SQL, pas d'un parcours de dossiers par l'API", () => {
    const s = lire("scripts/export-production/stockage.mjs");
    expect(s).toContain("FROM storage.objects");
    expect(s).not.toContain(".list(");
  });
});
