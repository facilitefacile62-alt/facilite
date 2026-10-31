import Link from "next/link";
import { notFound } from "next/navigation";
import { safeJsonLdString } from "@/lib/jsonLd";
import { DATE_MODIFICATION, DATE_PUBLICATION, PAGES_CONSEILS, pageConseil } from "@/lib/conseils";
import ConseilTexte from "../ConseilTexte";

// Page de conseils rendue côté serveur : un seul h1, des h2, JSON-LD Article et BreadcrumbList (champs réels seulement), canonique, liens internes
// (créateur de CV, offres, autres conseils) et un bouton vers la création de CV. Aucune image.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return PAGES_CONSEILS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = pageConseil(slug);
  if (!page) return {};
  const url = `${SITE_URL}/conseils/${page.slug}`;
  return {
    title: page.titre,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "Facilité",
      locale: "fr_SN",
      url,
      title: `${page.titre} | Facilite`,
      description: page.description,
      publishedTime: DATE_PUBLICATION,
      modifiedTime: DATE_MODIFICATION,
    },
    twitter: { card: "summary", title: `${page.titre} | Facilite`, description: page.description },
  };
}

function jsonLd(page) {
  const url = `${SITE_URL}/conseils/${page.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      inLanguage: "fr",
      datePublished: DATE_PUBLICATION,
      dateModified: DATE_MODIFICATION,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      author: { "@type": "Organization", name: "Facilité", url: SITE_URL },
      publisher: { "@type": "Organization", name: "Facilité", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.jpeg` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Conseils", item: `${SITE_URL}/conseils` },
        { "@type": "ListItem", position: 3, name: page.court, item: url },
      ],
    },
  ];
}

const BOUTON =
  "inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export default async function ConseilPage({ params }) {
  const { slug } = await params;
  const page = pageConseil(slug);
  if (!page) notFound();
  const voirAussi = page.liensPage.map(pageConseil).filter(Boolean);

  return (
    <>
      {jsonLd(page).map((donnees, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(donnees) }} />
      ))}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">Accueil</Link>
          {" › "}
          <Link href="/conseils" className="hover:underline">Conseils</Link>
        </nav>

        <article>
          <h1 className="text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">{page.h1}</h1>
          <p className="mt-4 text-base leading-relaxed text-gray-800 dark:text-gray-200">
            <ConseilTexte texte={page.intro} />
          </p>
          <p className="mt-5">
            <Link href="/creer-cv" className={BOUTON}>Créer mon CV</Link>
          </p>

          {page.sections.map((section) => {
            const paragraphes = section.paragraphes || [];
            const debutExemple = section.exempleDepuis ?? paragraphes.length;
            return (
              <section key={section.h2} className="mt-10">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{section.h2}</h2>
                {paragraphes.slice(0, debutExemple).map((p) => (
                  <p key={p} className="mt-3 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                    <ConseilTexte texte={p} />
                  </p>
                ))}
                {section.liste && (
                  section.ordonnee ? (
                    <ol className="mt-3 list-decimal space-y-2 pl-6 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                      {section.liste.map((item) => <li key={item}><ConseilTexte texte={item} /></li>)}
                    </ol>
                  ) : (
                    <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                      {section.liste.map((item) => <li key={item}><ConseilTexte texte={item} /></li>)}
                    </ul>
                  )
                )}
                {debutExemple < paragraphes.length && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-5 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                    {paragraphes.slice(debutExemple).map((p) => <p key={p}>{p}</p>)}
                  </div>
                )}
              </section>
            );
          })}
        </article>

        <section aria-labelledby="creer-cv-action" className="mt-12 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-6">
          <h2 id="creer-cv-action" className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Prêt à passer à l&apos;action ?</h2>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
            Créez votre CV, puis consultez <Link href="/offres" className="font-semibold underline underline-offset-2">les offres d&apos;emploi</Link> et envoyez votre candidature.
          </p>
          <p className="mt-4"><Link href="/creer-cv" className={BOUTON}>Créer mon CV</Link></p>
        </section>

        <nav aria-labelledby="a-lire-aussi" className="mt-10">
          <h2 id="a-lire-aussi" className="text-lg font-extrabold text-gray-900 dark:text-gray-100">À lire aussi</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {voirAussi.map((p) => (
              <li key={p.slug}>
                <Link href={`/conseils/${p.slug}`} className="block h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm font-bold text-gray-900 dark:text-gray-100 hover:border-emerald-500 transition-colors">
                  {p.court}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm"><Link href="/conseils" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">Tous les conseils</Link></p>
        </nav>
      </main>
    </>
  );
}
