import Link from "next/link";

// Index en liens simples des offres ouvertes, rendu côté serveur sous la liste interactive : les moteurs de recherche y trouvent un lien vers chaque offre ouverte
// sans exécuter la liste chargée après coup. Rien d'autre que l'intitulé, l'entreprise et le lieu : aucun contact, aucun identifiant de recruteur.
export default function OffresOuvertesLiens({ offres }) {
  if (!offres || offres.length === 0) return null;
  return (
    <nav aria-labelledby="offres-ouvertes" className="max-w-6xl mx-auto px-4 pb-10">
      <h2 id="offres-ouvertes" className="text-sm font-extrabold text-gray-700 dark:text-gray-300 mb-2">
        Offres ouvertes en ce moment
      </h2>
      <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {offres.map((o) => (
          <li key={o.id}>
            <Link href={`/offres/${o.id}`} className="text-gray-600 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline">
              {o.title}
              {[o.company, o.location].filter(Boolean).length > 0 ? ` – ${[o.company, o.location].filter(Boolean).join(", ")}` : ""}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
