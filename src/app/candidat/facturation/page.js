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
  const [loading, setLoading] = useState(true);
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

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) console.error("Erreur chargement des commandes:", error);
        else setOrders(data || []);
      } catch (err) {
        console.error("Exception facturation dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
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
                        {order.paystack_reference || "—"}
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
                        {order.invoice_url ? (
                          <button
                            onClick={() => handleDownloadInvoice(order)}
                            disabled={downloadingOrderId === order.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            {downloadingOrderId === order.id ? "..." : "Télécharger PDF"}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">Indisponible</span>
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
