const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Proxy (src/proxy.js) : moins de calcul par page. Dépassement du temps de calcul du plan Vercel le 18/11/2026
 * (5 h 32 pour 4 h ; ~384 000 appels, le proxy lisant le rôle et TOUS les interrupteurs en base à chaque passage).
 * La mémoire courte garde ces lectures quelques secondes dans l'instance serveur.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const module_ = () => import("../../src/lib/proxyMemoireCourte.js");

function horloge(debut = 1_000) {
  const h = { t: debut, maintenant: () => h.t, avance: (ms) => (h.t += ms) };
  return h;
}

test("une valeur est gardée pendant la durée choisie, puis relue", async () => {
  const { creerMemoireCourte } = await module_();
  const h = horloge();
  const m = creerMemoireCourte({ dureeMs: 20_000, maintenant: h.maintenant });
  let lectures = 0;
  const charger = async () => ++lectures;
  expect(await m.lireOuCharger("a", charger)).toBe(1);
  h.avance(19_999);
  expect(await m.lireOuCharger("a", charger)).toBe(1); // encore gardée
  h.avance(1);
  expect(await m.lireOuCharger("a", charger)).toBe(2); // expirée : relue
  expect(lectures).toBe(2);
});

test("des requêtes simultanées pour la même clé ne font qu'UNE lecture", async () => {
  const { creerMemoireCourte } = await module_();
  const m = creerMemoireCourte({ dureeMs: 60_000 });
  let lectures = 0;
  const charger = () => new Promise((ok) => setTimeout(() => ok(++lectures), 20));
  const rep = await Promise.all(Array.from({ length: 10 }, () => m.lireOuCharger("flags", charger)));
  expect(lectures).toBe(1);
  expect(new Set(rep).size).toBe(1);
});

test("une lecture en échec n'est JAMAIS gardée : l'erreur remonte (le proxy laisse alors passer) et la suivante relit", async () => {
  const { creerMemoireCourte } = await module_();
  const m = creerMemoireCourte({ dureeMs: 60_000 });
  let essais = 0;
  const charger = async () => {
    essais++;
    if (essais === 1) throw new Error("TIMEOUT");
    return "ok";
  };
  await expect(m.lireOuCharger("cle", charger)).rejects.toThrow("TIMEOUT");
  expect(m.taille()).toBe(0);
  expect(await m.lireOuCharger("cle", charger)).toBe("ok");
  expect(await m.lireOuCharger("cle", charger)).toBe("ok");
  expect(essais).toBe(2);
});

test("une valeur jugée non mémorisable (compte sans ligne de rôle) est rendue mais pas gardée", async () => {
  const { creerMemoireCourte } = await module_();
  const m = creerMemoireCourte({ dureeMs: 60_000 });
  let lectures = 0;
  const charger = async () => (++lectures === 1 ? null : { role: "user" });
  expect(await m.lireOuCharger("u", charger, (v) => v != null)).toBeNull();
  expect(m.taille()).toBe(0);
  expect(await m.lireOuCharger("u", charger, (v) => v != null)).toEqual({ role: "user" });
  expect(await m.lireOuCharger("u", charger, (v) => v != null)).toEqual({ role: "user" });
  expect(lectures).toBe(2);
});

test("durée nulle = aucune mémoire (retour à une lecture par passage) ; oublier() relit ; la taille est bornée", async () => {
  const { creerMemoireCourte } = await module_();
  const sans = creerMemoireCourte({ dureeMs: 0 });
  let n = 0;
  await sans.lireOuCharger("a", async () => ++n);
  await sans.lireOuCharger("a", async () => ++n);
  expect(n).toBe(2);

  const m = creerMemoireCourte({ dureeMs: 60_000, max: 3 });
  let lectures = 0;
  const charger = async () => ++lectures;
  await m.lireOuCharger("a", charger);
  m.oublier("a");
  await m.lireOuCharger("a", charger);
  expect(lectures).toBe(2);
  for (const cle of ["b", "c", "d", "e"]) await m.lireOuCharger(cle, charger);
  expect(m.taille()).toBeLessThanOrEqual(3);
});

test("proxy.js : jeton vérifié en local (getClaims), plus d'appel getUser() à chaque page, lectures en mémoire courte, listes de routes intactes", () => {
  const p = lire("src/proxy.js");
  expect(p).toContain('import { creerMemoireCourte } from "@/lib/proxyMemoireCourte";');
  expect(p).toContain("client().auth.getClaims()");
  expect(p).not.toContain("auth.getUser()");
  expect(p).toContain("memoireRoles.lireOuCharger(");
  expect(p).toContain("memoireInterrupteurs.lireOuCharger(");
  // un visiteur sans cookie n'appelle pas la vérification de jeton
  expect(p).toContain("if (hasSupabaseCookie) {");
  // l'échec d'une lecture reste « accès toléré » (fail-open) et ne remplit pas la mémoire d'une liste vide
  expect(p).toContain('throw new Error(r.error?.message || "interrupteurs illisibles")');
  expect(p).toContain("Vérification feature flags échouée (accès toléré)");
  // une réactivation de compte relit l'état réel
  expect(p).toContain("memoireRoles.oublier(user.id)");
  // interrupteur de repli documenté
  expect(p).toContain('process.env.PROXY_MEMOIRE_DESACTIVEE !== "1"');
  // le matcher et les routes publiques ne bougent pas
  expect(p).toContain('"/telecharger-android",');
  expect(p).toContain('"/conseils",');
});
