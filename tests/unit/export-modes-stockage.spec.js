const { test, expect } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

/**
 * stockage.mjs en mode Complet : portée (buckets privés seulement par défaut), référence du dernier export (fichiers inchangés jamais téléchargés), contre un FAUX serveur de
 * stockage local. Aucun accès à Supabase.
 */
const racine = path.join(__dirname, "../..");
const script = path.join(racine, "scripts/export-production/stockage.mjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const CONTENUS = new Map([
  ["job-offers/a.webp", Buffer.alloc(40, 1)],
  ["marketplace-photos/m.png", Buffer.alloc(30, 2)],
  ["stories-media/s.jpg", Buffer.alloc(20, 3)],
  ["banque-cv/b1.pdf", Buffer.alloc(100, 4)],
  ["banque-cv/b2.pdf", Buffer.alloc(150, 5)],
  ["resumes/r1.pdf", Buffer.alloc(200, 6)],
]);
const DATE = "2026-10-20T10:00:00.000Z";
const objets = () => [...CONTENUS].map(([cle, c]) => ({ bucket_id: cle.split("/")[0], name: cle.split("/").slice(1).join("/"), size: c.length, updated_at: DATE, etag: `"e-${cle}"` }));

function serveur() {
  const requetes = [];
  const srv = http.createServer((req, res) => {
    const m = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(req.url.split("?")[0]);
    const cle = m ? `${m[1]}/${decodeURIComponent(m[2])}` : req.url;
    requetes.push(cle);
    const c = CONTENUS.get(cle);
    if (!c) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" }));
    }
    res.writeHead(200, { "content-length": c.length });
    res.end(c);
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ srv, requetes, url: `http://127.0.0.1:${srv.address().port}` })));
}
function lancer(args, url) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { env: { ...process.env, EXPORT_DB_URL: "", NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "fausse-cle", EXPORT_ATTENTE_MS: "1", EXPORT_PARALLELE: "2" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}
function preparer(liste = objets()) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "modes-stockage-"));
  const fichier = path.join(d, "objets.json");
  fs.writeFileSync(fichier, JSON.stringify(liste));
  return { d, fichier, sortie: path.join(d, "stockage") };
}
const manifeste = (sortie) => JSON.parse(fs.readFileSync(path.join(sortie, "manifeste-stockage.json"), "utf8"));
const lire = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const ref = (cle, extra = {}) => ({ bucket: cle.split("/")[0], chemin: cle.split("/").slice(1).join("/"), octets: CONTENUS.get(cle).length, sha256: sha(CONTENUS.get(cle)), updated_at: DATE, etag: `"e-${cle}"`, archive: "ANCIENNE", ...extra });

