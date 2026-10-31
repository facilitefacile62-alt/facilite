import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/staticPageMetadata";
import { LONGUEUR_TITRE_PAGE, tronquer } from "@/lib/titresReferencement";
import MarketplaceClient from "./MarketplaceClient";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";
const ID_ARTICLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const metadataDeBase = {
  ...canonicalMetadata("/marketplace"),
  title: "Marketplace : annonces à Dakar et au Sénégal",
  description: "Découvrez la sélection du jour sur Facilité Marketplace : téléphones, véhicules, immobilier, mode et services à Dakar, Thiès et partout au Sénégal.",
};

/** Lecture publique d'un article (policy « articles visibles de tous ») pour son aperçu de partage ; null si introuvable. */
async function articlePourApercu(id) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle || !ID_ARTICLE.test(id)) return null;
  try {
    const reponse = await fetch(`${url}/rest/v1/marketplace_items?id=eq.${id}&select=titre,prix_xof,photos&limit=1`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      next: { revalidate: 300 },
    });
    if (!reponse.ok) return null;
    const [ligne] = await reponse.json();
    if (!ligne?.titre) return null;
    const brute = Array.isArray(ligne.photos) ? ligne.photos[0] : null;
    const photo = !brute ? null : /^https?:/i.test(brute) ? brute : `${url}/storage/v1/object/public/marketplace-photos/${brute}`;
    return { titre: ligne.titre, prix: Number(ligne.prix_xof) || 0, photo };
  } catch {
    return null;
  }
}

// Aperçu de partage d'un article (WhatsApp, Facebook, SMS…) : quand le lien /marketplace?article=<id> est collé dans une conversation,
// l'application de messagerie affiche une CARTE avec la photo, le nom et le prix de l'article (balises Open Graph), touchable pour
// l'ouvrir. Sans article, ce sont les métadonnées habituelles de la page.
export async function generateMetadata({ searchParams }) {
  const { article } = (await searchParams) || {};
  const id = Array.isArray(article) ? article[0] : article;
  const donnees = id ? await articlePourApercu(id) : null;
  if (!donnees) return metadataDeBase;

  const prix = donnees.prix > 0 ? `${String(Math.round(donnees.prix)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA` : null;
  const titre = prix ? `${donnees.titre} — ${prix}` : donnees.titre;
  // Titre de l'onglet : court et sans marque (le modèle du site l'ajoute) ; l'aperçu de partage garde le nom complet.
  const titreOnglet = prix ? `${tronquer(donnees.titre, LONGUEUR_TITRE_PAGE - prix.length - 3)} — ${prix}` : tronquer(donnees.titre, LONGUEUR_TITRE_PAGE);
  const description = prix ? `${prix} · Voir l'article sur Facilité Marketplace` : "Voir l'article sur Facilité Marketplace";
  return {
    ...metadataDeBase,
    title: titreOnglet,
    description,
    alternates: { canonical: `${SITE_URL}/marketplace?article=${id}` },
    openGraph: {
      type: "website",
      siteName: "Facilité",
      url: `${SITE_URL}/marketplace?article=${id}`,
      title: titre,
      description,
      ...(donnees.photo ? { images: [{ url: donnees.photo, alt: donnees.titre }] } : {}),
    },
    twitter: { card: donnees.photo ? "summary_large_image" : "summary", title: titre, description, ...(donnees.photo ? { images: [donnees.photo] } : {}) },
  };
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <MarketplaceClient />
    </Suspense>
  );
}
