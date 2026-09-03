"use client";

// Établissements ouverts autour de soi.
//
// C'est le maillon manquant de la chaîne Point Wave : un commerçant peut
// déclarer son activité et basculer son statut depuis /mon-activite, mais
// rien ne montrait ce statut à qui que ce soit. Sans cet écran, publier
// « ouvert » n'avait aucun destinataire.
//
// Page publique, sans connexion requise : etablissements_ouverts_proches est
// accordée à `anon` — trouver une pharmacie de garde ne doit pas attendre une
// création de compte, surtout à l'heure où on en a besoin.
import { useCallback, useEffect, useState } from "react";
import CarteEtablissements from "@/components/CarteEtablissements";
import { etablissementsProches, TYPES_ACTIVITE } from "@/lib/activiteData";
import { positionActuelle } from "@/lib/marketplaceData";

// Pas "candidate" : cet écran ne montre que des lieux à statut publiable.
const FILTRES = TYPES_ACTIVITE.filter((t) => t.id !== "candidate");
const RAYONS = [2, 5, 10, 25, 50];

function quand(iso) {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

const ETIQUETTE_PHARMACIE = { open: "Ouverte", on_duty: "De garde", closed: "Fermée" };

export default function EtablissementsPage() {
  const [position, setPosition] = useState(null);
  const [type, setType] = useState(null);
  const [rayonKm, setRayonKm] = useState(10);
  const [seulementOuverts, setSeulementOuverts] = useState(true);
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [aCherche, setACherche] = useState(false);

  const lancerRecherche = useCallback(
    async (pos) => {
      const p = pos || position;
      if (!p) return;
      setChargement(true);
      setErreur("");
      try {
        const r = await etablissementsProches({ latitude: p.latitude, longitude: p.longitude, rayonKm, type });
        setResultats(r);
        setACherche(true);
      } catch (e) {
        setErreur(e.message);
        setResultats([]);
      } finally {
        setChargement(false);
      }
    },
    [position, rayonKm, type]
  );

  const localiser = async () => {
    setErreur("");
    setChargement(true);
    try {
      const p = await positionActuelle();
      setPosition(p);
      await lancerRecherche(p);
    } catch (e) {
      setErreur(e.message);
      setChargement(false);
    }
  };

  useEffect(() => {
    if (!position) return;
    const t = setTimeout(() => lancerRecherche(position), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, rayonKm, position]);

  // Le filtre « ouverts uniquement » se fait côté client : la base renvoie
  // déjà les fermés (triés après les ouverts), et les garder permet
  // d'afficher « fermé actuellement » plutôt qu'une absence silencieuse.
  const affiches = seulementOuverts ? resultats.filter((r) => r.is_open) : resultats;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Établissements ouverts
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Points Wave, pharmacies et cliniques autour de vous, avec leur statut du moment.
          </p>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 mb-5">
          <button
            type="button"
            onClick={localiser}
            disabled={chargement}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#1877F2] text-white text-sm font-bold disabled:opacity-60 cursor-pointer"
          >
            <i className={`fa-solid ${chargement ? "fa-spinner fa-spin" : "fa-location-crosshairs"} mr-2`}></i>
            {position ? "Actualiser ma position" : "Chercher autour de moi"}
          </button>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => setType(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                type === null
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              }`}
            >
              Tous
            </button>
            {FILTRES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setType(type === f.id ? null : f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  type === f.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                }`}
              >
                <i className={`fa-solid ${f.icone} mr-1.5`}></i>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
              Rayon
              <select
                value={rayonKm}
                onChange={(e) => setRayonKm(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold cursor-pointer"
              >
                {RAYONS.map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={seulementOuverts}
                onChange={(e) => setSeulementOuverts(e.target.checked)}
                className="w-4 h-4 accent-[#1877F2] cursor-pointer"
              />
              Ouverts uniquement
            </label>
          </div>
        </div>

        {erreur && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-900 dark:text-amber-200">
            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
            {erreur}
          </div>
        )}

        {!position && !erreur && (
          <div className="text-center py-16">
            <i className="fa-solid fa-map-location-dot text-4xl text-gray-300 dark:text-gray-700"></i>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
              Activez votre position pour voir ce qui est ouvert près de vous
            </p>
          </div>
        )}

        {position && aCherche && affiches.length === 0 && !chargement && (
          <div className="text-center py-16">
            <i className="fa-solid fa-store-slash text-4xl text-gray-300 dark:text-gray-700"></i>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
              {seulementOuverts ? "Rien d'ouvert dans ce rayon pour l'instant" : "Aucun établissement trouvé"}
            </p>
            {seulementOuverts && resultats.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {resultats.length} établissement{resultats.length > 1 ? "s" : ""} existe
                {resultats.length > 1 ? "nt" : ""} ici, mais fermé{resultats.length > 1 ? "s" : ""} en ce moment.
              </p>
            )}
          </div>
        )}

        {affiches.length > 0 && (
          <>
            <CarteEtablissements etablissements={affiches} depart={position} />
            <ul className="space-y-2.5">
              {affiches.map((e) => (
                <li
                  key={e.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex items-start gap-3"
                >
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-white ${
                      e.is_open ? "bg-emerald-500" : "bg-gray-500"
                    }`}
                  >
                    {e.activity_type === "pharmacy" && e.pharmacy_status
                      ? ETIQUETTE_PHARMACIE[e.pharmacy_status]
                      : e.is_open
                        ? "Ouvert"
                        : "Fermé"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{e.nom}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {FILTRES.find((f) => f.id === e.activity_type)?.label || e.activity_type}
                      {e.quartier ? ` · ${e.quartier}` : ""} · {e.distanceLisible}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {e.maj_le ? `Mis à jour ${quand(e.maj_le)}` : "Jamais mis à jour"}
                    </p>
                  </div>

                  {e.telephone && (
                    <a
                      href={`tel:${e.telephone}`}
                      className="shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center cursor-pointer"
                      aria-label={`Appeler ${e.nom}`}
                    >
                      <i className="fa-solid fa-phone text-xs"></i>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
