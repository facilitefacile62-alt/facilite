const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Readable } = require("stream");

/**
 * exporter.ps1 -Mode Leger | Complet : confirmation explicite après l'estimation, ordre des étapes, essais à blanc, référence du dernier export, vérification par mode.
 * Aucun test ne se connecte à Supabase.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const ps = lire("scripts/export-production/exporter.ps1");
const verif = () => import("../../scripts/export-production/verifier.mjs");
const MO = 1048576;
const windows = process.platform === "win32";
const pgDumpPresent = windows && fs.existsSync(path.join(process.env.USERPROFILE || "", "Outils", "postgresql-17", "bin", "pg_dump.exe"));
const MDP = "phrase-secrete-de-test-123";

/** Texte d'une fonction PowerShell de exporter.ps1 (de « function X » à la première accolade fermante seule sur une ligne). */
function fonction(nom) {
  const debut = ps.indexOf(`function ${nom}`);
  expect(debut, nom).toBeGreaterThan(-1);
  const fin = ps.indexOf("\n}\n", debut);
  return ps.slice(debut, fin + 2);
}
/** Exécute un script PowerShell écrit dans un fichier temporaire (pas de problème de guillemets). */
function executer(corps, env = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "modes-ps-"));
  const f = path.join(d, "t.ps1");
  fs.writeFileSync(f, corps);
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", f], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 240000 });
  fs.rmSync(d, { recursive: true, force: true });
  return { sortie: r.stdout, erreur: r.stderr, code: r.status };
}

test.describe("exporter.ps1 : paramètres et ordre des étapes (statique)", () => {
  test("-Mode Leger | Complet (Leger par défaut), -AvecImagesPubliques, -Reference ; aucun paramètre pour passer la confirmation", () => {
    const bloc = ps.slice(ps.indexOf("param("), ps.indexOf(")\n$ErrorActionPreference"));
    expect(bloc).toContain("[ValidateSet('Leger', 'Complet')][string]$Mode = 'Leger'");
    expect(bloc).toContain("[switch]$AvecImagesPubliques");
    expect(bloc).toContain("[string]$Reference = ''");
    expect(bloc).not.toMatch(/Oui|Yes|Force|Confirm|SansConfirmation|Auto|Silencieux/i);
  });
  test("l'estimation et la confirmation viennent AVANT tout pg_dump, toute création de dossier d'export et tout téléchargement ; la phrase secrète est demandée avant", () => {
    const confirmation = ps.indexOf("if (-not (Confirmer-Export $argsEstimation))");
    expect(confirmation).toBeGreaterThan(0);
    const avant = (marque) => {
      const i = ps.indexOf(marque);
      expect(i, marque).toBeGreaterThan(-1);
      expect(confirmation, marque).toBeLessThan(i);
    };
    avant("& $pgDump --dbname=$env:EXPORT_DB_URL --schema-only");
    avant("& $pgDump --dbname=$env:EXPORT_DB_URL --format=custom");
    avant('$clair = Join-Path $Sortie "clair-$horo"');
    avant("& node @argsStockage");
    expect(ps.indexOf('Lire-Secret "Phrase secrete')).toBeLessThan(confirmation);
    expect(ps.indexOf("Verifier-Projet $refApi")).toBeLessThan(confirmation);
  });
  test("annulation : retour sans rien exporter et message clair", () => {
    expect(ps).toContain("Export ANNULE : aucune confirmation. Rien n'a ete exporte");
  });
  test("mode Leger : aucun téléchargement de fichiers (la branche Leger ne lance pas stockage.mjs) ; dump compressé, comptes inclus (schéma auth conservé)", () => {
    const bloc = ps.slice(ps.indexOf("if ($Mode -eq 'Leger') {\n    Write-Host \"[4/6]"), ps.indexOf("  } else {\n    Write-Host \"[4/6]"));
    expect(bloc).toContain("aucun (mode Leger");
    expect(bloc).not.toContain("stockage.mjs");
    expect(ps).toContain("--format=custom --compress=6 --no-owner @schemas");
    expect(ps).toContain("--schema=auth");
  });
  test("mode Complet : portée « prives » par défaut, « tous » avec -AvecImagesPubliques ; référence et identifiant d'archive transmis ; ttout le reste est conservé", () => {
    expect(ps).toContain("$portee = if ($AvecImagesPubliques) { 'tous' } else { 'prives' }");
    expect(ps).toContain('"--portee=$portee", "--archive-id=$idArchive"');
    expect(ps).toContain('if ($baseline) { $argsStockage += "--baseline=$baseline" }');
    expect(ps).toContain("if ($Reprendre) { $argsStockage += '--reprendre' }");
    for (const garde of ["Verifier-Projet $infoAdresse.Ref", "Verifier-Projet $refApi", "Demander-Decision-Absents", "chiffrement.mjs') chiffrer $tar", "dechiffrer $enc", "Remove-Item Env:\\EXPORT_DB_URL, Env:\\EXPORT_PASSPHRASE"]) {
      expect(ps, garde).toContain(garde);
    }
  });
  test("le nouvel état du dernier export n'est mis en place (chiffré) qu'APRÈS la relecture réussie de l'archive ; l'ancien est gardé", () => {
    const relecture = ps.indexOf('if ($relu -notmatch $attendu)');
    const miseEnPlace = ps.indexOf("Move-Item \"$etatEnc.nouveau\" $etatEnc -Force");
    expect(relecture).toBeGreaterThan(0);
    expect(miseEnPlace).toBeGreaterThan(relecture);
    expect(ps).toContain('Copy-Item $etatEnc "$etatEnc.precedent" -Force');
  });
  test("mode d'une reprise : relu dans mode-export.json, un autre -Mode explicite est refusé ; le fichier est écrit à la création du dossier", () => {
    expect(ps).toContain("-Mode $Mode refuse. Reprenez avec le meme mode");
    expect(ps).toContain("mode-export.json");
    expect(ps).toContain("@{ mode = $Mode; avecImagesPubliques = [bool]$AvecImagesPubliques; archive = $idArchive");
  });
  test("ASCII seulement (PowerShell 5.1) ; la vérification reçoit le mode et la portée", () => {
    expect(/^[\x00-\x7F]*$/.test(ps)).toBe(true);
    expect(ps).toContain('"--mode=$Mode"');
    expect(ps).toContain('$argsVerif += "--portee=$portee"');
  });
});

