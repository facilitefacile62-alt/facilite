const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Étape 4 : pages produit indexables. Éligibilité (actif, boutique active, photo, prix > 0, noms valides), titres uniques, JSON-LD Product en XOF sans avis ni
 * priceValidUntil, JAMAIS de numéro WhatsApp / GPS / propriétaire, 404 si introuvable, sitemap, canonique, ancien lien partagé conservé.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/produitPublic.js");
const BASE = "https://ocfhzwwjvljintabxxlg.supabase.co";
const HOTE = "https://facilite-images.exemple.workers.dev";
const boutiqueOk = { id: "b1", nom: "Boutique Aminata", quartier: "Médina", ville: "Dakar", actif: true };
const articleOk = { id: "a1b2c3d4-0000-4000-8000-000000000001", titre: "Sérum Visage BIOAQUA 15ml", description: "", categorie: "mode", prix_xof: 3500, quantite: 4, statut: "en_stock", photos: ["u1/photo1.jpg"], actif: true, etat: "neuf", marque: "BIOAQUA", taille: null, store_id: "b1", updated_at: "2026-10-20T10:00:00Z" };

test("colonnes lues : aucune colonne privée (numéro WhatsApp, GPS, propriétaire), aucun select *", async () => {
  const m = await mod();
  const lues = [...m.COLONNES_ARTICLE_PUBLIC, ...m.COLONNES_BOUTIQUE_PUBLIC];
  for (const interdite of m.COLONNES_INTERDITES_PRODUIT) expect(lues, interdite).not.toContain(interdite);
  expect(m.SELECT_ARTICLE_PUBLIC + m.SELECT_BOUTIQUE_PUBLIC).not.toMatch(/\*|telephone|latitude|longitude|owner/);
  const serveur = lire("src/lib/produitsServeur.js");
  expect(serveur).not.toMatch(/select=\*|\.select\("\*"\)/);
  expect(serveur).toContain("select=${SELECT_ARTICLE_PUBLIC}");
  expect(serveur).toContain("select=${SELECT_BOUTIQUE_PUBLIC}");
});

test("éligibilité : actif, boutique active, photo, prix > 0 ; refus de l'inactif, sans photo, sans prix, titre ou boutique vide ou de test", async () => {
  const { articleEligible } = await mod();
  expect(articleEligible(articleOk, boutiqueOk, BASE).eligible).toBe(true);
  const refus = (a, b) => articleEligible({ ...articleOk, ...a }, { ...boutiqueOk, ...b }, BASE);
  expect(refus({ actif: false }, {}).eligible).toBe(false);
  expect(refus({}, { actif: false }).eligible).toBe(false);
  expect(refus({ prix_xof: 0 }, {}).eligible).toBe(false);
  expect(refus({ prix_xof: null }, {}).eligible).toBe(false);
  expect(refus({ photos: [] }, {}).eligible).toBe(false);
  expect(refus({ photos: ["data:image/png;base64,AAAA"] }, {}).eligible).toBe(false);
  expect(refus({ titre: "" }, {}).eligible).toBe(false);
  expect(refus({ titre: "Test produit 2" }, {}).eligible).toBe(false);
  expect(refus({}, { nom: "" }).eligible).toBe(false);
  expect(refus({}, { nom: "Boutique de test" }).eligible).toBe(false);
  expect(refus({}, { nom: "FGHGF" }).eligible).toBe(false);
  expect(articleEligible(null, boutiqueOk, BASE).eligible).toBe(false);
});

test("noms de test : vides, très courts, « test/démo/essai… », lettres répétées, sans voyelle ou avec « ? » refusés ; noms normaux acceptés", async () => {
  const { nomRessembleATest } = await mod();
  for (const n of ["", "  ", "ab", "Test", "Boutique test", "DEMO shop", "Essai 3", "xxxx", "aaaa", "FGHGF", "N?.N?N?N?", "123456"]) expect(nomRessembleATest(n), n).toBe(true);
  for (const n of ["Boutique Aminata", "Chez Mamadou", "Pharmacie du Plateau", "Sérum Visage BIOAQUA 15ml", "Montre Rolex Submariner"]) expect(nomRessembleATest(n), n).toBe(false);
});

