const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Retour de MAXIT : la page est rechargée (adresse d'annulation) et perdait le QR et les boutons. Le paiement en cours est gardé sur l'appareil
 * et retrouvé DIRECTEMENT, tant qu'il est valable, pour le même compte.
 */
const charger = () => import("../../src/lib/paiementEnCours.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const COMPTE = "0b5cd0a1-6c3e-4b7e-9a11-2f8d4e6a7b90";
const AUTRE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const COMMANDE = "0a80493a-7507-4ef2-92b4-ba1db78024a3";
const PAIEMENT = {
  transactionId: COMMANDE,
  qrId: "dmeh-jY2ZmuQR8Y9zfCG",
  qrCodeBase64: "AAAA",
  deepLinkMaxit: "https://sugu.orange-sonatel.com/mp/123456789",
  deepLinkOm: "https://sugu.orange-sonatel.com/mp/123456789",
  quantiteJetons: 10,
  montantXof: 10,
  validForSeconds: 300,
};
const stockageFaux = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), m };
};

test.describe("paiement en cours gardé sur l'appareil", () => {
  test("enregistré puis retrouvé avec le temps réellement restant", async () => {
    const { sauvegarderPaiementEnCours, lirePaiementEnCours } = await charger();
    const stockage = stockageFaux();
    const t0 = 1_000_000;
    expect(sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, maintenant: t0, stockage })).toBe(true);
    const r = lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0 + 100_000, stockage });
    expect(r).toMatchObject({ transactionId: COMMANDE, qrCodeBase64: "AAAA", deepLinkMaxit: PAIEMENT.deepLinkMaxit, deepLinkOm: PAIEMENT.deepLinkOm, quantiteJetons: 10, montantXof: 10 });
    expect(r.validForSeconds).toBe(200); // 300 s de validité, 100 s écoulées
  });

  test("jamais pour un autre compte, ni après la fin de validité (et l'entrée expirée est effacée)", async () => {
    const { sauvegarderPaiementEnCours, lirePaiementEnCours } = await charger();
    const stockage = stockageFaux();
    const t0 = 1_000_000;
    sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, maintenant: t0, stockage });
    expect(lirePaiementEnCours("jetons", { proprietaire: AUTRE, maintenant: t0 + 10_000, stockage })).toBeNull();
    expect(lirePaiementEnCours("jetons", { proprietaire: undefined, maintenant: t0 + 10_000, stockage })).toBeNull();
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0 + 298_000, stockage })).toBeNull(); // moins de 3 s restantes
    expect(stockage.m.size).toBe(0);
    sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, maintenant: t0, stockage });
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0 + 400_000, stockage })).toBeNull();
  });

  test("données illisibles ou dangereuses : ignorées ; liens javascript:/data: écartés ; QR démesuré non gardé", async () => {
    const { sauvegarderPaiementEnCours, lirePaiementEnCours } = await charger();
    const stockage = stockageFaux();
    const t0 = 1_000_000;
    stockage.setItem("paiement-en-cours:jetons", "pas du json");
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0, stockage })).toBeNull();
    stockage.setItem("paiement-en-cours:jetons", JSON.stringify({ v: 1, proprietaire: COMPTE, transactionId: "pas-un-uuid", finMs: t0 + 100_000 }));
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0, stockage })).toBeNull();
    sauvegarderPaiementEnCours("jetons", { ...PAIEMENT, deepLinkMaxit: "javascript://x", deepLinkOm: "data://text/html,x", qrCodeBase64: "A".repeat(300_000) }, { proprietaire: COMPTE, maintenant: t0, stockage });
    const r = lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: t0 + 1000, stockage });
    expect(r.deepLinkMaxit).toBeNull();
    expect(r.deepLinkOm).toBeNull();
    expect(r.qrCodeBase64).toBeNull();
  });

  test("effacer ; stockage indisponible : aucune erreur", async () => {
    const { sauvegarderPaiementEnCours, lirePaiementEnCours, effacerPaiementEnCours } = await charger();
    const stockage = stockageFaux();
    sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, maintenant: 1_000_000, stockage });
    effacerPaiementEnCours("jetons", { stockage });
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, maintenant: 1_000_100, stockage })).toBeNull();
    const casse = { getItem: () => { throw new Error("bloqué"); }, setItem: () => { throw new Error("bloqué"); }, removeItem: () => { throw new Error("bloqué"); } };
    expect(sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, stockage: casse })).toBe(false);
    expect(lirePaiementEnCours("jetons", { proprietaire: COMPTE, stockage: casse })).toBeNull();
    expect(() => effacerPaiementEnCours("jetons", { stockage: casse })).not.toThrow();
    expect(sauvegarderPaiementEnCours("jetons", PAIEMENT, { proprietaire: COMPTE, stockage: null })).toBe(false);
  });
});

test.describe("la page retrouve directement le paiement (QR et boutons)", () => {
  const page = lire("src/app/premium/PremiumClient.jsx");

  test("au rechargement : restauration seulement si la commande est encore « pending », sans rouvrir MAXIT automatiquement", () => {
    const debut = page.indexOf("const restaureRef = useRef(false);");
    const fin = page.indexOf("const genererPaiement = async", debut);
    const restauration = page.slice(debut, fin);
    expect(restauration).toContain('lirePaiementEnCours("jetons", { proprietaire: user.id })');
    expect(restauration).toContain('etat.status === "pending"');
    expect(restauration).toContain("demarrerSuivi(sauvegarde)");
    expect(restauration).toContain('effacerPaiementEnCours("jetons")'); // payé, échoué ou inconnu : on oublie
    expect(restauration).not.toContain("tenterAuto"); // pas de nouvelle ouverture automatique à la restauration
  });

  test("429 « un paiement vient d'être préparé » : on affiche le paiement en cours au lieu d'une erreur ; le paiement créé est gardé", () => {
    expect(page).toMatch(/res\.status === 429 \? lirePaiementEnCours\("jetons"/);
    expect(page).toContain('sauvegarderPaiementEnCours("jetons", data, { proprietaire: user?.id })');
  });

  test("effacé au paiement confirmé, à l'échec confirmé et au nouvel achat", () => {
    expect(page.match(/effacerPaiementEnCours\("jetons"\)/g).length).toBeGreaterThanOrEqual(4);
    const nouvel = page.slice(page.indexOf("const nouvelAchat = () => {"), page.indexOf("const nouvelAchat = () => {") + 120);
    expect(nouvel).toContain("effacerPaiementEnCours");
  });
});
