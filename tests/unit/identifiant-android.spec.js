const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Identifiants de l'application : Android = com.ffacilite.app (l'application DÉJÀ publiée sur Google Play, que la nouvelle version met à jour),
 * iPhone = com.ffacilite.mobile (inchangé). Le fichier assetlinks.json du site déclare le même identifiant Android.
 */
const racine = path.join(__dirname, "../..");
const json = (p) => JSON.parse(fs.readFileSync(path.join(racine, p), "utf8"));

test("le package Android est celui de l'application publiée, l'identifiant iPhone ne change pas", () => {
  const { expo } = json("mobile/app.json");
  expect(expo.android.package).toBe("com.ffacilite.app");
  expect(expo.ios.bundleIdentifier).toBe("com.ffacilite.mobile");
});

test("assetlinks.json déclare le même identifiant Android", () => {
  const liens = json("public/.well-known/assetlinks.json");
  expect(liens[0].target.package_name).toBe(json("mobile/app.json").expo.android.package);
});

test("le schéma de redirection de connexion ne dépend pas de l'identifiant Android", () => {
  const { expo } = json("mobile/app.json");
  expect(expo.scheme).toBe("facilite");
  expect(JSON.stringify(expo.android)).not.toContain("com.ffacilite.mobile");
});

test("aucune version numérique n'est écrite en dur dans app.json : EAS gère le versionCode à distance", () => {
  const { expo } = json("mobile/app.json");
  expect(expo.android.versionCode).toBeUndefined();
  expect(json("mobile/eas.json").cli.appVersionSource).toBe("remote");
});
