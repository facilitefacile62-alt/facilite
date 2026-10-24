const { test, expect } = require("@playwright/test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

/**
 * Test de RENDU du composant d'attente de paiement (commun aux jetons et à la formation CV), en mode téléphone : le QR est VISIBLE tant que le
 * paiement n'est ni confirmé ni expiré, avec les boutons « Ouvrir MAXIT » / « Ouvrir Orange Money » et la phrase pour un autre téléphone ;
 * il disparaît au paiement confirmé (la page affiche « Paiement confirmé » à la place du composant) et à l'expiration des 5 minutes.
 */
// Chargement du composant : Playwright transforme le JSX en objets de test de composants (« __pw_type »), inutilisables pour un rendu serveur.
// On transpile donc nous-mêmes le composant et sa dépendance avec TypeScript (JSX → React.createElement, ES → CommonJS), puis on l'exécute.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const racine = path.join(__dirname, "../..");
function transpiler(fichier) {
  const source = fs.readFileSync(path.join(racine, fichier), "utf8");
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 } }).outputText;
}
function evaluer(fichier, modulesRelatifs = {}) {
  const exports_ = {};
  const exigence = (nom) => (nom === "react" ? React : modulesRelatifs[nom] ?? require(nom));
  new Function("exports", "require", "React", transpiler(fichier))(exports_, exigence, React);
  return exports_;
}
const charger = async () => {
  const validite = evaluer("src/lib/validiteQr.js");
  return evaluer("src/components/AttentePaiementQr.jsx", { "../lib/validiteQr": validite });
};
const PAIEMENT = {
  qrId: "QR1",
  qrCodeBase64: "AAAA",
  deepLinkMaxit: "https://sugu.orange-sonatel.com/mp/123456789",
  deepLinkOm: "https://sugu.orange-sonatel.com/mp/123456789",
  validForSeconds: 300,
};
const bouton = React.createElement("button", { type: "button", "data-testid": "bouton-recommencer" }, "Payer avec MAXIT");

async function rendre(props) {
  const { default: Composant } = await charger();
  return renderToStaticMarkup(
    React.createElement(Composant, {
      paiement: PAIEMENT,
      resume: "10 jetons · 1000 FCFA",
      estMobile: true,
      reste: 287,
      qrExpire: false,
      libelleBoutonOrdinateur: "Générer mon QR de paiement Orange Money",
      boutonRecommencer: bouton,
      ...props,
    })
  );
}

test.describe("rendu sur téléphone : le QR reste visible pendant l'attente", () => {
  test("après la création : image du QR présente, phrase « autre téléphone », boutons MAXIT et Orange Money, temps restant", async () => {
    const html = await rendre({});
    expect(html).toContain('data-testid="qr-paiement"');
    expect(html).toContain("data:image/png;base64,AAAA");
    expect(html).toContain("Un autre téléphone ? Scannez ce code avec Max it");
    expect(html).toContain("Ouvrir MAXIT");
    expect(html).toContain("Ouvrir Orange Money");
    expect(html).toContain('href="https://sugu.orange-sonatel.com/mp/123456789"');
    expect(html).toContain("valable 5 minutes");
    expect(html).toContain("il reste 4:47");
    expect(html).toContain("En attente de confirmation du paiement");
    expect(html).not.toContain("Le temps est écoulé");
  });

  test("le QR est AU-DESSUS des boutons (visible sans défiler sous eux), « Ouvrir MAXIT » avant « Ouvrir Orange Money »", async () => {
    const html = await rendre({});
    const qr = html.indexOf('data-testid="qr-paiement"');
    const phrase = html.indexOf("Un autre téléphone");
    const maxit = html.indexOf("Ouvrir MAXIT");
    const om = html.indexOf("Ouvrir Orange Money");
    expect(qr).toBeGreaterThan(-1);
    expect(qr).toBeLessThan(phrase);
    expect(phrase).toBeLessThan(maxit);
    expect(html.slice(html.lastIndexOf("<a", maxit), maxit)).toContain("order-first"); // MAXIT au premier plan sur téléphone
    expect(om).toBeGreaterThan(-1);
    // Aucun « order-N » CSS ne déplace le QR sous les boutons sur téléphone (c'était le cas avant : QR en order-2, boutons en order-1).
    expect(html).not.toMatch(/order-[1-9]|sm:order-/);
  });

  test("après le délai de 5 minutes : QR masqué (aucune image), phrase de fin, bouton prêt", async () => {
    const html = await rendre({ qrExpire: true, reste: 0 });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain('data-testid="qr-paiement"');
    expect(html).not.toContain("Ouvrir MAXIT");
    expect(html).toContain("Le temps est écoulé. Touchez « Payer avec MAXIT » pour recommencer.");
    expect(html).toContain('data-testid="bouton-recommencer"');
  });

  test("sur ordinateur : QR visible aussi, texte « Scannez ce QR code », phrase de fin avec le bouton habituel", async () => {
    const html = await rendre({ estMobile: false });
    expect(html).toContain('data-testid="qr-paiement"');
    expect(html).toContain("Scannez ce QR code avec Orange Money ou MAXIT");
    expect(html).not.toContain("Un autre téléphone");
    const expire = await rendre({ estMobile: false, qrExpire: true });
    expect(expire).toContain("Touchez « Générer mon QR de paiement Orange Money » pour recommencer.");
    expect(expire).not.toContain("<img");
  });

  test("à « Paiement confirmé » les pages n'affichent plus ce composant (donc plus de QR) : la branche « succes » précède celle de l'attente", () => {
    for (const f of ["src/app/premium/PremiumClient.jsx", "src/app/formation-redaction-cv/FormationRedactionCvClient.jsx"]) {
      const s = fs.readFileSync(path.join(__dirname, "../..", f), "utf8");
      const succes = s.indexOf('statutAchat === "succes"');
      const attente = s.indexOf('statutAchat === "attente" && paiement ? (');
      expect(succes).toBeGreaterThan(-1);
      expect(attente).toBeGreaterThan(succes);
      expect(s.indexOf("Paiement confirmé", succes)).toBeLessThan(attente);
    }
  });
});
