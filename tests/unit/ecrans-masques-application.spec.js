const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Application (première version Android) : fonctions MASQUÉES derrière des interrupteurs propres à l'application (fermés par défaut, illisible = caché, administrateur
 * voit tout) : scanner de document, extracteur, « Fonctionnalités », Diagnostic CV, Boîte à idées, Création de CV, Modèles de CV. Rien n'est supprimé.
 */
const ecrans = () => import("../../mobile/src/lib/ecransMasquesLogique.ts");
const flags = () => import("../../mobile/src/lib/featureFlagsLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

const NOUVEAUX = ["feat_scanner_document", "feat_app_extracteur", "feat_app_fonctionnalites", "feat_app_diagnostic_cv", "feat_app_boite_idees", "feat_app_creer_cv", "feat_app_modeles_cv"];

test.describe("interrupteurs", () => {
  test("les sept nouveaux interrupteurs sont fermés par défaut (donc cachés si illisibles) sauf pour l'administrateur", async () => {
    const { PAR_DEFAUT, fonctionnaliteAutorisee } = await flags();
    for (const id of NOUVEAUX) {
      expect(PAR_DEFAUT[id]?.enabled, id).toBe(false);
      for (const role of ["user", "recruiter", "visitor"]) expect(fonctionnaliteAutorisee(id, role, PAR_DEFAUT), `${id}/${role}`).toBe(false);
      expect(fonctionnaliteAutorisee(id, "admin", PAR_DEFAUT), id).toBe(true);
    }
  });
});

test.describe("écrans masqués : atteignables seulement si tous leurs interrupteurs sont ouverts", () => {
  const CIBLES = [
    ["/extracteur", {}, "feat_app_extracteur"],
    ["/fonctionnalites", {}, "feat_app_fonctionnalites"],
    ["/web/fonctionnalites", { outil: "compresser-pdf" }, "feat_app_fonctionnalites"],
    ["/web/creer-cv", {}, "feat_app_creer_cv"],
    ["/web/modeles", { aide: "services_modeles" }, "feat_app_modeles_cv"],
    ["/web/boite-a-idees", {}, "feat_app_boite_idees"],
    ["/web/importer-cv", { aide: "diagnostic_cv" }, "feat_app_diagnostic_cv"],
  ];
  test("chaque écran masqué est refusé par défaut (lien profond, notification, bouton) et accessible à l'administrateur", async () => {
    const { interrupteursEcran } = await ecrans();
    const { PAR_DEFAUT, tousAutorises } = await flags();
    for (const [chemin, params, interrupteur] of CIBLES) {
      const requis = interrupteursEcran(chemin, params);
      expect(requis, chemin).toContain(interrupteur);
      for (const role of ["user", "visitor", "recruiter"]) expect(tousAutorises(requis, role, PAR_DEFAUT), `${chemin}/${role}`).toBe(false);
      expect(tousAutorises(requis, "admin", PAR_DEFAUT), chemin).toBe(true);
      // ouvert côté serveur (les deux interrupteurs) : accessible
      const ouvert = Object.fromEntries(requis.map((id) => [id, { enabled: true, roles: { user: true } }]));
      expect(tousAutorises(requis, "user", { ...PAR_DEFAUT, ...ouvert }), chemin).toBe(true);
    }
  });
  test("une sous-page d'un écran masqué l'est aussi ; les chemins voisins ne le sont pas", async () => {
    const { interrupteursEcran } = await ecrans();
    expect(interrupteursEcran("/extracteur/resultat")).toContain("feat_app_extracteur");
    expect(interrupteursEcran("/extracteurs")).toEqual([]);
    expect(interrupteursEcran("/web/creer-cv-bis")).toEqual([]);
  });
  test("Import de CV (sans l'entrée « diagnostic ») reste accessible : seule l'entrée diagnostic est masquée", async () => {
    const { interrupteursEcran } = await ecrans();
    expect(interrupteursEcran("/web/importer-cv", {})).toEqual([]);
    expect(interrupteursEcran("/web/importer-cv", { aide: "autre" })).toEqual([]);
  });
  test("les interrupteurs partagés avec le site doivent AUSSI être ouverts (extracteur, Fonctionnalités, Diagnostic, Boîte à idées), sans qu'on les modifie", async () => {
    const { interrupteursEcran } = await ecrans();
    expect(interrupteursEcran("/extracteur")).toEqual(["nav_extracteur", "feat_app_extracteur"]);
    expect(interrupteursEcran("/fonctionnalites")).toEqual(["nav_plus_fonctionnalites", "feat_app_fonctionnalites"]);
    expect(interrupteursEcran("/web/importer-cv", { aide: "diagnostic_cv" })).toEqual(["feat_diagnostic_cv", "feat_app_diagnostic_cv"]);
    expect(interrupteursEcran("/web/boite-a-idees")).toEqual(["nav_plus_boite_idees", "feat_app_boite_idees"]);
  });
  test("restent accessibles quand tout est masqué : messages de Locaux, profil, Informations du compte, Paramètres, Locaux, accueil, offres", async () => {
    const { interrupteursEcran } = await ecrans();
    for (const chemin of [
      "/", "/offres", "/autour", "/messages", "/profil", "/menu", "/marketplace", "/marketplace/messages", "/marketplace/chat/abc", "/marketplace/mon-profil",
      "/marketplace/informations-compte", "/marketplace/reglages", "/marketplace/vendre/annonces", "/marketplace/vendre/ma-boutique", "/mon-profil/a-propos",
      "/mon-profil/parametres", "/mon-profil/informations-compte", "/mon-profil/securite", "/mon-profil/coordonnees", "/mon-profil/choisir-cv", "/mon-profil/scanner-document",
      "/candidature-spontanee", "/chat/abc", "/ecrire-email", "/web/faq", "/web/securite", "/web/suppression-compte", "/document",
    ]) expect(interrupteursEcran(chemin), chemin).toEqual([]);
  });
});

test.describe("pages du site ouvertes dans l'application", () => {
  test("un lien vers un outil masqué est refusé ; les autres liens du site restent libres", async () => {
    const { interrupteursPageSite } = await ecrans();
    const { PAR_DEFAUT, tousAutorises } = await flags();
    const masques = {
      "https://ffacilite.com/creer-cv": "feat_app_creer_cv",
      "https://ffacilite.com/creer-cv?template=moderne#x": "feat_app_creer_cv",
      "https://ffacilite.com/modeles": "feat_app_modeles_cv",
      "https://ffacilite.com/fonctionnalites": "feat_app_fonctionnalites",
      "https://ffacilite.com/boite-a-idees": "feat_app_boite_idees",
      "https://ffacilite.com/candidat/extracteur": "feat_app_extracteur",
    };
    for (const [url, id] of Object.entries(masques)) {
      const requis = interrupteursPageSite(url);
      expect(requis, url).toContain(id);
      expect(tousAutorises(requis, "user", PAR_DEFAUT), url).toBe(false);
      expect(tousAutorises(requis, "admin", PAR_DEFAUT), url).toBe(true);
    }
    for (const url of ["https://ffacilite.com/", "https://ffacilite.com/offres", "https://ffacilite.com/candidat/mes-cvs", "https://ffacilite.com/faq", "https://ffacilite.com/importer-cv", "https://ffacilite.com/creer-cvx"]) {
      expect(interrupteursPageSite(url), url).toEqual([]);
    }
  });
  test("web/[cle].tsx refuse ces liens (en plus des pages de paiement)", () => {
    expect(lire("mobile/src/lib/biensNumeriques.ts")).toContain("interrupteursPageSite(url)");
    expect(lire("mobile/src/app/web/[cle].tsx")).toContain("if (navigationBloquee(url)) return false;");
  });
});

test.describe("entrées masquées dans l'application (aucune ne reste visible)", () => {
  test("la garde globale est branchée à la racine (liens profonds, notifications, boutons)", () => {
    const l = lire("mobile/src/app/_layout.tsx");
    expect(l).toContain("useGardeEcransMasques();");
    const g = lire("mobile/src/lib/gardeEcransMasques.ts");
    expect(g).toContain("router.replace('/')");
    expect(g).toContain("interrupteursEcran(pathname, params)");
  });
  test("menu ☰ : tuiles Diagnostic CV, Fonctionnalités et Boîte à idées dépendent aussi de l'interrupteur de l'application", () => {
    const m = lire("mobile/src/app/menu.tsx");
    expect(m).toContain("interrupteur: ['feat_diagnostic_cv', 'feat_app_diagnostic_cv']");
    expect(m).toContain("interrupteur: ['nav_plus_fonctionnalites', 'feat_app_fonctionnalites']");
    expect(m).toContain("interrupteur: ['nav_plus_boite_idees', 'feat_app_boite_idees']");
  });
  test("bouton flottant : l'Extracteur dépend aussi de l'interrupteur de l'application ; l'assistant vocal reste derrière feat_voice_assistant", () => {
    const b = lire("mobile/src/components/BoutonFlottantFacilite.tsx");
    expect(b).toContain("interrupteur: ['nav_extracteur', 'feat_app_extracteur']");
    expect(b).toMatch(/id: 'assistant'[^\n]*interrupteur: 'feat_voice_assistant'/);
  });
  test("liste des outils : chaque entrée « IA » a ses interrupteurs ; l'écran et l'onglet du profil filtrent", () => {
    const o = lire("mobile/src/lib/outils.ts");
    expect(o).toContain("interrupteur: ['nav_extracteur', 'feat_app_extracteur'],");
    expect(o).toContain("interrupteur: ['nav_plus_boite_idees', 'feat_app_boite_idees'],");
    expect(o).toContain("interrupteur: ['feat_diagnostic_cv', 'feat_app_diagnostic_cv'],");
    expect(o).toContain("interrupteur: ['feat_app_modeles_cv'],");
    expect(lire("mobile/src/app/fonctionnalites.tsx")).toContain(".filter((o) => autorise(o.interrupteur))");
    expect(lire("mobile/src/app/(tabs)/profil.tsx")).toContain("OUTILS.filter((o) => autorise(o.interrupteur))");
  });
  test("profil de Facilité : onglet « Fonctionnalités » derrière son interrupteur, onglet « Documents » toujours là, aucun bouton « Locaux » ajouté", () => {
    const p = lire("mobile/src/app/(tabs)/profil.tsx");
    expect(p).toContain("...(fonctionnalitesOuvertes ? [{ id: 'fonctionnalites' as const");
    expect(p).toContain("{ id: 'documents' as const, label: 'Documents'");
    expect(p).not.toContain("allerLocaux");
    expect(p).not.toContain("{t('Locaux')}");
    expect(p).toContain("ongletDemande === 'fonctionnalites' && fonctionnalitesOuvertes");
    expect(p).toContain("onglet === 'fonctionnalites' && fonctionnalitesOuvertes");
  });
  test("scanner : photo, galerie et fichier (IA) masqués ; « Utiliser un CV déjà sur Facilité » reste ; le lien « créer un CV » suit feat_app_creer_cv", () => {
    const s = lire("mobile/src/app/mon-profil/scanner-document.tsx");
    const debutMasque = s.indexOf("{scanOuvert ? (");
    const finMasque = s.indexOf(") : null}", debutMasque);
    const masque = s.slice(debutMasque, finMasque);
    for (const f of ["prendrePhoto", "choisirPhoto", "choisirFichier"]) expect(masque, f).toContain(`onPress={${f}}`);
    expect(s.indexOf("Utiliser un CV déjà sur Facilité")).toBeLessThan(debutMasque); // hors du bloc masqué
    expect(s).toContain("{creerCvOuvert ? (");
    expect(s).toContain("const scanOuvert = useFonctionnalite('feat_scanner_document');");
  });
  test("entrées vers le scanner masquées : « Scanner » de Modifier infos, « Créer ou importer » (rubriques et Mes CV), « Ajouter un document » de l'onboarding, remplissage rapide de Locaux", () => {
    expect(lire("mobile/src/components/EnteteModifierInfos.tsx")).toMatch(/\{scanOuvert \? \(\s*<Pressable\s+onPress=\{\(\) => router\.push\('\/mon-profil\/scanner-document'\)\}/);
    expect(lire("mobile/src/components/EcranRubriqueCv.tsx").match(/\{scanOuvert \? \(/g).length).toBeGreaterThanOrEqual(1);
    expect(lire("mobile/src/components/EcranRubriqueCv.tsx")).toContain("scanOuvert ? SCANNER : ('/mon-profil/choisir-cv' as Href)");
    expect(lire("mobile/src/app/mon-profil/choisir-cv.tsx")).toMatch(/\{scanOuvert \? \(\s*<Pressable\s+onPress=\{\(\) => router\.replace\('\/mon-profil\/scanner-document'/);
    expect(lire("mobile/src/app/onboarding/document.tsx")).toContain("{scanOuvert ? (");
    const r = lire("mobile/src/components/RemplissageRapide.tsx");
    expect(r).toContain("return scanOuvert ? <RemplissageRapideContenu {...props} /> : null;");
  });
});
