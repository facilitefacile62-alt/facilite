"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// Suivi des commandes Orange Money en attente ou échouées (jetons Marketplace, formation CV, modèles de CV). Le bouton « Revérifier » interroge Orange
// pour UNE commande : elle n'est créditée que si Orange confirme un paiement réussi (même contrôle que le webhook et le rattrapage).
const PRODUITS = { jetons: "Jetons", formation: "Formation CV", cv: "Modèle de CV" };
const RESULTATS = {
  credite: "Paiement confirmé par Orange : commande créditée.",
  deja_traite: "Cette commande est déjà traitée.",
  attente: "Orange ne confirme pas encore de paiement : rien n'a été crédité.",
  echec_enregistre: "Orange indique un échec : commande marquée échouée.",
  incoherent: "Paiement trouvé mais incohérent avec la commande (référence ou montant) : rien n'a été crédité.",
  doublon_transaction: "Cette transaction Orange a déjà servi pour une autre commande : rien n'a été crédité.",
  erreur: "Vérification impossible pour le moment.",
};

function formaterDate(iso) {
  return iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

function TableauDoubles({ lignes, enCours, onRembourse }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-extrabold text-red-700 dark:text-red-400 mb-1">
        Paiements en double à rembourser <span className="text-gray-400 font-bold">({lignes.length})</span>
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Un client a payé deux fois le même QR. La commande n&apos;a été créditée qu&apos;une seule fois : le second paiement est à rembourser chez Orange.
      </p>
      {lignes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucun paiement en double.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-red-200 dark:border-red-900">
          <table className="w-full text-sm">
            <thead className="bg-red-50 dark:bg-red-950/30 text-left text-xs uppercase tracking-wide text-red-800">
              <tr>
                <th className="px-3 py-2">Reçu</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2">Commande (référence)</th>
                <th className="px-3 py-2">Montant à rembourser</th>
                <th className="px-3 py-2">Transaction en double</th>
                <th className="px-3 py-2">Transaction créditée</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.evenementId} className="border-t border-red-100 dark:border-red-900">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formaterDate(l.recuLe)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-bold">{PRODUITS[l.type] ?? l.type}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{l.reference}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums font-bold">{l.montantXof ? `${l.montantXof.toLocaleString("fr-FR")} FCFA` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs font-bold">{l.transactionEnDouble || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.transactionCreditee || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRembourse(l.type, l.evenementId)}
                      disabled={enCours === l.evenementId}
                      className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-50"
                    >
                      Marquer remboursé
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tableau({ titre, type, lignes, enCours, onReverifier }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-extrabold text-gray-900 dark:text-white mb-3">
        {titre} <span className="text-gray-400 font-bold">({lignes.length})</span>
      </h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucune commande en attente ni échouée.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Créée</th>
                <th className="px-3 py-2">Commande</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">État</th>
                <th className="px-3 py-2">Transaction Orange</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formaterDate(l.creeLe)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{l.montantXof ? `${l.montantXof.toLocaleString("fr-FR")} FCFA` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${l.etat === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {l.etat === "failed" ? "Échouée" : "En attente"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{l.transactionOrange || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onReverifier(type, l.id)}
                      disabled={enCours === l.id}
                      className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-50"
                    >
                      {enCours === l.id ? "Vérification…" : "Revérifier"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminCommandesOrangePage() {
  const { isAdmin, loading: authLoading, session } = useAuth();
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);
  const [message, setMessage] = useState("");

  const charger = useCallback(async () => {
    if (!session) return;
    setErreur("");
    try {
      const res = await fetch("/api/admin/commandes-orange", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corps.error || "Chargement impossible.");
      setDonnees(corps);
    } catch (e) {
      setErreur(e.message);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading && isAdmin) charger();
  }, [authLoading, isAdmin, charger]);

  async function reverifier(type, id) {
    setEnCours(id);
    setMessage("");
    try {
      const res = await fetch("/api/admin/commandes-orange/reverifier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type, id }),
      });
      const corps = await res.json().catch(() => ({}));
      setMessage(res.ok ? `${id.slice(0, 8)}… — ${RESULTATS[corps.resultat] || corps.resultat}${corps.message ? ` (${corps.message})` : ""}` : corps.error || "Vérification impossible.");
      await charger();
    } finally {
      setEnCours(null);
    }
  }

  async function rembourse(type, evenementId) {
    setEnCours(evenementId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/commandes-orange/rembourse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type, evenementId }),
      });
      const corps = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Paiement en double marqué comme remboursé." : corps.error || "Mise à jour impossible.");
      await charger();
    } finally {
      setEnCours(null);
    }
  }

  if (authLoading) return null;
  if (!isAdmin) return <p className="p-6 text-sm text-gray-600">Réservé aux administrateurs.</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/admin" className="text-sm font-bold text-blue-600 hover:underline">← Administration</Link>
      <h1 className="text-xl font-extrabold text-gray-900 dark:text-white mt-3 mb-1">Commandes Orange Money</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Commandes en attente ou échouées. « Revérifier » interroge Orange : une commande n&apos;est créditée que si Orange confirme le paiement.
      </p>

      {message && <p className="mb-4 rounded-xl bg-blue-50 text-blue-800 text-sm font-bold px-3 py-2" role="status">{message}</p>}
      {erreur && <p className="mb-4 text-sm text-red-600">{erreur}</p>}
      {!donnees && !erreur && <p className="text-sm text-gray-500">Chargement…</p>}
      {donnees && (
        <>
          <TableauDoubles lignes={donnees.doubles ?? []} enCours={enCours} onRembourse={rembourse} />
          <Tableau titre="Achats de jetons" type="jetons" lignes={donnees.jetons} enCours={enCours} onReverifier={reverifier} />
          <Tableau titre="Achats de modèles de CV" type="cv" lignes={donnees.achatsCv ?? []} enCours={enCours} onReverifier={reverifier} />
          <Tableau titre="Formation rédaction de CV" type="formation" lignes={donnees.formations} enCours={enCours} onReverifier={reverifier} />
        </>
      )}
    </div>
  );
}