test("photos : chemin du bucket marketplace-photos ou adresse complète, par le Worker si l'interrupteur est ouvert ; base64 ignoré ; liste JSON acceptée", async () => {
  const { photosPubliques } = await mod();
  expect(photosPubliques(["u1/p.jpg"], BASE, "")).toEqual([`${BASE}/storage/v1/object/public/marketplace-photos/u1/p.jpg`]);
  expect(photosPubliques(["u1/p.jpg"], BASE, HOTE)).toEqual([`${HOTE.replace(/\/$/, "")}/marketplace-photos/u1/p.jpg`]);
  expect(photosPubliques(["https://exemple.com/x.jpg", "data:image/png;base64,AAAA", 7, ""], BASE, HOTE)).toEqual(["https://exemple.com/x.jpg"]);
  expect(photosPubliques('["u1/p.jpg","u1/q.jpg"]', BASE, "")).toHaveLength(2);
  expect(photosPubliques(null, BASE, "")).toEqual([]);
});

test("titres : « intitulé – ville », 49 caractères au plus, UNIQUES dans l'ensemble ; doublons départagés par la boutique puis par l'identifiant ; déterministe", async () => {
  const { titresProduits } = await mod();
  const p = (id, titre, ville, boutique) => ({ id, titre, ville, boutique });
  const t = titresProduits([p("a1111111", "Sérum Visage BIOAQUA", "Dakar", "Aminata"), p("a2222222", "Crème mains", "Thiès", "Fatou")]);
  expect(t.get("a1111111")).toBe("Sérum Visage BIOAQUA – Dakar");
  expect(t.get("a2222222")).toBe("Crème mains – Thiès");
  const memeTitre = titresProduits([p("b1111111", "Montre Rolex", "Dakar", "Aminata"), p("b2222222", "Montre Rolex", "Dakar", "Fatou"), p("b3333333", "Montre Rolex", "Dakar", "Fatou")]);
  expect(new Set(memeTitre.values()).size).toBe(3);
  const longs = titresProduits([p("c1111111", "Crème Hydratante Pieds et Mains CINDYNAL Anti-Crevasses à l'huile de cheval", "Dakar", "A"), p("c2222222", "Crème Hydratante Pieds et Mains CINDYNAL Anti-Crevasses à l'huile de karité", "Dakar", "B")]);
  expect(new Set(longs.values()).size).toBe(2);
  for (const v of longs.values()) expect(v.length).toBeLessThanOrEqual(56);
  expect(titresProduits([p("b1111111", "Montre Rolex", "Dakar", "A"), p("b2222222", "Montre Rolex", "Dakar", "B")])).toEqual(titresProduits([p("b2222222", "Montre Rolex", "Dakar", "B"), p("b1111111", "Montre Rolex", "Dakar", "A")]));
});

test("JSON-LD Product : prix en XOF, disponibilité, état, vendeur ; aucun avis, note, priceValidUntil, numéro, GPS ni propriétaire", async () => {
  const { jsonLdProduit } = await mod();
  const url = "https://ffacilite.com/marketplace/produit/" + articleOk.id;
  const ld = jsonLdProduit({ article: articleOk, boutique: { ...boutiqueOk, telephone_whatsapp: "+221770000000", latitude: 14.69, longitude: -17.44, owner_id: "uuid-proprio" }, photos: ["https://x/1.jpg"], url });
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers.priceCurrency).toBe("XOF");
  expect(ld.offers.price).toBe("3500");
  expect(ld.offers.availability).toBe("https://schema.org/InStock");
  expect(ld.offers.itemCondition).toBe("https://schema.org/NewCondition");
  expect(ld.offers.seller).toEqual({ "@type": "Organization", name: "Boutique Aminata", areaServed: "Médina, Dakar" });
  expect(ld.brand.name).toBe("BIOAQUA");
  const texte = JSON.stringify(ld);
  expect(texte).not.toMatch(/aggregateRating|review|ratingValue|priceValidUntil|770000000|14\.69|17\.44|owner|uuid-proprio|telephone/i);
  expect(jsonLdProduit({ article: { ...articleOk, statut: "epuise", quantite: 0, etat: null, marque: "" }, boutique: boutiqueOk, photos: ["u"], url }).offers.availability).toBe("https://schema.org/OutOfStock");
  expect(jsonLdProduit({ article: { ...articleOk, etat: null }, boutique: boutiqueOk, photos: ["u"], url }).offers.itemCondition).toBeUndefined();
});

