"use client";

// Colonne centrale de « Autour de moi » de Facilité : OÙ RECRUTENT LES
// ENTREPRISES. Ne pas confondre avec « Autour de moi » de Locaux (boutiques
// proches). Elle est affichée DANS la mise en page de l'accueil (HomeClient,
// mode "autour") : les colonnes de gauche (profil, stats) et de droite (offres
// recommandées…) restent en place, seule la colonne du milieu change.
//
// Trois vues, choisies par le menu « Autour de moi » de la barre de navigation
// (même principe que Locaux) :
//  - liste  : « Offres proches »  → les offres rangées par ville, sans carte ;
//  - mini   : « Mini carte »      → la carte sur la page, liste de la ville dessous ;
//  - pleine : « Pleine carte »    → la carte en grand écran.
// Page publique (voir PUBLIC_BROWSABLE dans src/proxy.js) : les offres
// approuvées sont déjà lisibles par tous.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { chargerOffresParVille } from "@/lib/offresParVille";
import { positionActuelle } from "@/lib/marketplaceData";
import { depotsAvecPosition } from "@/lib/depotsSurPlace";

const CarteOffresVilles = dynamic(() => import("@/components/CarteOffresVilles"), {
  ssr: false,
  loading: () => <div className="w-full h-[420px] rounded-2xl bg-gray-100 animate-pulse" />,
});

// « Mini carte » est retirée pour le moment (trop compliquée) : seuls « liste » et « pleine » sont proposés.
const MODES = ["liste", "pleine"];