test.describe("exporter.ps1 : confirmation et référence (PowerShell réel, sans connexion)", () => {
  test.skip(!windows, "PowerShell Windows requis");
  test.describe.configure({ timeout: 300000 });

  test("Confirmer-Export : seule la réponse exacte OUI lance l'export ; oui, Oui, « OUI », O, yes, vide : annulation", () => {
    const f = fonction("Confirmer-Export");
    const essai = (reponse) =>
      executer(`$ErrorActionPreference='Stop'; $outils='X'; $script:appels=0
function node { $script:appels++; $global:LASTEXITCODE = 0; 'ESTIMATION' }
function Read-Host { param($p) '${reponse}' }
${f}
$r = Confirmer-Export @('--mode=Leger')
'RESULTAT=' + $r + ' APPELS=' + $script:appels`);
    for (const [reponse, attendu] of [["OUI", "True"], ["oui", "False"], ["Oui", "False"], ["OUI ", "False"], ["O", "False"], ["yes", "False"], ["", "False"], ["OUI OUI", "False"]]) {
      const r = essai(reponse);
      expect(r.sortie, `réponse « ${reponse} »`).toContain(`RESULTAT=${attendu} APPELS=1`);
    }
  });
  test("Confirmer-Export : l'estimation s'affiche d'abord ; si elle échoue, erreur et rien n'est exporté (aucune question posée)", () => {
    const f = fonction("Confirmer-Export");
    const r = executer(`$ErrorActionPreference='Stop'; $outils='X'; $script:questions=0
function node { $global:LASTEXITCODE = 1 }
function Read-Host { param($p) $script:questions++; 'OUI' }
${f}
try { Confirmer-Export @('--mode=Leger') | Out-Null; 'PAS D ERREUR' } catch { 'ERREUR:' + $_.Exception.Message }
'QUESTIONS=' + $script:questions`);
    expect(r.sortie).toContain("ERREUR:L'estimation a echoue : rien n'est exporte.");
    expect(r.sortie).toContain("QUESTIONS=0");
  });
  test("Preparer-Baseline avec -Reference : l'archive chiffrée est déchiffrée, seul le manifeste du stockage est extrait (./stockage/...), et devient l'état de référence", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "modes-ref-"));
    const contenu = path.join(d, "contenu");
    fs.mkdirSync(path.join(contenu, "stockage"), { recursive: true });
    fs.writeFileSync(path.join(contenu, "stockage", "manifeste-stockage.json"), JSON.stringify([{ bucket: "resumes", chemin: "a", octets: 5, sha256: "s1" }, { bucket: "resumes", chemin: "b", octets: 6, statut: "echec" }]));
    fs.writeFileSync(path.join(contenu, "donnees.dump"), "x".repeat(1000));
    const tar = path.join(d, "ancien.tar");
    expect(spawnSync("tar", ["-cf", "ancien.tar", "-C", "contenu", "."], { cwd: d }).status).toBe(0);
    const enc = path.join(d, "facilite-export-20261029-2216.tar.enc");
    expect(spawnSync(process.execPath, [path.join(racine, "scripts/export-production/chiffrement.mjs"), "chiffrer", tar, enc], { env: { ...process.env, EXPORT_PASSPHRASE: MDP } }).status).toBe(0);
    const tmp = path.join(d, "tmp");
    const f = fonction("Preparer-Baseline");
    const r = executer(`$ErrorActionPreference='Stop'; $Sortie='${d}'; $outils='${path.join(racine, "scripts/export-production")}'; $Reference='${enc}'
${f}
$chemin = Preparer-Baseline '${tmp}'
'ETAT=' + (Split-Path $chemin -Leaf)
Get-Content $chemin -Raw`, { EXPORT_PASSPHRASE: MDP });
    expect(r.sortie).toContain("ETAT=etat-reference.json");
    const etat = JSON.parse(r.sortie.slice(r.sortie.indexOf("{")));
    expect(etat.fichiers).toHaveLength(1);
    expect(etat.fichiers[0]).toMatchObject({ bucket: "resumes", chemin: "a", sha256: "s1", archive: "reference:facilite-export-20261029-2216" });
    fs.rmSync(d, { recursive: true, force: true });
  });
  test("Preparer-Baseline : mauvaise phrase secrète pour la référence ou pour l'état = arrêt expliqué ; sans état ni référence : $null (tout serait téléchargé)", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "modes-etat-"));
    const etatClair = path.join(d, "etat.json");
    fs.writeFileSync(etatClair, JSON.stringify({ version: 1, fichiers: [] }));
    expect(spawnSync(process.execPath, [path.join(racine, "scripts/export-production/chiffrement.mjs"), "chiffrer", etatClair, path.join(d, "etat-dernier-export.json.enc")], { env: { ...process.env, EXPORT_PASSPHRASE: MDP } }).status).toBe(0);
    const f = fonction("Preparer-Baseline");
    const base = (ref) => `$ErrorActionPreference='Stop'; $Sortie='${d}'; $outils='${path.join(racine, "scripts/export-production")}'; $Reference='${ref}'
${f}`;
    const bon = executer(`${base("")}\n$c = Preparer-Baseline '${path.join(d, "t1")}'\n'OK=' + (Split-Path $c -Leaf)`, { EXPORT_PASSPHRASE: MDP });
    expect(bon.sortie).toContain("OK=etat.json");
    const mauvais = executer(`${base("")}\ntry { Preparer-Baseline '${path.join(d, "t2")}' | Out-Null; 'PAS D ERREUR' } catch { 'ERREUR:' + $_.Exception.Message }`, { EXPORT_PASSPHRASE: "une-autre-phrase-123" });
    expect(mauvais.sortie).toContain("ERREUR:L'etat du dernier export est illisible avec cette phrase secrete");
    expect(mauvais.sortie).toContain("-Reference");
    const refAbsente = executer(`${base(path.join(d, "absente.tar.enc"))}\ntry { Preparer-Baseline '${path.join(d, "t3")}' | Out-Null; 'PAS D ERREUR' } catch { 'ERREUR:' + $_.Exception.Message }`, { EXPORT_PASSPHRASE: MDP });
    expect(refAbsente.sortie).toContain("ERREUR:-Reference introuvable");
    fs.rmSync(path.join(d, "etat-dernier-export.json.enc"));
    const rien = executer(`${base("")}\n$c = Preparer-Baseline '${path.join(d, "t4")}'\n'NUL=' + ($null -eq $c)`, { EXPORT_PASSPHRASE: MDP });
    expect(rien.sortie).toContain("NUL=True");
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe("exporter.ps1 : essais à blanc par mode (aucune connexion, aucune phrase secrète)", () => {
  test.skip(!pgDumpPresent, "PowerShell Windows et pg_dump 17 requis");
  test.describe.configure({ timeout: 600000 });
  const lancer = (args) => {
    const sortie = fs.mkdtempSync(path.join(os.tmpdir(), "modes-essai-"));
    const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(racine, "scripts/export-production/exporter.ps1"), "-EssaiABlanc", "-Sortie", sortie, ...args], { encoding: "utf8", timeout: 400000 });
    fs.rmSync(sortie, { recursive: true, force: true });
    return { sortie: r.stdout, erreur: r.stderr, code: r.status };
  };
  test("Leger (défaut) : mode annoncé, base seulement ; réussite", () => {
    const r = lancer([]);
    expect(r.sortie).toContain("Mode : Leger (base de donnees seulement, aucun fichier de stockage)");
    expect(r.sortie).toContain("ESSAI A BLANC REUSSI");
    expect(r.sortie).not.toContain("Aucune reference");
    expect(r.code).toBe(0);
  });
  test("Complet sans état ni référence : le script prévient que tout serait téléchargé (environ 615 Mo) ; avec -AvecImagesPubliques le mode l'annonce", () => {
    const r = lancer(["-Mode", "Complet"]);
    expect(r.sortie).toContain("Mode : Complet (buckets prives seulement ; images publiques exclues)");
    expect(r.sortie).toContain("Aucune reference");
    expect(r.sortie).toContain("environ 615 Mo");
    expect(r.code).toBe(0);
    const images = lancer(["-Mode", "Complet", "-AvecImagesPubliques"]);
    expect(images.sortie).toContain("buckets prives + images publiques");
  });
  test("-Reference vers une archive inexistante : échec signalé avant tout (code 1)", () => {
    const r = lancer(["-Mode", "Complet", "-Reference", path.join(os.tmpdir(), "n-existe-pas.tar.enc")]);
    expect(r.sortie).toContain("[ECHEC] -Reference : archive trouvee");
    expect(r.code).toBe(1);
  });
  test("options incohérentes refusées AVANT toute connexion : -AvecImagesPubliques ou -Reference sans -Mode Complet, mode inconnu", () => {
    for (const args of [["-AvecImagesPubliques"], ["-Mode", "Leger", "-AvecImagesPubliques"], ["-Reference", "x.tar.enc"], ["-Mode", "Leger", "-Reference", "x.tar.enc"]]) {
      const r = lancer(args);
      expect(r.code, args.join(" ")).not.toBe(0);
      expect(r.erreur + r.sortie, args.join(" ")).toMatch(/s'utilise avec -Mode Complet/);
    }
    const inconnu = lancer(["-Mode", "Rapide"]);
    expect(inconnu.code).not.toBe(0);
    expect(inconnu.erreur + inconnu.sortie).toMatch(/Rapide/);
  });
});

