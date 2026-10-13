"use client";

// « Autour de moi » de Facilité : OÙ RECRUTENT LES ENTREPRISES. Ne pas confondre
// avec « Autour de moi » de Locaux (boutiques proches). Une pastille par ville
// avec son nombre d'offres ; un clic ouvre la liste des offres de la ville.
// Page publique (voir PUBLIC_BROWSABLE dans src/proxy.js) : les offres
// approuvées sont déjà lisibles par tous.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { chargerOffresParVille } from "@/lib/offresParVille";
import { positionActuelle } from "@/lib/marketplaceData";

const CarteOffresVilles = dynamic(() => import("@/components/CarteOffresVilles"), {
  ssr: false,
  loading: () => <div className="w-full h-[420px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

export default function AutourFacilitePage() {
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const [msgPosition, setMsgPosition] = useState("");

  useEffect(() => {
    let annule = false;
    chargerOffresParVille()
      .then((r) => !annule && setResultat(r))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, []);

  const groupes = useMemo(() => resultat?.groupes ?? [], [resultat]);
  const courant = groupes.find((g) => g.ville === selection) ?? null;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;

  const onSelect = useCallback((ville) => setSelection(ville), []);

  const localiser = async () => {
    setMsgPosition("");
    try {
      const p = await positionActuelle();
      setPosition({ lat: p.latitude, lng: p.longitude });
    } catch (e) {
      setMsgPosition(e?.message || "Localisation indisponible.");
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Autour de moi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {resultat === null
              ? erreur
                ? "Impossible de charger les offres."
                : "Chargement…"
              : `${totalEntreprises} entreprise${totalEntreprises > 1 ? "s" : ""} recrutent · ${totalOffres} offre${totalOffres > 1 ? "s" : ""} dans ${groupes.length} ville${groupes.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      {msgPosition ? <p className="text-xs text-red-600 mb-2">{msgPosition}</p> : null}

      <CarteOffresVilles groupes={groupes} selection={selection} onSelect={onSelect} position={position} onLocaliser={localiser} />

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
        Position approximative : le centre de chaque ville.
        {resultat && resultat.sansVille > 0
          ? ` ${resultat.sansVille} offre${resultat.sansVille > 1 ? "s" : ""} ouverte${resultat.sansVille > 1 ? "s" : ""} sur tout le Sénégal (ville non précisée).`
          : ""}
      </p>

      {courant ? (
        <section className="mt-4" aria-label={`Offres à ${courant.ville}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              {courant.ville} · {courant.offres.length} offre{courant.offres.length > 1 ? "s" : ""} · {courant.entreprises} entreprise{courant.entreprises > 1 ? "s" : ""}
            </h2>
            <button type="button" onClick={() => setSelection(null)} aria-label="Fermer la liste" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {courant.offres.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/offres/${o.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:shadow-md transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-building"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-blue-600 truncate">{o.entreprise}</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">{o.titre}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : resultat && groupes.length > 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Clique sur une pastille pour voir les entreprises qui recrutent dans la ville.
        </p>
      ) : null}
    </main>
  );
}
