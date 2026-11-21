const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Interrupteur « Banque de CV — Analyse IA » (feat_banque_cv_ia).
 *
 * Contexte : l'import groupé du 30/09/2026 (771 CV) a épuisé les crédits Gemini. Fermé (état par défaut), la Banque de CV ne doit
 * faire AUCUN appel IA, pour personne — administrateur compris, puisque c'est lui qui importe — ni en cas d'interrupteur introuvable
 * ou de base injoignable. L'OCR d'une photo ou d'un PDF scanné passe lui aussi par Gemini : il fait partie de ce qui est coupé.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const MIGRATION = "supabase/migrations/20261120240000_feature_flag_banque_cv_ia.sql";
const IMPORTER = "src/app/api/admin/banque-cv/importer/route.js";
const RECHERCHER = "src/app/api/admin/banque-cv/rechercher/route.js";
const LISTE = "src/app/api/admin/banque-cv/route.js";

test.describe("Banque de CV : interrupteur IA", () => {
  test("la migration insère l'interrupteur FERMÉ, sans toucher aux interrupteurs existants", () => {
    const sql = lire(MIGRATION);
    expect(sql).toContain("INSERT INTO public.feature_flags");
    expect(sql).toContain("'feat_banque_cv_ia'");
    // enabled = false : la 5e valeur de la ligne (id, branch_id, name, path, enabled, roles, updated_at)
    expect(sql).toMatch(/NULL,\s*\n\s*false,/);
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).not.toMatch(/\bUPDATE\b\s+public\.feature_flags/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  test("l'arbre par défaut de l'écran « Fonctionnalités » le porte FERMÉ, sans rôle ouvert", () => {
    const src = lire("src/lib/featureFlags.js");
    const debut = src.indexOf('id: "feat_banque_cv_ia"');
    expect(debut).toBeGreaterThan(-1);
    // jusqu'à l'accolade fermante de l'entrée (« }, » seul sur sa ligne, à 6 espaces), pas la première « }, » venue (celle de roles)
    const bloc = src.slice(debut, src.indexOf("\n      },", debut));
    expect(bloc).toMatch(/enabled: false/);
    expect(bloc).toMatch(/roles: \{ user: false, recruiter: false, visitor: false \}/);
  });

  test("la lecture de l'interrupteur ne s'ouvre QUE sur enabled === true (introuvable ou base en panne = fermé)", () => {
    const src = lire("src/lib/banqueCvIA.js");
    expect(src).toContain('const FLAG_IA_BANQUE_CV = "feat_banque_cv_ia";');
    const corps = src.slice(src.indexOf("export async function iaBanqueCvOuverte"), src.indexOf("// Plafond dédié"));
    expect(corps).toContain("return data?.enabled === true;");
    expect(corps).toMatch(/catch\s*\{\s*return false;/);
    // pas de passe-droit administrateur : cette fonction ne lit aucun rôle
    expect(corps.replace(/getSupabaseAdmin/g, "")).not.toMatch(/admin|user_roles|role/i);
  });

  test("import : l'interrupteur est lu AVANT le quota ; fermé, ni OCR, ni catégorisation, ni vecteur, statut « nouveau »", () => {
    const src = lire(IMPORTER);
    expect(src).toContain("const iaOuverte = await iaBanqueCvOuverte();");
    expect(src.indexOf("await iaBanqueCvOuverte()")).toBeLessThan(src.indexOf("await checkBanqueCvQuota("));
    expect(src).toContain("if (iaOuverte && !(await checkBanqueCvQuota(user.id)))");
    expect(src).toContain("{ sansOcr: !iaOuverte }");
    expect(src).toMatch(/if \(iaOuverte\) \{\s*try \{\s*analyse = await categoriserCv\(/);
    expect(src).toContain("if (iaOuverte && analyse) {");
    expect(src).toContain('statut: !iaOuverte ? "nouveau" : analyse ? "analyse" : "erreur"');
    expect(src).toContain("ia_en_pause: !iaOuverte");
  });

  test("import : une photo ou un scan est refusé avec un message clair quand l'IA est fermée", () => {
    const src = lire(IMPORTER);
    expect(src).toContain("sa lecture passe par l'IA, actuellement en pause");
    expect(src).toMatch(/status: 422/);
  });

  test("recherche du candidat idéal : refus 403 AVANT le quota et AVANT tout appel IA quand l'interrupteur est fermé", () => {
    const src = lire(RECHERCHER);
    const garde = src.indexOf("if (!(await iaBanqueCvOuverte()))");
    expect(garde).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(src.indexOf("await checkBanqueCvQuota("));
    expect(garde).toBeLessThan(src.indexOf("await embarquerTexte(poste)"));
    expect(garde).toBeLessThan(src.indexOf("await diagnostiquerCandidats("));
    expect(src).toMatch(/ia_en_pause: true, error: MESSAGE_IA_BANQUE_CV_EN_PAUSE \}, \{ status: 403 \}/);
  });

  test("l'extraction de texte : sansOcr n'appelle jamais l'OCR (PDF scanné et image), le comportement par défaut est inchangé", () => {
    const src = lire("src/lib/documentParser.js");
    expect(src).toContain("export async function extractTextFromFile(buffer, filename, mimeType, options = {})");
    expect(src).toContain("const sansOcr = options.sansOcr === true;");
    // PDF scanné : retour AVANT ocrPdfPages
    expect(src.indexOf("if (sansOcr) return text || \"\";")).toBeLessThan(src.indexOf("const ocrText = await ocrPdfPages("));
    // image : retour AVANT runImageOcr
    expect(src.indexOf("if (sansOcr) return \"\";")).toBeLessThan(src.indexOf("return runImageOcr(buffer);"));
  });

  test("aucun appel IA de la Banque de CV ne se trouve dans un fichier qui ne lit pas l'interrupteur", () => {
    const dossier = path.join(__dirname, "../../src/app/api/admin/banque-cv");
    const fichiers = [];
    const parcourir = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) parcourir(p);
        else if (/\.js$/.test(e.name)) fichiers.push(p);
      }
    };
    parcourir(dossier);
    for (const f of fichiers) {
      const src = fs.readFileSync(f, "utf8");
      const appelleIa = /await (categoriserCv|embarquerTexte|diagnostiquerCandidats)\(/.test(src) || /extractTextFromFile\(/.test(src);
      if (appelleIa) {
        expect(src, `${path.relative(dossier, f)} appelle l'IA sans lire l'interrupteur`).toContain("iaBanqueCvOuverte()");
      }
    }
  });

  test("la liste renvoie l'état de l'interrupteur et l'écran affiche le bandeau « en pause » et le statut « en attente d'analyse »", () => {
    expect(lire(LISTE)).toContain("iaOuverte: await iaBanqueCvOuverte()");
    const ecran = lire("src/components/BanqueCvTab.jsx");
    expect(ecran).toContain("if (typeof data.iaOuverte === \"boolean\") setIaOuverte(data.iaOuverte);");
    expect(ecran).toContain("{iaOuverte === false && (");
    expect(ecran).toContain('cv.statut === "nouveau"');
    expect(ecran).toContain("En attente d&apos;analyse");
  });
});
