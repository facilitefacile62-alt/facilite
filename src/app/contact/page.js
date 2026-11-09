import Link from "next/link";
import { safeJsonLdString } from "@/lib/jsonLd";
import { FACILITE_EDITEUR, FACILITE_EMAIL_CONTACT, FACILITE_WHATSAPP_DISPLAY, FACILITE_WHATSAPP_NUMBER, editeurRenseigne } from "@/lib/contactFacilite";

// Page « Contact » : comment joindre l'équipe, avec les seules coordonnées déjà publiées sur le site (WhatsApp d'assistance de la FAQ, adresse e-mail des
// pages légales, messagerie, FAQ). Le bloc « Éditeur du site » (raison sociale, numéro d'enregistrement, adresse) n'apparaît que si les trois valeurs sont
// renseignées dans src/lib/contactFacilite.js ; tant qu'elles sont vides, il est absent de la page. Ces informations ne doivent JAMAIS être inventées.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";
const URL_PAGE = `${SITE_URL}/contact`;

export const metadata = {
  title: "Contact : joindre l'équipe Facilité",
  description: "Comment joindre l'équipe Facilité : WhatsApp, e-mail, messagerie du site et foire aux questions.",
  alternates: { canonical: URL_PAGE },
  openGraph: {
    type: "website",
    siteName: "Facilité",
    locale: "fr_SN",
    url: URL_PAGE,
    title: "Contact : joindre l'équipe Facilité | Facilite",
    description: "Comment joindre l'équipe Facilité : WhatsApp, e-mail, messagerie du site et foire aux questions.",
  },
};

const fildariane = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Contact", item: URL_PAGE },
  ],
};

const CARTE = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5";
const LIEN = "font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2";

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(fildariane) }} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">Accueil</Link>
        </nav>
        <h1 className="text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">Contacter l&apos;équipe Facilité</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-800 dark:text-gray-200">
          Une question, un problème avec une offre, un doute sur un recruteur ? Voici comment nous joindre. Par message, n&apos;envoyez jamais de mot de passe, de code reçu par
          SMS ni d&apos;informations bancaires.
        </p>

        <section aria-labelledby="canaux" className="mt-8">
          <h2 id="canaux" className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Nous joindre</h2>
          <ul className="mt-4 grid gap-4">
            <li className={CARTE}>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">WhatsApp d&apos;assistance</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Écrivez-nous sur WhatsApp au {FACILITE_WHATSAPP_DISPLAY}.</p>
              <p className="mt-3">
                <a
                  href={`https://wa.me/${FACILITE_WHATSAPP_NUMBER}?text=${encodeURIComponent("Bonjour Facilité, j'ai besoin d'aide sur la plateforme Facilité.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  Écrire sur WhatsApp
                </a>
              </p>
            </li>
            <li className={CARTE}>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">E-mail</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                <a href={`mailto:${FACILITE_EMAIL_CONTACT}`} className={LIEN}>{FACILITE_EMAIL_CONTACT}</a>
              </p>
            </li>
            <li className={CARTE}>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">Messagerie du site</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Si vous avez un compte, écrivez à l&apos;équipe depuis votre <Link href="/messagerie" className={LIEN}>messagerie</Link>.
              </p>
            </li>
            <li className={CARTE}>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">Questions fréquentes et aide à la candidature</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                La <Link href="/faq" className={LIEN}>foire aux questions</Link> répond aux questions courantes, et la page{" "}
                <Link href="/aide-candidature" className={LIEN}>aide à la candidature</Link> explique comment postuler.
              </p>
            </li>
          </ul>
        </section>

        <section aria-labelledby="signaler" className="mt-10">
          <h2 id="signaler" className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Signaler une offre suspecte</h2>
          <p className="mt-3 text-base leading-relaxed text-gray-800 dark:text-gray-200">
            Sur la fiche d&apos;une offre, utilisez le lien « Signaler cette offre » (réservé aux comptes connectés). Pour reconnaître une fausse offre, lisez nos{" "}
            <Link href="/conseils/anti-arnaque" className={LIEN}>conseils anti-arnaque</Link>.
          </p>
        </section>

        {editeurRenseigne() && (
          <section aria-labelledby="editeur" className="mt-10">
            <h2 id="editeur" className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Éditeur du site</h2>
            <dl className="mt-3 space-y-3 text-base text-gray-800 dark:text-gray-200">
              <div>
                <dt className="text-sm font-bold text-gray-600 dark:text-gray-400">Nom ou raison sociale</dt>
                <dd>{FACILITE_EDITEUR.raisonSociale}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-gray-600 dark:text-gray-400">Numéro d&apos;enregistrement</dt>
                <dd>{FACILITE_EDITEUR.numeroEnregistrement}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-gray-600 dark:text-gray-400">Adresse</dt>
                <dd>{FACILITE_EDITEUR.adresse}</dd>
              </div>
            </dl>
          </section>
        )}

        <p className="mt-10 text-sm text-gray-700 dark:text-gray-300">
          Voir aussi : <Link href="/conditions" className={LIEN}>conditions d&apos;utilisation</Link> et{" "}
          <Link href="/confidentialite" className={LIEN}>politique de confidentialité</Link>.
        </p>
      </main>
    </>
  );
}
