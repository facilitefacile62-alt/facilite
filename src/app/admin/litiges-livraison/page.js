"use client";

// Livraisons bloquées signalées par les acheteurs (voir migration 20261016120000). Quand un livreur
// disparaît après avoir pris ou récupéré un colis, l'acheteur signale (après un délai d'inactivité)
// et un ADMINISTRATEUR tranche ici : remettre la commande en attente d'un autre livreur, l'annuler,
// ou classer sans suite. Les coordonnées du livreur sont affichées pour que tu puisses d'abord l'appeler.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const STATUTS = { assignee: "Réclamée, pas encore récupérée", recuperee: "Récupérée, pas encore partie", en_livraison: "En livraison", livree_declaree: "Livrée (à confirmer)", livree: "Livrée", annulee: "Annulée", en_attente_livreur: "En attente d'un livreur" };

function quand(iso) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function AdminLitigesLivraisonPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [litiges, setLitiges] = useState([]);
  const [livreurs, setLivreurs] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);
  const [notes, setNotes] = useState({});

  const charger = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase
        .from("livraison_litiges")
        .select(
          "id, commande_id, livreur_id, statut_commande, motif, created_at, commande:marketplace_commandes(id, statut, quantite, prix_total_xof, livraison_nom, livraison_telephone, livraison_adresse, assignee_le, recuperee_le, en_livraison_le, livreur_position_maj_le, item:marketplace_items(titre), store:marketplace_stores(nom, quartier, ville))"
        )
        .is("resolu_le", null)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      setLitiges(data || []);
      const idsLivreurs = [...new Set((data || []).map((l) => l.livreur_id).filter(Boolean))];
      if (idsLivreurs.length) {
        const { data: ls } = await supabase.from("livreurs").select("user_id, telephone, type_vehicule, zone_principale").in("user_id", idsLivreurs);
        setLivreurs(Object.fromEntries((ls || []).map((l) => [l.user_id, l])));
      }
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // La règle ne peut pas voir que `charger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const trancher = async (id, action) => {
    if (action === "annuler" && !window.confirm("Annuler cette commande ? L'acheteur sera prévenu.")) return;
    setEnCours(id);
    try {
      const { data, error } = await supabase.rpc("resoudre_litige_livraison", { p_litige_id: id, p_action: action, p_note: notes[id] || null });
      if (error || !data) throw new Error(error?.message || "Déjà traité.");
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
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
        <div>
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">Retour à l&apos;accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800"><i className="fa-solid fa-arrow-left mr-1.5"></i>Administration</Link>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-2">Livraisons bloquées</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Signalements d&apos;acheteurs dont le livreur ne répond plus. Appelle d&apos;abord le livreur, puis tranche.</p>
        </header>

        {erreur ? <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{erreur}</div> : null}

        {chargement ? (
          <div className="text-center py-16 text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>
        ) : litiges.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
            <i className="fa-solid fa-circle-check text-2xl text-emerald-400"></i>
            <p className="text-xs font-bold text-gray-500 mt-3">Aucune livraison bloquée</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {litiges.map((l) => {
              const c = l.commande;
              const lv = livreurs[l.livreur_id];
              const encoreEnCours = c && ["assignee", "recuperee", "en_livraison"].includes(c.statut);
              return (
                <li key={l.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{c?.item?.titre || "Commande"} × {c?.quantite}</p>
                    <p className="text-xs text-gray-500">Boutique : {c?.store?.nom}{c?.store?.quartier ? `, ${c.store.quartier}` : ""} · {c?.prix_total_xof?.toLocaleString("fr-FR")} FCFA</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Signalé {quand(l.created_at)} · statut au signalement : {STATUTS[l.statut_commande] || l.statut_commande}</p>
                    {!encoreEnCours ? <p className="text-[11px] font-bold text-amber-600 mt-1">La commande a changé depuis : statut actuel « {STATUTS[c?.statut] || c?.statut} ». Classer est probablement le bon choix.</p> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-0.5">
                      <p className="font-black text-gray-700 dark:text-gray-200">Acheteur</p>
                      <p>{c?.livraison_nom} · {c?.livraison_telephone}</p>
                      <p className="text-gray-500">{c?.livraison_adresse}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-0.5">
                      <p className="font-black text-gray-700 dark:text-gray-200">Livreur</p>
                      <p>{lv ? `${lv.telephone || "téléphone inconnu"} · ${lv.type_vehicule || ""}` : "inconnu"}</p>
                      <p className="text-gray-500">Réclamée {quand(c?.assignee_le)} · retrait {quand(c?.recuperee_le)} · dernière position {quand(c?.livreur_position_maj_le)}</p>
                    </div>
                  </div>
                  {l.motif ? <p className="text-xs italic text-gray-600 dark:text-gray-300">« {l.motif} »</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" aria-label="Note" placeholder="Note (facultative)" value={notes[l.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [l.id]: e.target.value }))} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs w-48" maxLength={300} />
                    <button type="button" disabled={enCours === l.id || !encoreEnCours} onClick={() => trancher(l.id, "remettre_en_attente")} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer">Remettre en attente</button>
                    <button type="button" disabled={enCours === l.id || !encoreEnCours} onClick={() => trancher(l.id, "annuler")} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer">Annuler la commande</button>
                    <button type="button" disabled={enCours === l.id} onClick={() => trancher(l.id, "classer")} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black disabled:opacity-60 cursor-pointer">Classer sans suite</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
