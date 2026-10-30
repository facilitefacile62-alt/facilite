const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

/**
 * Modes d'export Leger / Complet : portée des buckets, calcul des fichiers nouveaux ou modifiés, état du dernier export, estimation de l'egress.
 * Tout est testé SANS connexion (fonctions pures, faux client de base de données, fichiers temporaires).
 */
const racine = path.join(__dirname, "../..");
const delta = () => import("../../scripts/export-production/delta.mjs");
const estimer = () => import("../../scripts/export-production/estimer.mjs");
const MO = 1048576;
const obj = (bucket, chemin, octets, extra = {}) => ({ bucket, chemin, octets, updated_at: "2026-10-20T10:00:00.000Z", etag: `"e-${chemin}"`, ...extra });
const ref = (o, extra = {}) => ({ bucket: o.bucket, chemin: o.chemin, octets: o.octets, sha256: `sha-${o.chemin}`, updated_at: o.updated_at, etag: o.etag, archive: "A1", ...extra });

test.describe("portée des modes", () => {
  const BUCKETS = ["avatars", "banque-cv", "chat-attachments", "covers", "invoices", "job-offers", "marketplace-photos", "resumes", "stories-media"];
  test("Leger : aucun fichier de stockage, même avec -AvecImagesPubliques", async () => {
    const { bucketsDansLaPortee } = await delta();
    expect(bucketsDansLaPortee(BUCKETS, { mode: "Leger" })).toEqual([]);
    expect(bucketsDansLaPortee(BUCKETS, { mode: "Leger", avecImagesPubliques: true })).toEqual([]);
  });
  test("Complet : buckets PRIVÉS seulement ; les 3 publics (déjà dans R2) sont exclus", async () => {
    const { bucketsDansLaPortee } = await delta();
    expect(bucketsDansLaPortee(BUCKETS, { mode: "Complet" })).toEqual(["avatars", "banque-cv", "chat-attachments", "covers", "invoices", "resumes"]);
  });
  test("Complet + -AvecImagesPubliques : tous les buckets", async () => {
    const { bucketsDansLaPortee } = await delta();
    expect(bucketsDansLaPortee(BUCKETS, { mode: "Complet", avecImagesPubliques: true })).toEqual([...BUCKETS].sort());
  });
  test("un bucket privé ajouté plus tard est exporté automatiquement ; un mode inconnu est refusé", async () => {
    const { bucketsDansLaPortee } = await delta();
    expect(bucketsDansLaPortee([...BUCKETS, "nouveau-prive"], { mode: "Complet" })).toContain("nouveau-prive");
    expect(() => bucketsDansLaPortee(BUCKETS, { mode: "Rapide" })).toThrow(/Mode inconnu/);
  });
});

