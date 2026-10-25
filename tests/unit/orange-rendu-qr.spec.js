const { test, expect } = require("@playwright/test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

/**
 * Test de RENDU du composant d'attente de paiement (commun aux jetons et à la formation CV). Téléphone : « Ouvrir MAXIT », puis juste dessous le QR
 * (visible tant que le paiement n'est ni confirmé ni expiré) avec la phrase pour un autre téléphone, puis le lien Orange Money ; ordinateur inchangé ;
 * le QR disparaît au paiement confirmé (la page affiche « Paiement confirmé » à la place du composant) et à l'expiration des 5 minutes.
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

test.describe("rendu sur téléphone : bouton, puis QR visible juste dessous", () => {
  test("après la création : bouton « Ouvrir MAXIT », QR, phrase « autre téléphone », lien Orange Money, temps restant", async () => {
    const html = await rendre({});
    expect(html).toContain('data-testid="ouvrir-maxit"');
    expect(html).toContain('data-testid="qr-paiement"');
    expect(html).toContain("data:image/png;base64,AAAA");
    expect(html).toContain("Un autre téléphone ? Scannez ce code avec Max it");
    expect(html).toContain('data-testid="ouvrir-orange-money"');
    expect(html).toContain('href="https://sugu.orange-sonatel.com/mp/123456789"');
    expect(html).toContain("valable 5 minutes");
    expect(html).toContain("il reste 4:47");
    expect(html).toContain("10 jetons · 1000 FCFA");
    expect(html).toContain("En attente de confirmation du paiement");
    expect(html).not.toContain("Le temps est écoulé");
  });

  test("ordre : bouton « Ouvrir MAXIT » → QR → phrase → lien « Ouvrir Orange Money » → état d'attente", async () => {
    const html = await rendre({});
    const maxit = html.indexOf('data-testid="ouvrir-maxit"');
    const qr = html.indexOf('data-testid="qr-paiement"');
    const phrase = html.indexOf("Un autre téléphone");
    const om = html.indexOf('data-testid="ouvrir-orange-money"');
    const attente = html.indexOf("En attente de confirmation");
    for (const i of [maxit, qr, phrase, om, attente]) expect(i).toBeGreaterThan(-1);
    expect(maxit).toBeLessThan(qr);
    expect(qr).toBeLessThan(phrase);
    expect(phrase).toBeLessThan(om);
    expect(om).toBeLessThan(attente);
    // Le QR suit DIRECTEMENT le bouton : rien d'autre entre les deux (ils tiennent ensemble à l'écran).
    const entre = html.slice(html.indexOf("</a>", maxit) + 4, qr);
    expect(entre).not.toMatch(/<p/);
    // Pas d'« order-N » CSS qui déplacerait le QR (c'était le cas avant : QR sous les boutons).
    expect(html).not.toMatch(/order-[1-9]|sm:order-|order-first/);
  });

  test("compact : bouton « Ouvrir MAXIT » plein largeur, QR un peu plus petit que sur ordinateur (160 px au lieu de 192 px), lien Orange Money discret", async () => {
    const html = await rendre({});
    const bouton = html.slice(html.indexOf('<a href="https://sugu.orange-sonatel.com/mp/123456789"'), html.indexOf("Ouvrir MAXIT"));
    expect(bouton).toContain("w-full");
    expect(bouton).toContain("bg-orange-500");
    const image = html.slice(html.indexOf("<img"), html.indexOf(">", html.indexOf("<img")));
    expect(image).toContain("w-40 h-40");
    expect(image).not.toContain("w-48");
    const lien = html.slice(html.lastIndexOf("<a ", html.indexOf('data-testid="ouvrir-orange-money"')), html.indexOf("Ouvrir Orange Money"));
    expect(lien).toContain("underline");
    expect(lien).not.toContain("bg-");
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

  test("sans lien MAXIT : le QR reste affiché (rien ne dépend du bouton)", async () => {
    const html = await rendre({ paiement: { ...PAIEMENT, deepLinkMaxit: null } });
    expect(html).toContain('data-testid="qr-paiement"');
    expect(html).not.toContain("Ouvrir MAXIT");
    expect(html).not.toContain("MAXIT s&#x27;ouvre tout seul");
  });

  test("ordinateur : INCHANGÉ — QR en premier (192 px), « Scannez ce QR code », boutons Orange Money puis MAXIT, phrase de fin avec le bouton habituel", async () => {
    const html = await rendre({ estMobile: false });
    expect(html.indexOf('data-testid="qr-paiement"')).toBeLessThan(html.indexOf("Scannez ce QR code"));
    expect(html).toContain("w-48 h-48");
    expect(html).not.toContain("w-40");
    expect(html).toContain("Scannez ce QR code avec Orange Money ou MAXIT");
    expect(html).not.toContain("Un autre téléphone");
    expect(html).not.toContain('data-testid="ouvrir-maxit"');
    expect(html.indexOf("Ouvrir Orange Money")).toBeLessThan(html.indexOf("Ouvrir MAXIT"));
    expect(html).toContain("sm:flex-row"); // boutons côte à côte
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
