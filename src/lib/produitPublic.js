// Page produit publique du Marketplace (/marketplace/produit/[id]) : ce qu'on a le droit d'y montrer, ce qui est éligible au référencement, titres, descriptions et
// JSON-LD Product. Logique pure, sans réseau (la lecture des données est dans produitsServeur.js).
//
// CONFIDENTIALITÉ : une page produit est lisible de tous et envoyée telle quelle aux moteurs de recherche. On n'y met JAMAIS le numéro WhatsApp d'une boutique, ses
// coordonnées GPS, ni l'identifiant de son propriétaire : seulement le nom de la boutique, son quartier et sa ville. Les colonnes ci-dessous sont les SEULES lues.
import { adresseImage } from "./imagesPubliques.js";
import { descriptionOffre, tronquer, LONGUEUR_TITRE_PAGE, LONGUEUR_DESCRIPTION } from "./titresReferencement.js";

export const COLONNES_ARTICLE_PUBLIC = [
  "id",
  "titre",
  "description",
  "categorie",
  "prix_xof",
  "quantite",
  "statut",
  "photos",
  "actif",
  "etat",
  "marque",
  "taille",
  "store_id",
  "updated_at",
];
export const SELECT_ARTICLE_PUBLIC = COLONNES_ARTICLE_PUBLIC.join(",");

export const COLONNES_BOUTIQUE_PUBLIC = ["id", "nom", "quartier", "ville", "actif"];
export const SELECT_BOUTIQUE_PUBLIC = COLONNES_BOUTIQUE_PUBLIC.join(",");

/** Colonnes qu'une page produit ne doit jamais lire ni envoyer. */
export const COLONNES_INTERDITES_PRODUIT = ["telephone_whatsapp", "latitude", "longitude", "owner_id", "whatsapp_confirme_numero", "position_precision_m"];

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idProduitValide = (id) => ID_UUID.test(String(id ?? ""));

const uneLigne = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Noms de test ou vides
// ---------------------------------------------------------------------------
const MOTS_TEST = /(^|[^\p{L}])(tests?|testeur|demo|démo|d[ée]mos?|essais?|exemples?|fake|bidon|lorem|ipsum|asdf|qwerty|azerty|xxx+)([^\p{L}]|$)/iu;

