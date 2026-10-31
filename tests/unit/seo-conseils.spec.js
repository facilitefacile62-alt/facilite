const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Pages de conseils (/conseils et cinq guides) : 600 à 900 mots, aucun chiffre, salaire, statistique, témoignage ni promesse, contenu différent d'une page à l'autre,
 * titres et descriptions uniques, un seul h1, JSON-LD Article et BreadcrumbList, liens internes, sitemap, pied de page seulement.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const donnees = () => import("../../src/lib/conseils.js");

const SLUGS = ["modele-cv-senegal", "lettre-de-motivation", "creer-cv-telephone", "postuler-whatsapp-email", "entretien-embauche"];

test("cinq pages, aux adresses demandées, dans l'ordre", async () => {
  const { PAGES_CONSEILS } = await donnees();
  expect(PAGES_CONSEILS.map((p) => p.slug)).toEqual(SLUGS);
});

test("longueur : 600 à 900 mots de contenu visible par page", async () => {
  const { PAGES_CONSEILS, compterMots } = await donnees();
  for (const p of PAGES_CONSEILS) {
    const n = compterMots(p);
    expect(n, `${p.slug} : ${n} mots`).toBeGreaterThanOrEqual(600);
    expect(n, `${p.slug} : ${n} mots`).toBeLessThanOrEqual(900);
  }
});

test("titre (60 caractères au plus avec la marque ajoutée par le modèle du site), description et h1 : uniques", async () => {
  const { PAGES_CONSEILS } = await donnees();
  for (const p of PAGES_CONSEILS) {
    expect(`${p.titre} | Facilite`.length, p.slug).toBeLessThanOrEqual(60);
    expect(p.titre, p.slug).not.toMatch(/facilit/i);
    expect(p.description.length, p.slug).toBeGreaterThanOrEqual(70);
    expect(p.description.length, p.slug).toBeLessThanOrEqual(155);
  }
  for (const champ of ["titre", "description", "h1", "court"]) {
    const valeurs = PAGES_CONSEILS.map((p) => p[champ]);
    expect(new Set(valeurs).size, champ).toBe(valeurs.length);
  }
  expect(lire("src/app/layout.js")).toContain('template: "%s | Facilite"');
});

test("aucun chiffre, pourcentage, montant, salaire chiffré, témoignage ni promesse de résultat", async () => {
  const { PAGES_CONSEILS, textesVisibles } = await donnees();
  for (const p of PAGES_CONSEILS) {
    const texte = [...textesVisibles(p), p.titre, p.description].join(" ");
    expect(texte.replace(/\+221/g, ""), `${p.slug} : chiffre`).not.toMatch(/\d/);
    expect(texte, `${p.slug} : montant`).not.toMatch(/FCFA|XOF|francs? CFA|\bfrancs\b/i);
    expect(texte, `${p.slug} : promesse`).not.toMatch(/garanti|garantie|garantis|garantit|100 ?%|à coup sûr|infaillible|succès assuré|vous serez embauché/i);
    expect(texte, `${p.slug} : témoignage`).not.toMatch(/témoign|« j'ai (trouvé|obtenu)|grâce à (ce|cette) (guide|page) j'ai/i);
  }
});

test("contenu original : aucune phrase ni paragraphe en commun entre deux pages", async () => {
  const { PAGES_CONSEILS, textesVisibles } = await donnees();
  const vues = new Map();
  for (const p of PAGES_CONSEILS) {
    const phrases = textesVisibles(p).flatMap((t) => t.split(/(?<=[.!?])\s+/)).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 35);
    for (const s of phrases) {
      expect(vues.has(s) && vues.get(s) !== p.slug ? `${s} (déjà dans ${vues.get(s)})` : null, p.slug).toBeNull();
      vues.set(s, p.slug);
    }
  }
});

