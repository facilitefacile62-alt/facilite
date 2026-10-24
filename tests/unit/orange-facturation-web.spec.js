const { test, expect } = require("@playwright/test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Page de facturation du SITE (/premium) — même maquette que l'application (24/10/2026) : pas de couronne ni de titre en haut, pas d'encadré
 * « non actif », carte « Solde de jetons / Activer Premium / Acheter des jetons », compteur − / +, QR dans la carte et BARRE FIXE en bas
 * (compte à rebours, Ouvrir Orange Money, Ouvrir MAXIT, attente) seulement pendant le QR.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8");
function evaluer(fichier, modulesRelatifs = {}) {
  const code = ts.transpileModule(lire(fichier), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports_ = {};
  new Function("exports", "require", "React", code)(exports_, (nom) => (nom === "react" ? React : modulesRelatifs[nom] ?? require(nom)), React);
  return exports_;
}
const composants = () => evaluer("src/components/FacturationQr.jsx", { "../lib/validiteQr": evaluer("src/lib/validiteQr.js") });

const PAIEMENT = {
  qrCodeBase64: "AAAA",
  deepLinkMaxit: "https://sugu.orange-sonatel.com/mp/123456789",
  deepLinkOm: "https://sugu.orange-sonatel.com/mp/123456789",
  quantiteJetons: 10,
  montantXof: 1000,
  validForSeconds: 300,
};

test.describe("QR et barre fixe de la page de facturation du site", () => {
  test("carte : QR dans son cadre blanc, « 10 jetons · 1 000 FCFA », phrase de scan ; aucun bouton dans la carte", () => {
    const { QrPaiementCarte } = composants();
    const html = renderToStaticMarkup(React.createElement(QrPaiementCarte, { paiement: PAIEMENT }));
    expect(html).toContain('data-testid="qr-paiement"');
    expect(html).toContain("data:image/png;base64,AAAA");
    expect(html.replace(/\s/g, " ")).toContain("10 jetons · 1 000 FCFA");
    expect(html).toContain("Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :");
    expect(html).not.toContain("Ouvrir");
  });

  test("barre fixe : position fixe en bas, « Paiement valable 5 minutes · il reste 4:40 », Orange Money (orange) et MAXIT (noir) côte à côte, attente", () => {
    const { BarrePaiementFixe } = composants();
    const html = renderToStaticMarkup(React.createElement(BarrePaiementFixe, { paiement: PAIEMENT, reste: 280 }));
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toContain("Paiement valable 5 minutes · il reste 4:40");
    expect(html).toContain('data-testid="ouvrir-orange-money"');
    expect(html).toContain('data-testid="ouvrir-maxit"');
    expect(html).toContain("bg-[#FF6B00]");
    expect(html).toContain("bg-[#111827]");
    expect(html.indexOf("Ouvrir Orange Money")).toBeLessThan(html.indexOf("Ouvrir MAXIT"));
    expect(html).toContain("min-h-12"); // cibles tactiles de 48 px
    expect(html).toContain("En attente de confirmation du paiement");
    expect(html).toContain('href="https://sugu.orange-sonatel.com/mp/123456789"');
  });

  test("lien manquant : le bouton correspondant n'est pas affiché ; temps inconnu : pas de compte à rebours", () => {
    const { BarrePaiementFixe } = composants();
    const html = renderToStaticMarkup(React.createElement(BarrePaiementFixe, { paiement: { ...PAIEMENT, deepLinkOm: null }, reste: null }));
    expect(html).not.toContain("Ouvrir Orange Money");
    expect(html).toContain("Ouvrir MAXIT");
    expect(html).not.toContain("il reste");
  });
});

test.describe("structure de la page /premium", () => {
  const page = lire("src/app/premium/PremiumClient.jsx");

  test("plus de couronne ni de titre en haut, plus de phrase d'introduction, plus d'encadré « Premium Locaux non actif »", () => {
    expect(page).not.toContain("Jetons rechargeables");
    expect(page).not.toContain("Premium Locaux non actif");
    expect(page).not.toContain("Activez-le en dépensant vos jetons");
    expect(page).not.toMatch(/<h1/);
    expect(page).not.toContain("w-16 h-16 bg-amber-50"); // l'ancienne couronne en en-tête
    expect(page).toContain('aria-label="Retour à ma boutique"'); // bouton rond de retour
  });

  test("encadré vert « Premium Locaux actif … jusqu'au JJ/MM/AAAA » seulement quand Premium est actif ; activation orange foncé / pâle", () => {
    expect(page).toMatch(/\{premiumActif && \(\s*<div[^>]*data-testid="premium-actif"/);
    expect(page).toContain("Votre boutique est mise en avant jusqu&apos;au {formatDateFr(premiumActif.date_expiration)}.");
    expect(page).toContain('soldeSuffisant ? "bg-[#F59E0B]');
    expect(page).toContain('"bg-[#FCD58F]"');
    expect(page).toContain("Il vous manque {jetonsRequis - soldeJetons} jeton");
  });

  test("compteur − / + par 10 de 10 à 500 ; textes de la maquette ; messages vert, rouge et gris", () => {
    expect(page).toContain("Math.min(500, Math.max(10,");
    expect(page).toContain("sens * 10");
    expect(page).toContain('aria-label="Moins de jetons"');
    expect(page).toContain('aria-label="Plus de jetons"');
    expect(page).toContain("Solde de jetons");
    expect(page).toContain("Acheter des jetons");
    expect(page).toContain("Touchez le bouton : votre QR de paiement Orange Money s'affiche.");
    expect(page).toContain("Paiement reçu : +");
    expect(page).toContain("Paiement annulé. Aucun montant n'a été débité.");
    expect(page).toContain("bg-[#ECFDF5] text-[#047857]");
    expect(page).toContain("bg-[#FEF2F2] text-[#B91C1C]");
    expect(page).toContain("bg-[#F1F2F4] text-[#374151]");
  });

  test("la barre fixe n'est montée que pendant le QR, et la page garde de la place en bas pour qu'elle ne cache rien", () => {
    expect(page).toContain('const enAttenteQr = statutAchat === "attente" && Boolean(paiement) && !qrExpire;');
    expect(page).toContain("{enAttenteQr && <BarrePaiementFixe");
    expect(page).toContain('enAttenteQr ? "pb-44" : "pb-12"');
  });

  test("conservé : « Payer avec MAXIT » et ouverture automatique sur téléphone, retour de MAXIT retrouvé, crédit par le serveur seulement", () => {
    expect(page).toContain("libelleBoutonPaiement(estMobile");
    expect(page).toContain("tenterAuto(");
    expect(page).toContain("lirePaiementEnCours(");
    expect(page).not.toMatch(/crediter_jetons|\.from\("jetons_boutique"\)\s*\.(update|insert)/);
  });
});
