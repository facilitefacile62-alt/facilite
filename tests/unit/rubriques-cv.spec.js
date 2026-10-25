const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Rubriques du CV (langues, expériences, formation, compétences, centres d'intérêt) — option A du 25/10/2026 : source = CV scanné ou importé,
 * lecture seule ; un nouveau CV ne remplace jamais en silence (écran de confirmation à deux gros boutons) ; l'ancienne version reste récupérable ;
 * sans CV : une phrase et un seul bouton.
 */
const logique = () => import("../../mobile/src/lib/rubriquesCvLogique.ts");
const scan = () => import("../../mobile/src/lib/scanLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const PAR_DEFAUT = {
  languages: [{ name: "Français", level: "Principal / Courant" }],
  skills: ["Gestion de projet", "Développement Web", "Stratégie Digitale"],
};

test.describe("valeurs d'exemple de la base : jamais traitées comme des données de la personne", () => {
  test("langue et compétences par défaut, lignes vides : tout est vide", async () => {
    const { rubriquesReelles, rubriquesVides } = await logique();
    expect(rubriquesVides(rubriquesReelles({ ...PAR_DEFAUT, experiences: [], educations: [], interests: [] }))).toBe(true);
    expect(rubriquesVides(rubriquesReelles({ languages: [{ name: "", level: "" }], skills: [] }))).toBe(true);
    expect(rubriquesVides(rubriquesReelles(null))).toBe(true);
    expect(rubriquesVides(rubriquesReelles({ languages: "n'importe quoi", experiences: { a: 1 } }))).toBe(true);
  });
  test("dès qu'une vraie donnée existe, rien n'est masqué ; une vraie langue accompagnée du Français par défaut est gardée", async () => {
    const { rubriquesReelles, rubriquesVides } = await logique();
    const r = rubriquesReelles({ languages: [{ name: "Wolof", level: "Courant" }], skills: ["Excel"], experiences: [{ title: "Comptable" }] });
    expect(r.languages).toHaveLength(1);
    expect(r.skills).toEqual(["Excel"]);
    expect(rubriquesVides(r)).toBe(false);
    // le Français seul mais avec un autre niveau est une vraie saisie
    expect(rubriquesReelles({ languages: [{ name: "Français", level: "Courant" }] }).languages).toHaveLength(1);
    // les compétences d'exemple mélangées à de vraies compétences ne sont pas retirées une à une
    expect(rubriquesReelles({ skills: [...PAR_DEFAUT.skills, "Excel"] }).skills).toHaveLength(4);
  });
});

test.describe("écran de confirmation : ce qui change, en phrases courtes", () => {
  test("une ligne par rubrique : avant → après, ajoutée, ou gardée si le CV n'en contient pas", async () => {
    const { changements, rubriquesReelles } = await logique();
    const avant = rubriquesReelles({ languages: [{ name: "Wolof", level: "" }, { name: "Anglais", level: "" }], skills: ["Excel"] });
    const apres = { languages: [{ name: "Wolof" }], experiences: [{ title: "A" }, { title: "B" }], educations: [], skills: [], interests: [] };
    const c = Object.fromEntries(changements(avant, apres).map((x) => [x.cle, x]));
    expect(c.languages.texte).toBe("Langues : 2 → 1");
    expect(c.experiences.texte).toBe("Expériences : 2 expériences ajoutées");
    expect(c.skills.gardee).toBe(true);
    expect(c.skills.texte).toBe("Compétences : le CV n'en contient pas, les vôtres sont gardées");
    expect(c.educations.gardee).toBe(true);
  });
  test("compte au singulier et au pluriel ; date « 25 octobre 2026 à 14:32 »", async () => {
    const { texteCompte, dateHeureFr, resumeVersion } = await logique();
    expect(texteCompte(1, "langue", "langues")).toBe("1 langue");
    expect(texteCompte(3, "langue", "langues")).toBe("3 langues");
    expect(texteCompte(0, "formation", "formations")).toBe("aucune formation");
    expect(dateHeureFr("2026-10-25T14:32:00")).toBe("25 octobre 2026 à 14:32");
    expect(dateHeureFr("pas une date")).toBe("");
    expect(resumeVersion({ languages: [1, 2, 3], experiences: [1], educations: [], skills: [], interests: [] })).toBe("3 langues · 1 expérience");
    expect(resumeVersion({ languages: [], experiences: [], educations: [], skills: [], interests: [] })).toBe("Aucune information");
  });
  test("lecture d'une ancienne version : ligne illisible ignorée", async () => {
    const { lireVersionCv } = await logique();
    const v = lireVersionCv({ id: "x", created_at: "2026-10-25T10:00:00Z", motif: "avant_scan", languages: [{ name: "A" }], experiences: null });
    expect(v.languages).toHaveLength(1);
    expect(v.experiences).toEqual([]);
    expect(lireVersionCv({ id: "x" })).toBeNull();
    expect(lireVersionCv(null)).toBeNull();
  });
});

test.describe("lecture de l'analyse du CV", () => {
  test("années d'une période : « Sept. 2018 - Juin 2021 », « 2021 » seul, « 2023 - Présent », rien", async () => {
    const { anneesDeDates } = await scan();
    expect(anneesDeDates("Septembre 2018 - Juin 2021")).toEqual({ debut: "2018", fin: "2021", enCours: false });
    expect(anneesDeDates("2021")).toEqual({ fin: "2021", enCours: false });
    expect(anneesDeDates("Depuis 2021")).toEqual({ debut: "2021", enCours: false });
    expect(anneesDeDates("Janvier 2023 - Présent")).toEqual({ debut: "2023", fin: undefined, enCours: true });
    expect(anneesDeDates("")).toEqual({ enCours: false });
  });
  test("listes de textes : tableau ou { detail }, sans vide ni doublon, longueur bornée", async () => {
    const { listeDeTextes } = await scan();
    expect(listeDeTextes(["Excel", " excel ", "", "Word", 5, null])).toEqual(["Excel", "Word"]);
    expect(listeDeTextes({ detail: ["Photoshop", "Photoshop"] })).toEqual(["Photoshop"]);
    expect(listeDeTextes(undefined)).toEqual([]);
    expect(listeDeTextes("pas une liste")).toEqual([]);
    expect(listeDeTextes(Array.from({ length: 100 }, (_, i) => `c${i}`))).toHaveLength(60);
    expect(listeDeTextes(["x".repeat(201)])).toEqual([]);
  });
  test("le scanner lit les formations, les compétences et les centres d'intérêt de la réponse du serveur", () => {
    const s = lire("mobile/src/lib/scanLogique.ts");
    for (const t of ["fields.formations", "competences_cles_hard_skills", "competences_informatiques", "qualites_personnelles", "centres_d_interet"]) expect(s).toContain(t);
  });
});

test.describe("remplacement jamais silencieux", () => {
  const scanner = lire("mobile/src/app/mon-profil/scanner-document.tsx");
  test("si la personne a déjà des rubriques réelles : écran de confirmation avant d'enregistrer ; sinon enregistrement direct", () => {
    expect(scanner).toMatch(/function confirmerEcrasement[\s\S]{0,200}rubriquesVides\(rubriquesReelles\(profile\)\)[\s\S]{0,120}enregistrerRevue\(donnees\);[\s\S]{0,60}return;[\s\S]{0,80}phase: 'confirmation'/);
    expect(scanner).toContain('question="Remplacer mes informations par celles de ce CV ?"');
    expect(scanner).toContain('oui="Oui, remplacer"');
    expect(scanner).toContain('non="Non, garder les miennes"');
  });
  test("« Non » revient à la revue sans rien écrire ; « Oui » passe par le serveur qui sauvegarde d'abord l'ancienne version", () => {
    expect(scanner).toContain("onNon={() => setEtat({ phase: 'revue', donnees: etat.donnees })}");
    expect(scanner).toContain("onOui={() => enregistrerRevue(etat.donnees)}");
    expect(scanner).toContain("await appliquerRubriquesCv(rubriquesDeLaRevue(donnees))");
    // plus aucune écriture directe des cinq colonnes depuis le scanner
    expect(scanner).not.toMatch(/languages:\s*donnees|experiences:\s*donnees\.experiences\.length/);
    const lib = lire("mobile/src/lib/rubriquesCv.ts");
    expect(lib).toContain("supabase.rpc('appliquer_rubriques_cv'");
    expect(lib).toContain("supabase.rpc('restaurer_version_cv'");
    expect(lib).not.toMatch(/\.from\('profiles'\)\s*\.update/);
  });
  test("la confirmation et la récupération ont deux GROS boutons (64 px au moins), « oui » vert et « non » blanc", () => {
    const c = lire("mobile/src/components/GrosBoutonsChoix.tsx");
    expect(c.match(/minHeight: 64/g)).toHaveLength(2);
    expect(c).toContain("backgroundColor: '#10B981'");
    const v = lire("mobile/src/app/mon-profil/versions-cv.tsx");
    expect(v).toContain('question="Revenir à cette version ?"');
    expect(v).toContain("restaurerVersionCv(choisie.id)");
    expect(v).toContain("Vos informations actuelles seront gardées dans la liste.");
  });
  test("pas encore de CV : « Créer ou importer mon CV » ; le scanner propose « Je n'ai pas de CV : en créer un »", () => {
    const e = lire("mobile/src/components/EcranRubriqueCv.tsx");
    expect(e.match(/Créer ou importer mon CV/g)).toHaveLength(1);
    expect(e).toContain("Vous n&apos;avez pas encore de CV.");
    expect(scanner).toContain("Je n&apos;ai pas de CV : en créer un");
  });
});

test.describe("les cinq rubriques sont en lecture seule", () => {
  const ecrans = {
    langues: lire("mobile/src/app/mon-profil/langues.tsx"),
    experiences: lire("mobile/src/app/mon-profil/experiences.tsx"),
    formation: lire("mobile/src/app/mon-profil/formation.tsx"),
    etiquettes: lire("mobile/src/components/EcranEtiquettes.tsx"),
    competences: lire("mobile/src/app/mon-profil/competences.tsx"),
    interets: lire("mobile/src/app/mon-profil/centres-interet.tsx"),
  };
  test("aucun ajout, aucune suppression, aucune écriture dans ces écrans", () => {
    for (const [nom, src] of Object.entries(ecrans)) {
      expect(src, nom).not.toMatch(/Modal|TextInput|CarteAjouter|supprimer|Supprimer|enregistrerChampsProfil|\.update\(|Ajouter une|Ajouter un/);
      expect(src, nom).not.toContain("trash-outline");
    }
  });
  test("chaque écran passe par rubriquesReelles : les valeurs d'exemple de la base ne s'affichent jamais", () => {
    for (const nom of ["langues", "experiences", "formation", "etiquettes"]) expect(ecrans[nom], nom).toContain("rubriquesReelles(profile)");
    expect(ecrans.competences).toContain('champ="skills"');
    expect(ecrans.interets).toContain('champ="interests"');
  });
  test("le composant commun : note « Ces informations viennent de votre CV. », mise à jour par un nouveau CV, lien vers les anciennes versions", () => {
    const e = lire("mobile/src/components/EcranRubriqueCv.tsx");
    for (const t of ["Ces informations viennent de votre CV.", "Mettre à jour avec un nouveau CV", "Retrouver une ancienne version", "/mon-profil/versions-cv", "/mon-profil/scanner-document"]) expect(e).toContain(t);
  });
});

test.describe("base de données : migration additive et sûre", () => {
  const sql = lire("supabase/migrations/20261025140000_profil_cv_versions.sql").replace(/--.*$/gm, "");
  test("table des versions en lecture seule pour la personne ; fonctions réservées aux comptes connectés ; une seule colonne ajoutée", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT SELECT ON public.profil_cv_versions TO authenticated;");
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE)[^;]*profil_cv_versions/i);
    expect(sql).toContain("USING (auth.uid() = user_id)");
    expect(sql.match(/SET search_path = ''/g).length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.appliquer_rubriques_cv");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.restaurer_version_cv");
    expect(sql.match(/ADD COLUMN/g)).toHaveLength(1);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);
    expect(fs.existsSync(path.join(__dirname, "../../docs/rollbacks/20261025140000_profil_cv_versions.down.sql"))).toBe(true);
  });
  test("la sauvegarde précède l'écriture, la restauration vérifie que la version est celle de la personne, 10 versions gardées", () => {
    const appliquer = sql.slice(sql.indexOf("FUNCTION public.appliquer_rubriques_cv"));
    expect(appliquer.indexOf("INSERT INTO public.profil_cv_versions")).toBeLessThan(appliquer.indexOf("UPDATE public.profiles"));
    expect(sql).toContain("WHERE id = p_version_id AND user_id = v_moi");
    expect(sql).toContain("LIMIT 10");
  });
});
