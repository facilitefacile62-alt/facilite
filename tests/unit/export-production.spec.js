const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
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
    expect(ps.indexOf("chiffrement.mjs') chiffrer $tar")).toBeGreaterThan(ps.indexOf("$argsVerif = @((Join-Path $outils 'verifier.mjs'), $clair"));
    expect(ps).toContain("La verification a trouve des ecarts : rien n'est chiffre ni supprime");
    expect(ps.indexOf("dechiffrer $enc")).toBeGreaterThan(0);
    expect(ps.indexOf("dechiffrer $enc")).toBeLessThan(ps.indexOf("Remove-Item $clair -Recurse"));
  });
  test("pg_dump est aussi cherché dans le dossier d'installation de l'utilisateur, sans dépendre de la variable", () => {
    expect(ps).toContain('Outils\\postgresql-17\\bin\\$nom.exe');
  });
  test("pg_dump 17 exigé ; trois schémas (comptes inclus) ; ASCII seulement (PowerShell 5.1)", () => {
    expect(ps).toContain("[int]$Matches[1] -lt 17");
    expect(ps).toContain("--schema=auth");
    expect(/^[\x00-\x7F]*$/.test(ps)).toBe(true);
  });
});

test.describe("exporter.ps1 -EssaiABlanc", () => {
  const ps = lire("scripts/export-production/exporter.ps1");
  const bloc = ps.slice(ps.indexOf("if ($EssaiABlanc) {"), ps.indexOf("# 2. Adresse de connexion"));
  test("le mode existe, s'arrête avant toute saisie de secret et toute connexion", () => {
    expect(ps).toContain("[switch]$EssaiABlanc");
    expect(bloc.length).toBeGreaterThan(500);
    expect(bloc).toContain("exit 0");
    expect(ps.indexOf("if ($EssaiABlanc) {")).toBeLessThan(ps.indexOf("$adresse = Lire-Adresse"));
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

test.describe("adresse de connexion : presse-papiers, contrôle sans affichage", () => {
  test.describe.configure({ timeout: 180000 });
  const helper = path.join(__dirname, "../../scripts/export-production/outils-adresse.ps1");
  // Fausses adresses : aucune ne correspond à une vraie base.
  const MDP = "Fausse-Valeur-42";
  const HOTE = "aws-0-test.pooler.supabase.com";
  const controler = (adresse) => {
    const cmd = `. '${helper}'; try { (Controler-Adresse '${adresse}') | ConvertTo-Json -Compress } catch { 'ERR:' + $_.Exception.Message }`;
    return execFileSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8" }).trim();
  };
  test("session pooler (port 5432) accepté ; adresse directe reconnue", () => {
    expect(JSON.parse(controler(`postgresql://postgres.abcdef:${MDP}@${HOTE}:5432/postgres`))).toMatchObject({ Type: "session-pooler", Port: 5432 });
    expect(JSON.parse(controler(`postgresql://postgres:${MDP}@db.abcdef.supabase.co:5432/postgres`))).toMatchObject({ Type: "direct", Port: 5432 });
  });
  test("refus clairs : espace réservé du mot de passe, Transaction pooler (6543), mot de passe absent, autre schéma", () => {
    expect(controler(`postgresql://postgres.abcdef:[YOUR-PASSWORD]@${HOTE}:5432/postgres`)).toMatch(/^ERR:.*espace reserve du mot de passe/);
    expect(controler(`postgresql://postgres.abcdef:${MDP}@${HOTE}:6543/postgres`)).toMatch(/^ERR:.*Transaction pooler/);
    expect(controler(`postgresql://postgres.abcdef@${HOTE}:5432/postgres`)).toMatch(/^ERR:.*illisible/);
    expect(controler("https://exemple.test/x")).toMatch(/^ERR:.*adresse de connexion Postgres/);
  });
  test("aucun message d'erreur ne répète le mot de passe ni l'hôte", () => {
    for (const a of [`postgresql://postgres.abcdef:${MDP}@${HOTE}:6543/postgres`, `postgresql://postgres.abcdef:[YOUR-PASSWORD]@${HOTE}:5432/postgres`]) {
      const r = controler(a);
      expect(r).not.toContain(MDP);
      expect(r).not.toContain(HOTE);
    }
  });
  test("le script lit le presse-papiers puis le vide ; n'affiche que le type et le port ; saisie masquée en repli", () => {
    const h = lire("scripts/export-production/outils-adresse.ps1");
    expect(h).toContain("Get-Clipboard -Raw");
    expect(h).toContain("Set-Clipboard -Value $null");
    expect(h).toContain("-AsSecureString");
    const ps = lire("scripts/export-production/exporter.ps1");
    expect(ps).toMatch(/\$adresse = Lire-Adresse\r?\n/);
    expect(ps).toContain("Adresse de connexion lue (non affichee) : type {0}, port {1}.");
    expect(ps).not.toMatch(/Write-Host[^\n]*\$adresse\b|Write-Host[^\n]*EXPORT_DB_URL/);
    expect(/^[\x00-\x7F]*$/.test(h)).toBe(true);
  });
});

const PROD = "ocfhzwwjvljintabxxlg";
const AUTRE = "abcdefghijklmnopqrst"; // un autre projet (comme facilite-e2e-test) : 20 caractères, faux
const MDP_FAUX = "Fausse-Valeur-42";
const HOTE_FAUX = "aws-0-test.pooler.supabase.com";
const ps1 = (cmd) => execFileSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8" }).trim();
const aide = path.join(__dirname, "../../scripts/export-production/outils-adresse.ps1");

test.describe("projet : l'export ne lit que la production", () => {
  test.describe.configure({ timeout: 180000 });
  test("la référence de production est la même dans le module Node, le script PowerShell et les tests existants", () => {
    expect(lire("scripts/export-production/projet.mjs")).toContain(`REF_PRODUCTION = "${PROD}"`);
    expect(lire("scripts/export-production/outils-adresse.ps1")).toContain(`$script:REF_PRODUCTION = '${PROD}'`);
    expect(lire("tests/helpers/testEnv.js")).toContain(`PROD_REF = "${PROD}"`);
  });
  test("lecture du ref : pooler (utilisateur postgres.<ref>), direct (db.<ref>.supabase.co), API ; sinon null", async () => {
    const { refDepuisAdresseDb, refDepuisUrlApi, exigerMemeProjet } = await import("../../scripts/export-production/projet.mjs");
    expect(refDepuisAdresseDb(`postgresql://postgres.${PROD}:x@${HOTE_FAUX}:5432/postgres`)).toBe(PROD);
    expect(refDepuisAdresseDb(`postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`)).toBe(PROD);
    expect(refDepuisAdresseDb("postgresql://postgres:x@localhost:5432/postgres")).toBeNull();
    expect(refDepuisUrlApi(`https://${PROD}.supabase.co`)).toBe(PROD);
    expect(refDepuisUrlApi("https://exemple.test")).toBeNull();
    expect(() => exigerMemeProjet(PROD, PROD)).not.toThrow();
    expect(() => exigerMemeProjet(PROD, AUTRE)).toThrow(/deux projets différents/);
    expect(() => exigerMemeProjet(null, PROD)).toThrow(/introuvable/);
  });
  test("PowerShell et Node lisent le même ref sur les mêmes adresses", () => {
    const cas = [`postgresql://postgres.${AUTRE}:x@${HOTE_FAUX}:5432/postgres`, `postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`, "postgresql://u:x@localhost:5432/p"];
    for (const a of cas) {
      const r = ps1(`. '${aide}'; $r = Extraire-Ref '${a}'; if ($r) { $r } else { 'NULL' }`);
      const attendu = (/^postgres(?:ql)?:\/\/postgres\.([a-z0-9]{20}):/.exec(a) || /@db\.([a-z0-9]{20})\.supabase\.co[:/]/.exec(a) || [null, "NULL"])[1];
      expect(r).toBe(attendu);
    }
    expect(ps1(`. '${aide}'; Extraire-RefApi 'https://${PROD}.supabase.co'`)).toBe(PROD);
  });
  test("exporter.ps1 : refs vérifiés (base ET fichiers) AVANT la phrase secrète et AVANT tout pg_dump", () => {
    const ps = lire("scripts/export-production/exporter.ps1");
    const premierDump = ps.indexOf("& $pgDump --dbname");
    expect(premierDump).toBeGreaterThan(0);
    for (const marque of ["Verifier-Projet $infoAdresse.Ref", "Verifier-Projet $refApi", 'Lire-Secret "Phrase secrete']) {
      expect(ps.indexOf(marque), marque).toBeGreaterThan(0);
      expect(ps.indexOf(marque), marque).toBeLessThan(premierDump);
    }
    expect(ps.indexOf("Verifier-Projet $refApi")).toBeLessThan(ps.indexOf('Lire-Secret "Phrase secrete'));
    expect(ps).toContain("IDENTIQUE a la production");
  });
  test("une adresse d'un autre projet : arrêt avec un message qui donne les deux refs, sans mot de passe ni hôte", () => {
    const r = ps1(`. '${aide}'; try { Verifier-Projet '${AUTRE}' "l'adresse de connexion" } catch { 'ERR:' + $_.Exception.Message }`);
    expect(r).toMatch(/^ERR:ARRET/);
    expect(r).toContain(AUTRE);
    expect(r).toContain(PROD);
    expect(r).toContain("Rien n'a ete lance");
    expect(ps1(`. '${aide}'; try { Verifier-Projet $null "l'adresse" } catch { 'ERR:' + $_.Exception.Message }`)).toMatch(/^ERR:Impossible de lire la reference/);
  });
  test("stockage.mjs refuse de télécharger si la base et l'API sont deux projets différents (code 3), accepte le même projet", () => {
    const script = path.join(__dirname, "../../scripts/export-production/stockage.mjs");
    const d = dossierTemp();
    const vide = path.join(d, "objets.json");
    fs.writeFileSync(vide, "[]");
    const lancer = (refDb, refApi) => {
      try {
        const sortie = execFileSync(process.execPath, [script, path.join(d, "out"), "--liste", `--objets=${vide}`], {
          encoding: "utf8",
          env: { ...process.env, EXPORT_DB_URL: `postgresql://postgres.${refDb}:${MDP_FAUX}@${HOTE_FAUX}:5432/postgres`, NEXT_PUBLIC_SUPABASE_URL: `https://${refApi}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: "fausse-cle" },
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { code: 0, texte: sortie };
      } catch (e) {
        return { code: e.status, texte: String(e.stderr) };
      }
    };
    const refus = lancer(PROD, AUTRE);
    expect(refus.code).toBe(3);
    expect(refus.texte).toContain("deux projets différents");
    expect(refus.texte).not.toContain(MDP_FAUX);
    expect(lancer(PROD, PROD).code).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe("-DepuisEnvLocal : conversion du Transaction pooler (6543) en Session pooler (5432), en mémoire", () => {
  test.describe.configure({ timeout: 180000 });
  const lireEnv = (lignes, attendu = "") => {
    const d = dossierTemp();
    const f = path.join(d, ".env.test");
    fs.writeFileSync(f, lignes.join("\n"));
    const cmd = `. '${aide}'; try { $l = Lire-AdresseEnv '${f}'; [pscustomobject]@{ Nom = $l.Nom; Type = $l.Type; Port = $l.Port; Ref = $l.Ref; Converti = $l.Converti; Attendu = ($l.Adresse -eq '${attendu}') } | ConvertTo-Json -Compress } catch { 'ERR:' + $_.Exception.Message }`;
    const r = ps1(cmd);
    fs.rmSync(d, { recursive: true, force: true });
    return r;
  };
  const base = (ref, port, fin = "/postgres") => `postgresql://postgres.${ref}:${MDP_FAUX}@${HOTE_FAUX}:${port}${fin}`;

  test("pooler 6543 du projet de production : converti en 5432, même hôte/utilisateur/mot de passe ; l'option pgbouncer est retirée", () => {
    const r = JSON.parse(lireEnv([`SUPABASE_DATABASE_URL=${base(PROD, 6543, "/postgres?pgbouncer=true")}`], base(PROD, 5432)));
    expect(r).toEqual({ Nom: "SUPABASE_DATABASE_URL", Type: "session-pooler", Port: 5432, Ref: PROD, Converti: true, Attendu: true });
  });
  test("les autres options sont conservées (sslmode)", () => {
    const r = JSON.parse(lireEnv([`SUPABASE_DATABASE_URL="${base(PROD, 6543, "/postgres?pgbouncer=true&sslmode=require")}"`], base(PROD, 5432, "/postgres?sslmode=require")));
    expect(r.Attendu).toBe(true);
    expect(r.Converti).toBe(true);
  });
  test("une adresse déjà en 5432 n'est pas touchée (Converti faux)", () => {
    const r = JSON.parse(lireEnv([`SUPABASE_DATABASE_URL=${base(PROD, 5432)}`], base(PROD, 5432)));
    expect(r).toMatchObject({ Port: 5432, Converti: false, Attendu: true });
  });
  test("variable écartée puis suivante acceptée : le NOM de la variable utilisée est DATABASE_URL", () => {
    const r = JSON.parse(lireEnv([`SUPABASE_DATABASE_URL=postgresql://postgres.${PROD}:[YOUR-PASSWORD]@${HOTE_FAUX}:5432/postgres`, `DATABASE_URL=${base(PROD, 6543)}`], base(PROD, 5432)));
    expect(r).toMatchObject({ Nom: "DATABASE_URL", Converti: true, Attendu: true });
  });
  test("un autre projet (même converti) reste refusé : le ref de production est exigé, message avec les deux refs", () => {
    const r = lireEnv([`SUPABASE_DATABASE_URL=${base(AUTRE, 6543)}`]);
    expect(r).toMatch(/^ERR:Aucune variable/);
    expect(r).toContain(AUTRE);
    expect(r).toContain(PROD);
    expect(r).not.toContain(MDP_FAUX);
    expect(r).not.toContain(HOTE_FAUX);
  });
  test("les autres cas gardent le refus : 6543 sur l'hôte direct, sur un hôte non Supabase, mot de passe absent", () => {
    const direct = lireEnv([`SUPABASE_DATABASE_URL=postgresql://postgres:${MDP_FAUX}@db.${PROD}.supabase.co:6543/postgres`]);
    expect(direct).toMatch(/^ERR:/);
    expect(direct).toContain("Transaction pooler");
    expect(lireEnv([`SUPABASE_DATABASE_URL=postgresql://postgres.${PROD}:${MDP_FAUX}@exemple.test:6543/postgres`])).toContain("Transaction pooler");
    expect(lireEnv([`SUPABASE_DATABASE_URL=postgresql://postgres.${PROD}@${HOTE_FAUX}:5432/postgres`])).toContain("illisible");
  });
  test("le presse-papiers garde le refus du 6543 (aucune conversion hors .env.local)", () => {
    expect(ps1(`. '${aide}'; try { Controler-Adresse '${base(PROD, 6543)}' } catch { 'ERR:' + $_.Exception.Message }`)).toContain("Transaction pooler");
    const h = lire("scripts/export-production/outils-adresse.ps1");
    const lireAdresse = h.slice(h.indexOf("function Lire-Adresse()"), h.indexOf("# Transaction pooler Supabase"));
    expect(lireAdresse).not.toContain("Convertir-Session");
  });
  test("le script dit « converti 6543 -> 5432 » sans afficher la valeur ni modifier .env.local", () => {
    const ps = lire("scripts/export-production/exporter.ps1");
    expect(ps).toContain("converti 6543 -> 5432 (Transaction pooler -> Session pooler, en memoire, rien n'est modifie dans .env.local)");
    expect(ps).not.toMatch(/Set-Content[^\n]*envLocal|Out-File[^\n]*envLocal|Add-Content[^\n]*envLocal/);
    expect(ps).not.toMatch(/Write-Host[^\n]*\$lu\.Adresse|Write-Host[^\n]*\$adresse\b/);
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
