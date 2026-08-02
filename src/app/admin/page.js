/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import BadgeDisplay from "@/components/BadgeDisplay";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "messages", label: "Messagerie Support", icon: "💬", href: "/admin/messages" },
  { id: "utilisateurs", label: "Utilisateurs", icon: "👥" },
  { id: "badges", label: "Demandes de badge", icon: "🎖️" },
  { id: "offres", label: "Offres d'emploi", icon: "💼" },
  { id: "ia", label: "Assistant IA & CV", icon: "🤖" },
  { id: "tarification", label: "Tarification", icon: "💳" },
];

const PERIODS = [
  { days: 7, label: "7 derniers jours" },
  { days: 30, label: "30 derniers jours" },
  { days: 90, label: "90 derniers jours" },
];

// Proxy "en ligne" : ce projet n'a pas de suivi de présence en temps réel.
// On considère "en ligne" un profil dont updated_at date de moins de 5 min —
// une approximation raisonnable, pas une vraie présence websocket.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function countInWindow(rows, dateField, startMsAgo, endMsAgo) {
  const now = Date.now();
  return rows.filter((r) => {
    const t = new Date(r[dateField]).getTime();
    return t <= now - endMsAgo && t > now - startMsAgo;
  }).length;
}

function growthPercent(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function AdminDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [selectedLang, setSelectedLang] = useState("FR");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [periodDays, setPeriodDays] = useState(7);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'none' | 'verified_recruiter' (filtre par badge, plus par rôle depuis le chantier RBAC — candidat/recruteur ont fusionné en 'user')

  const [users, setUsers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [badgeRequests, setBadgeRequests] = useState([]);
  const [rejectReasonDraft, setRejectReasonDraft] = useState({});

  const [searchQuery, setSearchQuery] = useState("");
  const [tableRoleFilter, setTableRoleFilter] = useState("all");
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-check" });
  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  };

  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    // localStorage n'existe pas côté serveur : cette lecture doit rester
    // dans un effet (jamais pendant le rendu, pour éviter un hydration
    // mismatch), donc setState-après-lecture-synchrone est ici la seule
    // option correcte.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedLang) setSelectedLang(savedLang);
  }, []);

  const handleLangChange = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem("lang", lang);
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        const [profilesRes, rolesRes, offersRes, applicationsRes, resumesRes, badgeRequestsRes] = await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("*"),
          supabase.from("job_offers").select("id, created_at").order("created_at", { ascending: false }),
          supabase.from("candidatures").select("id, created_at").order("created_at", { ascending: false }),
          supabase.from("resumes").select("id, user_id, created_at, type").order("created_at", { ascending: false }),
          supabase
            .from("badge_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true }),
        ]);

        if (profilesRes.error || rolesRes.error) {
          console.error("Erreur chargement profils/rôles:", profilesRes.error || rolesRes.error);
        } else {
          // profiles et user_roles n'ont pas de relation FK directe entre
          // elles (toutes deux référencent séparément auth.users) : pas
          // d'embedding PostgREST possible, fusion faite ici côté client.
          const roleByUserId = new Map((rolesRes.data || []).map((r) => [r.user_id, r]));
          const merged = (profilesRes.data || []).map((p) => ({
            ...p,
            role: roleByUserId.get(p.id)?.role || "user",
            status: roleByUserId.get(p.id)?.status || "active",
          }));
          setUsers(merged);
        }

        if (offersRes.error) console.error("Erreur chargement offres:", offersRes.error);
        else setOffers(offersRes.data || []);

        if (applicationsRes.error) console.error("Erreur chargement candidatures:", applicationsRes.error);
        else setApplications(applicationsRes.data || []);

        if (resumesRes.error) console.error("Erreur chargement CV:", resumesRes.error);
        else setResumes(resumesRes.data || []);

        if (badgeRequestsRes.error) console.error("Erreur chargement demandes de badge:", badgeRequestsRes.error);
        else setBadgeRequests(badgeRequestsRes.data || []);
      } catch (err) {
        console.error("Exception chargement dashboard admin:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    const previousUsers = users;
    setUpdatingUserId(userId);
    // Mise à jour optimiste : bascule immédiate de l'UI, restaurée en cas d'échec.
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    // user_roles n'accorde aucun privilège d'écriture direct à authenticated
    // (RBAC, 20260802050000) : toute écriture passe par cette route
    // service_role, qui revérifie elle-même que l'appelant est admin.
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userSession.access_token}` },
      body: JSON.stringify({ role: newRole }),
    });
    const body = await res.json().catch(() => ({}));

    setUpdatingUserId(null);

    if (!res.ok) {
      console.error("Erreur mise à jour rôle:", body.error);
      setUsers(previousUsers);
      triggerToast("Impossible de mettre à jour le rôle : " + (body.error || "erreur inconnue"), "fa-triangle-exclamation");
      return;
    }

    const target = previousUsers.find((u) => u.id === userId);
    triggerToast(`Rôle de ${target?.full_name || target?.email || "l'utilisateur"} mis à jour : ${newRole.toUpperCase()}`, "fa-circle-check");
  };

  // Section 4 du chantier RBAC : approve_badge_request()/reject_badge_request()
  // sont conçues pour être appelées directement (autorisation vérifiée à
  // l'intérieur de la fonction SQL elle-même, pas seulement ici).
  const handleApproveBadgeRequest = async (requestId) => {
    setUpdatingUserId(requestId);
    const { data: approved, error } = await supabase.rpc("approve_badge_request", { request_id: requestId });
    setUpdatingUserId(null);

    if (error || !approved) {
      triggerToast("Impossible d'approuver cette demande : " + (error?.message || "déjà traitée"), "fa-triangle-exclamation");
      return;
    }

    setBadgeRequests((prev) => prev.filter((r) => r.id !== requestId));
    triggerToast("Badge approuvé.", "fa-circle-check");
  };

  const handleRejectBadgeRequest = async (requestId, reason) => {
    setUpdatingUserId(requestId);
    const { data: rejected, error } = await supabase.rpc("reject_badge_request", {
      request_id: requestId,
      reason: reason || "Non conforme",
    });
    setUpdatingUserId(null);

    if (error || !rejected) {
      triggerToast("Impossible de rejeter cette demande : " + (error?.message || "déjà traitée"), "fa-triangle-exclamation");
      return;
    }

    setBadgeRequests((prev) => prev.filter((r) => r.id !== requestId));
    triggerToast("Demande rejetée.", "fa-circle-check");
  };

  // --- KPI ---
  const periodMs = periodDays * 24 * 60 * 60 * 1000;

  const kpi = useMemo(() => {
    const scopedUsers = users.filter((u) => {
      if (roleFilter === "all") return true;
      const isVerifiedRecruiter = (u.badges || []).includes("verified_recruiter");
      return roleFilter === "verified_recruiter" ? isVerifiedRecruiter : !isVerifiedRecruiter;
    });

    const candidats = users.filter((u) => !(u.badges || []).includes("verified_recruiter"));
    const recruteurs = users.filter((u) => (u.badges || []).includes("verified_recruiter"));
    // Date.now() rend ce useMemo techniquement impur (react-hooks/purity) :
    // le compteur "en ligne" ne se rafraîchit qu'aux re-renders déclenchés
    // par d'autres causes (changement de filtre, KPI...), pas à l'horloge —
    // acceptable pour un indicateur approximatif, pas besoin d'un vrai
    // ticker temps réel ici.
    // eslint-disable-next-line react-hooks/purity
    const onlineCount = scopedUsers.filter((u) => Date.now() - new Date(u.updated_at).getTime() < ONLINE_WINDOW_MS).length;

    const usersThisPeriod = countInWindow(scopedUsers, "created_at", periodMs, 0);
    const usersPrevPeriod = countInWindow(scopedUsers, "created_at", periodMs * 2, periodMs);

    const offersThisPeriod = countInWindow(offers, "created_at", periodMs, 0);
    const offersPrevPeriod = countInWindow(offers, "created_at", periodMs * 2, periodMs);
    const applicationsThisPeriod = countInWindow(applications, "created_at", periodMs, 0);

    const resumesThisPeriod = countInWindow(resumes, "created_at", periodMs, 0);
    const resumesPrevPeriod = countInWindow(resumes, "created_at", periodMs * 2, periodMs);
    const candidatsWithCv = new Set(resumes.map((r) => r.user_id)).size;
    const conversionRate = candidats.length > 0 ? Math.round((candidatsWithCv / candidats.length) * 100) : 0;

    return {
      totalUsers: scopedUsers.length,
      candidatsCount: candidats.length,
      recruteursCount: recruteurs.length,
      onlineCount,
      usersThisPeriod,
      usersGrowth: growthPercent(usersThisPeriod, usersPrevPeriod),
      totalOffers: offers.length,
      offersThisPeriod,
      offersGrowth: growthPercent(offersThisPeriod, offersPrevPeriod),
      totalApplications: applications.length,
      applicationsThisPeriod,
      totalResumes: resumes.length,
      resumesThisPeriod,
      resumesGrowth: growthPercent(resumesThisPeriod, resumesPrevPeriod),
      conversionRate,
    };
  }, [users, offers, applications, resumes, roleFilter, periodMs]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = tableRoleFilter === "all" || (u.role || "user") === tableRoleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement du Panneau Admin...</p>
        </div>
      </div>
    );
  }

  const currentPeriodLabel = PERIODS.find((p) => p.days === periodDays)?.label || "7 derniers jours";

  return (
    <div className="min-h-screen bg-[#F7F7F8] font-sans flex">
      {/* Toast Notification Flottant */}
      {toast.show && (
        <div className="fixed top-5 right-5 z-[1000] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 animate-fade-in-down">
          <i className={`fa-solid ${toast.icon} text-orange-400 text-base`}></i>
          <span className="text-xs font-extrabold">{toast.message}</span>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR LATÉRALE */}
      {/* ------------------------------------------------------------- */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-screen sticky top-0">
        <div className="flex items-center space-x-2 px-5 py-5 border-b border-gray-100">
          <Link href="/" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </Link>
          <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
          <span className="text-base font-extrabold text-gray-900 tracking-tight">Facilite</span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          <Link href="/" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
            <span>🏠</span>
            <span>Accueil</span>
          </Link>
          <Link
            href="/creer-cv"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-bold text-orange-600 border border-orange-300 hover:bg-orange-50 transition"
          >
            <span>➕</span>
            <span>Créer</span>
          </Link>
          <Link href="/service" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
            <span>🔍</span>
            <span>Explorer / Offres</span>
          </Link>
          <Link href="/messagerie" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition relative">
            <span>💬</span>
            <span>Messagerie Échanges</span>
            <UnreadBadge count={unreadMessagesCount} />
          </Link>
          <Link href="/admin/messages" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition">
            <span>💬</span>
            <span>Messagerie Support Admin</span>
          </Link>
          <Link href="/admin/support" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
            <span>🎧</span>
            <span>Support</span>
          </Link>
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
            <span>💳</span>
            <span>Facturation & Transactions</span>
          </Link>
          <Link href="/admin/commandes-agent" className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
            <span>🧑‍💼</span>
            <span>Commandes Agent</span>
          </Link>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition cursor-pointer text-left"
          >
            <span>📊</span>
            <span>Statistiques</span>
          </button>

          <div className="pt-2">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-extrabold text-orange-700 bg-orange-50">
              <span>🛡️</span>
              <span>Admin</span>
            </div>
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2 px-2">
            <div className="w-9 h-9 rounded-full bg-orange-600 text-white font-extrabold flex items-center justify-center text-xs shadow-inner flex-shrink-0">
              {(userSession?.user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-gray-900 truncate">Administrateur</p>
              <p className="text-[10px] text-gray-500 truncate">{userSession?.user?.email}</p>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleLangChange("FR")}
              className={`flex-1 py-1 text-[10px] font-extrabold rounded-md transition ${selectedLang === "FR" ? "bg-white shadow-xs text-gray-900" : "text-gray-500"}`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => handleLangChange("GB")}
              className={`flex-1 py-1 text-[10px] font-extrabold rounded-md transition ${selectedLang === "GB" ? "bg-white shadow-xs text-gray-900" : "text-gray-500"}`}
            >
              EN
            </button>
          </div>

          <button
            onClick={handleGlobalSignOut}
            className="w-full text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* CONTENU PRINCIPAL */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 min-w-0">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* En-tête principal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                🛡️
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Administration</h1>
                <p className="text-sm text-gray-500 font-medium">Gérez votre plateforme Facilite</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span>Connecté en tant que {userSession?.user?.email}</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-700">
                Admin
              </span>
            </div>
          </div>

          {/* Onglets horizontaux */}
          <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              tab.href ? (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 text-gray-500 hover:text-gray-800"
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              ) : (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            ))}
          </div>

          {activeTab === "dashboard" && (
            <>
              {/* Barre de filtres */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPeriodMenuOpen((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 hover:border-gray-300 transition cursor-pointer shadow-xs"
                  >
                    <span>📅 {currentPeriodLabel}</span>
                    <i className="fa-solid fa-chevron-down text-[10px] text-gray-400"></i>
                  </button>
                  {periodMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[180px]">
                      {PERIODS.map((p) => (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => {
                            setPeriodDays(p.days);
                            setPeriodMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                            p.days === periodDays ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full p-1 shadow-xs">
                  {[
                    { id: "all", label: "Tous" },
                    { id: "none", label: "Sans accréditation" },
                    { id: "verified_recruiter", label: "Recruteurs vérifiés" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRoleFilter(f.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                        roleFilter === f.id ? "bg-orange-500 text-white shadow-xs" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cartes KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {/* Carte 1 : Utilisateurs */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateurs</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {kpi.onlineCount} en ligne
                        </span>
                      </div>
                      <span className="text-3xl font-extrabold text-gray-900 block">{kpi.totalUsers}</span>
                    </div>
                    <div className="w-11 h-11 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-lg flex-shrink-0">
                      <i className="fa-solid fa-users"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">+{kpi.usersThisPeriod} sur la période</p>
                  <p className={`text-xs font-bold mt-1 ${kpi.usersGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    📈 {kpi.usersGrowth >= 0 ? "+" : ""}{kpi.usersGrowth}% vs période précédente
                  </p>
                </div>

                {/* Carte 2 : Offres & Activité */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Offres & Activité</span>
                      <span className="text-3xl font-extrabold text-gray-900 block">{kpi.totalOffers}</span>
                    </div>
                    <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-lg flex-shrink-0">
                      <i className="fa-solid fa-briefcase"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    +{kpi.offersThisPeriod} offres · {kpi.totalApplications} candidatures envoyées
                  </p>
                  <p className={`text-xs font-bold mt-1 ${kpi.offersGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    📈 {kpi.offersGrowth >= 0 ? "+" : ""}{kpi.offersGrowth}% vs période précédente
                  </p>
                </div>

                {/* Carte 3 : Assistant IA & CV */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Assistant IA & CV</span>
                      <span className="text-3xl font-extrabold text-gray-900 block">{kpi.totalResumes}</span>
                    </div>
                    <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-lg flex-shrink-0">
                      <i className="fa-solid fa-robot"></i>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    +{kpi.resumesThisPeriod} documents générés · {kpi.conversionRate}% de conversion
                  </p>
                  <p className={`text-xs font-bold mt-1 ${kpi.resumesGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    📈 {kpi.resumesGrowth >= 0 ? "+" : ""}{kpi.resumesGrowth}% vs période précédente
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === "utilisateurs" && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Liste des Comptes</h2>
                  <p className="text-xs text-gray-500 font-medium">Attribuer ou modifier les privilèges d'accès</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={tableRoleFilter}
                    onChange={(e) => setTableRoleFilter(e.target.value)}
                    className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">Tous les rôles</option>
                    <option value="user">Utilisateurs</option>
                    <option value="publisher">Éditeurs</option>
                    <option value="admin">Administrateurs</option>
                  </select>
                  <div className="relative max-w-xs w-full">
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                    <input
                      type="text"
                      placeholder="Rechercher nom ou email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Utilisateur</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Rôle Actuel</th>
                      <th className="py-4 px-6">Badges</th>
                      <th className="py-4 px-6">Inscription</th>
                      <th className="py-4 px-6 text-right">Action (Rôle)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-gray-400 italic">
                          Aucun utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-orange-50/30 transition">
                          <td className="py-4 px-6 flex items-center space-x-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.full_name || "Avatar"}
                                className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-xs"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-900 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                                {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-gray-900 block">{user.full_name || "Sans nom"}</span>
                              <span className="text-[10px] text-gray-400 font-normal">ID: {user.id.slice(0, 8)}...</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600 font-mono text-[11px]">{user.email}</td>
                          <td className="py-4 px-6">
                            <RoleBadge role={user.role || "user"} />
                          </td>
                          <td className="py-4 px-6">
                            <BadgeDisplay badges={user.badges} />
                            {(!user.badges || user.badges.length === 0) && <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-4 px-6 text-gray-500 font-medium">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) : "Inconnue"}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <select
                              value={user.role || "user"}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-extrabold focus:outline-none focus:border-orange-500 cursor-pointer shadow-xs"
                            >
                              <option value="user">🟢 Utilisateur</option>
                              <option value="publisher">🎧 Éditeur</option>
                              <option value="admin">🛡️ Administrateur</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "badges" && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-extrabold text-gray-900">Demandes de badge ({badgeRequests.length})</h2>
                <p className="text-xs text-gray-500 font-medium">
                  Accréditation « Recruteur vérifié » — NINEA, RCCM et attestation vérifiés avant approbation.
                </p>
              </div>
              {badgeRequests.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">Aucune demande en attente.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {badgeRequests.map((request) => (
                    <div key={request.id} className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-extrabold text-gray-900">{request.company_name}</span>
                          <BadgeDisplay badges={[request.requested_badge]} />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          NINEA : <span className="font-mono">{request.ninea_number}</span> · RCCM :{" "}
                          <span className="font-mono">{request.rccm_number}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Demandée le {new Date(request.created_at).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                          {" · "}{request.document_urls?.length || 0} document(s) joint(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          placeholder="Motif de rejet (optionnel)"
                          value={rejectReasonDraft[request.id] || ""}
                          onChange={(e) => setRejectReasonDraft((prev) => ({ ...prev, [request.id]: e.target.value }))}
                          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 w-40"
                        />
                        <button
                          type="button"
                          onClick={() => handleRejectBadgeRequest(request.id, rejectReasonDraft[request.id])}
                          disabled={updatingUserId === request.id}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          Rejeter
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveBadgeRequest(request.id)}
                          disabled={updatingUserId === request.id}
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
          )}

          {activeTab === "offres" && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-extrabold text-gray-900">Offres d'emploi ({offers.length})</h2>
                <p className="text-xs text-gray-500 font-medium">Vue d'ensemble de toutes les offres publiées sur la plateforme</p>
              </div>
              <div className="p-6 text-xs text-gray-500 font-medium">
                {offers.length === 0
                  ? "Aucune offre publiée pour le moment."
                  : `${offers.length} offre(s) au total, dont ${kpi.offersThisPeriod} sur les ${periodDays} derniers jours. La gestion détaillée (création, modification) se fait depuis l'Espace Recruteur.`}
              </div>
            </div>
          )}

          {activeTab === "ia" && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">Assistant IA & CV</h2>
              <p className="text-xs text-gray-500 font-medium mb-6">
                Métriques agrégées uniquement — le contenu des conversations avec l'assistant IA reste privé et n'est jamais accessible depuis ce panneau.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">CV générés (total)</span>
                  <span className="text-2xl font-extrabold text-gray-900">{kpi.totalResumes}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Sur la période</span>
                  <span className="text-2xl font-extrabold text-gray-900">{kpi.resumesThisPeriod}</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Taux de conversion candidats</span>
                  <span className="text-2xl font-extrabold text-gray-900">{kpi.conversionRate}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tarification" && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-10 text-center">
              <span className="text-3xl block mb-3">💳</span>
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">Tarification & Abonnements</h2>
              <p className="text-xs text-gray-500 font-medium max-w-md mx-auto">
                Aucun système de facturation n'est encore branché sur la plateforme. Cet onglet accueillera la gestion des abonnements lorsque cette fonctionnalité sera développée.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
