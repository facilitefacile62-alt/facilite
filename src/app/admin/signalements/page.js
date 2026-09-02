"use client";

// File des annonces signalées.
//
// Sans cet écran, le bouton « Signaler » de la Marketplace n'était qu'un
// enregistrement : la notification arrivait, pointait vers /admin, et rien ne
// s'affichait. Un signalement correctement stocké et parfaitement
// inexploitable.
//
// Deux décisions portées par l'interface :
//
//  * « Retirer l'annonce » désactive l'article dans le même geste que le
//    classement du signalement. Les séparer laisserait en ligne des annonces
//    reconnues fautives, le temps qu'un second clic soit oublié.
//  * « Rejeter » ne touche à rien : l'annonce est correcte, le signalement ne
//    tient pas. Un signalement rejeté n'est pas effacé — un compte qui signale
//    à tort en boucle doit rester visible.
//
// La lecture passe par lister_signalements (SECURITY DEFINER) et non par un
// SELECT : la policy de marketplace_items ne montre que les articles actifs,
// donc un vendeur signalé qui retire son annonce la ferait disparaître de cet
// écran — exactement au moment où il faut la regarder.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { urlPhoto } from "@/lib/marketplaceData";

const MOTIFS = {
  inexistant: "N'existe pas / plus",
  prix_trompeur: "Prix faux",
  contrefacon: "Contrefaçon",
  interdit: "Produit interdit",
  autre: "Autre",
};

const FILTRES = [
  { id: "nouveau", label: "À traiter" },
  { id: "traite", label: "Traités" },
  { id: "rejete", label: "Rejetés" },
  { id: null, label: "Tous" },
];

const prixLisible = (v) => new Intl.NumberFormat("fr-FR").format(Number(v) || 0);

function quand(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function SignalementsPage() {
  const { session, isAdmin, loading: authLoading } = useAuth();
  const [filtre, setFiltre] = useState("nouveau");
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);

  const charger = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase.rpc("lister_signalements", { p_statut: filtre });
      if (error) throw new Error(error.message);
      setLignes(data || []);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
      setLignes([]);
    } finally {
      setChargement(false);
    }
  }, [session, filtre]);

  useEffect(() => {
    // Même dérogation que les autres pages d'administration : la règle ne peut
    // pas voir que `charger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const trancher = async (id, statut) => {
    setEnCours(id);
    try {
      const { error } = await supabase.rpc("traiter_signalement", { p_id: id, p_statut: statut });
      if (error) throw new Error(error.message);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800">
            <i className="fa-solid fa-arrow-left mr-1.5"></i>Administration
          </Link>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-2">
            Annonces signalées
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Retirer une annonce la sort des recherches sans l&apos;effacer : la décision reste réversible.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-5">
          {FILTRES.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFiltre(f.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                filtre === f.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {erreur && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
            {erreur}
          </div>
        )}

        {chargement ? (
          <div className="text-center py-16 text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>
        ) : lignes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
            <i className="fa-regular fa-flag text-3xl text-gray-300 dark:text-gray-700"></i>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">Aucun signalement</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {lignes.map((s) => {
              const photo = Array.isArray(s.photos) && s.photos[0] ? urlPhoto(s.photos[0]) : null;
              return (
                <li
                  key={s.id}
                  className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <i className="fa-solid fa-image"></i>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-[10px] font-black uppercase">
                          {MOTIFS[s.motif] || s.motif}
                        </span>
                        {s.total_item > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                            {s.total_item} signalements
                          </span>
                        )}
                        {!s.item_actif && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase">
                            Retirée
                          </span>
                        )}
                        {s.statut !== "nouveau" && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-black uppercase">
                            {s.statut === "traite" ? "Traité" : "Rejeté"}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-black text-gray-900 dark:text-white mt-1.5 truncate">{s.titre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {prixLisible(s.prix_xof)} FCFA · {s.boutique_nom}
                        {s.quartier ? ` · ${s.quartier}` : ""}
                        {s.ville ? `, ${s.ville}` : ""}
                      </p>
                      {s.details && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 italic">
                          « {s.details} »
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5">Signalée {quand(s.signale_le)}</p>
                    </div>
                  </div>

                  {s.statut === "nouveau" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => trancher(s.id, "traite")}
                        disabled={enCours === s.id}
                        className="flex-1 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-black disabled:opacity-50 cursor-pointer"
                      >
                        Retirer l&apos;annonce
                      </button>
                      <button
                        type="button"
                        onClick={() => trancher(s.id, "rejete")}
                        disabled={enCours === s.id}
                        className="flex-1 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-black disabled:opacity-50 cursor-pointer"
                      >
                        Signalement infondé
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