/** Vrai si un nom d'article ou de boutique est vide, ressemble à un test ou n'a pas de sens (lettres répétées, sans voyelle, « ? »…). */
export function nomRessembleATest(nom) {
  const n = uneLigne(nom);
  if (n.length < 3) return true;
  if (!/\p{L}/u.test(n)) return true;
  if (MOTS_TEST.test(n)) return true;
  if (/\?{2,}|�/.test(n)) return true;
  if (/^(.)\1{2,}$/iu.test(n.replace(/\s/g, ""))) return true;
  if (!/[aeiouyàâäéèêëîïôöùûüœ]/iu.test(n)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
/** Adresses publiques des photos (bucket marketplace-photos, par le Worker si l'interrupteur est ouvert). Les images en base64 sont ignorées. */
export function photosPubliques(photos, urlSupabase, hote) {
  let liste = photos;
  if (typeof liste === "string") {
    try {
      const j = JSON.parse(liste);
      liste = Array.isArray(j) ? j : [liste];
    } catch {
      liste = [liste];
    }
  }
  if (!Array.isArray(liste)) return [];
  const base = String(urlSupabase || "").replace(/\/+$/, "");
  const sortie = [];
  for (const brute of liste) {
    if (typeof brute !== "string") continue;
    const t = brute.trim();
    if (!t || t.startsWith("data:")) continue;
    let url = null;
    const adresses = t.match(/https?:\/\/[^\s"'<>\\]+/g);
    if (adresses && adresses.length) url = adresses[adresses.length - 1];
    else if (base) url = `${base}/storage/v1/object/public/marketplace-photos/${t.replace(/^\/+/, "")}`;
    if (url) sortie.push(hote === undefined ? adresseImage(url) : adresseImage(url, hote));
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Éligibilité
// ---------------------------------------------------------------------------
/**
 * Article éligible au référencement : actif, boutique active, au moins une photo, prix supérieur à 0, et ni l'article ni la boutique n'ont un nom vide ou de test.
 * @returns {{ eligible: boolean, raison?: string }}
 */
export function articleEligible(article, boutique, urlSupabase) {
  if (!article || !boutique) return { eligible: false, raison: "introuvable" };
  if (article.actif !== true) return { eligible: false, raison: "article inactif" };
  if (boutique.actif !== true) return { eligible: false, raison: "boutique inactive" };
  if (!(Number(article.prix_xof) > 0)) return { eligible: false, raison: "sans prix" };
  if (photosPubliques(article.photos, urlSupabase).length === 0) return { eligible: false, raison: "sans photo" };
  if (nomRessembleATest(article.titre)) return { eligible: false, raison: "titre vide ou de test" };
  if (nomRessembleATest(boutique.nom)) return { eligible: false, raison: "boutique au nom vide ou de test" };
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Titres uniques
// ---------------------------------------------------------------------------
const cle = (s) => uneLigne(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function titreAvecSuffixe(titre, suffixe, max) {
  return `${tronquer(titre, Math.max(12, max - suffixe.length))}${suffixe}`;
}

/**
 * Titre de page de chaque produit, UNIQUE dans l'ensemble donné (le modèle de titre du site ajoute la marque) : « intitulé – ville » ; si deux produits donnent le même
 * titre, la boutique les départage, puis quatre caractères de l'identifiant en dernier recours. Déterministe : le même ensemble donne toujours les mêmes titres.
 * @param {{ id: string, titre: string, ville?: string, boutique?: string }[]} produits
 * @returns {Map<string, string>} identifiant → titre
 */
export function titresProduits(produits, max = LONGUEUR_TITRE_PAGE) {
  const titres = new Map();
  const suffixeVille = (p) => (uneLigne(p.ville) ? ` – ${uneLigne(p.ville)}` : "");
  for (const p of produits) titres.set(p.id, titreAvecSuffixe(uneLigne(p.titre), suffixeVille(p), max));
  const doublons = () => {
    const groupes = new Map();
    for (const [id, t] of titres) groupes.set(cle(t), [...(groupes.get(cle(t)) || []), id]);
    return [...groupes.values()].filter((ids) => ids.length > 1).flat();
  };
  const parId = new Map(produits.map((p) => [p.id, p]));
  let enDouble = doublons();
  if (enDouble.length) {
    for (const id of enDouble) {
      const p = parId.get(id);
      const nom = uneLigne(p.boutique);
      titres.set(id, titreAvecSuffixe(uneLigne(p.titre), nom ? ` – ${nom}` : suffixeVille(p), max));
    }
    enDouble = doublons();
    for (const id of enDouble) {
      const p = parId.get(id);
      const nom = uneLigne(p.boutique);
      titres.set(id, titreAvecSuffixe(uneLigne(p.titre), `${nom ? ` – ${nom}` : suffixeVille(p)} ${id.slice(0, 4)}`, max + 6));
    }
  }
  return titres;
}

// ---------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------
export const formaterPrix = (xof) => `${String(Math.round(Number(xof) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

export const LIBELLES_ETAT = { neuf: "Neuf", comme_neuf: "Comme neuf", bon_etat: "Bon état", a_reparer: "À réparer" };
const CONDITION_SCHEMA = { neuf: "https://schema.org/NewCondition", comme_neuf: "https://schema.org/UsedCondition", bon_etat: "https://schema.org/UsedCondition", a_reparer: "https://schema.org/DamagedCondition" };
const CATEGORIES_CONNUES = { mode: "Mode", telephones: "Téléphones", electronique: "Électronique", maison: "Maison", beaute: "Beauté", vehicules: "Véhicules", immobilier: "Immobilier", services: "Services" };

/** Libellé lisible d'une catégorie ; « autre » (ou vide) n'apporte rien : null. */
export function libelleCategorie(categorie) {
  const c = uneLigne(categorie).toLowerCase();
  if (!c || c === "autre") return null;
  return CATEGORIES_CONNUES[c] || c.charAt(0).toUpperCase() + c.slice(1).replace(/[_-]+/g, " ");
}

/** Description : texte du vendeur sans émoji ; à défaut, une phrase faite UNIQUEMENT de données réelles (jamais inventée). */
export function descriptionProduit(article, boutique, max = LONGUEUR_DESCRIPTION) {
  const texte = uneLigne(article.description);
  const lieu = [uneLigne(boutique.quartier), uneLigne(boutique.ville)].filter(Boolean).join(", ");
  const phrase = `${uneLigne(article.titre)}${article.marque ? ` ${uneLigne(article.marque)}` : ""}${LIBELLES_ETAT[article.etat] ? ` (${LIBELLES_ETAT[article.etat].toLowerCase()})` : ""} à ${formaterPrix(article.prix_xof)}, vendu par ${uneLigne(boutique.nom)}${lieu ? ` à ${lieu}` : ""}.`;
  if (texte.length < 40) return tronquer(phrase, max);
  return descriptionOffre({ description: texte, title: article.titre, company: boutique.nom, location: lieu }, max);
}

/** Article disponible ? Le statut est calculé par la base (quantité > 0 = en stock). */
export const enStock = (article) => article.statut === "en_stock" || (article.statut == null && Number(article.quantite) > 0);

/**
 * JSON-LD Product. Prix en XOF, disponibilité, vendeur (nom de la boutique) ; AUCUN avis ni note, AUCUN priceValidUntil deviné.
 */
export function jsonLdProduit({ article, boutique, photos, url }) {
  const lieu = [uneLigne(boutique.quartier), uneLigne(boutique.ville)].filter(Boolean).join(", ");
  const categorie = libelleCategorie(article.categorie);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: uneLigne(article.titre),
    description: descriptionProduit(article, boutique, 500),
    image: photos.slice(0, 8),
    sku: article.id,
    url,
    ...(uneLigne(article.marque) ? { brand: { "@type": "Brand", name: uneLigne(article.marque) } } : {}),
    ...(categorie ? { category: categorie } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: String(Math.round(Number(article.prix_xof))),
      priceCurrency: "XOF",
      availability: enStock(article) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(CONDITION_SCHEMA[article.etat] ? { itemCondition: CONDITION_SCHEMA[article.etat] } : {}),
      seller: { "@type": "Organization", name: uneLigne(boutique.nom), ...(lieu ? { areaServed: lieu } : {}) },
    },
  };
}