test("description : texte du vendeur sans émoji ; sinon phrase faite de données réelles seulement", async () => {
  const { descriptionProduit } = await mod();
  expect(descriptionProduit(articleOk, boutiqueOk)).toBe("Sérum Visage BIOAQUA 15ml BIOAQUA (neuf), catégorie Mode, à 3 500 FCFA, vendu par Boutique Aminata à Médina, Dakar.");
  const d = descriptionProduit({ ...articleOk, description: "🧴 Sérum visage au riz, hydrate et illumine la peau. Flacon de 15 ml, parfait pour un usage quotidien soir et matin." }, boutiqueOk);
  expect(d).toMatch(/^Sérum visage au riz/);
  expect(d).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(d.length).toBeLessThanOrEqual(155);
});

test("page produit : 404 si introuvable ou inactif, ancien comportement (vers l'annonce) si actif mais incomplet, aucune donnée privée dans le rendu", () => {
  const p = lire("src/app/marketplace/produit/[id]/page.js");
  expect(p).toContain("if (!produit.article) notFound();");
  expect(p).toContain("if (!produit.eligible) redirect(`/marketplace?article=${encodeURIComponent(id)}`);");
  expect(p).toContain("href={`/marketplace?article=${encodeURIComponent(article.id)}`}");
  expect(p).toContain("alternates: { canonical: url },");
  // Le code (commentaires exclus) ne nomme jamais une donnée privée.
  expect(p.replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/telephone|whatsapp|latitude|longitude|owner_id|store_id/i);
  expect(p).toContain("jsonLdProduit(");
  expect(lire("src/lib/produitPublic.js")).not.toMatch(/priceValidUntil\s*:|aggregateRating\s*:|review\s*:/);
});

test("lien partagé d'avant : /marketplace?article=<id> garde son aperçu, sa canonique pointe vers la page produit seulement si elle est référençable", () => {
  const p = lire("src/app/marketplace/page.js");
  expect(p).toContain("const produit = await chargerProduit(id);");
  expect(p).toContain("produit.eligible ? `${SITE_URL}/marketplace/produit/${id}` : `${SITE_URL}/marketplace?article=${id}`");
  expect(p).toContain("alternates: { canonical: canonique },");
  expect(p).toContain("title: titreOnglet,");
});