test.describe("stockage.mjs : portée des buckets", () => {
  test.describe.configure({ timeout: 120000 });
  test("--portee=prives : les 3 buckets publics ne sont NI listés NI demandés ; seuls banque-cv et resumes sont téléchargés", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives", "--archive-id=A"], url);
    expect(r.code).toBe(0);
    expect(requetes.sort()).toEqual(["banque-cv/b1.pdf", "banque-cv/b2.pdf", "resumes/r1.pdf"]);
    expect(manifeste(t.sortie).map((e) => e.bucket).sort()).toEqual(["banque-cv", "banque-cv", "resumes"]);
    expect(lire(path.join(t.sortie, "portee.json"))).toMatchObject({ portee: "prives", buckets: ["banque-cv", "resumes"], baseline: false, archive: "A" });
    for (const b of ["job-offers", "marketplace-photos", "stories-media"]) expect(fs.existsSync(path.join(t.sortie, b))).toBe(false);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("--portee=tous : les 3 buckets publics sont inclus (option -AvecImagesPubliques)", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=tous"], url);
    expect(r.code).toBe(0);
    expect(requetes).toHaveLength(6);
    expect(lire(path.join(t.sortie, "portee.json")).buckets).toEqual(["banque-cv", "job-offers", "marketplace-photos", "resumes", "stories-media"]);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("valeur de --portee inconnue : refus, rien n'est demandé", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=publics"], url);
    expect(r.code).toBe(1);
    expect(requetes).toEqual([]);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
});

test.describe("stockage.mjs : référence du dernier export (incrémental)", () => {
  test.describe.configure({ timeout: 120000 });
  test("seuls les fichiers NOUVEAUX ou MODIFIÉS sont demandés ; l'inchangé est référencé avec son empreinte et son archive d'origine, sans fichier sur le disque", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const etat = path.join(t.d, "etat.json");
    // b1 identique ; b2 enregistré avec une autre taille (donc modifié) ; r1 inconnu (nouveau).
    fs.writeFileSync(etat, JSON.stringify({ fichiers: [ref("banque-cv/b1.pdf"), ref("banque-cv/b2.pdf", { octets: 99 })] }));
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives", `--baseline=${etat}`, "--archive-id=NOUVELLE"], url);
    expect(r.code).toBe(0);
    expect(requetes.sort()).toEqual(["banque-cv/b2.pdf", "resumes/r1.pdf"]);
    const m = Object.fromEntries(manifeste(t.sortie).map((e) => [`${e.bucket}/${e.chemin}`, e]));
    expect(m["banque-cv/b1.pdf"]).toMatchObject({ statut: "inchange", sha256: sha(CONTENUS.get("banque-cv/b1.pdf")), archive: "ANCIENNE", octets: 100 });
    expect(m["banque-cv/b2.pdf"].statut).toBeUndefined();
    expect(m["banque-cv/b2.pdf"].sha256).toBe(sha(CONTENUS.get("banque-cv/b2.pdf")));
    expect(m["banque-cv/b2.pdf"].updated_at).toBe(DATE);
    expect(m["resumes/r1.pdf"].etag).toBe('"e-resumes/r1.pdf"');
    expect(fs.existsSync(path.join(t.sortie, "banque-cv", "b1.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(t.sortie, "banque-cv", "b2.pdf"))).toBe(true);
    expect(r.out).toContain("inchange(s) (references, non telecharges)");
    expect(r.out).toMatch(/2 recupere\(s\).*1 inchange\(s\) \(references\)/);
    expect(lire(path.join(t.sortie, "portee.json")).baseline).toBe(true);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("rien n'a changé depuis le dernier export : AUCUN fichier n'est demandé, le manifeste décrit pourtant tous les fichiers de la portée", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const etat = path.join(t.d, "etat.json");
    fs.writeFileSync(etat, JSON.stringify({ fichiers: ["banque-cv/b1.pdf", "banque-cv/b2.pdf", "resumes/r1.pdf"].map((c) => ref(c)) }));
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives", `--baseline=${etat}`], url);
    expect(r.code).toBe(0);
    expect(requetes).toEqual([]);
    expect(manifeste(t.sortie).every((e) => e.statut === "inchange" && e.sha256)).toBe(true);
    expect(manifeste(t.sortie)).toHaveLength(3);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("fichier modifié à taille égale : détecté par la date de modification ou l'etag, donc retéléchargé", async () => {
    const { srv, requetes, url } = await serveur();
    const liste = objets().map((o) => (o.name === "b1.pdf" ? { ...o, updated_at: "2026-10-28T09:00:00.000Z" } : o));
    const t = preparer(liste);
    const etat = path.join(t.d, "etat.json");
    fs.writeFileSync(etat, JSON.stringify({ fichiers: ["banque-cv/b1.pdf", "banque-cv/b2.pdf", "resumes/r1.pdf"].map((c) => ref(c)) }));
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives", `--baseline=${etat}`], url);
    expect(r.code).toBe(0);
    expect(requetes).toEqual(["banque-cv/b1.pdf"]);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("état illisible : arrêt par prudence (code 1), aucun fichier n'est demandé", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const etat = path.join(t.d, "etat.json");
    fs.writeFileSync(etat, "pas du json");
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives", `--baseline=${etat}`], url);
    expect(r.code).toBe(1);
    expect(r.err).toContain("illisible");
    expect(requetes).toEqual([]);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("reprise avec référence : les fichiers déjà téléchargés ne sont pas redemandés, les inchangés restent référencés", async () => {
    const { srv, requetes, url } = await serveur();
    const t = preparer();
    const etat = path.join(t.d, "etat.json");
    fs.writeFileSync(etat, JSON.stringify({ fichiers: [ref("banque-cv/b1.pdf")] }));
    const args = [t.sortie, `--objets=${t.fichier}`, "--portee=prives", `--baseline=${etat}`];
    expect((await lancer(args, url)).code).toBe(0);
    requetes.length = 0;
    const r = await lancer([...args, "--reprendre"], url);
    expect(r.code).toBe(0);
    expect(requetes).toEqual([]);
    expect(manifeste(t.sortie).filter((e) => e.statut === "inchange")).toHaveLength(1);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
  test("un fichier absent à la source reste signalé (code 4) même en mode incrémental", async () => {
    const { srv, url } = await serveur();
    const liste = [...objets(), { bucket_id: "resumes", name: "fantome.pdf", size: 10, updated_at: DATE, etag: '"x"' }];
    const t = preparer(liste);
    const r = await lancer([t.sortie, `--objets=${t.fichier}`, "--portee=prives"], url);
    expect(r.code).toBe(4);
    expect(lire(path.join(t.sortie, "absents-source.json")).nombre).toBe(1);
    srv.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
});
