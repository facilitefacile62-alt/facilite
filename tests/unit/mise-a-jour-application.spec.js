const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Mises à jour de l'application : la version annoncée par le site (public/app-version.json) est comparée à la version installée. Tuile « Mise à jour » du
 * menu ☰ grisée sans nouvelle version ; bandeau « Nouvelle mise à jour ! » en tête du fil seulement quand il y en a une.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const logique = () => import("../../mobile/src/lib/miseAJourLogique.ts");
const PLAY = "https://play.google.com/store/apps/details?id=com.ffacilite.app";
const APK = "https://ffacilite.com/telecharger-android";

test.describe("comparaison de versions", () => {
  test("compare chaque nombre : 1.10.0 est plus récent que 1.9.0 ; égalité ; versions de longueurs différentes ; illisible = 0", async () => {
    const { comparerVersions } = await logique();
    expect(comparerVersions("1.10.0", "1.9.0")).toBe(1);
    expect(comparerVersions("1.0.0", "1.0.0")).toBe(0);
    expect(comparerVersions("1.0", "1.0.0")).toBe(0);
    expect(comparerVersions("1.0.1", "1.0.10")).toBe(-1);
    expect(comparerVersions("2", "1.9.9")).toBe(1);
    expect(comparerVersions("abc", "0.0.0")).toBe(0);
  });
});

test.describe("mise à jour disponible", () => {
  test("même version ou plus ancienne : rien (tuile grisée, pas de bandeau)", async () => {
    const { miseAJourDisponible } = await logique();
    const c = { android: { version: "1.0.0", url: PLAY }, ios: { version: "1.0.0", url: "" }, apk: { version: "1.0.0", url: APK } };
    expect(miseAJourDisponible("1.0.0", c, "android")).toBeNull();
    expect(miseAJourDisponible("1.2.0", c, "android")).toBeNull();
    expect(miseAJourDisponible("1.0.0", null, "android")).toBeNull();
  });
  test("Android : Play Store si l'adresse est renseignée, sinon la page de l'APK ; iPhone : App Store ; web : jamais", async () => {
    const { miseAJourDisponible } = await logique();
    expect(miseAJourDisponible("1.0.0", { android: { version: "1.1.0", url: PLAY }, apk: { version: "1.1.0", url: APK } }, "android")).toEqual({ version: "1.1.0", url: PLAY });
    expect(miseAJourDisponible("1.0.0", { android: { version: "1.1.0", url: "" }, apk: { version: "1.1.0", url: APK } }, "android")).toEqual({ version: "1.1.0", url: APK });
    const store = "https://apps.apple.com/app/id123";
    expect(miseAJourDisponible("1.0.0", { ios: { version: "1.2.0", url: store } }, "ios")).toEqual({ version: "1.2.0", url: store });
    expect(miseAJourDisponible("1.0.0", { ios: { version: "1.2.0", url: "" } }, "ios")).toBeNull(); // pas encore sur l'App Store : rien
    expect(miseAJourDisponible("1.0.0", { android: { version: "9.0.0", url: PLAY } }, "web")).toBeNull();
  });
  test("le fichier du site : seules les versions valides et les adresses https sont retenues (http, javascript:, texte libre écartés)", async () => {
    const { lireConfigMaj, miseAJourDisponible } = await logique();
    expect(lireConfigMaj(null)).toBeNull();
    expect(lireConfigMaj("x")).toBeNull();
    const c = lireConfigMaj({ android: { version: "1.1.0", url: "javascript:alert(1)" }, apk: { version: "1.1.0", url: "http://x/y" }, ios: { version: "pas une version", url: "https://a.b" } });
    expect(c.android.url).toBeUndefined();
    expect(c.apk.url).toBeUndefined();
    expect(c.ios.version).toBeUndefined();
    expect(miseAJourDisponible("1.0.0", c, "android")).toBeNull();
  });
});

test.describe("le code", () => {
  test("le fichier du site existe, avec les trois canaux, à la version actuelle (aucune mise à jour annoncée)", () => {
    const j = JSON.parse(lire("public/app-version.json"));
    expect(j.android.url).toBe(PLAY);
    expect(j.apk.url).toBe(APK);
    expect(j.ios.url).toBe("");
    const app = JSON.parse(lire("mobile/app.json")).expo.version;
    for (const k of ["android", "ios", "apk"]) expect(j[k].version).toBe(app);
  });
  test("menu ☰ : tuile « Mise à jour » dans les deux espaces, grisée et sans action quand rien n'est disponible", () => {
    const m = lire("mobile/src/app/menu.tsx");
    expect(m).toContain("const TUILE_MAJ: Tuile =");
    expect(m).toContain("filtre([...TUILES_FACILITE, TUILE_MAJ])");
    expect(m).toContain("filtre(MENU_LOCAUX_REDUIT ? [TUILE_REGLAGES, TUILE_MAJ]");
    expect(m).toContain("disabled={tu.miseAJour && !maj.disponible}");
    expect(m).toContain("opacity: tu.miseAJour && !maj.disponible ? 0.45 : 1");
    expect(m).toContain("maj.ouvrir()");
  });
  test("fil d'actualité : bandeau « Nouvelle mise à jour ! » en tête, seulement s'il y a une mise à jour non fermée ; X pour le fermer", () => {
    expect(lire("mobile/src/app/(tabs)/index.tsx")).toContain("<BandeauMiseAJour />");
    const b = lire("mobile/src/components/BandeauMiseAJour.tsx");
    expect(b).toContain("if (!disponible || masquee) return null;");
    expect(b).toContain("Nouvelle mise à jour !");
    expect(b).toContain("Une nouvelle version de Facilité est disponible. Cliquez ici pour mettre à jour.");
    expect(b).toContain("onPress={ignorer}");
    const h = lire("mobile/src/lib/miseAJour.ts");
    expect(h).toContain("/app-version.json");
    expect(h).toContain("__DEV__ && process.env.EXPO_PUBLIC_MAJ_DEMO === '1'");
  });
  test("aucune nouvelle dépendance", () => {
    const pkg = JSON.parse(lire("mobile/package.json"));
    expect(Object.keys(pkg.dependencies)).not.toEqual(expect.arrayContaining(["expo-application", "expo-updates", "react-native-version-check"]));
  });
});
