const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

/**
 * Envoi des images publiques vers R2 « facilite-images » (scripts/r2-images) : aucun accès réseau dans ces tests, client S3 simulé en mémoire.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const envoi = () => import("../../scripts/r2-images/envoi.mjs");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** Faux client S3 : mémoire + journal des commandes (nom, bucket). */
function fauxClient() {
  const objets = new Map();
  const journal = [];
  const absent = () => Object.assign(new Error("absent"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
  return {
    objets,
    journal,
    async send(cmd) {
      const nom = cmd.constructor.name;
      journal.push({ nom, bucket: cmd.input.Bucket, cle: cmd.input.Key });
      if (nom === "PutObjectCommand") {
        objets.set(cmd.input.Key, { corps: Buffer.from(cmd.input.Body), type: cmd.input.ContentType, cache: cmd.input.CacheControl, meta: cmd.input.Metadata });
        return {};
      }
      if (nom === "HeadObjectCommand") {
        const o = objets.get(cmd.input.Key);
        if (!o) throw absent();
        return { ContentLength: o.corps.length, Metadata: o.meta };
      }
      if (nom === "GetObjectCommand") {
        const o = objets.get(cmd.input.Key);
        if (!o) throw absent();
        return { Body: { transformToByteArray: async () => new Uint8Array(o.corps) } };
      }
      if (nom === "ListObjectsV2Command") {
        return { Contents: [...objets.keys()].filter((k) => k.startsWith(cmd.input.Prefix)).map((Key) => ({ Key })), IsTruncated: false };
      }
      throw new Error("commande non prévue : " + nom);
    },
  };
}

/** Dossier d'export factice : 3 fichiers publics, 1 fichier d'un bucket PRIVÉ, 1 entrée sans empreinte. */
function exportFactice() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "r2-test-"));
  const stockage = path.join(d, "stockage");
  const fichiers = [
    ["job-offers", "admin-posters/a-w1280.webp", Buffer.from("affiche-1")],
    ["job-offers", "u1/audio.mp3", Buffer.from("audio-xxxxxx")],
    ["stories-media", "s/story.jpg", Buffer.from("story-1")],
    ["banque-cv", "cv/prive.pdf", Buffer.from("PRIVE")],
  ];
  const manifeste = [];
  for (const [bucket, chemin, contenu] of fichiers) {
    const cible = path.join(stockage, bucket, ...chemin.split("/"));
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
    manifeste.push({ bucket, chemin, octets: contenu.length, sha256: sha(contenu) });
  }
  manifeste.push({ bucket: "job-offers", chemin: "x/echec.png", octets: 5, statut: "echec" });
  fs.writeFileSync(path.join(stockage, "manifeste-stockage.json"), JSON.stringify(manifeste));
  return { d, stockage, manifeste };
}

test.describe("plan et fichiers locaux", () => {
  test("seuls les 3 buckets publics, seulement les fichiers avec empreinte ; jamais le bucket privé", async () => {
    const { planifier } = await envoi();
    const { stockage, manifeste } = exportFactice();
    const plan = planifier(stockage, manifeste);
    expect(plan.fichiers.map((f) => f.cle).sort()).toEqual(["job-offers/admin-posters/a-w1280.webp", "job-offers/u1/audio.mp3", "stories-media/s/story.jpg"]);
    expect(plan.sansEmpreinte).toBe(1);
    expect(plan.fichiers.some((f) => f.bucket === "banque-cv")).toBe(false);
  });
  test("un fichier local altéré ou absent est détecté AVANT tout envoi", async () => {
    const { planifier, verifierSource } = await envoi();
    const { stockage, manifeste } = exportFactice();
    const plan = planifier(stockage, manifeste);
    expect(verifierSource(plan)).toEqual([]);
    fs.writeFileSync(plan.fichiers[0].local, "altere");
    fs.rmSync(plan.fichiers[1].local);
    const ecarts = verifierSource(plan);
    expect(ecarts.map((e) => e.raison).sort()).toEqual(["empreinte ou taille différente du manifeste", "fichier local introuvable"]);
  });
  test("types de contenu des images, audios et inconnus", async () => {
    const { typeContenu } = await envoi();
    expect(typeContenu("a/b-w1280.webp")).toBe("image/webp");
    expect(typeContenu("x/PHOTO.JPG")).toBe("image/jpeg");
    expect(typeContenu("a/son.mp3")).toBe("audio/mpeg");
    expect(typeContenu("a/fichier.xyz")).toBe("application/octet-stream");
  });
});

