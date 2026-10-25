const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Règle Apple 3.1.1 (biens numériques) : sur iOS, aucun écran de l'application ne montre un prix, un bouton d'achat ou un lien de paiement pour
 * les jetons, Premium, la formation. Android : mêmes écrans masqués tant que l'interrupteur serveur feat_paiements_application est fermé (fermé par défaut). Le site garde ses paiements.
 */
const logique = () => import("../../mobile/src/lib/biensNumeriquesLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("règle iOS pour les biens numériques", () => {
  test("achat autorisé hors iOS ET seulement si l'interrupteur est ouvert ; marqueur d'identité posé sur iOS seulement", async () => {
    const { achatNumeriqueAutorise, marqueurAgentUtilisateur, MARQUEUR_APP_IOS } = await logique();
    expect(achatNumeriqueAutorise("ios", true)).toBe(false);
    expect(achatNumeriqueAutorise("ios", false)).toBe(false);
    expect(achatNumeriqueAutorise("android", true)).toBe(true);
    expect(achatNumeriqueAutorise("android", false)).toBe(false); // interrupteur fermé (ou illisible) : aucun achat sur Android
    expect(achatNumeriqueAutorise("android", undefined)).toBe(false);
    expect(achatNumeriqueAutorise("android", "true")).toBe(false); // jamais une valeur « presque vraie »
    expect(marqueurAgentUtilisateur("ios")).toBe(MARQUEUR_APP_IOS);
    expect(marqueurAgentUtilisateur("android")).toBeUndefined();
  });

  test("pages de paiement du site (Premium, formation, facturation) bloquées sur iOS et sur Android tant que l'interrupteur est fermé ; les autres pages restent ouvertes", async () => {
    const { cleWebBloquee } = await logique();
    for (const cle of ["premium", "formations", "facturation"]) {
      expect(cleWebBloquee(cle, "ios", true)).toBe(true);
      expect(cleWebBloquee(cle, "android", false)).toBe(true);
      expect(cleWebBloquee(cle, "android", true)).toBe(false);
    }
    for (const cle of ["concours", "faq", "creer-cv", "profil", undefined]) {
      expect(cleWebBloquee(cle, "ios", false)).toBe(false);
      expect(cleWebBloquee(cle, "android", false)).toBe(false);
    }
  });

  test("un lien suivi dans une page du site ne mène pas à une page de paiement quand l'achat n'est pas autorisé", async () => {
    const { navigationWebBloquee, estCheminPaiement } = await logique();
    for (const url of ["https://ffacilite.com/premium", "https://ffacilite.com/premium?x=1#a", "https://ffacilite.com/formations/abc", "https://ffacilite.com/formation-redaction-cv", "https://ffacilite.com/candidat/facturation", "https://ffacilite.com/achat-cv/payer"]) {
      expect(estCheminPaiement(url), url).toBe(true);
      expect(navigationWebBloquee(url, "android", false), url).toBe(true);
      expect(navigationWebBloquee(url, "ios", true), url).toBe(true);
      expect(navigationWebBloquee(url, "android", true), url).toBe(false);
    }
    for (const url of ["https://ffacilite.com/", "https://ffacilite.com/offres", "https://ffacilite.com/candidat/mes-cvs", "https://ffacilite.com/premiumx", "https://ffacilite.com/faq?page=premium"]) {
      expect(navigationWebBloquee(url, "android", false), url).toBe(false);
    }
  });

  test("le message neutre ne contient ni prix, ni mot d'achat, ni lien", async () => {
    const { MESSAGE_ACHAT_INDISPONIBLE } = await logique();
    expect(MESSAGE_ACHAT_INDISPONIBLE).toBe("Cette fonction n'est pas disponible sur cet appareil.");
    expect(MESSAGE_ACHAT_INDISPONIBLE).not.toMatch(/FCFA|\d|achat|payer|prix|site|http|ailleurs/i);
    const composant = lire("mobile/src/components/IndisponibleNeutre.tsx");
    expect(composant).not.toMatch(/FCFA|Linking|openURL|http|Acheter|Payer|MAXIT|Orange/);
  });

  test("écran de facturation (jetons, Premium) : message neutre sur iOS ; bouton « Page de facturation » masqué sur iOS", () => {
    const f = lire("mobile/src/app/marketplace/vendre/facturation.tsx");
    expect(f).toContain("achatsNumeriquesAutorises ? <FacturationContenu /> : <IndisponibleNeutre");
    const m = lire("mobile/src/app/marketplace/vendre/ma-boutique.tsx");
    expect(m).toMatch(/\{achatsNumeriquesAutorises \? \(\s*<View className="px-4 mt-3">\s*<BoutonAction\s+titre="Page de facturation"/);
  });

  test("menu : la tuile « Formation » (page payante) est masquée sur iOS, les autres tuiles ne changent pas", () => {
    const s = lire("mobile/src/app/menu.tsx");
    expect(s).toMatch(/id: 'formation'[^\n]*paiementNumerique: true/);
    expect(s.match(/paiementNumerique: true/g)).toHaveLength(1);
    expect(s).toContain("(achatsNumeriquesAutorises || !tu.paiementNumerique)");
  });

  test("pages du site dans l'application : Premium et formation bloquées sur iOS, marqueur dans l'identité du navigateur pour le reste", () => {
    const s = lire("mobile/src/app/web/[cle].tsx");
    expect(s).toContain("if (pageBloquee) return <IndisponibleNeutre />;");
    expect(s).toContain("const pageBloquee = usePageWebBloquee(cle);");
    expect(s).toContain("if (navigationBloquee(url)) return false;"); // aucun lien vers une page de paiement
    expect(s).toContain("applicationNameForUserAgent={agentUtilisateurApp}");
    const lib = lire("mobile/src/lib/biensNumeriques.ts");
    expect(lib).toContain("Platform.OS");
    expect(lib).toContain("useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS)");
  });
});

test.describe("interrupteur feat_paiements_application", () => {
  test("fermé par défaut dans l'application (aussi tant que la table est illisible)", () => {
    expect(lire("mobile/src/lib/featureFlagsLogique.ts")).toContain("feat_paiements_application: coupe(),");
  });
  test("tous les écrans de paiement lisent l'interrupteur par le même hook (aucun écran ne garde l'ancienne constante)", () => {
    for (const f of ["mobile/src/app/(tabs)/profil.tsx", "mobile/src/app/menu.tsx", "mobile/src/app/marketplace/vendre/facturation.tsx", "mobile/src/app/marketplace/vendre/ma-boutique.tsx", "mobile/src/app/mon-profil/achat-cv-apercu.tsx", "mobile/src/app/mon-profil/achat-cv-payer.tsx"]) {
      const t = lire(f);
      expect(t, f).toContain("const achatsNumeriquesAutorises = usePaiementsAutorises();");
      expect(t, f).not.toMatch(/import \{ achatsNumeriquesAutorises \}/);
    }
    expect(lire("mobile/src/lib/biensNumeriques.ts")).not.toContain("export const achatsNumeriquesAutorises");
  });
  test("migration : onze lignes fermées propres à l'application, retour arrière présent, rien d'autre ; les interrupteurs partagés avec le site ne sont pas touchés", () => {
    const IDS = [
      "feat_paiements_application", "feat_scanner_document", "feat_app_extracteur", "feat_app_fonctionnalites", "feat_app_diagnostic_cv", "feat_app_boite_idees",
      "feat_app_creer_cv", "feat_app_modeles_cv", "feat_app_inscription", "feat_app_mot_de_passe_oublie", "feat_app_connexion_sans_mot_de_passe",
    ];
    const m = lire("supabase/migrations/20261026100000_interrupteurs_application_play_store.sql");
    const sql = m.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const id of IDS) expect(sql).toMatch(new RegExp(`\\('${id}', 'branch_candidat', '[^\\n]+', NULL, FALSE, '\\{"user": true, "visitor": true, "recruiter": true\\}'::jsonb\\)`));
    expect(sql.match(/FALSE/g)).toHaveLength(IDS.length);
    expect(sql).not.toMatch(/\bTRUE\b/);
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER|CREATE|GRANT|REVOKE)\b\s/);
    expect(sql).not.toMatch(/'nav_extracteur'|'nav_plus_fonctionnalites'|'feat_diagnostic_cv'|'nav_plus_boite_idees'/);
    const r = lire("docs/rollbacks/20261026100000_interrupteurs_application_play_store.down.sql");
    for (const id of IDS) expect(r).toContain(`'${id}'`);
  });
});
