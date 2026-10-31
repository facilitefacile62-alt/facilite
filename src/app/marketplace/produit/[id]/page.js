/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { safeJsonLdString } from "@/lib/jsonLd";
import { chargerProduit, chargerProduitsEligibles, urlSupabasePublique } from "@/lib/produitsServeur";
import { LIBELLES_ETAT, descriptionProduit, enStock, formaterPrix, jsonLdProduit, libelleCategorie, photosPubliques, titresProduits } from "@/lib/produitPublic";

// Page produit publique, rendue côté serveur : titre unique, JSON-LD Product (prix en XOF), photos par le Worker, quartier et ville seulement.
// Jamais de numéro WhatsApp, de coordonnées GPS ni d'identifiant de propriétaire (voir src/lib/produitPublic.js). Le contact reste dans /marketplace?article=<id>.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

const urlProduit = (id) => `${SITE_URL}/marketplace/produit/${id}`;

/** Titre unique du produit parmi tous les produits éligibles (le modèle de titre du site ajoute la marque). */
function titreDe(id, courant, eligibles) {
  const produits = eligibles.map(({ article, boutique }) => ({ id: article.id, titre: article.titre, ville: boutique.ville, boutique: boutique.nom }));
  if (!produits.some((p) => p.id === id)) produits.push({ id, titre: courant.article.titre, ville: courant.boutique.ville, boutique: courant.boutique.nom });
  return titresProduits(produits).get(id);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const produit = await chargerProduit(id);
  if (!produit.article) return { title: "Article introuvable", robots: { index: false, follow: false } };
  if (!produit.eligible) return { robots: { index: false, follow: true } };

  const eligibles = await chargerProduitsEligibles();
  const titre = titreDe(id, produit, eligibles);
  const description = descriptionProduit(produit.article, produit.boutique);
  const photos = photosPubliques(produit.article.photos, urlSupabasePublique());
  const url = urlProduit(id);
  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Facilité",
      locale: "fr_SN",
      url,
      title: `${titre} | Facilite`,
      description,
      images: [{ url: photos[0], alt: produit.article.titre }],
    },
    twitter: { card: "summary_large_image", title: `${titre} | Facilite`, description, images: [photos[0]] },
  };
}

export default async function ProduitPage({ params }) {
  const { id } = await params;
  const produit = await chargerProduit(id);
  // Introuvable ou inactif : 404. Actif mais pas assez complet pour être référencé (sans photo, sans prix, nom de test…) : comportement d'avant, vers l'annonce.
  if (!produit.article) notFound();
  if (!produit.eligible) redirect(`/marketplace?article=${encodeURIComponent(id)}`);

  const { article, boutique } = produit;
  const photos = photosPubliques(article.photos, urlSupabasePublique());
  const lieu = [boutique.quartier, boutique.ville].map((s) => String(s || "").trim()).filter(Boolean).join(", ");
  const categorie = libelleCategorie(article.categorie);
  const eligibles = await chargerProduitsEligibles();
  const autres = eligibles
    .filter((p) => p.article.id !== article.id)
    .sort((a, b) => Number(b.article.categorie === article.categorie) - Number(a.article.categorie === article.categorie))
    .slice(0, 4);
  const fiche = [
    ["Catégorie", categorie],
    ["État", LIBELLES_ETAT[article.etat]],
    ["Marque", article.marque],
    ["Taille", article.taille],
    ["Disponibilité", enStock(article) ? "En stock" : "Épuisé"],
    ["Boutique", boutique.nom],
    ["Lieu", lieu],
  ].filter(([, valeur]) => String(valeur || "").trim());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLdProduit({ article, boutique, photos, url: urlProduit(id) })) }} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">Accueil</Link>
          {" › "}
          <Link href="/marketplace" className="hover:underline">Marketplace</Link>
        </nav>

        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{article.titre}</h1>
        <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-400">{formaterPrix(article.prix_xof)}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {photos.slice(0, 6).map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? article.titre : `${article.titre}, photo ${i + 1}`}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 object-contain"
              {...(i === 0 ? {} : { loading: "lazy", decoding: "async" })}
            />
          ))}
        </div>

        {String(article.description || "").trim() && (
          <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">{article.description}</p>
        )}

        <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {fiche.map(([nom, valeur]) => (
            <div key={nom} className="contents">
              <dt className="font-semibold text-gray-600 dark:text-gray-400">{nom}</dt>
              <dd className="text-gray-900 dark:text-gray-100">{valeur}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8">
          <Link
            href={`/marketplace?article=${encodeURIComponent(article.id)}`}
            className="inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Voir l&apos;annonce et contacter le vendeur
          </Link>
        </p>

        {autres.length > 0 && (
          <section aria-labelledby="autres-produits" className="mt-12">
            <h2 id="autres-produits" className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mb-3">
              Autres produits du Marketplace
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {autres.map(({ article: a, boutique: b }) => (
                <li key={a.id}>
                  <Link
                    href={`/marketplace/produit/${a.id}`}
                    className="block h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-emerald-500 transition-colors"
                  >
                    <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{a.titre}</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {formaterPrix(a.prix_xof)}
                      {b.ville ? ` · ${b.ville}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
