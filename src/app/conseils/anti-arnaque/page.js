import Link from "next/link";
import { safeJsonLdString } from "@/lib/jsonLd";

// Conseils anti-arnaque : page publique, en français simple, sans donnée personnelle ni chiffre. Conseils généraux de prudence : la page n'affirme rien sur les
// offres ou les recruteurs du site (Facilité ne peut pas tous les vérifier) et n'accuse personne.
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";
const URL_PAGE = `${SITE_URL}/conseils/anti-arnaque`;
const TITRE = "Conseils anti-arnaque pour chercher un emploi";
const DESCRIPTION = "Ne jamais payer pour postuler, se méfier des adresses personnelles et des liens raccourcis, reconnaître une fausse offre et la signaler.";

export const metadata = {
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PAGE },
  openGraph: { type: "article", siteName: "Facilité", locale: "fr_SN", url: URL_PAGE, title: `${TITRE} | Facilite`, description: DESCRIPTION },
  twitter: { card: "summary", title: `${TITRE} | Facilite`, description: DESCRIPTION },
};

const fildariane = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Conseils", item: `${SITE_URL}/conseils` },
    { "@type": "ListItem", position: 3, name: "Conseils anti-arnaque", item: URL_PAGE },
  ],
};

const H2 = "text-xl font-extrabold text-gray-900 dark:text-gray-100";
const P = "mt-3 text-base leading-relaxed text-gray-800 dark:text-gray-200";
const LISTE = "mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-gray-800 dark:text-gray-200";
const LIEN = "font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2";

export default function ConseilsAntiArnaque() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(fildariane) }} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
          <Link href="/" className="hover:underline">Accueil</Link>
          {" › "}
          <Link href="/conseils" className="hover:underline">Conseils</Link>
        </nav>

        <article>
          <h1 className="text-3xl font-extrabold leading-tight text-gray-900 dark:text-gray-100">Conseils anti-arnaque : chercher un emploi en sécurité</h1>
          <p className="mt-4 text-base leading-relaxed text-gray-800 dark:text-gray-200">
            Beaucoup de recruteurs sont sérieux, mais des personnes malhonnêtes publient aussi de fausses offres, sur tous les sites et sur les réseaux. Ces quelques
            réflexes vous protègent. Ils valent pour toutes les offres, où que vous les trouviez.
          </p>

          <section className="mt-10">
            <h2 className={H2}>Ne payez jamais pour postuler</h2>
            <p className={P}>
              Un employeur sérieux ne vous demande pas d&apos;argent pour étudier votre dossier, passer un entretien, obtenir un uniforme ou « réserver » un poste.
              Si on vous demande de payer pour être candidat, refusez et arrêtez la conversation.
            </p>
          </section>

          <section className="mt-10">
            <h2 className={H2}>Méfiez-vous des adresses personnelles et des liens raccourcis</h2>
            <ul className={LISTE}>
              <li>
                Une adresse e-mail personnelle (Gmail, Yahoo, Hotmail…) n&apos;est pas toujours un problème : de petites structures s&apos;en servent. Mais elle ne prouve
                rien. Vérifiez que l&apos;entreprise existe vraiment, par exemple avec son site officiel.
              </li>
              <li>
                Un lien raccourci cache sa destination. Avant d&apos;y laisser vos informations, demandez-vous où il mène, et préférez le site officiel de
                l&apos;employeur.
              </li>
              <li>Un formulaire en ligne ne doit demander que ce qu&apos;il faut pour une candidature : votre CV et vos coordonnées, rien de plus.</li>
            </ul>
          </section>

          <section className="mt-10">
            <h2 className={H2}>Ne donnez jamais de code reçu par SMS ni d&apos;informations bancaires</h2>
            <p className={P}>
              Un code reçu par SMS ou par WhatsApp sert à ouvrir un compte ou à valider un paiement : il vous appartient, personne n&apos;a besoin de vous le demander
              pour une candidature. Ne communiquez pas non plus votre mot de passe, vos codes de paiement mobile, votre numéro de carte ou de compte, ni une
              photo de vos documents d&apos;identité tant que vous n&apos;êtes pas sûr de l&apos;employeur.
            </p>
          </section>

          <section className="mt-10">
            <h2 className={H2}>Comment reconnaître une fausse offre</h2>
            <ul className={LISTE}>
              <li>Le salaire est très élevé pour un poste simple, ou on promet un emploi sans entretien.</li>
              <li>Le recruteur est pressé et vous demande de décider très vite, ou de ne pas en parler.</li>
              <li>On vous demande de payer, d&apos;envoyer de l&apos;argent ou d&apos;avancer des frais, même petits.</li>
              <li>Le nom de l&apos;entreprise manque, ou vous ne trouvez rien sur elle : pas de site, pas d&apos;adresse, pas de numéro joignable.</li>
              <li>L&apos;annonce est pleine de fautes, ou le poste décrit ne correspond pas au titre.</li>
              <li>Le recruteur veut parler uniquement par messagerie, et refuse un appel ou une rencontre dans un lieu public.</li>
            </ul>
            <p className={P}>
              Un seul de ces signes ne prouve rien, mais plusieurs ensemble doivent vous faire arrêter. En cas de doute, demandez conseil à un proche avant de
              répondre.
            </p>
          </section>

          <section className="mt-10">
            <h2 className={H2}>Que faire en cas de doute ou d&apos;arnaque</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-base leading-relaxed text-gray-800 dark:text-gray-200">
              <li>Arrêtez la conversation et ne versez rien.</li>
              <li>Gardez les messages et captures d&apos;écran, ils peuvent servir.</li>
              <li>
                Signalez l&apos;offre : sur sa fiche, utilisez « Signaler cette offre » (compte connecté). Vous pouvez aussi{" "}
                <Link href="/contact" className={LIEN}>contacter l&apos;équipe</Link>.
              </li>
              <li>Si vous avez déjà payé ou donné des codes, prévenez rapidement votre opérateur de paiement mobile ou votre banque, et les autorités compétentes.</li>
            </ol>
          </section>
        </article>

        <p className="mt-10 text-sm text-gray-700 dark:text-gray-300">
          Voir aussi : <Link href="/offres" className={LIEN}>les offres d&apos;emploi</Link>, <Link href="/conseils/postuler-whatsapp-email" className={LIEN}>postuler par
          WhatsApp ou e-mail</Link> et <Link href="/conseils" className={LIEN}>tous les conseils</Link>.
        </p>
      </main>
    </>
  );
}
