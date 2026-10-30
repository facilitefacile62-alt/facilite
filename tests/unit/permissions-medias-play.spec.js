const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Google Play : aucune permission de photos, vidéos ou stockage (READ_MEDIA_*, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE) ; le choix d'une photo passe par
 * le sélecteur système. La caméra, la localisation, le micro et la lecture multimédia gardent leurs permissions habituelles.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");

test("les permissions de photos, vidéos, audio et stockage sont retirées du manifeste final (blockedPermissions)", () => {
  const { expo } = JSON.parse(lire("mobile/app.json"));
  const bloquees = expo.android.blockedPermissions;
  for (const p of ["READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO", "READ_MEDIA_VISUAL_USER_SELECTED", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "SYSTEM_ALERT_WINDOW"]) {
    expect(bloquees, p).toContain(`android.permission.${p}`);
  }
  for (const p of ["CAMERA", "RECORD_AUDIO", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "INTERNET", "FOREGROUND_SERVICE_MEDIA_PLAYBACK"]) {
    expect(bloquees, p).not.toContain(`android.permission.${p}`);
  }
});

test("plus aucun écran ne demande l'accès à la galerie : tous passent par le sélecteur système", () => {
  const trouves = execSync('grep -rln "requestMediaLibraryPermissionsAsync" mobile/src || true', { cwd: racine, encoding: "utf8" }).trim();
  expect(trouves).toBe("");
  const g = lire("mobile/src/lib/galerie.ts");
  expect(g).toContain("export async function permissionGalerie()");
  expect(g).not.toMatch(/Permissions?Async|PermissionsAndroid/);
  const photo = lire("mobile/src/lib/photoProfil.ts");
  expect(photo).toContain("permissionGalerie()");
  expect(photo).toContain("launchImageLibraryAsync");
});

test("aucune bibliothèque de galerie (expo-media-library) n'est installée", () => {
  const dep = JSON.parse(lire("mobile/package.json")).dependencies;
  expect(Object.keys(dep)).not.toContain("expo-media-library");
});
