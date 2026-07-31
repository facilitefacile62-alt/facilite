/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import StatusBadge from "@/components/StatusBadge";

function formatFcfa(amount) {
  return `${Math.round(Number(amount) || 0).toLocaleString("fr-FR")} FCFA`;
}

export default function AdminDashboardKpiPage() {
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [resumesCount, setResumesCount] = useState(0);
  const [activeOffersCount, setActiveOffersCount] = useState(0);
  const [applicationsCount, setApplicationsCount] = useState(0);

  async function loadDashboard() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || (profile.role !== "admin" && profile.role !== "agent")) {
        window.location.replace(profile?.role ? `/${profile.role === "candidat" ? "messagerie" : profile.role}` : "/login");
        return;
      }
      setUserRole(profile.role);
      setUserId(session.user.id);

      const [ordersRes, resumesRes, offersRes, applicationsRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("resumes").select("id", { count: "exact", head: true }),
        supabase.from("job_offers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("candidatures").select("id", { count: "exact", head: true }),
      ]);

      const ordersList = ordersRes.data || [];
      setOrders(ordersList);
      setResumesCount(resumesRes.count || 0);
      setActiveOffersCount(offersRes.count || 0);
      setApplicationsCount(applicationsRes.count || 0);

      const userIds = [...new Set(ordersList.map((o) => o.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const map = {};
        (profs || []).forEach((p) => (map[p.id] = p));
        setProfilesById(map);
      }
    } catch (err) {
      console.error("Exception admin dashboard KPI:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, []);

  // Synchronisation temps réel : un nouveau paiement (webhook Paystack) doit
  // apparaître dans les KPIs et la table des transactions sans que l'admin
  // ait besoin de recharger la page.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`admin-dashboard-orders:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        loadDashboard();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const cvCount = resumesCount;
  const activeAccompagnementCount = paidOrders.filter((o) => o.has_agent_option).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight hidden sm:inline">Facilite</span>
            </Link>
            <RoleBadge role={userRole} />
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/admin"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5"
              title="Admin"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span className="hidden md:inline">Admin</span>
            </Link>
            <Link
              href="/admin/commandes-agent"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5"
              title="Commandes Agent"
            >
              <i className="fa-solid fa-user-tie"></i>
              <span className="hidden md:inline">Commandes Agent</span>
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition cursor-pointer flex items-center space-x-1"
              title="Déconnexion"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          Dashboard Analytics Global
        </h1>
        <p className="text-sm text-gray-500 font-medium mb-8">Indicateurs clés de la plateforme Facilite.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <i className="fa-solid fa-sack-dollar"></i>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Revenu total</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{formatFcfa(totalRevenue)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">CVs confectionnés</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{cvCount}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <i className="fa-solid fa-user-tie"></i>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Accompagnements actifs</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{activeAccompagnementCount}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Offres actives</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {activeOffersCount} <span className="text-sm text-gray-400 font-bold">/ {applicationsCount} postulations</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-extrabold text-gray-900">Transactions Paystack ({orders.length})</h2>
            <p className="text-xs text-gray-500 font-medium">Historique complet des commandes de la plateforme</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Client</th>
                  <th className="py-4 px-6">Référence Paystack</th>
                  <th className="py-4 px-6">Formule</th>
                  <th className="py-4 px-6">Montant</th>
                  <th className="py-4 px-6">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 italic">
                      Aucune transaction pour le moment.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const client = profilesById[order.user_id];
                    return (
                      <tr key={order.id} className="hover:bg-emerald-50/20 transition">
                        <td className="py-4 px-6 text-gray-600">
                          {new Date(order.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{client?.full_name || "—"}</span>
                          <span className="text-gray-400">{client?.email || order.user_id}</span>
                        </td>
                        <td className="py-4 px-6 text-gray-500 font-mono text-[11px]">
                          {order.paystack_reference || "—"}
                        </td>
                        <td className="py-4 px-6">
                          {order.has_agent_option ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                              Accompagnée
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-gray-100 text-gray-700 border border-gray-200">
                              Autonome
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-900">{formatFcfa(order.amount)}</td>
                        <td className="py-4 px-6">
                          <StatusBadge status={order.payment_status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
