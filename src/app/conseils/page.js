import Link from "next/link";
import { safeJsonLdString } from "@/lib/jsonLd";
import { PAGES_CONSEILS } from "@/lib/conseils";

// Index des pages de conseils : un seul h1, la liste des guides, JSON-LD BreadcrumbList, canonique.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";
const URL_INDEX = `${SITE_URL}/conseils`;

export const metadata = {
  title: "Conseils emploi et CV au Sénégal",
  description: "Cinq guides simples pour chercher un emploi au Sénégal : faire son CV, écrire une lettre, postuler par WhatsApp ou e-mail et réussir son entretien.",
  alternates: { canonical: URL_INDEX },
  openGraph: {
    type: "website",
    siteName: "Facilité",
    locale: "fr_SN",
    url: URL_INDEX,
    title: "Conseils emploi et CV au Sénégal | Facilite",
    description: "Cinq guides simples pour chercher un emploi au Sénégal : faire son CV, écrire une lettre, postuler par WhatsApp ou e-mail et réussir son entretien.",
  },
};

const fildariane = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Conseils", item: URL_INDEX },
  ],
};

export default function ConseilsIndex() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(fildariane) }} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">Accueil</Link>
        </nav>
        <h1 className="text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">Conseils pour trouver un emploi au Sénégal</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-800 dark:text-gray-200">
          Des guides courts et concrets, écrits en français simple, pour préparer votre candidature : le CV, la lettre, l&apos;envoi par WhatsApp ou par e-mail et l&apos;entretien.
        </p>
        <ul className="mt-8 grid gap-4">
          {PAGES_CONSEILS.map((p) => (
            <li key={p.slug}>
              <Link href={`/conseils/${p.slug}`} className="block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-emerald-500 transition-colors">
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{p.h1}</h2>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href="/creer-cv" className="inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            Créer mon CV
          </Link>
        </p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          Pour chercher en sécurité, lisez aussi nos <Link href="/conseils/anti-arnaque" className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2">conseils anti-arnaque</Link>.
        </p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
          Vous cherchez déjà un poste ? Parcourez <Link href="/offres" className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2">les offres d&apos;emploi</Link>.
        </p>
      </main>
    </>
  );
}
