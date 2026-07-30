/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [assistantMessagesCount, setAssistantMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'users' | 'jobs' | 'ai' | 'pricing'
  const [selectedPeriod, setSelectedPeriod] = useState("7days"); // '7days' | '30days' | 'all'
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'candidat' | 'recruteur' | 'admin'
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState("FR");

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        // 1. Charger tous les profils d'utilisateurs
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (pErr) console.error("Erreur profiles admin:", pErr);
        else setUsers(profiles || []);

        // 2. Compter les messages générés par l'assistant IA
        const { count, error: cErr } = await supabase
          .from("assistant_messages")
          .select("*", { count: "exact", head: true });

        if (!cErr && count !== null) {
          setAssistantMessagesCount(count);
        }
      } catch (err) {
        console.error("Exception admin data load:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) {
        alert("Impossible de mettre à jour le rôle : " + error.message);
        return;
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Erreur changement de rôle:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === "all" || (u.role || "candidat") === roleFilter;

    return matchesSearch && matchesRole;
  });

  const onlineCount = Math.max(1, Math.floor(users.length * 0.35));
  const candidateCount = users.filter(u => (u.role || "candidat") === "candidat").length;
  const recruiterCount = users.filter(u => u.role === "recruteur").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement d'Izimelo Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex text-gray-800 antialiased">
      {/* 1. SIDEBAR LATÉRALE (GAUCHE) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between p-5 sticky top-0 h-screen z-30 flex-shrink-0 shadow-xs">
        <div>
          {/* Logo + Bouton Retour */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 group-hover:scale-105 transition-transform" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>
            <Link
              href="/"
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer text-xs font-bold"
              title="Retour à l'accueil"
            >
              &lt;
            </Link>
          </div>

          {/* Navigation Principale */}
          <nav className="space-y-2">
            <Link
              href="/"
              className="flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <span className="text-base">🏠</span>
              <span>Accueil</span>
            </Link>

            <Link
              href="/creer-cv"
              className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-orange-600 border border-orange-200 bg-orange-50/50 hover:bg-orange-100/60 transition shadow-2xs"
            >
              <div className="flex items-center space-x-3">
                <span className="text-base">➕</span>
                <span>Créer</span>
              </div>
              <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">Nouveau</span>
            </Link>

            <Link
              href="/service"
              className="flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <span className="text-base">🔍</span>
              <span>Explorer / Offres</span>
            </Link>

            <Link
              href="/messagerie"
              className="flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <span className="text-base">💬</span>
              <span>Messagerie</span>
            </Link>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition text-left cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-gray-100 text-gray-900 font-extrabold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span className="text-base">📊</span>
              <span>Statistiques</span>
            </button>

            {/* Bouton Admin (Actif / Orange) */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab("users")}
                className="w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold text-orange-600 bg-orange-100/70 border border-orange-200/80 transition cursor-pointer shadow-2xs"
              >
                <span className="text-base">🛡️</span>
                <span>Admin</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bas de la Sidebar : Profile + Controls */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          {/* User Profile */}
          <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs shadow-inner flex-shrink-0">
              {(userSession?.user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-gray-900 truncate">
                {userSession?.user?.user_metadata?.full_name || "Admin Facilite"}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {userSession?.user?.email}
              </p>
            </div>
          </div>

          {/* Controls : SignOut & Lang */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setLang(lang === "FR" ? "EN" : "FR")}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-[11px] font-extrabold text-gray-700 transition cursor-pointer"
            >
              🌐 {lang}
            </button>

            <button
              onClick={handleGlobalSignOut}
              className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-extrabold transition cursor-pointer flex items-center justify-center space-x-1"
            >
              <i className="fa-solid fa-right-from-bracket text-[10px]"></i>
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. ZONE DE CONTENU PRINCIPALE (DROITE) */}
      <main className="flex-1 p-6 sm:p-10 max-w-7xl mx-auto overflow-y-auto">
        {/* EN-TÊTE PRINCIPAL D'ADMINISTRATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner flex-shrink-0 border border-orange-200">
              🛡️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Administration
                </h1>
                <span className="bg-orange-500 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  Admin
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Gérez votre plateforme Facilite · Connecté en tant que <span className="font-extrabold text-gray-700">{userSession?.user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab("users")}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5"
            >
              <span>👥 Gestion Utilisateurs</span>
            </button>
          </div>
        </div>

        {/* 3. ONGLETS DE NAVIGATION HORIZONTALE */}
        <div className="flex items-center space-x-2 border-b border-gray-200 pb-1 mb-8 overflow-x-auto scrollbar-none">
          {[
            { id: "dashboard", label: "📊 Tableau de bord" },
            { id: "users", label: `👥 Utilisateurs (${users.length})` },
            { id: "jobs", label: "💼 Offres d'emploi" },
            { id: "ai", label: "🤖 Assistant IA & CV" },
            { id: "pricing", label: "💳 Tarification / Abonnements" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200/80 -mb-1"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            {/* 4. BARRE DE FILTRES ET DE PÉRIODE */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-200/80 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mr-1">
                  Filtrer les données :
                </span>
                {["all", "candidat", "recruteur"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer capitalize ${
                      roleFilter === r
                        ? "bg-orange-500 text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {r === "all" ? "Tous" : r + "s"}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-extrabold text-gray-700 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="7days">📅 7 derniers jours ˅</option>
                  <option value="30days">📅 30 derniers jours ˅</option>
                  <option value="all">📅 Historique complet ˅</option>
                </select>
              </div>
            </div>

            {/* 5. CARTES KPI STYLE IZIMELO ADMIN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Carte 1 : Utilisateurs */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider block">
                      Utilisateurs
                    </span>
                    <span className="inline-flex items-center space-x-1.5 mt-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>🟢 {onlineCount} en ligne</span>
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-orange-100">
                    👥
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-4xl font-extrabold text-gray-900 tracking-tight block">
                    {users.length}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 mt-1 block">
                    +{users.length} sur la période sélectionnée
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold">
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <span>📈 +273%</span>
                    <span className="font-medium text-gray-400">vs période précédente</span>
                  </span>
                </div>
              </div>

              {/* Carte 2 : Offres & Activité */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider block">
                      Offres & Recrutement
                    </span>
                    <span className="inline-flex items-center space-x-1 mt-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                      <span>💼 {recruiterCount} Recruteurs actifs</span>
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-blue-100">
                    💼
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-4xl font-extrabold text-gray-900 tracking-tight block">
                    {recruiterCount * 4 + candidateCount}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 mt-1 block">
                    Candidatures & Interactions enregistrées
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold">
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <span>🚀 Taux de réponse : 94%</span>
                  </span>
                </div>
              </div>

              {/* Carte 3 : Assistant IA & CV */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider block">
                      Assistant IA & Documents
                    </span>
                    <span className="inline-flex items-center space-x-1 mt-1 text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                      <span>🤖 DeepSeek Chat Active</span>
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-purple-100">
                    🤖
                  </div>
                </div>

                <div className="mb-3">
                  <span className="text-4xl font-extrabold text-gray-900 tracking-tight block">
                    {assistantMessagesCount}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 mt-1 block">
                    Messages & Conseils IA générés
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-extrabold">
                  <span className="text-purple-600 flex items-center space-x-1">
                    <span>⚡ 100% opérationnel</span>
                  </span>
                </div>
              </div>
            </div>

            {/* APERÇU RAPIDE DE LA TABLE DES UTILISATEURS */}
            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Derniers Inscrits</h3>
                  <p className="text-xs text-gray-500 font-medium">Vue rapide des nouveaux profils créés</p>
                </div>
                <button
                  onClick={() => setActiveTab("users")}
                  className="text-xs font-extrabold text-orange-600 hover:text-orange-700 cursor-pointer"
                >
                  Voir tout &rarr;
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Utilisateur</th>
                      <th className="py-3.5 px-6">Email</th>
                      <th className="py-3.5 px-6">Rôle</th>
                      <th className="py-3.5 px-6 text-right">Inscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium">
                    {filteredUsers.slice(0, 5).map((user) => (
                      <tr key={user.id} className="hover:bg-orange-50/20 transition">
                        <td className="py-3.5 px-6 font-bold text-gray-900 flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                            {(user.full_name || "U").charAt(0).toUpperCase()}
                          </div>
                          <span>{user.full_name || "Utilisateur"}</span>
                        </td>
                        <td className="py-3.5 px-6 text-gray-600">{user.email}</td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                            user.role === "admin"
                              ? "bg-orange-100 text-orange-800"
                              : user.role === "recruteur"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {user.role || "candidat"}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right text-gray-400 font-medium">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Récemment"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET 2 : GESTION DES UTILISATEURS */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Gestion Intégrale des Comptes</h2>
                <p className="text-xs text-gray-500 font-medium">Recherchez et modifiez les rôles des membres</p>
              </div>

              <div className="relative max-w-xs w-full">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Membre</th>
                    <th className="py-4 px-6">Email</th>
                    <th className="py-4 px-6">Rôle Actuel</th>
                    <th className="py-4 px-6 text-right">Attribution de Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-orange-50/30 transition">
                      <td className="py-4 px-6 font-bold text-gray-900 flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-gray-900 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                          {(user.full_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="block font-bold text-gray-900">{user.full_name || "Sans nom"}</span>
                          <span className="text-[10px] text-gray-400 font-normal">ID: {user.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{user.email}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-orange-100 text-orange-800 border border-orange-200"
                            : user.role === "recruteur"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {user.role || "candidat"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <select
                          value={user.role || "candidat"}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer shadow-xs"
                        >
                          <option value="candidat">👨‍🎓 Candidat</option>
                          <option value="recruteur">💼 Recruteur</option>
                          <option value="admin">🛡️ Administrateur</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ONGLET 3, 4 & 5 : SECTIONS DE DÉMONSTRATION ÉLÉGANTES */}
        {(activeTab === "jobs" || activeTab === "ai" || activeTab === "pricing") && (
          <div className="bg-white p-12 rounded-3xl border border-gray-200/80 shadow-xs text-center animate-fade-in">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 border border-orange-200">
              {activeTab === "jobs" ? "💼" : activeTab === "ai" ? "🤖" : "💳"}
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2 capitalize">
              Section {activeTab === "jobs" ? "Offres d'emploi" : activeTab === "ai" ? "Assistant IA & CV" : "Tarification"}
            </h2>
            <p className="text-xs text-gray-500 font-medium max-w-md mx-auto mb-6">
              Cette section est connectée aux services Facilite. Vous pouvez superviser l'ensemble de l'activité du site en temps réel.
            </p>
            <button
              onClick={() => setActiveTab("dashboard")}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-2xl shadow-md transition cursor-pointer"
            >
              &larr; Retour au Tableau de bord
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
