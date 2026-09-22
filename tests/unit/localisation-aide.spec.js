const { test, expect } = require("@playwright/test");
const { estAppareilIOS, aideLocalisationRefusee } = require("../../src/lib/localisationAide.js");

/**
 * Aide affichée quand la localisation est refusée (CapturePosition.jsx).
 * Cas signalé : une vendeuse sur iPhone (Safari) bloquée, sans jamais voir
 * de message actionnable — sur iOS, navigator.permissions ne couvre pas
 * "geolocation", donc l'ancien code (basé dessus) ne s'affichait jamais là-bas.
 */

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

test.describe("estAppareilIOS", () => {
  test("iPhone et iPad reconnus", () => {
    expect(estAppareilIOS(IPHONE_UA)).toBe(true);
    expect(estAppareilIOS(IPAD_UA)).toBe(true);
  });
  test("Android et ordinateur non reconnus", () => {
    expect(estAppareilIOS(ANDROID_UA)).toBe(false);
    expect(estAppareilIOS(DESKTOP_UA)).toBe(false);
  });
  test("user agent vide ou absent : jamais iOS", () => {
    expect(estAppareilIOS("")).toBe(false);
    expect(estAppareilIOS(undefined)).toBe(false);
    expect(estAppareilIOS(null)).toBe(false);
  });
});

test.describe("aideLocalisationRefusee", () => {
  test("cas signalé : iPhone -> instructions Réglages > Safari > Localisation, jamais l'icône cadenas", () => {
    const aide = aideLocalisationRefusee({ userAgent: IPHONE_UA, entite: "boutique" });
    const texte = aide.etapes.join(" ");
    expect(texte).toContain("Réglages");
    expect(texte).toContain("Safari");
    expect(texte).toContain("Localisation");
    expect(texte).not.toContain("cadenas");
    expect(texte).toContain("boutique");
  });

  test("iPad : mêmes instructions qu'iPhone (même système)", () => {
    const aide = aideLocalisationRefusee({ userAgent: IPAD_UA, entite: "activité" });
    expect(aide.etapes.join(" ")).toContain("Réglages");
  });

  test("Android / ordinateur : instructions par l'icône cadenas de la barre d'adresse", () => {
    for (const ua of [ANDROID_UA, DESKTOP_UA]) {
      const aide = aideLocalisationRefusee({ userAgent: ua, entite: "boutique" });
      const texte = aide.etapes.join(" ");
      expect(texte).toContain("cadenas");
      expect(texte).not.toContain("Réglages");
    }
  });

  test("l'entité demandée (boutique/activité) apparaît dans la dernière étape", () => {
    expect(aideLocalisationRefusee({ userAgent: ANDROID_UA, entite: "activité" }).etapes.at(-1)).toContain("activité");
    expect(aideLocalisationRefusee({ userAgent: IPHONE_UA, entite: "activité" }).etapes.at(-1)).toContain("activité");
  });

  test("entite par défaut : boutique", () => {
    expect(aideLocalisationRefusee({ userAgent: ANDROID_UA }).etapes.at(-1)).toContain("boutique");
  });

  test("titre toujours présent et non vide, quel que soit l'appareil", () => {
    for (const ua of [IPHONE_UA, ANDROID_UA, DESKTOP_UA, ""]) {
      const aide = aideLocalisationRefusee({ userAgent: ua });
      expect(aide.titre.length).toBeGreaterThan(0);
      expect(aide.etapes.length).toBeGreaterThan(0);
    }
  });
});
