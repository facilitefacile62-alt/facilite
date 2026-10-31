const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Liens entrants : plus jamais « Unmatched Route ». Le retour de connexion Google (facilite://auth/callback) mène à l'accueil ; les liens https://ffacilite.com/…
 * mènent à l'écran correspondant de l'application, ou à l'accueil s'il n'existe pas ; la page introuvable est en français et revient à l'accueil.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const logique = () => import("../../mobile/src/lib/lienEntrantLogique.ts");
const ID = "f05b24d4-7e54-4066-9c59-8ea3ef89f7c4";

test("retour de connexion Google : toutes les formes mènent à l'accueil, sans garder les jetons", async () => {
  const { cheminInterne } = await logique();
  for (const e of ["facilite://auth/callback", "facilite://auth/callback#access_token=a&refresh_token=b", "facilite://auth/callback?code=xyz", "/auth/callback", "exp://192.168.1.7:8081/--/auth/callback"]) {
    expect(cheminInterne(e), e).toBe("/");
  }
});

test("liens https://ffacilite.com : article partagé, offre, écrans connus ; le reste mène à l'accueil", async () => {
  const { cheminInterne } = await logique();
  expect(cheminInterne(`https://ffacilite.com/marketplace?article=${ID}`)).toBe(`/marketplace/${ID}`);
  expect(cheminInterne("https://ffacilite.com/marketplace")).toBe("/marketplace");
  expect(cheminInterne("https://ffacilite.com/marketplace?article=pas-un-identifiant")).toBe("/marketplace");
  expect(cheminInterne(`https://www.ffacilite.com/offres/${ID}`)).toBe(`/offre/${ID}`);
  expect(cheminInterne("https://ffacilite.com/offres")).toBe("/offres");
  expect(cheminInterne("https://ffacilite.com/")).toBe("/");
  expect(cheminInterne("https://ffacilite.com/une-page-inconnue")).toBe("/");
  expect(cheminInterne("https://ffacilite.com/admin/modeles-documents")).toBe("/");
  expect(cheminInterne("https://autre-site.example/marketplace")).toBe("/");
});

test("liens de sécurité : les paramètres sont gardés seulement pour le nouveau mot de passe et la confirmation de compte", async () => {
  const { cheminInterne } = await logique();
  expect(cheminInterne("facilite://nouveau-mot-de-passe?code=abc")).toBe("/nouveau-mot-de-passe?code=abc");
  expect(cheminInterne("facilite://confirmer-compte")).toBe("/confirmer-compte");
  expect(cheminInterne("facilite://recherche?q=secret")).toBe("/recherche");
});

test("entrées vides ou bizarres : l'accueil, jamais d'erreur", async () => {
  const { cheminInterne } = await logique();
  for (const e of ["", "   ", null, undefined, "n'importe quoi", "javascript:alert(1)", "//"]) expect(() => cheminInterne(e)).not.toThrow();
  expect(cheminInterne(null)).toBe("/");
  expect(cheminInterne("javascript:alert(1)")).toBe("/");
});

test("les fichiers du routeur : redirection système, route de retour, page introuvable en français", () => {
  expect(lire("mobile/src/app/+native-intent.tsx")).toContain("redirectSystemPath");
  expect(lire("mobile/src/app/+native-intent.tsx")).toContain("cheminInterne(path)");
  expect(lire("mobile/src/app/auth/callback.tsx")).toContain('<Redirect href="/" />');
  const nf = lire("mobile/src/app/+not-found.tsx");
  expect(nf).toContain("Page introuvable");
  expect(nf).toContain("router.replace('/')");
  expect(nf).not.toContain("Unmatched");
});

test("le logo clé : l'image détourée du propriétaire remplace le dessin vectoriel, partout (en-tête, connexion, bascule)", () => {
  expect(fs.existsSync(path.join(racine, "mobile/assets/images/cle-detouree.png"))).toBe(true);
  expect(lire("mobile/src/components/CleLogo.tsx")).toContain("cle-detouree.png");
  const e = lire("mobile/src/components/EcranConnexion.tsx");
  expect(e).toContain("return <CleLogo hauteur={hauteur} />;");
  expect(e).not.toContain("Ellipse");
  const b = lire("mobile/src/components/BasculePlateforme.tsx");
  expect(b).toContain('<CleLogo hauteur={15} couleur="#FFFFFF" />');
  expect(b).not.toContain('name="key"');
});
