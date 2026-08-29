import Link from "next/link";

/**
 * Page publique de demande de suppression de compte.
 *
 * Exigée par Google Play pour toute application permettant de créer un
 * compte : l'URL doit être atteignable SANS installer l'application et SANS
 * se connecter. Le formulaire Data Safety la réclame et la refuse vide —
 * c'était l'un des deux manques bloquants relevés le 2026-08-29.
 *
 * Volontairement un composant serveur sans état : aucune session à lire,
 * aucun appel réseau. Une page de suppression qui exigerait d'être connecté
 * pour être lue manquerait précisément son objet.
 *
 * Ajoutée à PUBLIC_ROUTES dans src/proxy.js, au même titre que les autres
 * pages légales : sans cela le proxy redirigerait un visiteur anonyme vers
 * /login et Google constaterait une URL inaccessible.
 */
export const metadata = {
  title: "Supprimer mon compte — Facilité",
  description:
    "Comment demander la suppression de votre compte Facilité et de toutes vos données : procédure dans l'application, demande par e-mail, délais et données conservées.",
  alternates: { canonical: "https://ffacilite.com/suppression-compte" },
};

const DONNEES_SUPPRIMEES = [
  "Votre compte et vos identifiants de connexion",
  "Votre profil : nom, photo, coordonnées, biographie, formations, expériences, compétences",
  "Vos CV et lettres de motivation, créés dans l'éditeur comme importés",
  "Vos candidatures et les messages échangés",
  "Vos préférences et paramètres d'affichage",
];

const DONNEES_CONSERVEES = [
  {
    quoi: "Factures et traces de paiement",
    duree: "10 ans",
    pourquoi:
      "Obligation comptable et fiscale. Ces pièces sont dissociées de votre profil : elles ne permettent plus de vous identifier dans l'application.",
  },
  {
    quoi: "Journaux de sécurité",
    duree: "12 mois",
    pourquoi:
      "Détection de fraude et d'accès non autorisés. Ils ne contiennent ni CV, ni message, ni contenu de profil.",
  },
];

export default function SuppressionComptePage() {
  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-[#10E688] mb-2">
          Facilité — ffacilite.com
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
          Supprimer votre compte et vos données
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-8 max-w-2xl">
          Vous pouvez demander à tout moment la suppression de votre compte Facilité et des données qui s&apos;y
          rattachent. Aucune justification ne vous sera demandée. Cette page est accessible sans compte et sans
          installer l&apos;application.
        </p>

        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 mb-5">
          <h2 className="text-lg font-extrabold mb-1">Depuis l&apos;application</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
            Le moyen le plus rapide — la demande est enregistrée immédiatement.
          </p>
          <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            {[
              "Connectez-vous à votre compte sur ffacilite.com ou dans l'application Facilité.",
              "Ouvrez votre profil, puis l'onglet « Sécurité & Connexion ».",
              "Choisissez « Supprimer mon compte » et confirmez.",
            ].map((etape, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-[#10E688] text-xs font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{etape}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 mb-5">
          <h2 className="text-lg font-extrabold mb-1">Par e-mail</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
            Si vous n&apos;avez plus accès à votre compte.
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            Écrivez à{" "}
            <a
              href="mailto:contact@ffacilite.com?subject=Demande%20de%20suppression%20de%20compte"
              className="font-extrabold text-emerald-700 dark:text-[#10E688] underline underline-offset-2"
            >
              contact@ffacilite.com
            </a>{" "}
            depuis l&apos;adresse e-mail associée à votre compte, avec « Demande de suppression de compte » en objet.
            Nous répondons sous 30 jours au plus.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Écrire depuis l&apos;adresse du compte nous sert de vérification : sans elle, nous devrons vous demander un
            autre élément prouvant que le compte est bien le vôtre. Cette précaution évite qu&apos;un tiers fasse
            supprimer votre compte à votre place.
          </p>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 mb-5">
          <h2 className="text-lg font-extrabold mb-4">Ce qui est supprimé</h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {DONNEES_SUPPRIMEES.map((d) => (
              <li key={d} className="flex gap-2.5 leading-relaxed">
                <span aria-hidden="true" className="text-emerald-600 dark:text-[#10E688] font-black">
                  ✓
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 sm:p-5">
            <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200 mb-1">Délai de 30 jours</h3>
            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
              Votre compte est désactivé immédiatement : il devient invisible des recruteurs et vous ne pouvez plus
              vous y connecter. L&apos;effacement définitif intervient <strong>30 jours plus tard</strong>. Ce délai
              existe pour vous permettre de revenir sur une suppression demandée par erreur — écrivez-nous avant son
              terme. Passé ce délai, la suppression est irréversible et nous ne pouvons rien restaurer.
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 mb-5">
          <h2 className="text-lg font-extrabold mb-1">Ce que nous devons conserver</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
            La loi nous impose de garder ces éléments, même après suppression.
          </p>
          <div className="space-y-4">
            {DONNEES_CONSERVEES.map((d) => (
              <div key={d.quoi} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                <p className="text-sm font-extrabold">
                  {d.quoi} <span className="font-bold text-gray-400">— {d.duree}</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5">{d.pourquoi}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8">
          <h2 className="text-lg font-extrabold mb-3">Une question ?</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Écrivez à{" "}
            <a
              href="mailto:contact@ffacilite.com"
              className="font-extrabold text-emerald-700 dark:text-[#10E688] underline underline-offset-2"
            >
              contact@ffacilite.com
            </a>
            . Le détail des données que nous traitons et des services qui les reçoivent figure dans notre{" "}
            <Link
              href="/confidentialite"
              className="font-extrabold text-emerald-700 dark:text-[#10E688] underline underline-offset-2"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <p className="text-[11px] text-gray-400 mt-8">Dernière mise à jour : 29 août 2026.</p>
      </main>
    </div>
  );
}
