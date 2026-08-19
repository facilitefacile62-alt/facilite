/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import BadgeDisplay from "@/components/BadgeDisplay";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import SecurityAlertsWidget, { securityEventStyle } from "@/components/SecurityAlertsWidget";
import { getFeatureFlagsTreeAsync, persistFeatureFlagsOverrides, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";
import {
  requestDocumentAccess,
  fetchAccessibleDocument,
  STATUS_LABELS,
  STATUS_COLORS,
  PROFILE_COMPLETENESS_FIELDS,
} from "@/lib/documentAccess";
import AvatarImage from "@/components/AvatarImage";
import AdminAIStudio from "@/components/AdminAIStudio";
import AdminSecurityLab from "@/components/AdminSecurityLab";

// "Utilisateurs", "Tarification" et "Messagerie Support" ont migré dans
// NAV_SECTIONS (sidebar catégorisée) — les garder ici aurait recréé le
// doublon d'accès trouvé en B0 (deux chemins vers /admin/messages).
const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "securite", label: "Sécurité & Failles", icon: "🛡️" },
  { id: "fonctionnalites", label: "Fonctionnalités", icon: "✨" },
  { id: "ia_studio", label: "Entraînement IA", icon: "🧠" },
  { id: "badges", label: "Demandes de badge", icon: "🎖️" },
  { id: "offres", label: "Offres d'emploi", icon: "💼" },
  { id: "ia", label: "Assistant IA & CV", icon: "🤖" },
];

// Rang de gravité pour le tri "gravité puis date" de l'onglet Sécurité —
// mêmes 3 couleurs que securityEventStyle (SecurityAlertsWidget.jsx),
// dérivées de event_type plutôt que de la colonne severity brute pour
// rester cohérent avec la demande explicite (rouge access_denied, orange
// quota).
const SECURITY_EVENT_SEVERITY_RANK = { access_denied: 2, repeated_access_denial: 2, cv_quota_exceeded: 1 };
function securityEventSeverityRank(eventType) {
  return SECURITY_EVENT_SEVERITY_RANK[eventType] ?? 0;
}

