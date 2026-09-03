"use client";

// Statut en direct d'un établissement.
//
// Premier métier branché : le Point Wave. Un interrupteur, rien de plus —
// mais il valide la chaîne entière : déclarer son activité, poser sa position,
// basculer son statut, apparaître sur la carte des lieux ouverts.
//
// La pharmacie est là aussi : c'est le même écran avec trois états au lieu de
// deux, et la garde n'est ni « ouvert » ni « fermé » — c'est ouvert la nuit,
// et c'est précisément ce que les gens cherchent en urgence.
//
// POURQUOI L'HORODATAGE EST AFFICHÉ EN GRAND
//
// « Ouvert » sans date ne vaut rien : personne ne sait si l'information date
// de dix minutes ou du mois dernier. C'est la même leçon que le stock de la
// Marketplace — la fraîcheur est ce qui décide un déplacement.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import CapturePosition from "@/components/CapturePosition";
import {
  basculerStatut,
  chargerMonActivite,
  definirMonActivite,
  STATUTS_PHARMACIE,
  TYPES_ACTIVITE,
} from "@/lib/activiteData";

function depuis(iso) {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function MonActivitePage() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id || null;

  const [profil, setProfil] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      setProfil(await chargerMonActivite(userId));
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useEffect(() => {
    // Même dérogation que les autres pages du dépôt : la règle ne voit pas que
    // `recharger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recharger();
  }, [recharger]);

  const choisirType = async (type) => {
    setEnCours(true);
    setErreur("");
    try {
      await definirMonActivite(type, null);
      await recharger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  const changerStatut = async (charge) => {
    setEnCours(true);
    setErreur("");
    try {
      await basculerStatut(charge);
      await recharger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  };

  if (authLoading || chargement) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-store text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
            Connectez-vous pour déclarer votre activité
          </p>
          <Link
            href="/login?redirect=%2Fmon-activite"
            className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const type = profil?.activity_type || "candidate";
  // Le verrou suit la base, pas la simple présence de coordonnées : c'est
  // `activity_position_definie_le` qui décide, et lui seul.
  const positionVerrouillee = !!profil?.activity_position_definie_le;
  const positionnee = positionVerrouillee;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Mon activité</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Déclarez ce que vous faites, et dites aux gens si vous êtes ouvert en ce moment.
          </p>
        </header>

        {erreur && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
            {erreur}
          </div>
        )}

        {/* Type d'activité */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 mb-4">
          <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">Type d&apos;activité</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TYPES_ACTIVITE.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choisirType(t.id)}
                disabled={enCours}
                className={`px-3 py-3 rounded-2xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                  type === t.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                }`}
              >
                <i className={`fa-solid ${t.icone} block text-base mb-1.5`}></i>
                {t.label}
              </button>
            ))}
          </div>
          {type === "candidate" && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
              En tant que candidat, vous n&apos;avez pas de statut à publier. Choisissez un métier
              ci-dessus si vous tenez un point Wave, une pharmacie ou une clinique.
            </p>
          )}
        </section>

        {type !== "candidate" && (
          <>
            {/* Statut en direct */}
            <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-black text-gray-900 dark:text-white">Statut en direct</h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {profil?.activity_updated_at
                      ? `Dernier changement ${depuis(profil.activity_updated_at)}`
                      : "Jamais publié"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase text-white ${
                    profil?.is_open ? "bg-emerald-500" : "bg-gray-500"
                  }`}
                >
                  {profil?.is_open ? "Ouvert" : "Fermé"}
                </span>
              </div>

              {type === "wave_point" && (
                <button
                  type="button"
                  onClick={() => changerStatut({ isOpen: !profil?.is_open })}
                  disabled={enCours}
                  className={`w-full py-4 rounded-2xl text-sm font-black text-white transition disabled:opacity-50 cursor-pointer ${
                    profil?.is_open ? "bg-gray-700 hover:bg-gray-800" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <i className={`fa-solid ${profil?.is_open ? "fa-lock" : "fa-lock-open"} mr-2`}></i>
                  {profil?.is_open ? "Je ferme mon point" : "J'ouvre mon point"}
                </button>
              )}

              {type === "pharmacy" && (
                <div className="grid grid-cols-3 gap-2">
                  {STATUTS_PHARMACIE.map((st) => {
                    const actif = profil?.pharmacy_status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => changerStatut({ statut: st.id })}
                        disabled={enCours}
                        className={`py-3.5 rounded-2xl text-xs font-black transition disabled:opacity-50 cursor-pointer ${
                          actif
                            ? `${st.couleur} text-white`
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {type === "clinic" && (
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  La gestion des consultations et de la file d&apos;attente arrive prochainement. Votre
                  clinique apparaît déjà sur la carte des établissements.
                </p>
              )}
            </section>

            {/* Position */}
            <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">Emplacement</h2>
              <CapturePosition
                verrouillee={positionVerrouillee}
                definieLe={profil?.activity_position_definie_le}
                entite="activité"
                optionPayante={false}
                onReleve={async (p) => {
                  setEnCours(true);
                  setErreur("");
                  try {
                    await definirMonActivite(type, p);
                    await recharger();
                  } catch (e) {
                    setErreur(e.message);
                  } finally {
                    setEnCours(false);
                  }
                }}
              />
              {!positionnee && (
                <p className="text-[11px] text-gray-400 mt-2">
                  Sans emplacement, vous n&apos;apparaissez pas sur la carte des établissements ouverts.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
