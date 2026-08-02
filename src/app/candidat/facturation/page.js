/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import { labelForCvModel } from "@/lib/cvModels";

export default function FacturationPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }

        setUserSession(session);

        const [ordersRes, transRes, subRes] = await Promise.all([
          supabase
            .from("orders")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", session.user.id)
            .single()
        ]);

        if (ordersRes.error) console.error("Erreur chargement des commandes:", ordersRes.error);
        else setOrders(ordersRes.data || []);
        
        if (transRes.error) console.error("Erreur chargement transactions:", transRes.error);
        else setTransactions(transRes.data || []);
        
        if (subRes.data) setSubscription(subRes.data);
      } catch (err) {
        console.error("Exception facturation dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  const handleBuyCredits = async () => {
    setLoadingPayment(true);
    try {
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession.access_token}`,
        },
        body: JSON.stringify({ amount: 5000, planName: "Premium", description: "Abonnement Premium (1 crédit)" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de paiement");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleDownloadInvoice = async (order) => {
    if (!order.invoice_url) return;
    setDownloadingOrderId(order.id);

    const { data, error } = await supabase.storage
      .from("invoices")
      .createSignedUrl(order.invoice_url, 3600);

    setDownloadingOrderId(null);

    if (error || !data?.signedUrl) {
      console.error("Erreur génération URL signée facture:", error?.message);
      alert("Impossible d'ouvrir la facture.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "paid":
      case "success":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Payé ✅
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-200">
            Échoué
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            En attente ⏳
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de votre facturation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <RoleBadge role="candidat" />
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/candidat"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Mon espace</span>
            </Link>
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 relative"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
              <UnreadBadge count={unreadMessagesCount} />
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Facturation
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">Mon Historique de Facturation</h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Retrouvez toutes vos commandes de confection de CV et téléchargez vos factures.
            </p>
          </div>
        </div>

        {/* Mon Solde et Achats de Crédits */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden mb-8 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Mon Forfait</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {subscription ? `Plan actuel : ${subscription.plan_name.toUpperCase()}` : "Aucun forfait actif."}
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-2">
              {subscription?.credits || 0} <span className="text-sm font-bold text-gray-500">crédits restants</span>
            </p>
          </div>
          <button
            onClick={handleBuyCredits}
            disabled={loadingPayment}
            className="px-6 py-3 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 text-sm font-extrabold rounded-2xl transition shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loadingPayment ? (
              <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <i className="fa-solid fa-bolt"></i>
            )}
            <span>Recharger mon compte (5000 XOF)</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-extrabold text-gray-900">Achats ({orders.length})</h2>
            <p className="text-xs text-gray-500 font-medium">Historique complet de vos paiements</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Référence</th>
                  <th className="py-4 px-6">Modèle</th>
                  <th className="py-4 px-6">Formule</th>
                  <th className="py-4 px-6">Montant</th>
                  <th className="py-4 px-6">Statut</th>
                  <th className="py-4 px-6 text-right">Facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-400 italic">
                      Vous n'avez encore effectué aucun achat.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-emerald-50/20 transition">
                      <td className="py-4 px-6 text-gray-600">
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-4 px-6 text-gray-500 font-mono text-[11px]">
                        {order.payment_reference || "—"}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900">{labelForCvModel(order.cv_model_id)}</td>
                      <td className="py-4 px-6">
                        {order.has_agent_option ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                            Accompagné
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
                            Autonome
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900">
                        {Number(order.amount).toLocaleString("fr-FR")} {order.currency}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(order.payment_status)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {order.payment_status === "paid" && order.resume_id && (
                            <Link
                              href={`/creer-cv?resumeId=${order.resume_id}&download=1`}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold rounded-lg transition shadow-xs cursor-pointer whitespace-nowrap"
                            >
                              Télécharger mon CV
                            </Link>
                          )}
                          {order.invoice_url ? (
                            <button
                              onClick={() => handleDownloadInvoice(order)}
                              disabled={downloadingOrderId === order.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              {downloadingOrderId === order.id ? "..." : "Facture PDF"}
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[11px]">Facture indisponible</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recharges de crédits — jusqu'ici récupérées en state mais jamais
            affichées : aucun moyen de consulter ni télécharger le reçu
            d'une recharge de crédits IA sur la plateforme. */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden mt-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-extrabold text-gray-900">Recharges de crédits ({transactions.length})</h2>
            <p className="text-xs text-gray-500 font-medium">Historique de vos achats de crédits IA</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Référence</th>
                  <th className="py-4 px-6">Formule</th>
                  <th className="py-4 px-6">Montant</th>
                  <th className="py-4 px-6">Statut</th>
                  <th className="py-4 px-6 text-right">Reçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 italic">
                      Vous n'avez encore effectué aucune recharge de crédits.
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-emerald-50/20 transition">
                      <td className="py-4 px-6 text-gray-600">
                        {new Date(transaction.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-4 px-6 text-gray-500 font-mono text-[11px]">
                        {transaction.provider_reference || "—"}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900">
                        {transaction.metadata?.plan_name || "Recharge de crédits"}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900">
                        {Number(transaction.amount).toLocaleString("fr-FR")} {transaction.currency}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(transaction.status)}</td>
                      <td className="py-4 px-6 text-right">
                        {transaction.invoice_url ? (
                          <button
                            onClick={() => handleDownloadInvoice(transaction)}
                            disabled={downloadingOrderId === transaction.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            {downloadingOrderId === transaction.id ? "..." : "Reçu PDF"}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">Reçu indisponible</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
