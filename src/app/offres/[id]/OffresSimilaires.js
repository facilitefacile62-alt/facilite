import Link from "next/link";

// Bloc rendu côté serveur sous une offre clôturée : le visiteur (et le moteur de recherche) trouve tout de suite des offres encore ouvertes.
export default function OffresSimilaires({ offres }) {
  if (!offres || offres.length === 0) return null;
  return (
    <section aria-labelledby="offres-similaires" className="max-w-3xl mx-auto px-4 pb-12">
      <h2 id="offres-similaires" className="text-lg font-extrabold text-gray-900 dark:text-gray-100 mb-3">
        Offres similaires encore ouvertes
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {offres.map((o) => (
          <li key={o.id}>
            <Link
              href={`/offres/${o.id}`}
              className="block h-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-emerald-500 transition-colors"
            >
              <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{o.title}</span>
              <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                {[o.company, o.location].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <Link href="/offres" className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline">
          Voir toutes les offres disponibles
        </Link>
      </p>
    </section>
  );
}