test.describe("envoi et vérification (client simulé)", () => {
  test("dépose tout dans facilite-images avec type, cache d'un an et empreinte ; la 2e fois, tout est sauté", async () => {
    const { planifier, envoyer, BUCKET_R2 } = await envoi();
    const { stockage, manifeste } = exportFactice();
    const plan = planifier(stockage, manifeste);
    const client = fauxClient();
    const r1 = await envoyer({ client, plan });
    expect(r1).toEqual({ deposes: 3, sautes: 0, echecs: [] });
    const o = client.objets.get("job-offers/admin-posters/a-w1280.webp");
    expect(o.type).toBe("image/webp");
    expect(o.cache).toBe("public, max-age=31536000, immutable");
    expect(o.meta.sha256).toBe(sha(Buffer.from("affiche-1")));
    const r2 = await envoyer({ client, plan });
    expect(r2).toEqual({ deposes: 0, sautes: 3, echecs: [] });
    for (const c of client.journal) expect(c.bucket).toBe(BUCKET_R2);
  });
  test("la vérification relit chaque objet : conforme, puis détecte contenu différent, manquant et objet en trop", async () => {
    const { planifier, envoyer, verifierR2 } = await envoi();
    const { stockage, manifeste } = exportFactice();
    const plan = planifier(stockage, manifeste);
    const client = fauxClient();
    await envoyer({ client, plan });
    const ok = await verifierR2({ client, plan });
    expect(ok.conforme).toBe(true);
    expect(ok.parBucket["job-offers"]).toEqual({ attendus: 2, identiques: 2, differents: 0, manquants: 0, en_trop: 0 });
    client.objets.get("job-offers/u1/audio.mp3").corps = Buffer.from("autre chose");
    client.objets.delete("stories-media/s/story.jpg");
    client.objets.set("job-offers/intrus.png", { corps: Buffer.from("x"), meta: {} });
    const mauvais = await verifierR2({ client, plan });
    expect(mauvais.conforme).toBe(false);
    expect(mauvais.parBucket["job-offers"]).toMatchObject({ differents: 1, en_trop: 1 });
    expect(mauvais.parBucket["stories-media"]).toMatchObject({ manquants: 1 });
    expect(mauvais.problemes.map((p) => p.raison).sort()).toEqual(["absent de R2", "contenu différent"]);
  });
  test("un fichier déjà présent mais DIFFÉRENT est redéposé ; seules des commandes de dépôt, lecture, tête et liste sont utilisées (aucune suppression)", async () => {
    const { planifier, envoyer, verifierR2 } = await envoi();
    const { stockage, manifeste } = exportFactice();
    const plan = planifier(stockage, manifeste);
    const client = fauxClient();
    await envoyer({ client, plan });
    client.objets.get("job-offers/u1/audio.mp3").corps = Buffer.from("corrompu");
    client.objets.get("job-offers/u1/audio.mp3").meta = { sha256: "autre" };
    const r = await envoyer({ client, plan });
    expect(r).toMatchObject({ deposes: 1, sautes: 2 });
    expect((await verifierR2({ client, plan })).conforme).toBe(true);
    expect([...new Set(client.journal.map((c) => c.nom))].sort()).toEqual(["GetObjectCommand", "HeadObjectCommand", "ListObjectsV2Command", "PutObjectCommand"]);
  });
  test("un échec d'écriture est compté, pas avalé", async () => {
    const { planifier, envoyer } = await envoi();
    const { stockage, manifeste } = exportFactice();
    process.env.R2IMG_ATTENTE_MS = "1";
    const plan = planifier(stockage, manifeste);
    const client = fauxClient();
    const send = client.send.bind(client);
    client.send = async (cmd) => {
      if (cmd.constructor.name === "PutObjectCommand" && cmd.input.Key.endsWith("story.jpg")) throw Object.assign(new Error("refus"), { name: "AccessDenied" });
      return send(cmd);
    };
    const r = await envoyer({ client, plan });
    expect(r.deposes).toBe(2);
    expect(r.echecs).toEqual([{ cle: "stories-media/s/story.jpg", erreur: "AccessDenied" }]);
  });
});

