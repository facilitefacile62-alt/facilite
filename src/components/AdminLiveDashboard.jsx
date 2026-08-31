"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminLiveDashboard({
  users = [],
  offers = [],
  applications = [],
  resumes = [],
  badgeRequests = [],
  orders = [],
  securityAlerts = [],
  periodDays = 7,
  onNavigateTab,
  triggerToast
}) {
  // --- États internes ---
  const [transactionsList, setTransactionsList] = useState(orders || []);
  const [activityFilter, setActivityFilter] = useState("all");
  const [financialFilter, setFinancialFilter] = useState("all"); // all | paid | pending | failed
  const [chartMetric, setChartMetric] = useState("activity"); // activity | finance
  const [validatingOrderId, setValidatingOrderId] = useState(null);
  const [chartHoverDay, setChartHoverDay] = useState(null);

  // Synchronisation des commandes
  useEffect(() => {
    if (orders && orders.length > 0) {
      setTransactionsList(orders);
    }
  }, [orders]);

  // --- 1. Raccourcis de modération & Éléments nécessitant une attention ---
  const pendingBadgeCount = useMemo(() => {
    return badgeRequests.filter((b) => b.status === "pending").length;
  }, [badgeRequests]);

  const pendingOrdersCount = useMemo(() => {
    return transactionsList.filter((o) => o.payment_status === "pending" || o.payment_status === "unpaid").length;
  }, [transactionsList]);

  const recentSecurityCount = useMemo(() => {
    return securityAlerts.filter((a) => !a.resolved).length;
  }, [securityAlerts]);

  // --- 2. Statistiques Financières ---
  const financialStats = useMemo(() => {
    const now = Date.now();
    const periodMs = periodDays * 24 * 60 * 60 * 1000;
    const prevPeriodMs = periodMs * 2;
    const day24hMs = 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let periodRevenue = 0;
    let prevPeriodRevenue = 0;
    let revenue24h = 0;
    let paidOrdersCount = 0;

    transactionsList.forEach((order) => {
      const orderAmount = Number(order.amount) || 0;
      const isPaid = order.payment_status === "paid" || order.payment_status === "completed" || order.payment_status === "success";
      const orderTime = new Date(order.created_at || order.updated_at).getTime();

      if (isPaid) {
        totalRevenue += orderAmount;
        paidOrdersCount += 1;

        if (now - orderTime <= periodMs) {
          periodRevenue += orderAmount;
        } else if (now - orderTime <= prevPeriodMs) {
          prevPeriodRevenue += orderAmount;
        }

        if (now - orderTime <= day24hMs) {
          revenue24h += orderAmount;
        }
      }
    });

    const avgOrderValue = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0;
    const growthRevenue = prevPeriodRevenue > 0 ? Math.round(((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100) : (periodRevenue > 0 ? 100 : 0);

    return {
      totalRevenue,
      periodRevenue,
      prevPeriodRevenue,
      revenue24h,
      paidOrdersCount,
      avgOrderValue,
      growthRevenue
    };
  }, [transactionsList, periodDays]);

  // Validation manuelle d'un paiement en attente
  const handleValidateOrder = async (orderId, newStatus = "paid") => {
    setValidatingOrderId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      setTransactionsList((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: newStatus } : o))
      );

      triggerToast?.(
        newStatus === "paid" ? "✅ Paiement validé avec succès !" : "Commande rejetée.",
        newStatus === "paid" ? "fa-circle-check" : "fa-circle-xmark"
      );
    } catch (err) {
      console.error("Erreur validation commande:", err);
      triggerToast?.("Erreur : " + err.message, "fa-triangle-exclamation");
    } finally {
      setValidatingOrderId(null);
    }
  };

  // --- 3. Fil d'Activité Unifié en Direct (Live Activity Stream) ---
  const activityLogs = useMemo(() => {
    const logs = [];

    // Inscriptions
    users.forEach((u) => {
      logs.push({
        id: `user-${u.id}`,
        type: "user",
        category: "inscriptions",
        title: "Nouvelle inscription",
        detail: u.full_name || u.email || "Utilisateur sans nom",
        email: u.email,
        avatar: u.avatar_url,
        timestamp: new Date(u.created_at).getTime(),
        dateStr: u.created_at,
        icon: "fa-user-plus",
        color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400"
      });
    });

    // Candidatures
    applications.forEach((app) => {
      logs.push({
        id: `app-${app.id}`,
        type: "application",
        category: "candidatures",
        title: "Candidature déposée",
        detail: app.candidate_name || app.candidate_email || "Candidat",
        badge: app.status || "envoyée",
        timestamp: new Date(app.created_at).getTime(),
        dateStr: app.created_at,
        icon: "fa-paper-plane",
        color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400"
      });
    });

    // Documents IA & CVs
    resumes.forEach((res) => {
      logs.push({
        id: `res-${res.id}`,
        type: "resume",
        category: "ia_cv",
        title: "Document / CV généré",
        detail: res.title || "CV Professionnel",
        timestamp: new Date(res.created_at).getTime(),
        dateStr: res.created_at,
        icon: "fa-robot",
        color: "text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400"
      });
    });

    // Commandes & Paiements
    transactionsList.forEach((ord) => {
      logs.push({
        id: `ord-${ord.id}`,
        type: "order",
        category: "ventes",
        title: ord.payment_status === "paid" ? "Paiement validé" : "Commande initiée",
        detail: `${Number(ord.amount || 0).toLocaleString("fr-FR")} CFA · ${ord.payment_method || "Paiement"}`,
        badge: ord.payment_status,
        timestamp: new Date(ord.created_at || ord.updated_at).getTime(),
        dateStr: ord.created_at || ord.updated_at,
        icon: "fa-receipt",
        color: ord.payment_status === "paid" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60" : "text-amber-600 bg-amber-50 dark:bg-amber-950/60"
      });
    });

    // Demandes de Badges
    badgeRequests.forEach((badge) => {
      logs.push({
        id: `badge-${badge.id}`,
        type: "badge",
        category: "moderation",
        title: "Demande de badge",
        detail: `${badge.requested_role || "Recruteur"} · ${badge.organization_name || "Entreprise"}`,
        badge: badge.status,
        timestamp: new Date(badge.created_at).getTime(),
        dateStr: badge.created_at,
        icon: "fa-certificate",
        color: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400"
      });
    });

    // Tri par date décroissante
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [users, applications, resumes, transactionsList, badgeRequests]);

  const filteredActivityLogs = useMemo(() => {
    if (activityFilter === "all") return activityLogs.slice(0, 30);
    return activityLogs.filter((log) => log.category === activityFilter).slice(0, 30);
  }, [activityLogs, activityFilter]);

  // --- 4. Données pour les Graphiques de Tendances (7 à 30 jours) ---
  const chartData = useMemo(() => {
    const daysCount = periodDays;
    const now = new Date();
    const daysArray = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

      daysArray.push({
        dateStr: dayStr,
        label: label,
        users: 0,
        applications: 0,
        resumes: 0,
        revenue: 0,
        ordersCount: 0
      });
    }

    // Agréger les utilisateurs
    users.forEach((u) => {
      if (!u.created_at) return;
      const day = u.created_at.split("T")[0];
      const match = daysArray.find((item) => item.dateStr === day);
      if (match) match.users += 1;
    });

    // Agréger les candidatures
    applications.forEach((a) => {
      if (!a.created_at) return;
      const day = a.created_at.split("T")[0];
      const match = daysArray.find((item) => item.dateStr === day);
      if (match) match.applications += 1;
    });

    // Agréger les CVs
    resumes.forEach((r) => {
      if (!r.created_at) return;
      const day = r.created_at.split("T")[0];
      const match = daysArray.find((item) => item.dateStr === day);
      if (match) match.resumes += 1;
    });

    // Agréger les revenus
    transactionsList.forEach((ord) => {
      const date = (ord.created_at || ord.updated_at)?.split("T")[0];
      const match = daysArray.find((item) => item.dateStr === date);
      if (match && (ord.payment_status === "paid" || ord.payment_status === "completed")) {
        match.revenue += Number(ord.amount) || 0;
        match.ordersCount += 1;
      }
    });

    // Calcul des valeurs maximales pour l'échelle SVG
    const maxUsers = Math.max(...daysArray.map((d) => d.users), 1);
    const maxApps = Math.max(...daysArray.map((d) => d.applications), 1);
    const maxResumes = Math.max(...daysArray.map((d) => d.resumes), 1);
    const maxActivity = Math.max(maxUsers, maxApps, maxResumes, 5);
    const maxRevenue = Math.max(...daysArray.map((d) => d.revenue), 10000);

    return {
      days: daysArray,
      maxActivity,
      maxRevenue
    };
  }, [users, applications, resumes, transactionsList, periodDays]);

  // Filtrage des transactions affichées dans la table financière
  const filteredTransactions = useMemo(() => {
    return transactionsList.filter((ord) => {
      if (financialFilter === "all") return true;
      if (financialFilter === "paid") return ord.payment_status === "paid" || ord.payment_status === "completed";
      if (financialFilter === "pending") return ord.payment_status === "pending" || ord.payment_status === "unpaid";
      if (financialFilter === "failed") return ord.payment_status === "failed" || ord.payment_status === "cancelled";
      return true;
    }).slice(0, 15);
  }, [transactionsList, financialFilter]);

  const formatTimeAgo = (isoDate) => {
    if (!isoDate) return "";
    const ms = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  };

  return (
    <div className="space-y-8 mt-2 animate-in fade-in duration-300">
      
      {/* ========================================================================= */}
      {/* 1. CENTRE D'ACTION & MODÉRATION RAPIDE (ATTENTION REQUISE) */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Centre d&apos;Action & Modération (Attention Requise)
          </h3>
          <span className="text-[11px] font-bold text-gray-500">
            {pendingBadgeCount + pendingOrdersCount + recentSecurityCount} action(s) en attente
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Action 1 : Demandes de Badges */}
          <div
            onClick={() => onNavigateTab?.("badges")}
            className="group bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs hover:shadow-md hover:border-amber-400 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-certificate"></i>
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 block">Demandes de Badge</span>
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {pendingBadgeCount} <span className="text-xs font-semibold text-gray-400">à valider</span>
                </span>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all"></i>
          </div>

          {/* Action 2 : Paiements / Commandes en attente */}
          <div
            onClick={() => {
              const el = document.getElementById("section-finances");
              el?.scrollIntoView({ behavior: "smooth" });
              setFinancialFilter("pending");
            }}
            className="group bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs hover:shadow-md hover:border-emerald-400 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 block">Paiements en attente</span>
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {pendingOrdersCount} <span className="text-xs font-semibold text-gray-400">à vérifier</span>
                </span>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"></i>
          </div>

          {/* Action 3 : Messagerie Support */}
          <Link
            href="/admin/messages"
            className="group bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs hover:shadow-md hover:border-blue-400 transition flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-headset"></i>
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 block">Support Client & FAQ</span>
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                  Accéder à la messagerie →
                </span>
              </div>
            </div>
            <i className="fa-solid fa-arrow-up-right-from-square text-xs text-gray-300 group-hover:text-blue-500 transition-colors"></i>
          </Link>

          {/* Action 4 : Lab Sécurité & RLS */}
          <div
            onClick={() => onNavigateTab?.("securite")}
            className="group bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs hover:shadow-md hover:border-purple-400 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 block">Sécurité & Audits</span>
                <span className="text-xl font-black text-gray-900 dark:text-white">
                  {recentSecurityCount > 0 ? (
                    <span className="text-rose-600">{recentSecurityCount} alerte(s)</span>
                  ) : (
                    <span className="text-emerald-600 text-sm">Système sain ✅</span>
                  )}
                </span>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all"></i>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GRAPHIQUES DE TENDANCES ET ANALYTICS (7 À 30 JOURS) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        
        {/* Header du graphique avec sélecteur de métrique */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2]"></span>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Évolution Temporelle & Tendances ({periodDays} jours)
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Visualisation chronologique des inscriptions, candidatures, générations IA et flux financier.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartMetric("activity")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                chartMetric === "activity"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              <i className="fa-solid fa-chart-line"></i>
              <span>Activité Plateforme</span>
            </button>

            <button
              onClick={() => setChartMetric("finance")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                chartMetric === "finance"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              <i className="fa-solid fa-money-bill-trend-up"></i>
              <span>Revenus (FCFA)</span>
            </button>
          </div>
        </div>

        {/* Légende du graphique */}
        <div className="flex items-center gap-5 pt-4 pb-2 text-xs font-bold text-gray-600 dark:text-gray-400 flex-wrap">
          {chartMetric === "activity" ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>Inscriptions Utilisateurs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span>Candidatures Envoyées</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span>CVs & Outils IA</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>Revenus Encaissés par Jour (CFA)</span>
            </div>
          )}
        </div>

        {/* Zone de rendu SVG du Graphique */}
        <div className="relative pt-6 pb-2">
          
          {/* Tooltip au survol */}
          {chartHoverDay && (
            <div className="absolute top-0 right-4 bg-gray-900 text-white text-xs px-3.5 py-2 rounded-xl shadow-xl z-20 pointer-events-none border border-gray-700 animate-in fade-in">
              <div className="font-extrabold text-orange-400 mb-1">{chartHoverDay.label} ({chartHoverDay.dateStr})</div>
              {chartMetric === "activity" ? (
                <div className="space-y-0.5">
                  <div className="text-emerald-400">👥 {chartHoverDay.users} inscriptions</div>
                  <div className="text-blue-400">💼 {chartHoverDay.applications} candidatures</div>
                  <div className="text-purple-400">🤖 {chartHoverDay.resumes} documents IA</div>
                </div>
              ) : (
                <div>
                  <div className="text-emerald-400 font-black text-sm">
                    {chartHoverDay.revenue.toLocaleString("fr-FR")} CFA
                  </div>
                  <div className="text-gray-300 text-[10px]">{chartHoverDay.ordersCount} transaction(s) payée(s)</div>
                </div>
              )}
            </div>
          )}

          {/* Graphique SVG dynamique */}
          <div className="w-full h-56 flex items-end gap-1 sm:gap-2 px-2 pt-6">
            {chartData.days.map((day, idx) => {
              const maxVal = chartMetric === "activity" ? chartData.maxActivity : chartData.maxRevenue;
              
              // Hauteurs relatives (en pourcentage, min 4% pour être visible)
              const userH = Math.max(4, Math.min(100, (day.users / maxVal) * 100));
              const appH = Math.max(4, Math.min(100, (day.applications / maxVal) * 100));
              const resH = Math.max(4, Math.min(100, (day.resumes / maxVal) * 100));
              const revH = Math.max(4, Math.min(100, (day.revenue / maxVal) * 100));

              return (
                <div
                  key={day.dateStr}
                  onMouseEnter={() => setChartHoverDay(day)}
                  onMouseLeave={() => setChartHoverDay(null)}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                >
                  {/* Colonnes de données */}
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-44 pb-1">
                    {chartMetric === "activity" ? (
                      <>
                        <div
                          style={{ height: `${userH}%` }}
                          className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-sm transition-all group-hover:brightness-125"
                        ></div>
                        <div
                          style={{ height: `${appH}%` }}
                          className="w-1.5 sm:w-2 bg-blue-500 rounded-t-sm transition-all group-hover:brightness-125"
                        ></div>
                        <div
                          style={{ height: `${resH}%` }}
                          className="w-1.5 sm:w-2 bg-purple-500 rounded-t-sm transition-all group-hover:brightness-125"
                        ></div>
                      </>
                    ) : (
                      <div
                        style={{ height: `${revH}%` }}
                        className={`w-full max-w-[24px] rounded-t-md transition-all ${
                          day.revenue > 0
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:brightness-110 shadow-xs"
                            : "bg-gray-100 dark:bg-gray-800"
                        }`}
                      ></div>
                    )}
                  </div>

                  {/* Label de la date */}
                  <span className="text-[9px] sm:text-[10px] text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white font-bold truncate max-w-full text-center">
                    {idx % 2 === 0 || periodDays <= 7 ? day.label.split(" ")[0] : ""}
                  </span>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. SUIVI FINANCIER & DES TRANSACTIONS / ABONNEMENTS */}
      {/* ========================================================================= */}
      <div id="section-finances" className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        
        {/* Header Financier */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Suivi Financier & Validation des Commandes
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Chiffre d&apos;affaires, abonnements et validation manuelle des paiements.
            </p>
          </div>

          {/* Filtres de statut de paiement */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
            {[
              { id: "all", label: "Toutes" },
              { id: "paid", label: "Payées ✅" },
              { id: "pending", label: "En attente ⏳" },
              { id: "failed", label: "Échouées ❌" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFinancialFilter(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  financialFilter === f.id
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Mini Cartes KPI Financières */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
            <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
              Revenus Totaux
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1 block">
              {financialStats.totalRevenue.toLocaleString("fr-FR")} CFA
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
              {financialStats.paidOrdersCount} commandes encaissées
            </span>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
            <span className="text-[11px] font-extrabold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">
              Période ({periodDays}j)
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-950 dark:text-blue-100 mt-1 block">
              {financialStats.periodRevenue.toLocaleString("fr-FR")} CFA
            </span>
            <span className={`text-[10px] font-bold ${financialStats.growthRevenue >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {financialStats.growthRevenue >= 0 ? "+" : ""}{financialStats.growthRevenue}% vs préc.
            </span>
          </div>

          <div className="bg-purple-50/60 dark:bg-purple-950/40 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/50">
            <span className="text-[11px] font-extrabold text-purple-800 dark:text-purple-300 uppercase tracking-wider block">
              Dernières 24h
            </span>
            <span className="text-xl sm:text-2xl font-black text-purple-950 dark:text-purple-100 mt-1 block">
              {financialStats.revenue24h.toLocaleString("fr-FR")} CFA
            </span>
            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold">
              Activité journalière
            </span>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/50">
            <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
              Panier Moyen
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-100 mt-1 block">
              {financialStats.avgOrderValue.toLocaleString("fr-FR")} CFA
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
              Par commande client
            </span>
          </div>
        </div>

        {/* Tableau des Dernières Transactions */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              Aucune transaction trouvée pour ce filtre.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Réf. Commande</th>
                  <th className="pb-3">Client / ID</th>
                  <th className="pb-3">Montant</th>
                  <th className="pb-3">Méthode</th>
                  <th className="pb-3">Statut</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTransactions.map((ord) => {
                  const isPaid = ord.payment_status === "paid" || ord.payment_status === "completed";
                  const isPending = ord.payment_status === "pending" || ord.payment_status === "unpaid";
                  const isValidating = validatingOrderId === ord.id;

                  return (
                    <tr key={ord.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                      <td className="py-3 pl-2 font-mono font-bold text-gray-900 dark:text-white">
                        {ord.id?.slice(0, 8)}...
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">
                        {ord.user_id ? (
                          <span className="font-medium" title={ord.user_id}>
                            {users.find((u) => u.id === ord.user_id)?.full_name || ord.user_id.slice(0, 10) + "..."}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Visiteur</span>
                        )}
                      </td>
                      <td className="py-3 font-black text-gray-950 dark:text-white">
                        {Number(ord.amount || 0).toLocaleString("fr-FR")} CFA
                      </td>
                      <td className="py-3 font-bold text-gray-600 dark:text-gray-400 capitalize">
                        {ord.payment_method || "KPay / Direct"}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isPending
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {ord.payment_status || "inconnu"}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 font-medium">
                        {formatTimeAgo(ord.created_at || ord.updated_at)}
                      </td>
                      <td className="py-3 text-right pr-2">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isValidating}
                              onClick={() => handleValidateOrder(ord.id, "paid")}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition active:scale-95 disabled:opacity-50"
                              title="Valider manuellement ce paiement"
                            >
                              {isValidating ? <i className="fa-solid fa-spinner fa-spin"></i> : "Valider"}
                            </button>
                            <button
                              type="button"
                              disabled={isValidating}
                              onClick={() => handleValidateOrder(ord.id, "failed")}
                              className="px-2 py-1 bg-gray-200 hover:bg-rose-100 text-gray-600 hover:text-rose-700 rounded-lg text-[11px] font-bold transition"
                              title="Rejeter"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-bold text-[11px]">Traité</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. FIL D'ACTIVITÉ EN DIRECT (LIVE ACTIVITY FEED / LOGS) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Fil d&apos;Activité en Direct (Live Activity)
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Flux chronologique en temps réel des actions et interactions sur Facilité.
            </p>
          </div>

          {/* Filtres d'activité */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl flex-wrap">
            {[
              { id: "all", label: "Toutes" },
              { id: "inscriptions", label: "👤 Inscriptions" },
              { id: "candidatures", label: "💼 Candidatures" },
              { id: "ia_cv", label: "🤖 IA & CVs" },
              { id: "ventes", label: "💰 Ventes" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActivityFilter(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  activityFilter === f.id
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des logs d'activité */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800/60 max-h-[480px] overflow-y-auto pr-1 mt-3">
          {filteredActivityLogs.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400">
              Aucune activité récente trouvée.
            </div>
          ) : (
            filteredActivityLogs.map((log) => (
              <div key={log.id} className="py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 px-2 rounded-2xl transition">
                
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Icône de l'activité */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${log.color} shadow-2xs`}>
                    <i className={`fa-solid ${log.icon}`}></i>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                        {log.title}
                      </span>
                      {log.badge && (
                        <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {log.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {log.detail}
                    </p>
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-[11px] font-semibold text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatTimeAgo(log.dateStr)}
                </div>

              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
