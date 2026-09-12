"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { METIERS_REGLEMENTES } from "@/lib/marketplaceData";

// Écran de vérification des établissements sensibles (santé/finance) ET,
// depuis l'ajout des métiers réglementés (boutiques type_boutique='service'
// dont le métier est Pharmacien/Infirmier(ère)/Sage-femme), même esprit que
// la file de modération des offres d'admin/page.js (handleModerateOffer ->
// moderate_job_offer) : liste des boutiques en attente, décision via l'appel
// RPC direct moderate_marketplace_store (SECURITY DEFINER, vérifie côté
// serveur que l'appelant est admin — cette page en est le client, pas la
// barrière de sécurité elle-même). Fichier séparé plutôt qu'un nouvel onglet
// dans admin/page.js (2000+ lignes, sous modification active) pour ne pas
// risquer d'y toucher — même mécanisme étendu ici plutôt qu'un second écran
// en parallèle, demande explicite.
//
// Deux requêtes séparées plutôt qu'un .or() PostgREST unique : les valeurs
// de METIERS_REGLEMENTES contiennent des caractères (accents, "/") qui
// rendent la syntaxe de filtre .or() fragile à composer/encoder à la main —
// deux .in() simples, chacun sans ambiguïté, puis fusion côté client.
const LIBELLES_CATEGORIE = {
  sante: "Santé",
  finance: "Finance",
};

export default function AdminEtablissementsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [enAttente, setEnAttente] = useState(null); // null = chargement
  const [erreur, setErreur] = useState("");
  const [decisionEnCours, setDecisionEnCours] = useState(null);

  const chargerFile = useCallback(async () => {
    setErreur("");
    const colonnes = "id, nom, quartier, ville, type_boutique, categorie_etablissement, metier, telephone_whatsapp, owner_id, created_at";
    const [etablissements, services] = await Promise.all([
      supabase
        .from("marketplace_stores")
        .select(colonnes)
        .eq("type_boutique", "etablissement")
        .in("categorie_etablissement", ["sante", "finance"])
        .eq("verifie", false)
        .eq("actif", true),
      supabase
        .from("marketplace_stores")
        .select(colonnes)
        .eq("type_boutique", "service")
        .in("metier", METIERS_REGLEMENTES)
        .eq("verifie", false)
        .eq("actif", true),
    ]);

    if (etablissements.error || services.error) {
      setErreur(etablissements.error?.message || services.error?.message);
      setEnAttente([]);
      return;
    }
    const fusion = [...(etablissements.data || []), ...(services.data || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    setEnAttente(fusion);
  }, []);

  useEffect(() => {
    // setState différé : corps de l'effet, pas un callback d'un système
    // externe — exigé par la règle react-hooks correspondante.
    if (isAdmin) queueMicrotask(chargerFile);
  }, [isAdmin, chargerFile]);

  const decider = async (storeId, decision) => {
    setDecisionEnCours(storeId);
    setErreur("");
    try {
      const { error } = await supabase.rpc("moderate_marketplace_store", {
        p_store_id: storeId,
        p_decision: decision,
      });
      if (error) throw error;
      setEnAttente((liste) => (liste || []).filter((s) => s.id !== storeId));
    } catch (err) {
      setErreur(err.message || "Erreur lors de la décision.");
    } finally {
      setDecisionEnCours(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
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
    <div className="min-h-screen bg-[#FAF6F1]/50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/admin" className="hover:underline">Admin</Link>
          <span>/</span>
          <span className="text-gray-800">Établissements à vérifier</span>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-lg font-extrabold text-gray-900">
              Vérification des fiches sensibles ({enAttente?.length ?? 0})
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Établissements santé/finance et métiers réglementés (Pharmacien, Infirmier/Infirmière,
              Sage-femme) uniquement — ces fiches restent invisibles du public tant qu&apos;elles ne sont pas
              validées ici. Les autres catégories/métiers se publient immédiatement, sans passer par cette
              file.
            </p>
          </div>

          {erreur && (
            <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {erreur}
            </div>
          )}

          {enAttente === null ? (
            <div className="p-8 text-center text-gray-400">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
          ) : enAttente.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic text-xs">Aucune fiche en attente.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {enAttente.map((store) => (
                <div key={store.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">{store.nom}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase">
                        {store.type_boutique === "service"
                          ? store.metier
                          : LIBELLES_CATEGORIE[store.categorie_etablissement] || store.categorie_etablissement}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {[store.quartier, store.ville].filter(Boolean).join(", ") || "Localisation non renseignée"}
                      {store.telephone_whatsapp ? ` · ${store.telephone_whatsapp}` : ""}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Créée le {new Date(store.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => decider(store.id, "rejected")}
                      disabled={decisionEnCours === store.id}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={() => decider(store.id, "approved")}
                      disabled={decisionEnCours === store.id}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      Approuver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
