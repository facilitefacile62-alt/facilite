const { test, expect } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

/**
 * Téléchargement du stockage (scripts/export-production/stockage.mjs) contre un FAUX serveur de stockage local (aucun accès à Supabase) :
 * erreurs passagères réessayées, fichier « absent à la source » jamais contourné, taille fausse refusée, reprise qui ne retélécharge que le nécessaire.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const script = path.join(racine, "scripts/export-production/stockage.mjs");
const UUID = "3f2a91bc-1111-2222-3333-444455556666";
const CHEMINS = ["a/1.bin", "a/2.bin", `u/${UUID}/17900-ab1-xy.png`];
const CONTENUS = new Map(CHEMINS.map((c, i) => [`b1/${c}`, Buffer.alloc(100 + i * 50, i + 1)]));

function demarrerServeur() {
  const etat = { comportement: new Map(), requetes: [] };
  const serveur = http.createServer((req, res) => {
    const m = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(req.url.split("?")[0]);
    const cle = m ? `${m[1]}/${decodeURIComponent(m[2])}` : req.url;
    etat.requetes.push(cle);
    const comp = etat.comportement.get(cle) || { type: "ok" };
    const json = (code, corps) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(corps));
    };
    if (comp.type === "absent") return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    if (comp.type === "sature") return json(500, { statusCode: "500", error: "Internal", message: "Too many connections issued to the database" });
    if (comp.type === "instable") {
      comp.restants = comp.restants ?? comp.fois;
      if (comp.restants > 0) {
        comp.restants -= 1;
        return json(500, { statusCode: "500", error: "Internal", message: "Too many connections issued to the database" });
      }
    }
    const contenu = CONTENUS.get(cle);
    if (!contenu) return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
    const corps = comp.type === "court" ? contenu.subarray(0, 10) : contenu;
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": corps.length });
    res.end(corps);
  });
  return new Promise((resolve) => serveur.listen(0, "127.0.0.1", () => resolve({ serveur, etat, url: `http://127.0.0.1:${serveur.address().port}` })));
}

function lancer(args, url) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, EXPORT_DB_URL: "", NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "fausse-cle", EXPORT_ATTENTE_MS: "1", EXPORT_PARALLELE: "2" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}

function preparer() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "stockage-test-"));
  const objets = path.join(d, "objets.json");
  fs.writeFileSync(objets, JSON.stringify(CHEMINS.map((c) => ({ bucket_id: "b1", name: c, size: CONTENUS.get(`b1/${c}`).length }))));
  return { d, objets, sortie: path.join(d, "stockage") };
}
const manifeste = (sortie) => JSON.parse(fs.readFileSync(path.join(sortie, "manifeste-stockage.json"), "utf8"));
const nombre = (etat, chemin) => etat.requetes.filter((r) => r === `b1/${chemin}`).length;

test.describe("stockage.mjs : téléchargement, erreurs classées, reprise", () => {
  test.describe.configure({ timeout: 120000 });

  test("tout va bien : 3 fichiers, empreintes, code 0", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.objets}`], url);
    expect(r.code).toBe(0);
    const m = manifeste(t.sortie);
    expect(m).toHaveLength(3);
    for (const e of m) expect(e.sha256).toBe(crypto.createHash("sha256").update(CONTENUS.get(`b1/${e.chemin}`)).digest("hex"));
    expect(fs.readFileSync(path.join(t.sortie, "b1", "a", "1.bin")).equals(CONTENUS.get("b1/a/1.bin"))).toBe(true);
    expect(etat.requetes).toHaveLength(3);
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test("erreur passagère (« Too many connections ») : réessayée jusqu'au succès, sans échec", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    etat.comportement.set(`b1/${CHEMINS[2]}`, { type: "instable", fois: 3 });
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.objets}`], url);
    expect(r.code).toBe(0);
    expect(nombre(etat, CHEMINS[2])).toBe(4);
    expect(manifeste(t.sortie).every((e) => e.sha256)).toBe(true);
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test("erreur passagère qui dure : échec listé (chemin masqué, aucun identifiant complet), code 2 ; puis reprise = seul le fichier échoué est redemandé", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    etat.comportement.set(`b1/${CHEMINS[2]}`, { type: "sature" });
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.objets}`], url);
    expect(r.code).toBe(2);
    expect(r.out).toContain("Fichiers NON recuperes (echec) (1)");
    expect(r.out).toContain("Too many connections issued to the database");
    expect(r.out).toContain("3f2a91bc...");
    expect(r.out).not.toContain(UUID);
    expect(r.out).not.toContain("17900-ab1-xy");
    expect(r.out).toContain("-Reprendre");
    const echec = manifeste(t.sortie).find((e) => e.statut === "echec");
    expect(echec).toMatchObject({ chemin: CHEMINS[2], genre: "transitoire" });
    expect(nombre(etat, CHEMINS[2])).toBe(7);

    // La source est rétablie : la reprise ne redemande QUE le fichier échoué.
    etat.comportement.clear();
    etat.requetes.length = 0;
    const r2 = await lancer([t.sortie, "--reprendre", `--objets=${t.objets}`], url);
    expect(r2.code).toBe(0);
    expect(etat.requetes).toEqual([`b1/${CHEMINS[2]}`]);
    expect(r2.out).toContain("2 deja present(s) et verifie(s)");
    expect(manifeste(t.sortie).every((e) => e.sha256)).toBe(true);
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test("reprise : un fichier local modifié ou supprimé est retéléchargé, un fichier intact ne l'est pas", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    const t = preparer();
    expect((await lancer([t.sortie, `--objets=${t.objets}`], url)).code).toBe(0);
    fs.writeFileSync(path.join(t.sortie, "b1", "a", "1.bin"), "corrompu");
    fs.rmSync(path.join(t.sortie, "b1", "a", "2.bin"));
    etat.requetes.length = 0;
    const r = await lancer([t.sortie, "--reprendre", `--objets=${t.objets}`], url);
    expect(r.code).toBe(0);
    expect(etat.requetes.sort()).toEqual(["b1/a/1.bin", "b1/a/2.bin"]);
    expect(fs.readFileSync(path.join(t.sortie, "b1", "a", "1.bin")).equals(CONTENUS.get("b1/a/1.bin"))).toBe(true);
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test("fichier listé mais INTROUVABLE (404) : confirmé deux fois, « absent_source », absents-source.json avec empreinte, code 4, jamais contourné", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    etat.comportement.set(`b1/${CHEMINS[2]}`, { type: "absent" });
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.objets}`], url);
    expect(r.code).toBe(4);
    expect(nombre(etat, CHEMINS[2])).toBe(2);
    expect(r.out).toContain("INTROUVABLES dans le stockage (absents a la source)");
    expect(r.out).not.toContain(UUID);
    const e = manifeste(t.sortie).find((x) => x.statut === "absent_source");
    expect(e).toMatchObject({ chemin: CHEMINS[2], genre: "absent" });
    expect(e.sha256).toBeUndefined();
    const liste = JSON.parse(fs.readFileSync(path.join(t.sortie, "absents-source.json"), "utf8"));
    expect(liste.nombre).toBe(1);
    expect(liste.fichiers[0]).toMatchObject({ bucket: "b1", chemin: CHEMINS[2] });
    expect(liste.empreinte).toMatch(/^[0-9a-f]{64}$/);
    // Le fichier réapparaît : la reprise le récupère, plus aucun absent.
    etat.comportement.clear();
    const r2 = await lancer([t.sortie, "--reprendre", `--objets=${t.objets}`], url);
    expect(r2.code).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(t.sortie, "absents-source.json"), "utf8")).nombre).toBe(0);
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test("taille reçue différente de la taille annoncée : échec (jamais accepté), code 2", async () => {
    const { serveur, etat, url } = await demarrerServeur();
    etat.comportement.set("b1/a/2.bin", { type: "court" });
    const t = preparer();
    const r = await lancer([t.sortie, `--objets=${t.objets}`], url);
    expect(r.code).toBe(2);
    expect(r.out).toContain("taille reçue 10 o, taille annoncée 150 o");
    expect(manifeste(t.sortie).find((e) => e.statut === "echec")).toMatchObject({ chemin: "a/2.bin", genre: "taille" });
    serveur.close();
    fs.rmSync(t.d, { recursive: true, force: true });
  });
});

test.describe("fichiers absents à la source : choix explicite, rapport, garde-fous (statique)", () => {
  const ps = lire("scripts/export-production/exporter.ps1");
  const verif = lire("scripts/export-production/verifier.mjs");
  test("exporter.ps1 : -Reprendre saute le dump (1/6 à 3/6), passe --reprendre à stockage, redemande les secrets, refuse un dossier dans le dépôt", () => {
    expect(ps).toContain("[switch]$Reprendre");
    expect(ps).toContain("[1/6] [2/6] [3/6] deja faits (reprise)");
    expect(ps).toContain("$argsStockage += '--reprendre'");
    expect(ps).toContain("Le dossier de reprise est DANS le depot");
    // L'appel réel (dans le bloc principal) vient après la saisie de la phrase secrète ; celui de l'essai à blanc, lui, n'a besoin d'aucun secret.
    expect(ps.lastIndexOf("= Trouver-DossierReprise")).toBeGreaterThan(ps.indexOf('Lire-Secret "Phrase secrete'));
    for (const f of ["structure.sql", "donnees.dump", "metadonnees.json"]) expect(ps).toContain(f);
  });
  test("codes de stockage : 3 projet différent, 2 échecs (relancer avec -Reprendre), 4 absents (choix explicite) ; rien n'est chiffré avant", () => {
    expect(ps).toContain("if ($codeStockage -eq 3)");
    expect(ps).toContain("if ($codeStockage -eq 2)");
    expect(ps).toContain("Relancez la meme commande avec -Reprendre");
    expect(ps).toContain("if ($codeStockage -eq 4) { Demander-Decision-Absents");
    expect(ps.indexOf("$codeStockage -eq 4")).toBeLessThan(ps.indexOf("verifier.mjs') $clair"));
    expect(ps.indexOf("verifier.mjs') $clair")).toBeLessThan(ps.indexOf("chiffrement.mjs') chiffrer $tar"));
  });
  test("le choix est une phrase exacte (sensible à la casse), enregistrée avec le nombre et l'empreinte de la liste", () => {
    expect(ps).toContain("$reponse -cne 'CONTINUER SANS ABSENTS'");
    expect(ps).toContain("Pour continuer SANS ces fichiers, tapez exactement : CONTINUER SANS ABSENTS");
    expect(ps).toContain("decision-absents.json");
    expect(ps).toContain("empreinte = $absents.empreinte");
    expect(ps).toContain("throw \"Arret : choix non confirme");
  });
  test("verifier.mjs : les absents sont écrits dans le rapport ; sans décision valable pour CETTE liste, c'est un problème qui bloque le chiffrement", () => {
    expect(verif).toContain("absents_a_la_source: []");
    expect(verif).toContain("decision_absents: null");
    expect(verif).toContain("decision.empreinte === empreinteAbsents(absentsManifeste)");
    expect(verif).toContain("choix explicite de la personne requis");
    expect(verif).toContain("(b.absents === 0 || decisionValide)");
    expect(verif).toContain("chemin_masque: masquerChemin(f.chemin)");
  });
  test("l'empreinte de la liste ne dépend pas de l'ordre et change si la liste change", async () => {
    const { empreinteAbsents } = await import("../../scripts/export-production/projet.mjs");
    const a = { bucket: "b1", chemin: "x/1" };
    const b = { bucket: "b1", chemin: "x/2" };
    expect(empreinteAbsents([a, b])).toBe(empreinteAbsents([b, a]));
    expect(empreinteAbsents([a])).not.toBe(empreinteAbsents([b]));
    expect(empreinteAbsents([a, b])).not.toBe(empreinteAbsents([a]));
  });
  test("masquerChemin : identifiants raccourcis, nom réduit à sa forme, référence stable ; rien d'identifiant en clair", async () => {
    const { masquerChemin } = await import("../../scripts/export-production/projet.mjs");
    const r = masquerChemin(`${UUID}/Jean_Dupont-CV.pdf`);
    expect(r).toMatch(/^3f2a91bc\.\.\.\/aaaa_aaaaaa-aa\.pdf \[ref [0-9a-f]{8}\]$/);
    expect(r).not.toContain("Jean");
    expect(masquerChemin("x/1")).toBe(masquerChemin("x/1"));
    expect(masquerChemin("x/1")).not.toBe(masquerChemin("x/2"));
  });
});