test("plan du site : produits éligibles seulement, aucun si nav_marketplace est coupé, panne sans effet sur le reste", () => {
  const s = lire("src/app/sitemap.js");
  expect(s).toContain('filtrerRoutesDesactivees([{ path: "/marketplace" }])');
  expect(s).toContain("for (const { article } of await chargerProduitsEligibles())");
  expect(s).toContain("url: `${SITE_URL}/marketplace/produit/${article.id}`,");
  expect(s).toMatch(/catch \(err\) \{\n\s+console\.error\("\[sitemap\] Échec du chargement des produits/);
  expect(s).toContain("export const revalidate = 3600;");
});

// ---------------------------------------------------------------------------
// Correction de l'étape 4 : titres par défaut ou trop pauvres, description par défaut
// ---------------------------------------------------------------------------
test("titre par défaut ou trop pauvre : « Article Boutique », « Produit », « masque » refusés (ancien comportement : renvoi vers l'annonce) ; « Costume africain », « Smartphone » acceptés", async () => {
  const { articleEligible, titreParDefaut, titreTropPauvre } = await mod();
  for (const t of ["Article Boutique", "article boutique", "Article", "Produit", "Nouvel article", "Mon produit", "Sans titre", "Article 2"]) expect(titreParDefaut(t), t).toBe(true);
  for (const t of ["Costume africain", "Article de luxe en cuir", "Produit de beauté bio", "Montre Rolex"]) expect(titreParDefaut(t), t).toBe(false);
  for (const t of ["masque", "sac", "robe", "Table", "abc defg".slice(0, 3)]) expect(titreTropPauvre(t), t).toBe(true);
  for (const t of ["Costume africain", "Smartphone", "Sac Nike", "Robe longue", "Masque visage"]) expect(titreTropPauvre(t), t).toBe(false);
  const refus = (titre) => articleEligible({ ...articleOk, titre }, boutiqueOk, BASE);
  expect(refus("Article Boutique")).toEqual({ eligible: false, raison: "titre par défaut" });
  expect(refus("masque")).toEqual({ eligible: false, raison: "titre trop pauvre" });
  expect(refus("Costume africain").eligible).toBe(true);
  // ancien comportement conservé : la page renvoie vers l'annonce, qui reste fonctionnelle
  expect(lire("src/app/marketplace/produit/[id]/page.js")).toContain("if (!produit.eligible) redirect(`/marketplace?article=${encodeURIComponent(id)}`);");
});

test("description par défaut (« Superbe article disponible immédiatement en stock… ») : traitée comme vide ; la page, la meta description et le JSON-LD affichent la phrase construite avec les vraies données", async () => {
  const { descriptionParDefaut, descriptionVendeur, descriptionProduit, phraseProduit, jsonLdProduit } = await mod();
  const modele = "Superbe article disponible immédiatement en stock. Produit de très bonne qualité, vérifié et garanti. Contactez notre boutique directement via WhatsApp ou messagerie pour valider votre commande et profiter d'une livraison rapide à Dakar et partout au Sénégal.";
  expect(descriptionParDefaut(modele)).toBe(true);
  expect(descriptionParDefaut("  SUPERBE ARTICLE DISPONIBLE IMMEDIATEMENT EN STOCK ! autre suite")).toBe(true);
  expect(descriptionParDefaut("Sérum visage au riz, hydrate et illumine la peau.")).toBe(false);
  const article = { ...articleOk, description: modele };
  expect(descriptionVendeur(article)).toBeNull();
  const attendu = "Sérum Visage BIOAQUA 15ml BIOAQUA (neuf), catégorie Mode, à 3 500 FCFA, vendu par Boutique Aminata à Médina, Dakar.";
  expect(phraseProduit(article, boutiqueOk)).toBe(attendu);
  expect(descriptionProduit(article, boutiqueOk)).toBe(attendu);
  const ld = jsonLdProduit({ article, boutique: boutiqueOk, photos: ["https://x/1.jpg"], url: "https://ffacilite.com/marketplace/produit/" + article.id });
  expect(ld.description).toBe(attendu);
  expect(JSON.stringify(ld)).not.toMatch(/Superbe article|WhatsApp/i);
  // une vraie description du vendeur reste utilisée
  const vraie = "Sérum visage au riz, hydrate et illumine la peau. Flacon de 15 ml, parfait pour un usage quotidien soir et matin.";
  expect(descriptionVendeur({ ...articleOk, description: vraie })).toBe(vraie);
  expect(descriptionProduit({ ...articleOk, description: vraie }, boutiqueOk)).toMatch(/^Sérum visage au riz/);
  // deux produits au texte par défaut n'ont jamais la même description
  const a2 = { ...article, id: "x2", titre: "Costume africain", prix_xof: 30000 };
  expect(descriptionProduit(a2, boutiqueOk)).not.toBe(descriptionProduit(article, boutiqueOk));
  const page = lire("src/app/marketplace/produit/[id]/page.js");
  expect(page).toContain("{descriptionVendeur(article) || phraseProduit(article, boutique)}");
});
