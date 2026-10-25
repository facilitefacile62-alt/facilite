const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Créateur de CV (/creer-cv) : exemple de départ NEUTRE et fictif (plus aucune identité réelle), et garde-fou « Écrivez vos informations avant de continuer. »
 * avant de télécharger, payer ou imprimer tant que le nom ou le téléphone sont ceux d'un exemple.
 */
const charger = () => import("../../src/lib/exempleCreateurCv.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

// Fragments de l'ancienne identité (écrits ici seulement pour vérifier qu'ils ont disparu du code).
const ANCIENNE_IDENTITE = [/macoumba/i, /samake/i, /azma/i, /cefas/i, /k[ée]b[ée]mer/i, /77 ?140 ?08 ?32/, /771400832/, /facilitefacile/i, /facilite-digital/i, /entrepreneure|g[ée]rante/i, /d[ée]l[ée]gu[ée]e m[ée]dicale/i];

test.describe("exemple de départ neutre", () => {
  test("aucune identité réelle dans l'exemple (nom, téléphone, e-mail, LinkedIn, entreprise, écoles, profil)", async () => {
    const { exempleCvNeutre } = await charger();
    const texte = JSON.stringify(exempleCvNeutre());
    for (const motif of ANCIENNE_IDENTITE) expect(texte, String(motif)).not.toMatch(motif);
    const e = exempleCvNeutre();
    expect(e).toMatchObject({ firstName: "Prénom", lastName: "NOM", phone: "+221 77 000 00 00", email: "prenom.nom@exemple.com", linkedin: "" });
  });
  test("l'aperçu reste lisible : au moins un poste, une formation, des compétences, des langues ; une copie neuve à chaque appel", async () => {
    const { exempleCvNeutre } = await charger();
    const a = exempleCvNeutre();
    expect(a.experiences.length).toBeGreaterThan(0);
    expect(a.educations.length).toBeGreaterThan(0);
    expect(a.skills.length).toBeGreaterThan(1);
    expect(a.languages.length).toBeGreaterThan(0);
    expect(Object.keys(a.sectionTitles)).toEqual(expect.arrayContaining(["experience", "education", "skills", "languages"]));
    a.firstName = "Modifié";
    a.skills.push({ id: 9, name: "x" });
    const b = exempleCvNeutre();
    expect(b.firstName).toBe("Prénom");
    expect(b.skills).toHaveLength(2);
  });
});

test.describe("garde-fou avant télécharger, payer, imprimer", () => {
  test("refuse l'ancien exemple (nom dans les deux ordres, accents, casse ; téléphone sous toutes ses formes) et le nouvel exemple", async () => {
    const { identiteAEcrire } = await charger();
    const cv = (firstName, lastName, phone = "") => ({ firstName, lastName, phone });
    expect(identiteAEcrire(cv("Macoumba", "Samake", "+221 77 123 45 67"))).toBe(true);
    expect(identiteAEcrire(cv("MACOUMBA", " samaké ", ""))).toBe(true);
    expect(identiteAEcrire(cv("Samake", "Macoumba"))).toBe(true);
    expect(identiteAEcrire(cv("Prénom", "NOM", "+221 77 123 45 67"))).toBe(true);
    for (const tel of ["+221 77 140 08 32", "771400832", "77 140 08 32", "00221771400832", "+221-77-140-08-32"]) {
      expect(identiteAEcrire(cv("Awa", "Ndiaye", tel)), tel).toBe(true);
    }
    expect(identiteAEcrire(cv("Awa", "Ndiaye", "+221 77 000 00 00"))).toBe(true);
  });
  test("refuse un nom vide ; accepte une vraie identité, même sans téléphone ou avec un prénom proche", async () => {
    const { identiteAEcrire } = await charger();
    const cv = (firstName, lastName, phone = "") => ({ firstName, lastName, phone });
    expect(identiteAEcrire(cv("", ""))).toBe(true);
    expect(identiteAEcrire(cv("  ", ""))).toBe(true);
    expect(identiteAEcrire(null)).toBe(true);
    expect(identiteAEcrire(cv("Awa", "Ndiaye", "+221 77 123 45 67"))).toBe(false);
    expect(identiteAEcrire(cv("Awa", "Ndiaye", ""))).toBe(false); // le téléphone n'est pas obligatoire
    expect(identiteAEcrire(cv("Macoumba", "Diop", "+221 77 123 45 67"))).toBe(false); // seul le couple exact est refusé
    expect(identiteAEcrire(cv("Fatou", "Samake", "+221 70 000 00 01"))).toBe(false);
    expect(identiteAEcrire(cv("Awa", "Ndiaye", "1234"))).toBe(false); // numéro court : pas un téléphone d'exemple
  });
  test("le message est exactement « Écrivez vos informations avant de continuer. »", async () => {
    const { MESSAGE_ECRIVEZ_VOS_INFORMATIONS } = await charger();
    expect(MESSAGE_ECRIVEZ_VOS_INFORMATIONS).toBe("Écrivez vos informations avant de continuer.");
  });
});

test.describe("page du créateur", () => {
  const page = lire("src/app/creer-cv/page.js");
  test("plus aucune identité réelle dans la page (exemple, valeurs de secours d'un modèle, indications des champs)", () => {
    for (const motif of ANCIENNE_IDENTITE) expect(page, String(motif)).not.toMatch(motif);
  });
  test("l'exemple de départ vient de exempleCvNeutre ; le garde-fou couvre l'enregistrement avant paiement, le téléchargement et l'impression (les deux boutons)", () => {
    expect(page).toContain("useState(exempleCvNeutre)");
    expect(page).toMatch(/const saveCvDraftAndOpenPricing = async \(\) => \{\s*if \(!identiteOk\(\)\) return;/);
    expect(page).toMatch(/const handleDownloadPdf = async \(\) => \{\s*if \(!identiteOk\(\)\) return;/);
    expect(page).toContain("const imprimerCv = () => {\n    if (identiteOk()) window.print();");
    expect(page.match(/onClick=\{imprimerCv\}/g)).toHaveLength(2);
    expect(page.match(/window\.print\(\)/g)).toHaveLength(1); // seulement dans imprimerCv
    expect(page).toContain("triggerToast(MESSAGE_ECRIVEZ_VOS_INFORMATIONS");
  });
  test("un modèle n'affiche plus de téléphone ni d'e-mail de secours quand la personne les efface", () => {
    expect(page).toContain("<p>{cvData.phone}</p>");
    expect(page).toContain("<p>{cvData.email}</p>");
  });
});