test.describe("programme en ligne de commande et garde-fous", () => {
  const script = path.join(racine, "scripts/r2-images/envoyer.mjs");
  const lancer = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, R2IMG_ENDPOINT: "", R2IMG_KEY_ID: "", R2IMG_SECRET: "", ...env } });

  test("--essai : aucun accès réseau, code 0, affiche le plan en nombres", () => {
    const { stockage } = exportFactice();
    const r = lancer(["--source", stockage, "--essai"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Plan : 3 fichier(s)");
    expect(r.stdout).toContain("3/3 conformes au manifeste");
    expect(r.stdout).toContain("ESSAI : aucun accès réseau");
  });
  test("fichier local altéré : arrêt (code 2) avant tout envoi, même avec des clés", () => {
    const { stockage, manifeste } = exportFactice();
    fs.writeFileSync(path.join(stockage, "job-offers", "u1", "audio.mp3"), "altere");
    const r = lancer(["--source", stockage], { R2IMG_ENDPOINT: "https://" + "a".repeat(32) + ".r2.cloudflarestorage.com", R2IMG_KEY_ID: "cle-fausse", R2IMG_SECRET: "secret-faux" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("rien n'est envoyé");
    expect(manifeste.length).toBeGreaterThan(0);
  });
  test("adresse R2 invalide (avec nom de bucket, ou autre hôte) : refusée sans réseau, sans répéter les clés", () => {
    const { stockage } = exportFactice();
    for (const adresse of ["https://" + "a".repeat(32) + ".r2.cloudflarestorage.com/facilite-images", "https://exemple.test", "http://" + "a".repeat(32) + ".r2.cloudflarestorage.com"]) {
      const r = lancer(["--source", stockage], { R2IMG_ENDPOINT: adresse, R2IMG_KEY_ID: "cle-fausse-123", R2IMG_SECRET: "secret-faux-456" });
      expect(r.status, adresse).toBe(1);
      expect(r.stderr).toContain("Adresse R2 invalide");
      expect(r.stdout + r.stderr).not.toContain("cle-fausse-123");
      expect(r.stdout + r.stderr).not.toContain("secret-faux-456");
    }
  });
  test("variables absentes : refus clair (code 1)", () => {
    const { stockage } = exportFactice();
    const r = lancer(["--source", stockage]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("R2IMG_ENDPOINT / R2IMG_KEY_ID / R2IMG_SECRET manquantes");
  });
  test("le bucket est fixe ; aucun autre bucket, aucune suppression, aucune variable R2_* du projet, aucun fichier d'environnement lu", () => {
    const code = ["envoi.mjs", "envoyer.mjs"].map((f) => lire(`scripts/r2-images/${f}`).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")).join("\n");
    expect(code).toContain('export const BUCKET_R2 = "facilite-images";');
    expect(code).not.toMatch(/facilite-media|DeleteObject|DeleteBucket|ListBuckets|CreateBucket|PutBucket|CopyObject/);
    expect(code).not.toMatch(/process\.env\.R2_|\.env\.local|dotenv|loadEnvFile/);
    expect(code).not.toMatch(/supabase.co|createClient|@supabase|SERVICE_ROLE/i);
  });
  test("envoyer.ps1 : lecture par le presse-papiers en 3 étapes, rien de secret affiché, variables effacées, ASCII seulement (PowerShell 5.1)", () => {
    const ps = lire("scripts/r2-images/envoyer.ps1");
    const outils = lire("scripts/r2-images/outils-presse-papiers.ps1");
    expect(ps.match(/Demander-Valeur "/g)).toHaveLength(3);
    expect(ps).not.toMatch(/Read-Host|AsSecureString/);
    expect(ps).toContain("Remove-Item Env:\\R2IMG_ENDPOINT, Env:\\R2IMG_KEY_ID, Env:\\R2IMG_SECRET");
    expect(ps).toContain("Adresse lue : $adresse (non secrete). Presse-papiers vide.");
    // Access Key ID et secret : seulement leur longueur est affichée.
    expect(ps).not.toMatch(/Write-Host[^\n]*\$(cleId|secret)\b(?!\.Length)/);
    expect(ps).toContain("$($cleId.Length) caracteres, forme correcte (non affiche)");
    expect(ps).toContain("$($secret.Length) caracteres, forme correcte (non affiche)");
    expect(ps).not.toMatch(/Write-Host[^\n]*\$env:R2IMG/);
    expect(ps).not.toMatch(/(Set-Content|Out-File|Add-Content)[^\n]*(R2IMG|cleId|secret)/);
    expect(outils).toContain("Set-Clipboard -Value $null");
    expect(/^[\x00-\x7F]*$/.test(ps)).toBe(true);
    expect(/^[\x00-\x7F]*$/.test(outils)).toBe(true);
  });
});

test.describe("lecture par le presse-papiers (presse-papiers SIMULÉ : le vrai presse-papiers n'est pas touché)", () => {
  test.describe.configure({ timeout: 120000 });
  const aide = path.join(racine, "scripts/r2-images/outils-presse-papiers.ps1");
  const HEX16 = "0123456789abcdef";
  const ADRESSE = "https://" + HEX16.repeat(2) + ".r2.cloudflarestorage.com";
  const FAUX_ID = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"; // 32 caractères, faux
  const FAUX_SECRET = HEX16.repeat(4); // 64 caractères, faux

  // Exécute `corps` dans PowerShell avec un presse-papiers simulé (file de valeurs), un effaceur qui compte, et sans attente de la touche Entrée.
  function simuler(valeurs, corps) {
    const file = valeurs.map((v) => `$script:file.Enqueue('${v}')`).join("; ");
    const cmd = `. '${aide}'; $script:file = New-Object System.Collections.Queue; ${file}; $script:vidages = 0; ` +
      `$script:LecteurPresse = { if ($script:file.Count -gt 0) { [string]$script:file.Dequeue() } else { '' } }; ` +
      `$script:EffaceurPresse = { $script:vidages++ }; $script:Attente = { }; ${corps}`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8" });
    return { sortie: r.stdout, erreur: r.stderr, code: r.status };
  }
  const aides = (s) => s.split(/\r?\n/).filter((l) => l.startsWith("  -> "));

  test("adresse : vide, mauvais hôte, nom de bucket, espaces refusés avec une ligne d'aide chacun ; la bonne est lue, le presse-papiers vidé UNE fois", () => {
    const r = simuler(["", "https://exemple.test", ADRESSE + "/facilite-images", "https://avec un espace", ADRESSE + "/"],
      `$v = Demander-Valeur 'copiez' { param($x) Controler-AdresseR2 $x } -MaxEssais 8; 'LU=' + ($v -ceq '${ADRESSE}/'); 'VIDAGES=' + $script:vidages`);
    expect(r.code).toBe(0);
    expect(aides(r.sortie)).toHaveLength(4);
    expect(r.sortie).toContain("LU=True");
    expect(r.sortie).toContain("VIDAGES=1");
    expect(r.sortie).toContain("Le presse-papiers est vide");
    expect(r.sortie).toContain("nom de bucket");
    expect(r.sortie).not.toContain(HEX16.repeat(2)); // la valeur lue n'est jamais affichée par la fonction
  });
  test("Access Key ID : vide, adresse copiée par erreur, trop court, espaces refusés ; le bon est lu sans jamais être affiché", () => {
    const r = simuler(["", ADRESSE, "trop-court", "A1b2C3d4E5f6G7h8 I9j0K1l2M3n4O5p6", FAUX_ID],
      `$v = Demander-Valeur 'copiez' { param($x) Controler-CleId $x } -MaxEssais 8; 'LU=' + ($v -ceq '${FAUX_ID}'); 'LONGUEUR=' + $v.Length; 'VIDAGES=' + $script:vidages`);
    expect(r.code).toBe(0);
    expect(aides(r.sortie)).toHaveLength(4);
    expect(r.sortie).toContain("Vous avez copie une adresse");
    expect(r.sortie).toContain("LU=True");
    expect(r.sortie).toContain("LONGUEUR=32");
    expect(r.sortie).toContain("VIDAGES=1");
    expect(r.sortie).not.toContain(FAUX_ID);
  });
  test("Secret Access Key : refuse la même valeur que l'Access Key ID, une valeur de 63 caractères, une adresse ; la bonne est lue sans jamais être affichée", () => {
    const r = simuler([FAUX_ID, FAUX_SECRET.slice(0, 63), "https://exemple.test", FAUX_SECRET],
      `$cleId = '${FAUX_ID}'; $v = Demander-Valeur 'copiez' { param($x) Controler-Secret $x $cleId } -MaxEssais 8; 'LU=' + ($v -ceq '${FAUX_SECRET}'); 'LONGUEUR=' + $v.Length; 'VIDAGES=' + $script:vidages`);
    expect(r.code).toBe(0);
    expect(aides(r.sortie)).toHaveLength(3);
    expect(r.sortie).toContain("meme valeur que l'Access Key ID");
    expect(r.sortie).toContain("LU=True");
    expect(r.sortie).toContain("LONGUEUR=64");
    expect(r.sortie).toContain("VIDAGES=1");
    expect(r.sortie).not.toContain(FAUX_SECRET);
    expect(r.sortie).not.toContain(FAUX_ID);
  });
  test("une valeur refusée ne vide PAS le presse-papiers ; les messages d'aide ne répètent jamais la valeur lue", () => {
    const r = simuler(["secret-faux-trop-court-xyz", "autre-faux-abc"],
      `try { Demander-Valeur 'copiez' { param($x) Controler-Secret $x '' } -MaxEssais 2 | Out-Null } catch { 'ERR:' + $_.Exception.Message }; 'VIDAGES=' + $script:vidages`);
    expect(r.sortie).toContain("ERR:Trop d'essais");
    expect(r.sortie).toContain("VIDAGES=0");
    expect(r.sortie).not.toContain("secret-faux-trop-court-xyz");
    expect(r.sortie).not.toContain("autre-faux-abc");
  });
  test("le script ne plante pas sur une valeur vide ou mauvaise : il redemande (aucune exception avant le plafond de test)", () => {
    const r = simuler(["", "", "", FAUX_ID], `$v = Demander-Valeur 'copiez' { param($x) Controler-CleId $x } -MaxEssais 10; 'FINI=' + ($v -ceq '${FAUX_ID}')`);
    expect(r.code).toBe(0);
    expect(r.sortie).toContain("FINI=True");
    expect(r.erreur.trim()).toBe("");
  });
});