test.describe("fichiers nouveaux ou modifiés (comparaison avec le dernier export)", () => {
  test("sans état : tout est nouveau", async () => {
    const { calculerDelta } = await delta();
    const r = calculerDelta([obj("resumes", "a", 10), obj("resumes", "b", 20)], null);
    expect(r.nouveaux).toHaveLength(2);
    expect(r.aTelecharger).toHaveLength(2);
    expect(r.inchanges).toEqual([]);
  });
  test("identique (nom, taille, date, etag) : inchangé, pas de téléchargement", async () => {
    const { calculerDelta } = await delta();
    const a = obj("banque-cv", "u/a.pdf", 100);
    const r = calculerDelta([a], { fichiers: [ref(a)] });
    expect(r.aTelecharger).toEqual([]);
    expect(r.inchanges).toHaveLength(1);
    expect(r.inchanges[0].base.archive).toBe("A1");
  });
  test("taille différente, date plus récente ou etag différent : modifié", async () => {
    const { calculerDelta } = await delta();
    const a = obj("avatars", "u/p.jpg", 100);
    const b = obj("avatars", "u/q.jpg", 100);
    const c = obj("avatars", "u/r.jpg", 100);
    const etat = { fichiers: [ref({ ...a, octets: 90 }), ref({ ...b, updated_at: "2026-10-01T00:00:00.000Z" }), ref({ ...c, etag: '"autre"' })] };
    const r = calculerDelta([a, b, c], etat);
    expect(r.modifies.map((o) => o.chemin).sort()).toEqual(["u/p.jpg", "u/q.jpg", "u/r.jpg"]);
    expect(r.inchanges).toEqual([]);
  });
  test("nouveau fichier : téléchargé ; fichier de l'état disparu : « supprimé » (il reste dans les archives précédentes)", async () => {
    const { calculerDelta } = await delta();
    const a = obj("resumes", "a", 10);
    const ancien = obj("resumes", "disparu", 5);
    const r = calculerDelta([a, obj("resumes", "neuf", 7)], { fichiers: [ref(a), ref(ancien)] });
    expect(r.nouveaux.map((o) => o.chemin)).toEqual(["neuf"]);
    expect(r.supprimes.map((b) => b.chemin)).toEqual(["disparu"]);
    expect(r.inchanges).toHaveLength(1);
  });
  test("état venant d'un ancien manifeste (sans date ni etag) : comparaison par nom et taille ; entrée sans empreinte = à télécharger", async () => {
    const { calculerDelta } = await delta();
    const a = obj("resumes", "a", 10);
    const b = obj("resumes", "b", 20);
    const etat = { fichiers: [{ bucket: "resumes", chemin: "a", octets: 10, sha256: "s", archive: "ref" }, { bucket: "resumes", chemin: "b", octets: 20, archive: "ref" }] };
    const r = calculerDelta([a, b], etat);
    expect(r.inchanges.map((o) => o.chemin)).toEqual(["a"]);
    expect(r.nouveaux.map((o) => o.chemin)).toEqual(["b"]);
  });
  test("état construit d'après un manifeste : seulement les fichiers téléchargés avec empreinte (ni échec, ni absent, ni référence)", async () => {
    const { etatDepuisManifeste } = await delta();
    const etat = etatDepuisManifeste(
      [
        { bucket: "a", chemin: "ok", octets: 1, sha256: "s" },
        { bucket: "a", chemin: "ko", octets: 1, statut: "echec" },
        { bucket: "a", chemin: "abs", octets: 1, statut: "absent_source" },
        { bucket: "a", chemin: "ref", octets: 1, sha256: "s", statut: "inchange" },
        { bucket: "a", chemin: "sans", octets: 1 },
      ],
      { archive: "ancienne" },
    );
    expect(etat.fichiers.map((f) => f.chemin)).toEqual(["ok"]);
    expect(etat.fichiers[0].archive).toBe("ancienne");
  });
  test("nouvel état : fichiers téléchargés → archive courante ; inchangés → archive d'origine ; disparus retirés ; buckets hors portée conservés", async () => {
    const { fusionnerEtat } = await delta();
    const ancien = { fichiers: [ref(obj("resumes", "garde", 1)), ref(obj("resumes", "disparu", 1)), ref(obj("job-offers", "image", 1), { archive: "Ancienne" })] };
    const manifeste = [
      { bucket: "resumes", chemin: "garde", octets: 1, sha256: "sha-garde", statut: "inchange", archive: "A1" },
      { bucket: "resumes", chemin: "neuf", octets: 2, sha256: "sha-neuf" },
      { bucket: "resumes", chemin: "echec", octets: 3, statut: "echec" },
    ];
    const etat = fusionnerEtat(ancien, manifeste, { archive: "A2", buckets: ["resumes"] });
    const par = Object.fromEntries(etat.fichiers.map((f) => [f.chemin, f]));
    expect(par.garde.archive).toBe("A1");
    expect(par.neuf.archive).toBe("A2");
    expect(par.disparu).toBeUndefined();
    expect(par.echec).toBeUndefined();
    expect(par.image.archive).toBe("Ancienne");
    expect(etat.archive).toBe("A2");
  });
});