function kilometres(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function AutourCentre() {
  const parametres = useSearchParams();
  const vueUrl = parametres?.get("vue");
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [selection, setSelection] = useState(null);
  const [position, setPosition] = useState(null);
  const [msgPosition, setMsgPosition] = useState("");
  // Choix fait depuis le menu quand on est déjà sur la page (événement) ; sinon l'adresse (?vue=) fait foi.
  const [choixMenu, setChoixMenu] = useState(null);
  const mode = MODES.includes(choixMenu?.vue) && choixMenu.depuis === vueUrl ? choixMenu.vue : MODES.includes(vueUrl) ? vueUrl : "liste";

  useEffect(() => {
    let annule = false;
    chargerOffresParVille()
      .then((r) => !annule && setResultat(r))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, []);

  const localiser = async () => {
    try {
      const p = await positionActuelle();
      setPosition({ lat: p.latitude, lng: p.longitude });
      setMsgPosition("");
    } catch (e) {
      setMsgPosition(e?.message || "Localisation indisponible.");
    }
  };

  // Le menu de la barre de navigation prévient la page quand on y est déjà.
  useEffect(() => {
    const surChoix = (e) => {
      const vue = e?.detail?.mode;
      if (MODES.includes(vue)) setChoixMenu({ vue, depuis: vueUrl });
    };
    window.addEventListener("facilite:autour-offres", surChoix);
    return () => window.removeEventListener("facilite:autour-offres", surChoix);
  }, [vueUrl]);

  // « Offres proches » demande la position pour ranger les villes de la plus proche à la plus lointaine.
  useEffect(() => {
    if (mode !== "liste" || position) return undefined;
    let annule = false;
    positionActuelle()
      .then((p) => !annule && setPosition({ lat: p.latitude, lng: p.longitude }))
      .catch((e) => !annule && setMsgPosition(e?.message || "Localisation indisponible."));
    return () => {
      annule = true;
    };
  }, [mode, position]);

  const groupes = useMemo(() => resultat?.groupes ?? [], [resultat]);
  const depots = useMemo(() => depotsAvecPosition(), []);
  const courant = groupes.find((g) => g.ville === selection) ?? null;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;
  const villesRangees = useMemo(() => {
    if (!position) return groupes;
    return [...groupes].sort((a, b) => kilometres(position, a) - kilometres(position, b));
  }, [groupes, position]);


  const carte = (plein) => (
    <CarteOffresVilles groupes={groupes} selection={selection} onSelect={setSelection} position={position} onLocaliser={localiser} plein={plein} depots={depots} />
  );

  const ligneOffre = (o) => (
    <li key={o.id}>
      <Link href={`/offres/${o.id}`} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:shadow-md transition">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-building"></i>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-blue-600 truncate">{o.entreprise}</div>
          <div className="text-sm font-bold text-gray-900 line-clamp-2">{o.titre}</div>
        </div>
        <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
      </Link>
    </li>
  );

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-black text-gray-900">Autour de moi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {resultat === null
            ? erreur
              ? "Impossible de charger les offres."
              : "Chargement…"
            : `${totalEntreprises} entreprise${totalEntreprises > 1 ? "s" : ""} recrutent · ${totalOffres} offre${totalOffres > 1 ? "s" : ""} dans ${groupes.length} ville${groupes.length > 1 ? "s" : ""} · ${depots.length} dépôts sur place à Dakar`}
        </p>
      </div>
      {msgPosition ? <p className="text-xs text-red-600">{msgPosition}</p> : null}

      {mode === "liste" ? (
        <div className="space-y-4">
          {position ? <p className="text-[11px] text-gray-500">Villes rangées de la plus proche à la plus éloignée de vous.</p> : null}
          {villesRangees.map((g) => (
            <section key={g.ville} aria-label={`Offres à ${g.ville}`}>
              <h2 className="text-sm font-black text-gray-900 mb-1.5">
                {g.ville} · {g.offres.length} offre{g.offres.length > 1 ? "s" : ""}
                {position ? <span className="font-bold text-gray-500"> · {Math.round(kilometres(position, g))} km</span> : null}
              </h2>
              <ul className="grid gap-1.5">{g.offres.map(ligneOffre)}</ul>
            </section>
          ))}
          <section aria-label="Dépôts sur place">
            <h2 className="text-sm font-black text-gray-900 mb-1.5">Dépôts sur place · {depots.length}</h2>
            <ul className="grid gap-1.5">
              {depots.map((d) => (
                <li key={d.id}>
                  <Link href="/recrutement-journalier" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 hover:shadow-md transition">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-hand-holding"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-gray-900 truncate">{d.nom}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">{d.adresse}</div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : mode === "pleine" ? (
        <div className="fixed inset-0 z-[600] bg-[#0B0F17] flex flex-col">
          <div className="flex-1 min-h-0">{carte(true)}</div>
          <Link href="/autour?vue=liste" className="absolute top-3 right-3 z-[650] px-4 py-2 rounded-full bg-white text-gray-900 text-xs font-black shadow-xl">
            <i className="fa-solid fa-compress mr-1.5"></i>Fermer la carte
          </Link>
        </div>
      ) : (
        <>
          {carte(false)}
          <p className="text-[11px] text-gray-500">
            Position approximative : le centre de chaque ville.
            {resultat && resultat.sansVille > 0
              ? ` ${resultat.sansVille} offre${resultat.sansVille > 1 ? "s" : ""} ouverte${resultat.sansVille > 1 ? "s" : ""} sur tout le Sénégal (ville non précisée).`
              : ""}
          </p>
          {courant ? (
            <section aria-label={`Offres à ${courant.ville}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-sm font-black text-gray-900">
                  {courant.ville} · {courant.offres.length} offre{courant.offres.length > 1 ? "s" : ""} · {courant.entreprises} entreprise{courant.entreprises > 1 ? "s" : ""}
                </h2>
                <button type="button" onClick={() => setSelection(null)} aria-label="Fermer la liste" className="text-gray-500 hover:text-gray-900">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <ul className="grid gap-1.5">{courant.offres.map(ligneOffre)}</ul>
            </section>
          ) : resultat && groupes.length > 0 ? (
            <p className="text-center text-sm text-gray-500 mt-2">Clique sur une pastille pour voir les entreprises qui recrutent dans la ville.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
