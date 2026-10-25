const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Mettre mon profil à jour avec ce CV » : les CV déjà enregistrés sur Facilité (créés sur le site ou importés) servent à remplir les rubriques du profil,
 * par la même relecture et les mêmes deux gros boutons que le scanner. L'exemple du créateur de CV est écarté. Contenus ci-dessous : forme réelle, données inventées.
 */
const logique = () => import("../../mobile/src/lib/mesCvLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

// Forme réelle d'un CV créé sur le site (clés relevées en base), valeurs inventées.
const CV_CREE = {
  firstName: "Awa", lastName: "Ndiaye", jobTitle: "Comptable", email: "awa@exemple.sn", phone: "+221 77 000 00 00", city: "Dakar", profile: "Comptable rigoureuse.",
  experiences: [
    { id: 1, title: "Comptable", employer: "Société Sénégalaise", city: "Dakar", startDate: "Jan 2021", endDate: "Déc 2023", current: false, description: "…" },
    { id: 2, title: "Chef comptable", employer: "ACME", city: "Thiès", startDate: "Jan 2024", endDate: "", current: true, description: "…" },
  ],
  educations: [{ id: 1, school: "UCAD", degree: "Licence en gestion", city: "Dakar", startDate: "2017", endDate: "2020", current: false, description: "" }],
  skills: [{ id: 1, name: "Excel", level: "Avancé" }, { id: 2, name: "Paie", level: "Bon" }],
  itSkills: [{ id: 1, name: "Sage" }], qualities: ["Rigueur"], hobbies: [{ id: 1, name: "Lecture" }],
  languages: [{ id: 1, name: "Wolof", level: "Courant" }, { id: 2, name: "Français", level: "Courant" }],
};
const EXEMPLE_CREATEUR = {
  firstName: "Macoumba", lastName: "Samake", experiences: [{ title: "ENTREPRENEURE", employer: "AZMA Collection" }], skills: [{ name: "Gestion des stocks et inventaires" }], educations: [{ school: "X", degree: "Y" }], languages: [{ name: "Français", level: "Courant" }],
};
const EXEMPLE_TESTS = { firstName: "", lastName: "", experiences: [{ title: "Conseiller Clientèle", employer: "X" }], skills: [{ name: "Gestion de la relation client" }], educations: [{ school: "X", degree: "Y" }], languages: [{ name: "Français", level: "" }] };
// Forme réelle de la réponse d'analyse d'un CV importé (extractedFields).
const CV_IMPORTE = {
  analyzedAt: "2026-10-01T10:00:00Z",
  extractedFields: {
    etat_civil: { nom: "Moussa Kane", titre_professionnel: "Électricien" }, contacts: { telephone: "+221 77 111 11 11", email: "m@exemple.sn", localisation: "Pikine" },
    profil_professionnel: "Électricien bâtiment.", langues: { detail: ["Wolof - Courant", "Français : Bon"] }, centres_d_interet: ["Football"],
    formations: [{ diplome: "CAP Électricité", etablissement: "Lycée technique", dates: "2014 - 2016", domaine: "Électricité", lieu: "Dakar" }],
    experiences_professionnelles: [{ poste: "Électricien", entreprise: "BTP SA", dates: "Mars 2019 - Présent", localisation: "Dakar", missions: [] }],
    competences_cles_hard_skills: ["Câblage"], competences_informatiques: { detail: ["AutoCAD"] }, qualites_personnelles: ["Ponctuel"],
  },
};

test.describe("CV d'exemple du créateur : jamais proposés", () => {
  test("l'exemple d'ouverture du créateur et celui des tests automatiques sont reconnus ; un vrai CV n'est pas écarté", async () => {
    const { estCvExemple } = await logique();
    expect(estCvExemple(EXEMPLE_CREATEUR)).toBe(true);
    expect(estCvExemple(EXEMPLE_TESTS)).toBe(true);
    expect(estCvExemple(CV_CREE)).toBe(false);
    // un seul repère ne suffit pas : prénom identique mais autre poste ou autre employeur
    expect(estCvExemple({ ...EXEMPLE_CREATEUR, experiences: [{ title: "Gérante", employer: "AZMA Collection" }] })).toBe(false);
    expect(estCvExemple({ ...EXEMPLE_CREATEUR, firstName: "Fatou" })).toBe(false);
    expect(estCvExemple({ experiences: [{ title: "Conseiller Clientèle" }], skills: [{ name: "Excel" }] })).toBe(false);
    // les CV des tests automatiques sont enregistrés avec l'accent mal encodé : reconnus quand même
    expect(estCvExemple({ ...EXEMPLE_TESTS, experiences: [{ title: "Conseiller ClientÃ¨le", employer: "X" }] })).toBe(true);
    for (const v of [null, undefined, "x", 5, []]) expect(estCvExemple(v)).toBe(false);
  });
});

test.describe("lecture d'un CV créé sur le site", () => {
  test("identité, langues, expériences (années de début et de fin, poste actuel), formation, compétences + informatique + qualités, loisirs", async () => {
    const { cvUtilisable } = await logique();
    const r = cvUtilisable({ id: "a", title: "CV", type: "created", created_at: null, content: CV_CREE });
    expect(r.ok).toBe(true);
    const d = r.donnees;
    expect(d).toMatchObject({ fullName: "Awa Ndiaye", headline: "Comptable", city: "Dakar", bio: "Comptable rigoureuse." });
    expect(d.languages).toEqual([{ name: "Wolof", level: "Courant" }, { name: "Français", level: "Courant" }]);
    expect(d.experiences[0]).toMatchObject({ title: "Comptable", company: "Société Sénégalaise", location: "Dakar", startYear: "2021", endYear: "2023", isCurrent: false });
    expect(d.experiences[1]).toMatchObject({ title: "Chef comptable", startYear: "2024", endYear: undefined, isCurrent: true });
    expect(d.educations[0]).toMatchObject({ school: "UCAD", degree: "Licence en gestion", startYear: "2017", endYear: "2020" });
    expect(d.skills).toEqual(["Excel", "Paie", "Sage", "Rigueur"]);
    expect(d.interests).toEqual(["Lecture"]);
  });
  test("un CV créé vide, ou seulement l'exemple, n'est pas utilisable", async () => {
    const { cvUtilisable } = await logique();
    expect(cvUtilisable({ id: "b", title: "x", type: "created", created_at: null, content: { firstName: "A", experiences: [], educations: [], skills: [], languages: [] } })).toEqual({ ok: false, raison: "vide" });
    expect(cvUtilisable({ id: "c", title: "x", type: "created", created_at: null, content: EXEMPLE_CREATEUR })).toEqual({ ok: false, raison: "exemple" });
    expect(cvUtilisable({ id: "d", title: "x", type: "created", created_at: null, content: null })).toEqual({ ok: false, raison: "vide" });
  });
});

test.describe("lecture d'un CV importé (réutilise le lecteur du scanner)", () => {
  test("mêmes champs que l'analyse : langues, formation, expérience en cours, compétences, centres d'intérêt", async () => {
    const { cvUtilisable } = await logique();
    const r = cvUtilisable({ id: "e", title: "CV.pdf", type: "imported", created_at: null, content: CV_IMPORTE });
    expect(r.ok).toBe(true);
    const d = r.donnees;
    expect(d.fullName).toBe("Moussa Kane");
    expect(d.languages.map((l) => l.name)).toEqual(["Wolof", "Français"]);
    expect(d.educations[0]).toMatchObject({ school: "Lycée technique", degree: "CAP Électricité", startYear: "2014", endYear: "2016" });
    expect(d.experiences[0]).toMatchObject({ title: "Électricien", startYear: "2019", isCurrent: true });
    expect(d.skills).toEqual(["Câblage", "AutoCAD", "Ponctuel"]);
    expect(d.interests).toEqual(["Football"]);
  });
  test("importé sans analyse, autre type de document : non utilisable", async () => {
    const { cvUtilisable } = await logique();
    expect(cvUtilisable({ id: "f", title: "x", type: "imported", created_at: null, content: { fileName: "a.pdf" } })).toEqual({ ok: false, raison: "vide" });
    expect(cvUtilisable({ id: "g", title: "x", type: "CV", created_at: null, content: { fileName: "a.pdf" } })).toEqual({ ok: false, raison: "type" });
    expect(cvUtilisable({ id: "h", title: "x", type: "Lettre de motivation", created_at: null, content: {} })).toEqual({ ok: false, raison: "type" });
  });
  test("résumé du contenu en phrases courtes", async () => {
    const { resumeContenuCv, libelleTypeCv } = await logique();
    expect(resumeContenuCv({ languages: [1, 2], experiences: [1], educations: [], skills: [1, 2, 3], interests: [] })).toBe("2 langues · 1 expérience · 3 compétences");
    expect(libelleTypeCv("created")).toBe("CV créé sur Facilité");
    expect(libelleTypeCv("imported")).toBe("CV importé");
  });
});

test.describe("parcours dans l'application", () => {
  test("liste « Mes CV » : un gros bouton « Mettre mon profil à jour avec ce CV » par CV, uniquement les CV de la personne, exemples écartés", () => {
    const s = lire("mobile/src/app/mon-profil/choisir-cv.tsx");
    expect(s).toContain("Mettre mon profil à jour avec ce CV");
    expect(s).toContain("minHeight: 56");
    expect(s).toContain("cvUtilisable(cv)");
    expect(s).toContain("Les CV qui ne contiennent que l&apos;exemple du créateur ne sont pas proposés.");
    expect(s).toContain("Créer ou importer mon CV");
    const lib = lire("mobile/src/lib/mesCv.ts");
    expect(lib).toContain(".eq('user_id', userId)");
    expect(lib).toContain(".in('type', ['created', 'imported'])");
    expect(lib).not.toMatch(/\.(insert|update|delete|upsert)\(/);
  });
  test("le CV choisi passe par la MÊME relecture et les mêmes deux gros boutons que le scanner ; rien n'est écrit avant", () => {
    const sc = lire("mobile/src/app/mon-profil/scanner-document.tsx");
    expect(sc).toContain("depuis === 'mes-cv' ? lireCvChoisi() : null");
    expect(sc).toContain("{ phase: 'revue', donnees: choisi }");
    expect(sc).toContain("Utiliser un CV déjà sur Facilité");
    expect(sc).toContain("/mon-profil/choisir-cv");
    expect(sc).toContain("memoriserCvChoisi(null);"); // vidé une fois le CV enregistré
    expect(lire("mobile/src/app/mon-profil/choisir-cv.tsx")).toContain("/mon-profil/scanner-document?depuis=mes-cv");
  });
  test("le lecteur du scanner n'est pas dupliqué : il est partagé (scanLogique.ts) entre l'analyse d'un fichier et les CV importés", () => {
    expect(lire("mobile/src/lib/scanLogique.ts")).toContain("export function mapperChampsExtraits(");
    expect(lire("mobile/src/lib/scanDocument.ts")).not.toContain("function mapperChampsExtraits");
    expect(lire("mobile/src/lib/mesCvLogique.ts")).toContain("mapperChampsExtraits(champs)");
  });
});
