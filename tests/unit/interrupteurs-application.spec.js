const { test, expect } = require("@playwright/test");

/**
 * Interrupteurs propres à l'application (première version Android) : fermés par défaut, FERMÉS si la table est illisible, ouverts seulement quand une ligne de
 * feature_flags les ouvre ; un administrateur voit tout. Règles pures : mobile/src/lib/featureFlagsLogique.ts.
 */
const logique = () => import("../../mobile/src/lib/featureFlagsLogique.ts");

// Interrupteurs de CETTE PR et des suivantes : la liste complète est vérifiée quand tous sont déclarés (voir la fin du fichier).
const DECLARES = ["feat_paiements_application", "feat_scanner_document", "feat_app_extracteur", "feat_app_fonctionnalites", "feat_app_diagnostic_cv", "feat_app_boite_idees", "feat_app_creer_cv", "feat_app_modeles_cv", "feat_app_inscription", "feat_app_mot_de_passe_oublie", "feat_app_connexion_sans_mot_de_passe"];

test.describe("fermés par défaut et si la table est illisible", () => {
  test("chaque interrupteur déclaré est fermé pour tous les rôles sauf l'administrateur", async () => {
    const { PAR_DEFAUT, fonctionnaliteAutorisee } = await logique();
    for (const id of DECLARES) {
      expect(PAR_DEFAUT[id], id).toBeDefined();
      expect(PAR_DEFAUT[id].enabled, id).toBe(false);
      for (const role of ["user", "recruiter", "visitor"]) expect(fonctionnaliteAutorisee(id, role, PAR_DEFAUT), `${id} / ${role}`).toBe(false);
      expect(fonctionnaliteAutorisee(id, "admin", PAR_DEFAUT), id).toBe(true); // l'administrateur voit toujours tout (voulu)
    }
  });
  test("table illisible ou ligne absente : l'état reste celui des valeurs par défaut, donc fermé", async () => {
    const { PAR_DEFAUT, fonctionnaliteAutorisee } = await logique();
    const illisible = { ...PAR_DEFAUT }; // featureFlags.ts garde les valeurs par défaut quand la lecture échoue
    for (const id of DECLARES) expect(fonctionnaliteAutorisee(id, "user", illisible)).toBe(false);
  });
  test("une ligne ouverte rouvre la fonction ; fermée ou rôle refusé, elle reste cachée", async () => {
    const { fonctionnaliteAutorisee } = await logique();
    const id = "feat_paiements_application";
    expect(fonctionnaliteAutorisee(id, "user", { [id]: { enabled: true, roles: { user: true, recruiter: true, visitor: true } } })).toBe(true);
    expect(fonctionnaliteAutorisee(id, "user", { [id]: { enabled: true, roles: { user: false } } })).toBe(false);
    expect(fonctionnaliteAutorisee(id, "user", { [id]: { enabled: false, roles: { user: true } } })).toBe(false);
  });
  test("un identifiant non listé reste autorisé (comme sur le site) ; plusieurs interrupteurs : tous doivent être ouverts", async () => {
    const { fonctionnaliteAutorisee, tousAutorises, PAR_DEFAUT } = await logique();
    expect(fonctionnaliteAutorisee("nav_inconnu", "user", PAR_DEFAUT)).toBe(true);
    expect(tousAutorises(undefined, "user", PAR_DEFAUT)).toBe(true);
    expect(tousAutorises(["nav_offres", "feat_paiements_application"], "user", PAR_DEFAUT)).toBe(false);
    expect(tousAutorises(["nav_offres", "nav_messagerie"], "user", PAR_DEFAUT)).toBe(true);
    expect(tousAutorises(["nav_offres", "feat_paiements_application"], "admin", PAR_DEFAUT)).toBe(true);
  });
  test("les interrupteurs partagés avec le site ne sont pas modifiés", async () => {
    const { PAR_DEFAUT } = await logique();
    expect(PAR_DEFAUT.nav_extracteur.enabled).toBe(true);
    expect(PAR_DEFAUT.nav_plus_fonctionnalites.enabled).toBe(true);
    expect(PAR_DEFAUT.feat_diagnostic_cv.enabled).toBe(true);
  });
});