test("liens internes : seulement le créateur de CV, les offres et les autres conseils existants ; chaque page renvoie à d'autres conseils", async () => {
  const { PAGES_CONSEILS } = await donnees();
  const autorises = new Set(["/creer-cv", "/offres", ...SLUGS.map((s) => `/conseils/${s}`)]);
  for (const p of PAGES_CONSEILS) {
    const brut = JSON.stringify(p);
    const liens = [...brut.matchAll(/\[\[([^|\]]+)\|/g)].map((m) => m[1]);
    for (const l of liens) expect(autorises.has(l), `${p.slug} → ${l}`).toBe(true);
    expect(liens.includes(`/conseils/${p.slug}`), `${p.slug} ne se renvoie pas à elle-même`).toBe(false);
    expect(p.liensPage.length).toBeGreaterThanOrEqual(2);
    for (const s of p.liensPage) {
      expect(SLUGS.includes(s) && s !== p.slug, `${p.slug} → ${s}`).toBe(true);
    }
    expect(liens.some((l) => l.startsWith("/conseils/")), `${p.slug} : lien vers un autre conseil dans le texte`).toBe(true);
    expect(liens.includes("/creer-cv"), `${p.slug} : lien vers le créateur de CV`).toBe(true);
    expect(liens.includes("/offres"), `${p.slug} : lien vers les offres`).toBe(true);
  }
});

test("honnêteté sur le prix : la page « CV sur téléphone » dit que le téléchargement sur Facilité est payant", async () => {
  const { pageConseil, textesVisibles } = await donnees();
  const t = textesVisibles(pageConseil("creer-cv-telephone")).join(" ");
  expect(t).toMatch(/le téléchargement du CV final est payant, vérifiez le prix affiché dans la fenêtre de paiement avant de confirmer/);
  // Aucune autre affirmation sur le paiement que le code ne confirme pas.
  expect(t).not.toMatch(/avant que vous payiez|le tarif s'affiche|rien n'est débité|sans votre accord/i);
});

test("affirmations vérifiables : le créateur est décrit comme « un modèle prêt à remplir » (le code ne confirme pas un ordre de rubriques) ; aucune page ne promet que Facilité est gratuit", async () => {
  const { PAGES_CONSEILS, pageConseil, textesVisibles } = await donnees();
  const t1 = textesVisibles(pageConseil("modele-cv-senegal")).join(" ");
  expect(t1).toContain("avec un modèle prêt à remplir.");
  expect(t1).not.toMatch(/déjà organisé|dans l'ordre décrit ici/);
  for (const p of PAGES_CONSEILS) {
    const phrases = textesVisibles(p).flatMap((x) => x.split(/(?<=[.!?])\s+/));
    for (const ph of phrases) expect(/facilit/i.test(ph) && /gratuit/i.test(ph) && !/application de traitement de texte/i.test(ph), `${p.slug} : ${ph}`).toBe(false);
  }
});

test("page d'un conseil : rendu serveur, un seul h1, h2, JSON-LD Article et BreadcrumbList, canonique, bouton vers /creer-cv, aucune image, 404 hors des cinq pages", () => {
  const p = lire("src/app/conseils/[slug]/page.js");
  expect(p).not.toContain('"use client"');
  expect((p.match(/<h1\b/g) || []).length).toBe(1);
  expect(p).toContain("<h2");
  expect(p).toContain('"@type": "Article"');
  expect(p).toContain('"@type": "BreadcrumbList"');
  expect(p).toContain("alternates: { canonical: url },");
  expect(p).toContain('<Link href="/creer-cv" className={BOUTON}>Créer mon CV</Link>');
  expect(p).toContain("export const dynamicParams = false;");
  expect(p).toContain("generateStaticParams");
  expect(p).not.toMatch(/<img|<Image|imageUrl|\bimage:/);
  // Champs réels seulement : pas d'auteur personnel inventé, pas de note ni d'avis.
  expect(p).not.toMatch(/aggregateRating|review|Person/);
});

test("index /conseils : un seul h1, canonique, JSON-LD BreadcrumbList, titre et description propres", () => {
  const p = lire("src/app/conseils/page.js");
  expect((p.match(/<h1\b/g) || []).length).toBe(1);
  expect(p).toContain("alternates: { canonical: URL_INDEX },");
  expect(p).toContain('"@type": "BreadcrumbList"');
  expect(p).toContain('title: "Conseils emploi et CV au Sénégal"');
  expect("Conseils emploi et CV au Sénégal | Facilite".length).toBeLessThanOrEqual(60);
});

test("sitemap et accès : l'index et les cinq pages sont annoncés, /conseils est ouvert aux visiteurs", () => {
  const s = lire("src/app/sitemap.js");
  expect(s).toContain('{ path: "/conseils", changeFrequency: "monthly", priority: 0.7 },');
  expect(s).toContain("...PAGES_CONSEILS.map((p) => ({ path: `/conseils/${p.slug}`");
  const proxy = lire("src/proxy.js");
  expect(proxy).toMatch(/PUBLIC_BROWSABLE_ROUTES = \[[\s\S]*?"\/conseils",[\s\S]*?\];/);
});

test("pied de page seulement : les liens Conseils sont dans Footer, la navigation principale n'est pas touchée", () => {
  const f = lire("src/components/Footer.jsx");
  expect(f).toContain('<nav aria-label="Conseils"');
  expect(f).toContain('href="/conseils"');
  expect(f).toContain("PAGES_CONSEILS.map");
  expect(lire("src/components/Header.jsx")).not.toMatch(/\/conseils/);
});