test.describe("verifier.mjs : évaluation du stockage par mode (fonction pure)", () => {
  const f = (bucket, chemin, octets, extra = {}) => ({ bucket, chemin, octets, sha256: `s-${chemin}`, ...extra });
  const prod = (bucket_id, n, octets) => ({ bucket_id, n, octets: String(octets) });
  const toutBon = () => true;

  test("fichiers téléchargés et conformes : égal ; les volumes comptent les octets téléchargés", async () => {
    const { evaluerStockage } = await verif();
    const r = evaluerStockage({ manifeste: [f("resumes", "a", 10), f("resumes", "b", 20)], objetsProd: [prod("resumes", 2, 30)], buckets: ["resumes"], lireFichier: toutBon });
    expect(r.problemes).toEqual([]);
    expect(r.lignes[0]).toMatchObject({ bucket: "resumes", etat: "égal", fichiers_relus: 2, octets_exportes: 30 });
    expect(r.volumes).toEqual({ telecharge: 30, references: 0 });
  });
  test("fichiers « inchange » : présents PAR RÉFÉRENCE (non relus), comptés pour leur taille, volumes séparés", async () => {
    const { evaluerStockage } = await verif();
    const lu = [];
    const r = evaluerStockage({
      manifeste: [f("banque-cv", "a", 100, { statut: "inchange", archive: "A1" }), f("banque-cv", "b", 50)],
      objetsProd: [prod("banque-cv", 2, 150)],
      buckets: ["banque-cv"],
      lireFichier: (x) => (lu.push(x.chemin), true),
    });
    expect(r.problemes).toEqual([]);
    expect(lu).toEqual(["b"]);
    expect(r.lignes[0]).toMatchObject({ etat: "égal (dont fichiers inchangés référencés)", fichiers_references: 1, fichiers_relus: 1, octets_references: 100, octets_exportes: 50 });
    expect(r.volumes).toEqual({ telecharge: 50, references: 100 });
  });
  test("bucket HORS portée (images publiques dans R2) : indiqué « hors portée », jamais un problème ; sans portée, le même bucket manquant est un écart", async () => {
    const { evaluerStockage } = await verif();
    const args = { manifeste: [f("resumes", "a", 10)], objetsProd: [prod("resumes", 1, 10), prod("job-offers", 764, 116 * MO)], lireFichier: toutBon };
    const avec = evaluerStockage({ ...args, buckets: ["resumes"] });
    expect(avec.problemes).toEqual([]);
    expect(avec.lignes.find((l) => l.bucket === "job-offers").etat).toContain("hors portée");
    const sans = evaluerStockage({ ...args, buckets: null });
    expect(sans.problemes).toHaveLength(1);
    expect(sans.problemes[0]).toContain("job-offers");
  });
  test("écarts détectés : fichier de la production absent du manifeste, fichier téléchargé illisible ou différent, entrée en échec", async () => {
    const { evaluerStockage } = await verif();
    const manque = evaluerStockage({ manifeste: [f("resumes", "a", 10)], objetsProd: [prod("resumes", 2, 30)], buckets: ["resumes"], lireFichier: toutBon });
    expect(manque.lignes[0].etat).toBe("ÉCART");
    const abime = evaluerStockage({ manifeste: [f("resumes", "a", 10)], objetsProd: [prod("resumes", 1, 10)], buckets: ["resumes"], lireFichier: () => false });
    expect(abime.problemes).toHaveLength(1);
    const echec = evaluerStockage({ manifeste: [f("resumes", "a", 10, { statut: "echec", erreur: "x" })], objetsProd: [prod("resumes", 1, 10)], buckets: ["resumes"], lireFichier: toutBon });
    expect(echec.problemes).toHaveLength(1);
  });
  test("un fichier absent à la source n'est conforme que si la décision explicite est valable ; il figure toujours dans le rapport, chemin masqué", async () => {
    const { evaluerStockage } = await verif();
    const manifeste = [f("resumes", "a", 10), f("resumes", "u/fantome.pdf", 7, { statut: "absent_source", erreur: "Object not found" })];
    const sans = evaluerStockage({ manifeste, objetsProd: [prod("resumes", 2, 17)], buckets: ["resumes"], lireFichier: toutBon, decisionValide: false });
    expect(sans.problemes).toHaveLength(1);
    expect(sans.absentsALaSource).toHaveLength(1);
    expect(sans.absentsALaSource[0].chemin_masque).toMatch(/\[ref [0-9a-f]{8}\]$/);
    const avec = evaluerStockage({ manifeste, objetsProd: [prod("resumes", 2, 17)], buckets: ["resumes"], lireFichier: toutBon, decisionValide: true });
    expect(avec.problemes).toEqual([]);
    expect(avec.lignes[0].etat).toBe("égal, avec absents acceptés");
  });
  test("compterCopy mesure aussi le volume (octets) de chaque table du dump, pour comparer à la page Usage", async () => {
    const { compterCopy } = await verif();
    const volumes = new Map();
    const dump = ["COPY public.a (id) FROM stdin;", "1", "22", "\\.", "COPY auth.b (id) FROM stdin;", "333", "\\."].join("\n");
    const c = await compterCopy(Readable.from([dump]), volumes);
    expect([...c]).toEqual([["public.a", 2], ["auth.b", 1]]);
    expect(volumes.get("public.a")).toBe(2 + 3);
    expect(volumes.get("auth.b")).toBe(4);
  });
  test("verifier.mjs : mode Leger = aucun stockage comparé ; --mode et --portee lus ; le rapport contient mode, portée et volumes mesurés", () => {
    const code = lire("scripts/export-production/verifier.mjs");
    expect(code).toContain('if (mode === "Leger") {');
    expect(code).toContain("mode léger : aucun fichier de stockage exporté");
    expect(code).toContain('valeur("mode")');
    expect(code).toContain('valeur("portee")');
    expect(code).toContain("base_non_compressee_octets");
    expect(code).toContain("stockage_telecharge_octets");
    expect(code).toContain("stockage_references_octets");
    expect(code).toContain("Volumes mesurés de CET export");
  });
});