// Sidebar catégorisée (B1) : chaque entrée est soit un vrai lien (type
// "link", navigue vers une autre page — actif si l'URL courante correspond),
// soit un onglet interne à cette page (type "tab", actif si activeTab
// correspond — bascule juste le contenu affiché plus bas sans navigation).
const NAV_SECTIONS = [
  {
    label: "Contenu",
    items: [
      { type: "link", href: "/admin/offres", icon: "⚡", label: "Publieur d'Offres IA & Affiches", accent: true },
      { type: "link", href: "/creer-cv", icon: "➕", label: "Créer un CV" },
    ],
  },
  {
    label: "Communication",
    items: [
      { type: "link", href: "/messagerie", icon: "💬", label: "Messagerie Échanges", unread: true },
      { type: "link", href: "/admin/messages", icon: "💬", label: "Messagerie Support Admin" },
      { type: "link", href: "/admin/support", icon: "🎧", label: "Support" },
    ],
  },
  {
    label: "Gestion",
    items: [
      { type: "tab", id: "fonctionnalites", icon: "✨", label: "Fonctionnalités" },
      { type: "tab", id: "ia_studio", icon: "🧠", label: "Entraînement IA", badge: "Studio" },
      { type: "tab", id: "securite", icon: "🛡️", label: "Sécurité & Failles", badge: "Live" },
      { type: "tab", id: "utilisateurs", icon: "👥", label: "Utilisateurs" },
      { type: "tab", id: "tarification", icon: "💳", label: "Tarification" },
      { type: "link", href: "/admin/dashboard", icon: "💰", label: "Facturation & Transactions" },
      { type: "link", href: "/admin/commandes-agent", icon: "🧑‍💼", label: "Commandes Agent" },
    ],
  },
  {
    label: "Administration & Sécurité",
    items: [
      { type: "tab", id: "securite", icon: "🛡️", label: "Lab Sécurité & Failles", badge: "Audit" },
      { type: "tab", id: "badges", icon: "🎖️", label: "Demandes de badge" },
    ],
  },
  {
    label: "Données & Statistiques",
    items: [
      { type: "link", href: "/admin/scraping", icon: "🤖", label: "Agrégation & Scraping" },
      { type: "tab", id: "dashboard", icon: "📊", label: "Statistiques" },
    ],
  },
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

// Ancienneté lisible pour la file de modération — c'est ce qui indique à
// l'admin qu'une offre attend depuis trop longtemps, pas juste sa date brute.
function formatAge(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

// Interrupteur compact réutilisé pour "Recruteur vérifié" et "Compte de
// test" dans la liste des comptes (partie C) — un bouton natif plutôt
// qu'un <input type="checkbox"> stylé, pour garder le même pattern
// cursor-pointer/disabled que le reste de cette page.
function ToggleSwitch({ checked, onChange, disabled, title, activeColorClass }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? activeColorClass : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function growthPercent(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [selectedLang, setSelectedLang] = useState("FR");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Hydratation et synchronisation de l'onglet actif (URL + localStorage)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      if (urlTab) {
        setActiveTab(urlTab);
        return;
      }
      const savedTab = localStorage.getItem("FACILITE_ADMIN_ACTIVE_TAB");
      if (savedTab) {
        setActiveTab(savedTab);
      }
    } catch {}
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem("FACILITE_ADMIN_ACTIVE_TAB", tabId);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const [periodDays, setPeriodDays] = useState(7);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [mobilePlusMenuOpen, setMobilePlusMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | 'none' | 'verified_recruiter' (filtre par badge, plus par rôle depuis le chantier RBAC — candidat/recruteur ont fusionné en 'user')

  const [users, setUsers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [offers, setOffers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [badgeRequests, setBadgeRequests] = useState([]);

  // --- Fiche détaillée candidat (palier 1 sans consentement + palier 2 avec) ---
  const [ordersByUser, setOrdersByUser] = useState(new Map());
  const [completenessByUser, setCompletenessByUser] = useState(new Map());
  const [selectedUser, setSelectedUser] = useState(null);
  const [userAccessRequests, setUserAccessRequests] = useState([]);
  const [userResumesList, setUserResumesList] = useState([]);
  const [accessReasonDraft, setAccessReasonDraft] = useState("");
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [viewingDocumentKey, setViewingDocumentKey] = useState(null);

  const [rejectReasonDraft, setRejectReasonDraft] = useState({});
  const [pendingOffers, setPendingOffers] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [moderatingId, setModeratingId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [tableRoleFilter, setTableRoleFilter] = useState("all");
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // --- Onglet Sécurité (partie D) ---
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityFilterType, setSecurityFilterType] = useState("all");
  const [securityFilterSeverity, setSecurityFilterSeverity] = useState("all");
  const [invariantStatuses, setInvariantStatuses] = useState([]);
  const [resolvingAlertId, setResolvingAlertId] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-check" });
  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  };

  // --- Arbre des fonctionnalités & Contrôle d'accès ---
  const [featureTree, setFeatureTree] = useState(DEFAULT_FEATURE_TREE);
  const [featureSearch, setFeatureSearch] = useState("");
  const [expandedBranches, setExpandedBranches] = useState({
    branch_nav: true,
    branch_candidat: true,
    branch_recruteur: true,
    branch_services: true,
  });

  useEffect(() => {
    getFeatureFlagsTreeAsync().then(setFeatureTree).catch(() => {});
  }, []);

  const toggleBranch = (branchId) => {
    setExpandedBranches((prev) => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  // Chaque handler garde le même calcul pur qu'avant (état optimiste
  // immédiat, pas de changement d'UX), puis persiste sur Supabase — source
  // commune à tous les visiteurs, plus du localStorage par navigateur. En
  // cas d'échec (ex: RLS refuse — pas admin), on revient à l'état précédent
  // et on prévient par toast, même patron que handleRoleChange plus bas.
  const handleToggleFeatureMaster = async (branchId, featId) => {
    const previous = featureTree;
    const updated = featureTree.map((b) => {
      if (b.id !== branchId) return b;
      return {
        ...b,
        children: b.children.map((f) => {
          if (f.id !== featId) return f;
          return { ...f, enabled: !f.enabled };
        }),
      };
    });
    setFeatureTree(updated);
    const targetFeat = updated.find((b) => b.id === branchId)?.children.find((f) => f.id === featId);
    const { error } = await persistFeatureFlagsOverrides([{ id: featId, enabled: targetFeat.enabled, roles: targetFeat.roles }]);
    if (error) {
      setFeatureTree(previous);
      triggerToast("Échec de la mise à jour : " + error.message, "fa-triangle-exclamation");
      return;
    }
    triggerToast(
      targetFeat?.enabled ? `Module "${targetFeat.name}" activé.` : `Module "${targetFeat.name}" désactivé.`,
      targetFeat?.enabled ? "fa-circle-check" : "fa-circle-xmark"
    );
  };

  const handleToggleFeatureRole = async (branchId, featId, roleKey) => {
    const previous = featureTree;
    const updated = featureTree.map((b) => {
      if (b.id !== branchId) return b;
      return {
        ...b,
        children: b.children.map((f) => {
          if (f.id !== featId) return f;
          const currentVal = f.roles?.[roleKey] ?? true;
          return {
            ...f,
            roles: { ...f.roles, [roleKey]: !currentVal },
          };
        }),
      };
    });
    setFeatureTree(updated);
    const targetFeat = updated.find((b) => b.id === branchId)?.children.find((f) => f.id === featId);
    const { error } = await persistFeatureFlagsOverrides([{ id: featId, enabled: targetFeat.enabled, roles: targetFeat.roles }]);
    if (error) {
      setFeatureTree(previous);
      triggerToast("Échec de la mise à jour : " + error.message, "fa-triangle-exclamation");
      return;
    }
    triggerToast("Permissions du rôle mises à jour.", "fa-circle-check");
  };

  const handleToggleBranchAll = async (branchId, enableVal) => {
    const previous = featureTree;
    const updated = featureTree.map((b) => {
      if (b.id !== branchId) return b;
      return {
        ...b,
        children: b.children.map((f) => ({ ...f, enabled: enableVal })),
      };
    });
    setFeatureTree(updated);
    const changedRows = (updated.find((b) => b.id === branchId)?.children || []).map((f) => ({ id: f.id, enabled: f.enabled, roles: f.roles }));
    const { error } = await persistFeatureFlagsOverrides(changedRows);
    if (error) {
      setFeatureTree(previous);
      triggerToast("Échec de la mise à jour : " + error.message, "fa-triangle-exclamation");
      return;
    }
    triggerToast(enableVal ? "Branche activée." : "Branche désactivée.", "fa-circle-check");
  };

  const handleToggleAllGlobal = async (enableVal) => {
    const previous = featureTree;
    const updated = featureTree.map((b) => ({
      ...b,
      children: b.children.map((f) => ({ ...f, enabled: enableVal })),
    }));
    setFeatureTree(updated);
    const changedRows = updated.flatMap((b) => b.children.map((f) => ({ id: f.id, enabled: f.enabled, roles: f.roles })));
    const { error } = await persistFeatureFlagsOverrides(changedRows);
    if (error) {
      setFeatureTree(previous);
      triggerToast("Échec de la mise à jour : " + error.message, "fa-triangle-exclamation");
      return;
    }
    triggerToast(enableVal ? "Toutes les fonctionnalités activées." : "Toutes les fonctionnalités désactivées.", "fa-circle-check");
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
    let active = true;
    
    // Sécurité de délai (Timeout de secours de 4 secondes)
    const timeoutId = setTimeout(() => {
      if (active) {
        console.warn("[Admin Access] Sécurité timeout de 4s déclenchée.");
        setLoading(false);
      }
    }, 4000);

    async function verifyAdminAccessAndLoad() {
      try {
        // Invalidation/Refresh forcé du cache session
        await supabase.auth.refreshSession().catch(() => {});
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (active) {
            router.push("/login");
          }
          return;
        }

        if (active) {
          setUserSession(session);
        }

        // Appel direct à la fonction RPC is_admin
        const { data: isAdmin, error: rpcError } = await supabase
          .rpc("is_admin", { check_user_id: session.user.id });

        if (rpcError || isAdmin !== true) {
          console.warn("[Admin Access] Refus d'accès: non admin ou erreur RPC.", rpcError);
          if (active) {
            router.push("/profil");
          }
          return;
        }

        if (active) {
          setMyRole("admin");
        }

        const [profilesRes, rolesRes, offersRes, applicationsRes, resumesRes, badgeRequestsRes, pendingOffersRes, pendingReportsRes, phoneStatusRes, ordersRes] = await Promise.all([
          // Colonnes explicites plutôt que "*" : exclut délibérément le
          // contenu que le candidat a rédigé sur lui-même (bio, expériences,
          // formations, compétences, langues, CV importé...) — le palier 1
          // (sans consentement) ne montre qu'identité/statut/réglages,
          // jamais ce contenu. Le CV lui-même reste en plus protégé par la
          // RLS (voir 20260818030000_resumes_consent_gate.sql).
          supabase
            .from("profiles")
            .select(
              "id, email, full_name, avatar_url, cover_url, created_at, updated_at, location, city, country, phone, website_url, gender, slug, contact_email, is_public, show_contact, education_level, recruiter_verified, badges, is_test_account, cv_visible_recruteurs, date_naissance, deleted_at, profile_views, post_impressions"
            )
            .order("created_at", { ascending: false }),
          supabase.from("user_roles").select("*"),
          supabase.from("job_offers").select("id, created_at").order("created_at", { ascending: false }),
          supabase.from("candidatures").select("id, created_at").order("created_at", { ascending: false }),
          supabase.from("resumes").select("id, user_id, created_at, type").order("created_at", { ascending: false }),
          supabase
            .from("badge_requests")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: true }),
          supabase
            .from("job_offers")
            .select("id, title, company, recruiter_id, created_at, status_updated_at")
            .eq("status", "pending_review")
            .order("status_updated_at", { ascending: true }),
          supabase
            .from("reports")
            .select("id, reporter_id, target_type, target_id, reason, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: true }),
          // Numéros déjà masqués côté SQL (mask_phone_number) — le numéro
          // complet ne transite jamais jusqu'ici, voir 20260808020000.
          supabase.rpc("get_users_phone_status"),
          // Historique de commandes (statuts uniquement, jamais invoice_url)
          // pour la fiche candidat palier 1.
          supabase
            .from("orders")
            .select("id, user_id, cv_model_id, has_agent_option, amount, currency, payment_status, created_at"),
        ]);

        if (active) {
          if (pendingOffersRes.error) console.error("Erreur chargement file de modération:", pendingOffersRes.error);
          else setPendingOffers(pendingOffersRes.data || []);

          if (pendingReportsRes.error) console.error("Erreur chargement signalements:", pendingReportsRes.error);
          else setPendingReports(pendingReportsRes.data || []);

          if (profilesRes.error || rolesRes.error) {
            console.error("Erreur chargement profils/rôles:", profilesRes.error || rolesRes.error);
          } else {
            if (phoneStatusRes.error) console.error("Erreur chargement statut téléphone:", phoneStatusRes.error);
            const phoneByUserId = new Map((phoneStatusRes.data || []).map((r) => [r.user_id, r.phone_masked]));
            const roleByUserId = new Map((rolesRes.data || []).map((r) => [r.user_id, r]));
            const merged = (profilesRes.data || []).map((p) => ({
              ...p,
              role: roleByUserId.get(p.id)?.role || "user",
              status: roleByUserId.get(p.id)?.status || "active",
              phone_masked: phoneByUserId.get(p.id) || null,
            }));
            setUsers(merged);

            // Complétude de profil : calculée en SQL (get_profiles_completeness),
            // jamais depuis le contenu brut — ce composant ne l'a plus
            // (voir la liste de colonnes explicite ci-dessus).
            const userIds = merged.map((u) => u.id);
            if (userIds.length > 0) {
              const { data: completenessRows, error: completenessError } = await supabase.rpc(
                "get_profiles_completeness",
                { p_user_ids: userIds }
              );
              if (completenessError) {
                console.error("Erreur chargement complétude des profils:", completenessError);
              } else if (active) {
                setCompletenessByUser(new Map((completenessRows || []).map((r) => [r.user_id, r])));
              }
            }
          }

          if (offersRes.error) console.error("Erreur chargement offres:", offersRes.error);
          else setOffers(offersRes.data || []);

          if (applicationsRes.error) console.error("Erreur chargement candidatures:", applicationsRes.error);
          else setApplications(applicationsRes.data || []);

          if (resumesRes.error) console.error("Erreur chargement CV:", resumesRes.error);
          else setResumes(resumesRes.data || []);

          if (badgeRequestsRes.error) console.error("Erreur chargement demandes de badge:", badgeRequestsRes.error);
          else setBadgeRequests(badgeRequestsRes.data || []);

          if (ordersRes.error) {
            console.error("Erreur chargement commandes:", ordersRes.error);
          } else {
            const grouped = new Map();
            for (const order of ordersRes.data || []) {
              const list = grouped.get(order.user_id) || [];
              list.push(order);
              grouped.set(order.user_id, list);
            }
            setOrdersByUser(grouped);
          }
        }

      } catch (err) {
        console.error("Exception vérification/chargement admin:", err);
      } finally {
        clearTimeout(timeoutId);
        if (active) {
          setLoading(false);
        }
      }
    }

    verifyAdminAccessAndLoad();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [router]);

  const handleRoleChange = async (userId, newRole) => {
    const previousUsers = users;
    setUpdatingUserId(userId);
    // Mise à jour optimiste : bascule immédiate de l'UI, restaurée en cas d'échec.
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

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

  const handleSuspendToggle = async (targetUser) => {
    const nextStatus = targetUser.status === "suspended" ? "active" : "suspended";
    const previousUsers = users;
    setUpdatingUserId(targetUser.id);
    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u)));

    const res = await fetch(`/api/admin/users/${targetUser.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userSession.access_token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = await res.json().catch(() => ({}));
    setUpdatingUserId(null);

    if (!res.ok) {
      setUsers(previousUsers);
      triggerToast("Impossible de mettre à jour le statut : " + (body.error || "erreur inconnue"), "fa-triangle-exclamation");
      return;
    }

    triggerToast(
      nextStatus === "suspended"
        ? `${targetUser.full_name || targetUser.email} suspendu. Réversible à tout moment.`
        : `${targetUser.full_name || targetUser.email} réactivé.`,
      nextStatus === "suspended" ? "fa-user-slash" : "fa-user-check"
    );
  };

  // Dissocie le numéro de téléphone (connexion SMS) d'un compte. Le numéro
  // complet n'est jamais connu du client — seule sa version déjà masquée
  // (phone_masked) sert au message de confirmation, ce qui suffit à
  // identifier le bon compte sans jamais l'exposer en clair dans l'UI.
  const handleDisassociatePhone = async (targetUser) => {
    const confirmed = window.confirm(`Dissocier le numéro ${targetUser.phone_masked} de ce compte ?`);
    if (!confirmed) return;

    setUpdatingUserId(targetUser.id);
    const res = await fetch(`/api/admin/users/${targetUser.id}/phone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userSession.access_token}` },
    });
    const body = await res.json().catch(() => ({}));
    setUpdatingUserId(null);

    if (!res.ok) {
      triggerToast("Impossible de dissocier ce numéro : " + (body.error || "erreur inconnue"), "fa-triangle-exclamation");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, phone_masked: null } : u)));
    triggerToast("Numéro de téléphone dissocié.", "fa-phone-slash");
  };

  const handleRevokeBadge = async (targetUser, badgeName) => {
    setUpdatingUserId(targetUser.id);
    const { error } = await supabase.rpc("revoke_badge", {
      target_user_id: targetUser.id,
      badge_name: badgeName,
      reason: "Retiré depuis le panneau admin",
    });
    setUpdatingUserId(null);

    if (error) {
      triggerToast("Impossible de retirer ce badge : " + error.message, "fa-triangle-exclamation");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, badges: (u.badges || []).filter((b) => b !== badgeName) } : u))
    );
    triggerToast("Badge retiré.", "fa-circle-check");
  };

  // Interrupteur "Recruteur vérifié" (partie C) : bascule via les deux RPC
  // dédiées (grant_verified_recruiter_badge / revoke_badge existant), jamais
  // un UPDATE direct sur profiles.badges depuis le client. Confirmation
  // obligatoire à l'activation si la cible n'est pas déjà marquée compte de
  // test — vérifiée côté client sur l'état chargé, la RPC elle-même n'a pas
  // à connaître cette règle de confirmation (garde-fou UX, pas de sécurité).
  const handleToggleVerifiedBadge = async (targetUser) => {
    const hasBadge = (targetUser.badges || []).includes("verified_recruiter");

    if (!hasBadge && !targetUser.is_test_account) {
      const confirmed = window.confirm(
        `Ce compte accédera au fil de CV des candidats réels. Confirmer l'attribution du badge "Recruteur vérifié" à ${targetUser.full_name || targetUser.email} ?`
      );
      if (!confirmed) return;
    }

    setUpdatingUserId(targetUser.id);
    const { error } = hasBadge
      ? await supabase.rpc("revoke_badge", {
          target_user_id: targetUser.id,
          badge_name: "verified_recruiter",
          reason: "Retiré depuis l'interrupteur de la liste des comptes",
        })
      : await supabase.rpc("grant_verified_recruiter_badge", {
          target_user_id: targetUser.id,
          reason: "Attribué depuis l'interrupteur de la liste des comptes",
        });
    setUpdatingUserId(null);

    if (error) {
      triggerToast("Impossible de modifier ce badge : " + error.message, "fa-triangle-exclamation");
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUser.id
          ? {
              ...u,
              badges: hasBadge
                ? (u.badges || []).filter((b) => b !== "verified_recruiter")
                : [...(u.badges || []), "verified_recruiter"],
            }
          : u
      )
    );
    triggerToast(hasBadge ? "Badge retiré." : "Badge « Recruteur vérifié » attribué.", "fa-circle-check");
  };

  const handleToggleTestAccount = async (targetUser) => {
    const nextValue = !targetUser.is_test_account;
    setUpdatingUserId(targetUser.id);
    const { error } = await supabase.rpc("set_test_account_flag", {
      target_user_id: targetUser.id,
      is_test: nextValue,
      reason: "Basculé depuis l'interrupteur de la liste des comptes",
    });
    setUpdatingUserId(null);

    if (error) {
      triggerToast("Impossible de modifier ce statut : " + error.message, "fa-triangle-exclamation");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_test_account: nextValue } : u)));
    triggerToast(nextValue ? "Marqué comme compte de test." : "Retiré des comptes de test.", "fa-circle-check");
  };

  const handleModerateOffer = async (offerId, decision) => {
    setModeratingId(offerId);
    const { data: ok, error } = await supabase.rpc("moderate_job_offer", { offer_id: offerId, decision });
    setModeratingId(null);

    if (error || !ok) {
      triggerToast("Impossible de traiter cette offre : " + (error?.message || "déjà traitée"), "fa-triangle-exclamation");
      return;
    }

    setPendingOffers((prev) => prev.filter((o) => o.id !== offerId));
    triggerToast(decision === "approved" ? "Offre approuvée, visible publiquement." : "Offre rejetée.", "fa-circle-check");
  };

  const handleResolveReport = async (reportId) => {
    setModeratingId(reportId);
    const { error } = await supabase
      .from("reports")
      .update({ status: "resolved", resolved_by: userSession.user.id, resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    setModeratingId(null);

    if (error) {
      triggerToast("Impossible de résoudre ce signalement : " + error.message, "fa-triangle-exclamation");
      return;
    }

    setPendingReports((prev) => prev.filter((r) => r.id !== reportId));
    triggerToast("Signalement marqué comme résolu.", "fa-circle-check");
  };

  // --- Onglet Sécurité (partie D) ---
  const loadSecurityData = async () => {
    setSecurityLoading(true);
    const [alertsRes, invariantsRes] = await Promise.all([
      supabase.rpc("get_security_alert_history", {
        p_days: 30,
        p_event_type: securityFilterType === "all" ? null : securityFilterType,
        p_severity: securityFilterSeverity === "all" ? null : securityFilterSeverity,
      }),
      supabase.from("invariant_status").select("*").order("invariant_key"),
    ]);
    setSecurityLoading(false);

    if (alertsRes.error) {
      console.error("Erreur chargement alertes sécurité:", alertsRes.error);
    } else {
      setSecurityAlerts(alertsRes.data || []);
    }
    if (invariantsRes.error) {
      console.error("Erreur chargement statut des invariants:", invariantsRes.error);
    } else {
      setInvariantStatuses(invariantsRes.data || []);
    }
  };

  useEffect(() => {
    if (activeTab !== "securite" || !myRole) return;
    loadSecurityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, myRole, securityFilterType, securityFilterSeverity]);

  // Journalise chaque consultation du panneau Sécurité (quel admin, quelle
  // section, quand) — via une route API dédiée : log_security_event() est
  // restreinte à service_role depuis le 2026-08-08, un client ne peut plus
  // l'appeler directement. Dépendances volontairement limitées à
  // [activeTab, myRole] (pas les filtres) : une seule entrée par ouverture
  // d'onglet, pas une par changement de filtre.
  useEffect(() => {
    if (activeTab !== "securite" || !myRole || !userSession?.access_token) return;
    fetch("/api/admin/security-panel-viewed", {
      method: "POST",
      headers: { Authorization: `Bearer ${userSession.access_token}` },
    }).catch((err) => console.warn("[Sécurité] Journalisation de la consultation échouée (non bloquant):", err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, myRole]);

  // Temps réel : un canal par utilisateur connecté, jamais partagé. RLS
  // ("Seuls les admins lisent les logs", is_admin(auth.uid())) s'applique
  // à l'abonnement postgres_changes lui-même — un publisher/candidat abonné
  // au même canal ne recevrait rien, vérifié dans
  // tests/e2e/security-tab-realtime-and-access.spec.js. On se contente de
  // recharger la liste au lieu de fusionner l'événement brut à la main :
  // le payload Realtime ne porte pas actor_email (jointure faite dans la
  // RPC), une fusion partielle afficherait "compte non identifié" à tort.
  useEffect(() => {
    if (activeTab !== "securite" || !myRole) return;
    const channel = supabase
      .channel("admin-security-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, () => {
        loadSecurityData();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, myRole]);

  // --- Touche Console DevTools (F12) & Raccourci Clavier (Alt+S) ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (e) => {
      if ((e.altKey && e.key.toLowerCase() === "s") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        handleTabChange("securite");
        triggerToast("Lab Sécurité & Failles activé !", "fa-shield-check");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Fonction d'audit appelable directement dans la console DevTools (F12)
    window.scanFailles = window.auditSecurite = window.scanSecurite = async () => {
      console.log("%c🛡️ [Facilité Security Lab] Lancement du diagnostic de sécurité...", "color: #f97316; font-weight: bold; font-size: 14px;");
      if (!userSession?.access_token) {
        console.warn("Session admin requise.");
        return;
      }
      try {
        const res = await fetch("/api/admin/security-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${userSession.access_token}` },
        });
        const data = await res.json();
        console.log(`%cScore Global de Sécurité : ${data.score}/100 (${data.scoreRating})`, "color: #10b981; font-weight: bold; font-size: 16px;");
        console.log("%c1. Protection RLS des Tables :", "font-weight: bold; color: #3b82f6;");
        console.table(data.categories.tables);
        console.log("%c2. Étanchéité des Buckets :", "font-weight: bold; color: #8b5cf6;");
        console.table(data.categories.storage);
        console.log("%c3. 13 Invariants de Sécurité :", "font-weight: bold; color: #ec4899;");
        console.table(data.categories.invariants);
        console.log("%c4. Secrets & Environnement :", "font-weight: bold; color: #f59e0b;");
        console.table(data.categories.environment);
        return data;
      } catch (err) {
        console.error("Erreur scan sécurité:", err);
      }
    };

    console.log("%c🛡️ [Facilité Security Lab] Console Active. Tapez scanFailles() ou auditSecurite() pour inspecter toutes les failles en direct !", "color: #10b981; font-weight: bold; font-size: 12px; background: #064e3b; padding: 4px 8px; border-radius: 4px;");

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      delete window.scanFailles;
      delete window.auditSecurite;
      delete window.scanSecurite;
    };
  }, [userSession]);

  const handleResolveAlert = async (alertId, action) => {
    setResolvingAlertId(alertId);
    const { data: ok, error } = await supabase.rpc("resolve_security_alert", { p_log_id: alertId, p_action: action });
    setResolvingAlertId(null);

    if (error || !ok) {
      triggerToast("Impossible de mettre à jour cette alerte : " + (error?.message || "introuvable"), "fa-triangle-exclamation");
      return;
    }

    setSecurityAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, resolved_status: action, resolved_at: new Date().toISOString(), resolved_by_email: userSession?.user?.email }
          : a
      )
    );
    triggerToast(action === "resolved" ? "Alerte marquée comme résolue." : "Alerte ignorée.", "fa-circle-check");
  };

  const handleSuspendFromAlert = async (alert) => {
    if (!alert.actor_id) return;
    setResolvingAlertId(alert.id);
    const res = await fetch(`/api/admin/users/${alert.actor_id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userSession.access_token}` },
      body: JSON.stringify({ status: "suspended" }),
    });
    const body = await res.json().catch(() => ({}));
    setResolvingAlertId(null);

    if (!res.ok) {
      triggerToast("Impossible de suspendre ce compte : " + (body.error || "erreur inconnue"), "fa-triangle-exclamation");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === alert.actor_id ? { ...u, status: "suspended" } : u)));
    triggerToast(`${alert.actor_email || "Compte"} suspendu depuis l'alerte.`, "fa-user-slash");
  };

  const openSecurityAlerts = securityAlerts
    .filter((a) => a.resolved_status === "open")
    .sort((a, b) => securityEventSeverityRank(b.event_type) - securityEventSeverityRank(a.event_type) || new Date(b.created_at) - new Date(a.created_at));

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

  // --- Fiche détaillée candidat : palier 1 (déjà chargé en bloc) + palier 2
  // (demandes d'accès aux documents, chargées à la demande à l'ouverture). ---
  const openUserDetail = async (user) => {
    setSelectedUser(user);
    setUserAccessRequests([]);
    setUserResumesList([]);
    setAccessReasonDraft("");

    const { data, error } = await supabase
      .from("document_access_requests")
      .select("id, admin_id, candidate_id, reason, status, expires_at, created_at")
      .eq("candidate_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement des demandes d'accès:", error);
      return;
    }
    setUserAccessRequests(data || []);

    const hasActiveAccess = (data || []).some(
      (r) => r.admin_id === userSession?.user?.id && r.status === "approved" && new Date(r.expires_at) > new Date()
    );
    if (hasActiveAccess) {
      const { data: resumesData, error: resumesError } = await supabase
        .from("resumes")
        .select("id, title, type, created_at")
        .eq("user_id", user.id);
      if (resumesError) console.error("Erreur chargement des CV du candidat:", resumesError);
      else setUserResumesList(resumesData || []);
    }
  };

  const handleRequestDocumentAccess = async (candidateId) => {
    if (!accessReasonDraft.trim()) {
      triggerToast("Un motif est requis pour la demande.", "fa-triangle-exclamation");
      return;
    }
    setRequestingAccess(true);
    const { requestId, error } = await requestDocumentAccess(candidateId, accessReasonDraft.trim());
    setRequestingAccess(false);

    if (error || !requestId) {
      triggerToast("Impossible de créer la demande : " + (error?.message || "une demande est peut-être déjà en attente"), "fa-triangle-exclamation");
      return;
    }

    triggerToast("Demande envoyée au candidat.", "fa-circle-check");
    setAccessReasonDraft("");
    if (selectedUser?.id === candidateId) {
      await openUserDetail(selectedUser);
    }
  };

  const handleViewDocument = async (candidateId, documentType, resumeId) => {
    const key = `${documentType}:${resumeId || "profile"}`;
    setViewingDocumentKey(key);
    const { data, error } = await fetchAccessibleDocument({ candidateId, documentType, resumeId });
    setViewingDocumentKey(null);

    if (error || !data?.document) {
      triggerToast("Accès refusé ou document introuvable : " + (error || "erreur inconnue"), "fa-triangle-exclamation");
      return;
    }

    const doc = data.document;
    const rawPath = doc.file_url || doc.cv_url;
    if (rawPath) {
      const signedUrl = await getSignedCvUrl(rawPath);
      if (signedUrl) window.open(signedUrl, "_blank", "noopener,noreferrer");
      else triggerToast("Impossible de générer le lien du document.", "fa-triangle-exclamation");
    } else if (doc.content) {
      triggerToast(`CV "${doc.title}" consulté (contenu du builder) — vue détaillée à venir.`, "fa-circle-info");
    } else {
      triggerToast("Aucun document disponible pour ce candidat.", "fa-triangle-exclamation");
    }
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

  const isConnectedAccountTest = users.find((u) => u.id === userSession?.user?.id)?.is_test_account === true;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = tableRoleFilter === "all" || (u.role || "user") === tableRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Rendu partagé desktop (sidebar fixe) / mobile (tiroir hamburger) — un
  // seul endroit à faire évoluer pour les deux, plutôt que deux JSX qui
  // dérivent (voir le doublon Messagerie Support trouvé en B0).
  const renderNavItem = (item, onNavigate) => {
    if (item.type === "static") {
      return (
        <div
          key={item.label}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-extrabold text-orange-700 bg-orange-50"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      );
    }

    if (item.accent) {
      return (
        <Link
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-bold text-orange-600 border border-orange-300 hover:bg-orange-50 transition"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      );
    }

    const isActive = item.type === "link" ? pathname === item.href : activeTab === item.id;
    const baseClass = `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition relative ${
      isActive ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;

    if (item.type === "link") {
      return (
        <Link
          key={item.label}
          href={item.href}
          onClick={(e) => {
            onNavigate?.();
            if (pathname === item.href) {
              e.preventDefault();
              window.location.href = item.href;
            }
          }}
          className={baseClass}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
          {item.unread && <UnreadBadge count={unreadMessagesCount} />}
        </Link>
      );
    }

    return (
      <button
        key={item.label}
        type="button"
        onClick={() => {
          handleTabChange(item.id);
          onNavigate?.();
        }}
        className={`${baseClass} w-full text-left cursor-pointer flex items-center justify-between`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge && (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const renderNavSections = (onNavigate) => (
    <>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="pt-3 first:pt-0">
          <div className="px-3.5 pb-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
            {section.label}
          </div>
          <div className="space-y-1">{section.items.map((item) => renderNavItem(item, onNavigate))}</div>
        </div>
      ))}
    </>
  );

  const renderAccountFooter = () => (
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
  );

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
    <div className={`font-sans flex ${activeTab === "ia_studio" ? "h-screen overflow-hidden bg-[#FAF6F1]" : "min-h-screen bg-[#F7F7F8]"}`}>
      {/* Toast Notification Flottant */}
      {toast.show && (
        <div className="fixed top-5 right-5 z-[1000] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 animate-fade-in-down">
          <i className={`fa-solid ${toast.icon} text-orange-400 text-base`}></i>
          <span className="text-xs font-extrabold">{toast.message}</span>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR LATÉRALE (desktop) */}
      {/* ------------------------------------------------------------- */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-screen sticky top-0">
        <div className="flex items-center space-x-2 px-5 py-5 border-b border-gray-100">
          <Link href="/" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition" title="Retour à l'accueil">
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </Link>
          <Link href="/" className="flex items-center space-x-2 group cursor-pointer" title="Aller à l'accueil Facilite">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:opacity-80 transition" />
            <span className="text-base font-extrabold text-gray-900 tracking-tight group-hover:text-orange-600 transition">Facilite</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">{renderNavSections()}</nav>

        {renderAccountFooter()}
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* NAVIGATION MOBILE : déclencheur hamburger + tiroir plein écran */}
      {/* ------------------------------------------------------------- */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-700 cursor-pointer"
      >
        <i className="fa-solid fa-bars"></i>
      </button>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
              <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 group cursor-pointer" title="Aller à l'accueil Facilite">
                <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:opacity-80 transition" />
                <span className="text-base font-extrabold text-gray-900 tracking-tight group-hover:text-orange-600 transition">Facilite</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Fermer le menu"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
            <nav className="flex-1 px-3 py-5 overflow-y-auto">{renderNavSections(() => setMobileNavOpen(false))}</nav>
            {renderAccountFooter()}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONTENU PRINCIPAL */}
      {/* ------------------------------------------------------------- */}
      <div className={`flex-1 min-w-0 ${activeTab === "ia_studio" ? "h-screen flex flex-col overflow-hidden" : ""}`}>
        <main className={`max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 ${activeTab === "ia_studio" ? "flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`}>
          {/* Header & Barre d'onglets fixes en haut */}
          <div className="flex-none bg-[#FAF6F1]/95 backdrop-blur-md pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-orange-200/50 shadow-xs mb-2">
            {/* En-tête principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-2.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-lg sm:text-xl shadow-sm flex-shrink-0">
                  🛡️
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight">Administration</h1>
                  <p className="text-xs text-gray-500 font-medium">Gérez votre plateforme Facilite</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleTabChange("securite")}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                    activeTab === "securite"
                      ? "bg-emerald-600 text-white shadow-emerald-500/20"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                  title="Ouvrir le Lab Sécurité & Failles (Raccourci: Alt+S)"
                >
                  <i className="fa-solid fa-shield-check text-xs"></i>
                  <span>Lab Sécurité & Failles</span>
                </button>
                <span>Connecté en tant que {userSession?.user?.email}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-orange-700">
                  Admin
                </span>
              </div>
            </div>

            {/* Onglets horizontaux (Desktop) */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl overflow-x-auto">
              {TABS.map((tab) => (
                tab.href ? (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    onClick={(e) => {
                      if (pathname === tab.href) {
                        e.preventDefault();
                        window.location.href = tab.href;
                      }
                    }}
                    className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 text-gray-500 hover:text-gray-800"
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </Link>
                ) : (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
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

            {/* Onglets horizontaux (Mobile) avec bouton Plus */}
            <div className="flex sm:hidden items-center justify-between bg-gray-100 p-1.5 rounded-2xl relative">
              <div className="flex items-center gap-1 overflow-hidden">
                {TABS.slice(0, 2).map((tab) => (
                  tab.href ? (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 text-gray-500 hover:text-gray-800"
                    >
                      <span>{tab.icon}</span>
                      <span className="truncate max-w-[90px]">{tab.label}</span>
                    </Link>
                  ) : (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span className="truncate max-w-[90px]">{tab.label}</span>
                    </button>
                  )
                ))}
              </div>

              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMobilePlusMenuOpen(!mobilePlusMenuOpen)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mobilePlusMenuOpen ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span>➕</span>
                  <span>Plus</span>
                </button>

                {mobilePlusMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] py-2 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                    {TABS.slice(2).map((tab) => (
                      tab.href ? (
                        <Link
                          key={tab.id}
                          href={tab.href}
                          onClick={() => setMobilePlusMenuOpen(false)}
                          className="px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <span>{tab.icon}</span>
                          <span>{tab.label}</span>
                        </Link>
                      ) : (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            handleTabChange(tab.id);
                            setMobilePlusMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition-colors ${
                            activeTab === tab.id ? "bg-orange-50 text-orange-700" : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <span>{tab.icon}</span>
                          <span>{tab.label}</span>
                        </button>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isConnectedAccountTest && (
            <div className="mb-6 p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold flex items-center gap-2">
              <i className="fa-solid fa-flask"></i>
              <span>Mode test — données fictives. Ce compte administrateur est marqué comme compte de test.</span>
            </div>
          )}

          {activeTab === "dashboard" && (
            <>
              <SecurityAlertsWidget onVoirTout={() => handleTabChange("securite")} />

              {/* Barre de filtres — mise en évidence dans son propre bandeau, au-dessus des métriques */}
              <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-orange-50/60 border border-orange-100 rounded-2xl">
                <span className="text-[11px] font-extrabold text-orange-800 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-filter text-[10px]"></i>
                  Filtres
                </span>
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
                      <span className="text-4xl font-extrabold text-gray-900 block tracking-tight">{kpi.totalUsers}</span>
                    </div>
                    <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
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
                      <span className="text-4xl font-extrabold text-gray-900 block tracking-tight">{kpi.totalOffers}</span>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
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
                      <span className="text-4xl font-extrabold text-gray-900 block tracking-tight">{kpi.totalResumes}</span>
                    </div>
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
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

          {activeTab === "securite" && (
            <AdminSecurityLab
              userSession={userSession}
              securityAlerts={securityAlerts}
              invariantStatuses={invariantStatuses}
              onResolveAlert={handleResolveAlert}
              onSuspendUser={handleSuspendFromAlert}
              triggerToast={triggerToast}
            />
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

              <div className="overflow-x-auto overflow-y-auto custom-scrollbar border-t border-gray-100" style={{ maxHeight: '520px', minHeight: '350px' }}>
                <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                  <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-xs shadow-xs">
                    <tr className="border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 sticky left-0 z-30 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[200px]">Utilisateur</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Email</th>
                      <th className="py-3.5 px-4 min-w-[130px]">Téléphone</th>
                      <th className="py-3.5 px-4 min-w-[140px]">Rôle</th>
                      <th className="py-3.5 px-4 min-w-[90px]">Statut</th>
                      <th className="py-3.5 px-4 min-w-[170px]">Date & Heure d'inscription</th>
                      <th className="py-3.5 px-4 min-w-[200px]">Badges & Accréditations</th>
                      <th className="py-3.5 px-4 text-right sticky right-0 z-30 bg-gray-50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)] min-w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-12 text-center text-gray-400 italic">
                          Aucun utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="group hover:bg-orange-50/30 transition">
                          {/* Colonne Utilisateur FIXE à gauche */}
                          <td className="py-3.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-[#FFFBF7] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] flex items-center space-x-3">
                            <AvatarImage
                              path={user.avatar_url}
                              alt={user.full_name || "Avatar"}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200 shadow-xs shrink-0"
                              fallback={
                                <div className="w-8 h-8 rounded-full bg-gray-900 text-white font-extrabold flex items-center justify-center text-xs shadow-inner shrink-0">
                                  {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                                </div>
                              }
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-gray-900 block truncate max-w-[130px]">{user.full_name || "Sans nom"}</span>
                              <span className="text-[10px] text-gray-400 font-normal block font-mono">ID: {user.id.slice(0, 8)}...</span>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 text-gray-600 font-mono text-[11px]">{user.email}</td>

                          {/* Téléphone */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 font-mono text-[11px]">{user.phone_masked || "—"}</span>
                              {user.phone_masked && (
                                <button
                                  type="button"
                                  onClick={() => handleDisassociatePhone(user)}
                                  disabled={updatingUserId === user.id}
                                  title={`Dissocier ${user.phone_masked}`}
                                  className="text-gray-300 hover:text-red-500 transition cursor-pointer disabled:opacity-50 shrink-0"
                                >
                                  <i className="fa-solid fa-phone-slash text-[11px]"></i>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Rôle avec sélecteur direct */}
                          <td className="py-3.5 px-4">
                            <select
                              value={user.role || "user"}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={updatingUserId === user.id}
                              className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-orange-500 cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              <option value="user">🟢 Utilisateur</option>
                              <option value="publisher">🎧 Éditeur</option>
                              <option value="admin">🛡️ Admin</option>
                            </select>
                          </td>

                          {/* Statut */}
                          <td className="py-3.5 px-4">
                            {user.status === "suspended" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                                🔒 Suspendu
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">
                                ✓ Actif
                              </span>
                            )}
                          </td>

                          {/* Date & Heure d'inscription */}
                          <td className="py-3.5 px-4">
                            {user.created_at ? (
                              <div className="flex flex-col">
                                <span className="font-extrabold text-gray-900 text-xs">
                                  {new Date(user.created_at).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="text-[11px] text-gray-500 font-mono font-medium flex items-center gap-1 mt-0.5">
                                  <i className="fa-regular fa-clock text-[10px] text-orange-500"></i>
                                  {new Date(user.created_at).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Badges & Accréditations */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(user.badges || []).map((badge) => (
                                <span key={badge} className="inline-flex items-center gap-1">
                                  <BadgeDisplay badges={[badge]} />
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeBadge(user, badge)}
                                    disabled={updatingUserId === user.id}
                                    title={`Retirer le badge ${badge}`}
                                    className="text-gray-300 hover:text-red-500 transition cursor-pointer disabled:opacity-50"
                                  >
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                  </button>
                                </span>
                              ))}

                              {/* Interrupteur Recruteur Vérifié */}
                              <div className="flex items-center gap-1 pl-1" title="Recruteur vérifié">
                                <span className="text-[10px]">🎖️</span>
                                <ToggleSwitch
                                  checked={(user.badges || []).includes("verified_recruiter")}
                                  onChange={() => handleToggleVerifiedBadge(user)}
                                  disabled={updatingUserId === user.id}
                                  title="Recruteur vérifié"
                                  activeColorClass="bg-emerald-500"
                                />
                              </div>

                              {/* Interrupteur Compte de test */}
                              <div className="flex items-center gap-1 pl-1" title="Compte de test">
                                <span className="text-[10px]">🧪</span>
                                <ToggleSwitch
                                  checked={Boolean(user.is_test_account)}
                                  onChange={() => handleToggleTestAccount(user)}
                                  disabled={updatingUserId === user.id}
                                  title="Compte de test"
                                  activeColorClass="bg-purple-500"
                                />
                              </div>
                            </div>
                          </td>

                          {/* Actions FIXE à droite */}
                          <td className="py-3.5 px-4 text-right sticky right-0 z-10 bg-white group-hover:bg-[#FFFBF7] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openUserDetail(user)}
                                title="Voir la fiche détaillée"
                                className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition cursor-pointer flex items-center justify-center shrink-0"
                              >
                                <i className="fa-solid fa-id-card text-xs"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSuspendToggle(user)}
                                disabled={updatingUserId === user.id}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-xs disabled:opacity-50 ${
                                  user.status === "suspended"
                                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                    : "bg-red-50 hover:bg-red-100 text-red-700"
                                }`}
                              >
                                {user.status === "suspended" ? "Réactiver" : "Suspendre"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedUser && (
            <UserDetailModal
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              orders={ordersByUser.get(selectedUser.id) || []}
              completeness={completenessByUser.get(selectedUser.id) || null}
              accessRequests={userAccessRequests}
              resumesList={userResumesList}
              accessReasonDraft={accessReasonDraft}
              setAccessReasonDraft={setAccessReasonDraft}
              requestingAccess={requestingAccess}
              onRequestAccess={() => handleRequestDocumentAccess(selectedUser.id)}
              viewingDocumentKey={viewingDocumentKey}
              onViewDocument={(documentType, resumeId) => handleViewDocument(selectedUser.id, documentType, resumeId)}
              currentAdminId={userSession?.user?.id}
            />
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
                      {myRole === "admin" ? (
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
                      ) : (
                        // publisher : lecture seule (peut préparer le dossier,
                        // ne signe pas — voir approve_badge_request(), admin
                        // uniquement).
                        <span className="text-[10px] text-gray-400 italic shrink-0">Décision réservée à un administrateur</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "offres" && (
            <div className="space-y-6">
              {/* File de modération : offres en attente d'approbation. Toute
                  offre nouvelle ou modifiée substantiellement repasse ici
                  (trigger SQL) — jamais d'approbation automatique. */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-extrabold text-gray-900">File de modération — Offres ({pendingOffers.length})</h2>
                  <p className="text-xs text-gray-500 font-medium">En attente d'approbation, triées par ancienneté</p>
                </div>
                {pendingOffers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 italic text-xs">Aucune offre en attente.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingOffers.map((offer) => (
                      <div key={offer.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="text-sm font-extrabold text-gray-900 block">{offer.title}</span>
                          <span className="text-xs text-gray-500 font-medium">{offer.company}</span>
                          <p className="text-[10px] text-gray-400 mt-1">{formatAge(offer.status_updated_at || offer.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleModerateOffer(offer.id, "rejected")}
                            disabled={moderatingId === offer.id}
                            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                          >
                            Rejeter
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerateOffer(offer.id, "approved")}
                            disabled={moderatingId === offer.id}
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

              {/* Signalements : reports.pending, résolution = état, jamais suppression. */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-extrabold text-gray-900">Signalements ({pendingReports.length})</h2>
                  <p className="text-xs text-gray-500 font-medium">Contenus signalés par des utilisateurs, triés par ancienneté</p>
                </div>
                {pendingReports.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 italic text-xs">Aucun signalement en attente.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {pendingReports.map((report) => (
                      <div key={report.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="text-sm font-extrabold text-gray-900 block">
                            {report.target_type === "job_offer" ? "Offre d'emploi" : report.target_type} — {report.target_id.slice(0, 8)}...
                          </span>
                          <span className="text-xs text-gray-500 font-medium">{report.reason}</span>
                          <p className="text-[10px] text-gray-400 mt-1">{formatAge(report.created_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResolveReport(report.id)}
                          disabled={moderatingId === report.id}
                          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          Marquer comme résolu
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 text-xs text-gray-500 font-medium">
                {offers.length} offre(s) au total sur la plateforme, dont {kpi.offersThisPeriod} sur les {periodDays} derniers jours.
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

          {activeTab === "fonctionnalites" && (
            <div className="space-y-6">
              {/* En-tête du gestionnaire de fonctionnalités */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🌳</span>
                    <h2 className="text-lg font-extrabold text-gray-900">Arbre d'Autorisations des Fonctionnalités</h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-800">
                      Chantier & Contrôle d'Accès
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    Activez ou désactivez les boutons et modules pour chaque catégorie d'utilisateurs le temps de finaliser les travaux.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleToggleAllGlobal(true)}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-xl transition cursor-pointer border border-emerald-200"
                  >
                    ✓ Tout Activer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllGlobal(false)}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition cursor-pointer border border-red-200"
                  >
                    ✕ Tout Désactiver
                  </button>
                </div>
              </div>

              {/* Barre de recherche dans l'arbre */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher une fonctionnalité, un bouton ou une route (ex: Modèles, Importer, Offres)..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 shadow-xs transition"
                />
              </div>

              {/* Rendu sous forme d'Arbre (Tree Structure) */}
              <div className="space-y-4">
                {featureTree.map((branch) => {
                  const filteredChildren = branch.children.filter((feat) => {
                    if (!featureSearch.trim()) return true;
                    const q = featureSearch.toLowerCase();
                    return (
                      feat.name.toLowerCase().includes(q) ||
                      feat.description.toLowerCase().includes(q) ||
                      (feat.path && feat.path.toLowerCase().includes(q))
                    );
                  });

                  if (featureSearch.trim() && filteredChildren.length === 0) return null;

                  const isExpanded = expandedBranches[branch.id] !== false;
                  const activeCount = branch.children.filter((c) => c.enabled).length;

                  return (
                    <div
                      key={branch.id}
                      className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden transition"
                    >
                      {/* En-tête de la Branche Principale */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleBranch(branch.id)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-orange-700 flex items-center justify-center text-base shrink-0 shadow-xs">
                            {branch.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-gray-900">{branch.name}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {activeCount} / {branch.children.length} activé{activeCount > 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 font-medium truncate">{branch.description}</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleBranchAll(branch.id, true)}
                            title="Activer tous les modules de cette branche"
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 bg-emerald-50 rounded-lg transition"
                          >
                            Activer tout
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBranchAll(branch.id, false)}
                            title="Désactiver tous les modules de cette branche"
                            className="text-[11px] font-bold text-red-600 hover:text-red-700 px-2 py-1 bg-red-50 rounded-lg transition"
                          >
                            Désactiver tout
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBranch(branch.id)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition cursor-pointer"
                          >
                            <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}></i>
                          </button>
                        </div>
                      </div>

                      {/* Feuilles / Nœuds de la branche (Arborescence) */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5">
                          <div className="border-l-2 border-orange-200/80 ml-3 sm:ml-4 pl-4 sm:pl-6 space-y-4">
                            {filteredChildren.map((feat) => (
                              <div
                                key={feat.id}
                                className={`rounded-2xl border p-4 transition-all relative ${
                                  feat.enabled
                                    ? "bg-white border-gray-200 shadow-2xs hover:border-orange-200"
                                    : "bg-gray-50/60 border-dashed border-gray-300 opacity-80"
                                }`}
                              >
                                {/* Petite ligne de branchement visuelle */}
                                <div className="absolute -left-[18px] sm:-left-[26px] top-6 w-3 sm:w-5 h-0.5 bg-orange-200"></div>

                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                  {/* Infos Fonctionnalité */}
                                  <div className="min-w-0 flex items-start gap-3">
                                    <span className="text-2xl mt-0.5 shrink-0">{feat.icon}</span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 className="text-xs sm:text-sm font-extrabold text-gray-900">{feat.name}</h4>
                                        {feat.path && (
                                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                            {feat.path}
                                          </span>
                                        )}
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                            feat.enabled
                                              ? "bg-emerald-100 text-emerald-800"
                                              : "bg-red-100 text-red-800"
                                          }`}
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full ${feat.enabled ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                          {feat.enabled ? "Actif" : "Désactivé"}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                                        {feat.description}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Interrupteur Maître (Global Toggle) */}
                                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                                    <span className="text-xs font-extrabold text-gray-700">
                                      {feat.enabled ? "Activé" : "Verrouillé"}
                                    </span>
                                    <ToggleSwitch
                                      checked={feat.enabled}
                                      onChange={() => handleToggleFeatureMaster(branch.id, feat.id)}
                                      title={feat.enabled ? "Désactiver ce module" : "Activer ce module"}
                                      activeColorClass="bg-emerald-500"
                                    />
                                  </div>
                                </div>

                                {/* Matrice d'autorisations par Rôle (Arbre de permissions) */}
                                {feat.enabled && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50/50 rounded-xl p-3">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                      <i className="fa-solid fa-users-gear text-orange-500"></i>
                                      <span>Autorisations par profil d'utilisateur :</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      {/* Candidats / Utilisateurs */}
                                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs">👤</span>
                                          <span className="text-[11px] font-bold text-gray-800">Candidats</span>
                                        </div>
                                        <ToggleSwitch
                                          checked={feat.roles?.user !== false}
                                          onChange={() => handleToggleFeatureRole(branch.id, feat.id, "user")}
                                          title="Autoriser pour les Candidats"
                                          activeColorClass="bg-orange-500"
                                        />
                                      </div>

                                      {/* Recruteurs */}
                                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs">💼</span>
                                          <span className="text-[11px] font-bold text-gray-800">Recruteurs</span>
                                        </div>
                                        <ToggleSwitch
                                          checked={feat.roles?.recruiter !== false}
                                          onChange={() => handleToggleFeatureRole(branch.id, feat.id, "recruiter")}
                                          title="Autoriser pour les Recruteurs"
                                          activeColorClass="bg-blue-500"
                                        />
                                      </div>

                                      {/* Visiteurs non connectés */}
                                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs">🌐</span>
                                          <span className="text-[11px] font-bold text-gray-800">Visiteurs</span>
                                        </div>
                                        <ToggleSwitch
                                          checked={feat.roles?.visitor !== false}
                                          onChange={() => handleToggleFeatureRole(branch.id, feat.id, "visitor")}
                                          title="Autoriser pour les Visiteurs"
                                          activeColorClass="bg-purple-500"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "ia_studio" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <AdminAIStudio />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Fiche détaillée candidat, deux paliers :
 * - Palier 1 (toujours visible, sans consentement) : identité, statut,
 *   complétude, historique de commandes (statuts uniquement).
 * - Palier 2 (avec consentement) : état des demandes d'accès aux
 *   documents CV de ce candidat, et la liste des CV une fois une demande
 *   approuvée pour l'admin connecté.
 * Aucun composant Modal générique n'existe dans ce projet — patron repris
 * du tiroir de navigation mobile (backdrop + clic extérieur ferme).
 */
function UserDetailModal({
  user,
  onClose,
  orders,
  completeness,
  accessRequests,
  resumesList,
  accessReasonDraft,
  setAccessReasonDraft,
  requestingAccess,
  onRequestAccess,
  viewingDocumentKey,
  onViewDocument,
  currentAdminId,
}) {
  const myActiveRequest = accessRequests.find(
    (r) => r.admin_id === currentAdminId && r.status === "approved" && new Date(r.expires_at) > new Date()
  );
  const myPendingRequest = accessRequests.find((r) => r.admin_id === currentAdminId && r.status === "pending");

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-extrabold text-gray-900">{user.full_name || "Sans nom"}</h3>
            <p className="text-[11px] text-gray-400 font-mono">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Palier 1 */}
          <section>
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Informations du compte</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 rounded-xl p-3">
                <span className="block text-gray-400 font-bold text-[10px] uppercase">Téléphone</span>
                <span className="font-mono text-gray-800">{user.phone_masked || "—"}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <span className="block text-gray-400 font-bold text-[10px] uppercase">Date & Heure d'inscription</span>
                <span className="text-gray-800 font-medium flex items-center gap-1.5 mt-0.5">
                  <i className="fa-regular fa-calendar text-[11px] text-orange-500"></i>
                  {user.created_at
                    ? `${new Date(user.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })} à ${new Date(user.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "—"}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                <span className="block text-gray-400 font-bold text-[10px] uppercase">Statut</span>
                <span className="text-gray-800">{user.status === "suspended" ? "🔒 Suspendu" : "✓ Actif"}</span>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">Complétude du profil</h4>
            {completeness ? (
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_COMPLETENESS_FIELDS.map((f) => (
                  <span
                    key={f.key}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      completeness[f.key]
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-400 border-gray-200"
                    }`}
                  >
                    {completeness[f.key] ? "✓" : "✗"} {f.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Chargement...</p>
            )}
          </section>

          <section>
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">
              Historique de commandes ({orders.length})
            </h4>
            {orders.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune commande.</p>
            ) : (
              <div className="space-y-1.5">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                    <span className="text-gray-600">{new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
                    <span className="font-bold text-gray-800">
                      {Number(o.amount).toLocaleString("fr-FR")} {o.currency}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        o.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : o.payment_status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {o.payment_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Palier 2 */}
          <section className="border-t border-gray-100 pt-5">
            <h4 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3">
              Accès aux documents (CV) — avec consentement
            </h4>

            {myActiveRequest ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${STATUS_COLORS.approved}`}>
                    {STATUS_LABELS.approved}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Expire le {new Date(myActiveRequest.expires_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {resumesList.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Ce candidat n'a aucun CV enregistré.</p>
                ) : (
                  <div className="space-y-1.5">
                    {resumesList.map((r) => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                        <span className="font-bold text-gray-800">{r.title}</span>
                        <button
                          type="button"
                          onClick={() => onViewDocument(r.type === "imported" ? "resume_file" : "resume_content", r.id)}
                          disabled={viewingDocumentKey !== null}
                          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-extrabold rounded-lg transition cursor-pointer disabled:opacity-50"
                        >
                          {viewingDocumentKey?.startsWith(r.type === "imported" ? "resume_file" : "resume_content") ? "..." : "Voir"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : myPendingRequest ? (
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${STATUS_COLORS.pending}`}>
                  {STATUS_LABELS.pending}
                </span>
                <span className="text-[11px] text-gray-500">En attente de la réponse du candidat.</span>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={accessReasonDraft}
                  onChange={(e) => setAccessReasonDraft(e.target.value)}
                  placeholder="Motif de la demande (ex. accompagnement candidature, vérification suite signalement...)"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-orange-500 focus:bg-white transition resize-none"
                />
                <button
                  type="button"
                  onClick={onRequestAccess}
                  disabled={requestingAccess}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {requestingAccess ? "Envoi..." : "Demander l'accès aux documents"}
                </button>
              </div>
            )}

            {accessRequests.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Historique des demandes</span>
                <div className="space-y-1">
                  {accessRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{new Date(r.created_at).toLocaleDateString("fr-FR")} — {r.reason}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