test.describe("estimation de l'egress", () => {
  const RELATIONS = Math.round(31.17 * MO); // tables + index public + auth + storage, mesuré le 29/10/2026
  const prives = [obj("banque-cv", "a", 300 * MO), obj("resumes", "b", 180 * MO), obj("avatars", "c", MO)];
  test("Leger : base + structure seulement, quelques dizaines de Mo, aucun fichier", async () => {
    const { estimerEgress, QUOTA_EGRESS_OCTETS } = await estimer();
    const e = estimerEgress({ mode: "Leger", tailleRelationsOctets: RELATIONS });
    expect(e.stockage).toBeNull();
    expect(e.total).toBeLessThan(30 * MO);
    expect(e.total).toBeGreaterThan(15 * MO);
    expect(e.partQuota).toBeCloseTo(e.total / QUOTA_EGRESS_OCTETS, 10);
    expect(e.partQuota).toBeLessThan(0.01);
  });
  test("Complet sans référence : tout est à télécharger, l'estimation le dit", async () => {
    const { estimerEgress, formaterEstimation } = await estimer();
    const e = estimerEgress({ mode: "Complet", tailleRelationsOctets: RELATIONS, objets: prives, bucketsPortee: ["avatars", "banque-cv", "resumes"], etat: null });
    expect(e.stockage.aTelechargerOctets).toBe(481 * MO);
    expect(e.stockage.avecReference).toBe(false);
    const texte = formaterEstimation(e).join("\n");
    expect(texte).toContain("AUCUNE référence");
    expect(texte).toContain("-Reference");
    expect(texte).toContain("TOTAL ESTIMÉ");
    expect(texte).toMatch(/quota gratuit de 5 Go par mois/);
  });
  test("Complet avec référence : seuls les fichiers nouveaux ou modifiés comptent, les inchangés sont évités", async () => {
    const { estimerEgress, formaterEstimation } = await estimer();
    const etat = { fichiers: [ref(prives[0]), ref(prives[1]), ref({ ...prives[2], octets: 100 })] };
    const objets = [...prives, obj("resumes", "nouveau", 5 * MO)];
    const e = estimerEgress({ mode: "Complet", tailleRelationsOctets: RELATIONS, objets, bucketsPortee: ["avatars", "banque-cv", "resumes"], etat });
    expect(e.stockage.nouveaux).toBe(1);
    expect(e.stockage.modifies).toBe(1);
    expect(e.stockage.aTelechargerOctets).toBe(MO + 5 * MO);
    expect(e.stockage.referencesN).toBe(2);
    expect(e.stockage.referencesOctets).toBe(480 * MO);
    const texte = formaterEstimation(e).join("\n");
    expect(texte).toContain("2 inchangé(s) NON retéléchargés");
    expect(texte).not.toContain("AUCUNE référence");
    expect(e.total).toBeLessThan(40 * MO);
  });
  test("un fichier de l'état qui n'existe plus est signalé, mais seulement pour les buckets de la portée", async () => {
    const { estimerEgress } = await estimer();
    const etat = { fichiers: [ref(obj("resumes", "disparu", 1)), ref(obj("job-offers", "autre", 1))] };
    const e = estimerEgress({ mode: "Complet", tailleRelationsOctets: RELATIONS, objets: [], bucketsPortee: ["resumes"], etat });
    expect(e.stockage.supprimes).toBe(1);
  });
  test("le texte annonce le mode, la portée, la part du quota, et que rien n'est exporté avant confirmation", async () => {
    const { estimerEgress, formaterEstimation } = await estimer();
    const leger = formaterEstimation(estimerEgress({ mode: "Leger", tailleRelationsOctets: RELATIONS })).join("\n");
    expect(leger).toContain("rien n'est exporté tant que vous n'avez pas confirmé");
    expect(leger).toContain("Mode : Leger (base de données seulement, aucun fichier de stockage)");
    const complet = formaterEstimation(estimerEgress({ mode: "Complet", avecImagesPubliques: true, tailleRelationsOctets: RELATIONS, objets: [], bucketsPortee: [], etat: {} })).join("\n");
    expect(complet).toContain("buckets privés + images publiques");
    const prive = formaterEstimation(estimerEgress({ mode: "Complet", tailleRelationsOctets: RELATIONS, objets: [], bucketsPortee: [], etat: {} })).join("\n");
    expect(prive).toContain("images publiques déjà dans R2");
  });
  test("calibrage : l'estimation de la base reste au-dessus du volume réellement mesuré le 29/10 (13,4 Mo) et du même ordre de grandeur", async () => {
    const { estimerEgress } = await estimer();
    const e = estimerEgress({ mode: "Leger", tailleRelationsOctets: RELATIONS });
    expect(e.base.estime).toBeGreaterThan(13.4 * MO);
    expect(e.base.estime).toBeLessThan(3 * 13.4 * MO);
  });
  test("mesurer() : session en LECTURE SEULE, puis seulement des SELECT ; Leger ne liste aucun fichier", async () => {
    const { mesurer } = await estimer();
    const requetes = [];
    const client = {
      async query(sql, params) {
        requetes.push(sql);
        if (/pg_total_relation_size/.test(sql)) return { rows: [{ octets: String(31 * MO) }] };
        if (/FROM storage\.buckets/.test(sql)) return { rows: [{ id: "avatars" }, { id: "job-offers" }, { id: "resumes" }] };
        if (/FROM storage\.objects/.test(sql)) return { rows: [{ bucket_id: "resumes", name: "x", size: "12", updated_at: "2026-10-20T10:00:00Z", etag: '"e"' }], params };
        return { rows: [] };
      },
    };
    const leger = await mesurer(client, { mode: "Leger" });
    expect(leger).toEqual({ tailleRelationsOctets: 31 * MO, bucketsPortee: [], objets: [] });
    expect(requetes.some((r) => /storage\.objects/.test(r))).toBe(false);
    requetes.length = 0;
    const complet = await mesurer(client, { mode: "Complet" });
    expect(complet.bucketsPortee).toEqual(["avatars", "resumes"]);
    expect(complet.objets).toEqual([{ bucket: "resumes", chemin: "x", octets: 12, updated_at: "2026-10-20T10:00:00.000Z", etag: '"e"' }]);
    expect(requetes[0]).toBe("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    for (const r of requetes.slice(1)) expect(r.trim()).toMatch(/^SELECT/);
  });
  test("reprise : estimation sur le disque (aucune connexion) = fichiers sans empreinte du manifeste", async () => {
    const { estimerReprise } = await estimer();
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "reprise-"));
    expect(estimerReprise(d)).toBeNull();
    fs.mkdirSync(path.join(d, "stockage"));
    fs.writeFileSync(path.join(d, "stockage", "manifeste-stockage.json"), JSON.stringify([
      { bucket: "a", chemin: "ok", octets: 10 * MO, sha256: "s" },
      { bucket: "a", chemin: "ko", octets: 4 * MO, statut: "echec" },
      { bucket: "a", chemin: "ref", octets: 50 * MO, sha256: "s", statut: "inchange" },
    ]));
    const r = estimerReprise(d);
    expect(r.fichiers).toBe(1);
    expect(r.octets).toBe(4 * MO);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe("programmes en ligne de commande (sans connexion)", () => {
  const estimerCli = path.join(racine, "scripts/export-production/estimer.mjs");
  const etatCli = path.join(racine, "scripts/export-production/etat.mjs");
  const lancer = (script, args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, EXPORT_DB_URL: "", ...env } });

  test("estimer --mode invalide ou absent : usage, code 1 ; sans adresse de base : refus clair, aucune connexion", () => {
    expect(lancer(estimerCli, ["--mode=Rapide"]).status).toBe(1);
    expect(lancer(estimerCli, []).status).toBe(1);
    const sans = lancer(estimerCli, ["--mode=Leger"]);
    expect(sans.status).toBe(1);
    expect(sans.stderr).toContain("EXPORT_DB_URL absente");
  });
  test("estimer --reprise : estimation locale, la base n'est pas refaite, aucune adresse de connexion requise", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "reprise-cli-"));
    fs.mkdirSync(path.join(d, "stockage"));
    fs.writeFileSync(path.join(d, "stockage", "manifeste-stockage.json"), JSON.stringify([{ bucket: "a", chemin: "x", octets: 3 * MO, statut: "echec" }]));
    const r = lancer(estimerCli, [`--reprise=${d}`]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("La base de données n'est PAS refaite");
    expect(r.stdout).toContain("1 (3,0 Mo)");
    fs.rmSync(d, { recursive: true, force: true });
  });
  test("etat.mjs : référence d'après un ancien manifeste, puis nouvel état après un export", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "etat-cli-"));
    const manifeste = path.join(d, "manifeste.json");
    fs.writeFileSync(manifeste, JSON.stringify([{ bucket: "resumes", chemin: "a", octets: 5, sha256: "s1" }, { bucket: "resumes", chemin: "b", octets: 6, statut: "echec" }]));
    const etat1 = path.join(d, "etat1.json");
    expect(lancer(etatCli, ["depuis-manifeste", manifeste, etat1, "--archive=ancienne"]).status).toBe(0);
    const e1 = JSON.parse(fs.readFileSync(etat1, "utf8"));
    expect(e1.fichiers).toHaveLength(1);
    expect(e1.fichiers[0].archive).toBe("reference:ancienne");
    // Nouvel export : "a" inchangé (référencé), "n" nouveau téléchargé.
    const stock = path.join(d, "stockage");
    fs.mkdirSync(stock);
    fs.writeFileSync(path.join(stock, "manifeste-stockage.json"), JSON.stringify([{ bucket: "resumes", chemin: "a", octets: 5, sha256: "s1", statut: "inchange", archive: "reference:ancienne" }, { bucket: "resumes", chemin: "n", octets: 2, sha256: "s2" }]));
    fs.writeFileSync(path.join(stock, "portee.json"), JSON.stringify({ buckets: ["resumes"] }));
    const etat2 = path.join(d, "etat2.json");
    expect(lancer(etatCli, ["fusionner", etat1, stock, etat2, "--archive=nouvelle"]).status).toBe(0);
    const par = Object.fromEntries(JSON.parse(fs.readFileSync(etat2, "utf8")).fichiers.map((f) => [f.chemin, f.archive]));
    expect(par).toEqual({ a: "reference:ancienne", n: "nouvelle" });
    expect(lancer(etatCli, ["fusionner", "-", stock, etat2]).status).toBe(1); // --archive obligatoire
    fs.rmSync(d, { recursive: true, force: true });
  });
  test("les modules de calcul n'écrivent jamais sur Supabase : pas d'INSERT/UPDATE/DELETE/DROP, session en lecture seule", () => {
    for (const f of ["delta.mjs", "estimer.mjs", "etat.mjs"]) {
      const code = fs.readFileSync(path.join(racine, "scripts/export-production", f), "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code, f).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\s/);
      expect(code, f).not.toMatch(/\.upload\(|\.remove\(/);
    }
    expect(fs.readFileSync(path.join(racine, "scripts/export-production/estimer.mjs"), "utf8")).toContain('"SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY"');
  });
});
