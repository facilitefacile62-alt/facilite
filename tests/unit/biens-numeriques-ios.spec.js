const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Règle Apple 3.1.1 (biens numériques) : sur iOS, aucun écran de l'application ne montre un prix, un bouton d'achat ou un lien de paiement pour
 * les jetons, Premium, la formation. Android (APK direct) et le site gardent l'achat.
 */
const logique = () => import("../../mobile/src/lib/biensNumeriquesLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("règle iOS pour les biens numériques", () => {
  test("achat autorisé hors iOS seulement ; marqueur d'identité posé sur iOS seulement", async () => {
    const { achatNumeriqueAutorise, marqueurAgentUtilisateur, MARQUEUR_APP_IOS } = await logique();
    expect(achatNumeriqueAutorise("ios")).toBe(false);
    expect(achatNumeriqueAutorise("android")).toBe(true);
    expect(achatNumeriqueAutorise("web")).toBe(true);
    expect(marqueurAgentUtilisateur("ios")).toBe(MARQUEUR_APP_IOS);
    expect(marqueurAgentUtilisateur("android")).toBeUndefined();
  });

  test("pages de paiement du site bloquées sur iOS (Premium, formation) et ouvertes ailleurs ; les autres pages restent ouvertes", async () => {
    const { cleWebBloquee } = await logique();
    for (const cle of ["premium", "formations"]) {
      expect(cleWebBloquee(cle, "ios")).toBe(true);
      expect(cleWebBloquee(cle, "android")).toBe(false);
    }
    for (const cle of ["concours", "faq", "creer-cv", "profil", undefined]) expect(cleWebBloquee(cle, "ios")).toBe(false);
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
    expect(s).toContain("if (pageWebBloquee(cle)) return <IndisponibleNeutre />;");
    expect(s).toContain("applicationNameForUserAgent={agentUtilisateurApp}");
    const lib = lire("mobile/src/lib/biensNumeriques.ts");
    expect(lib).toContain("Platform.OS");
  });
});
