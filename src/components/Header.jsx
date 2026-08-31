"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";
import RoleNavLink from "@/components/RoleNavLink";
import { isFeatureAllowed, getFeatureFlagsTreeAsync, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";
import { notifierConnexion } from "@/lib/confirmerConnexion";
import { triggerFeatureDisabledModal } from "@/components/FeatureDisabledModal";
import { getFaciliteWhatsAppUrl } from "@/lib/whatsappHelp";

// Répertoire exhaustif des sections, rubriques et outils pour une navigation instantanée (zéro défilement)
const QUICK_SECTIONS_INDEX = [
  {
    id: "sec_scanner",
    title: "Scanner Document IA (CV, CNI, Passeport)",
    type: "Rubrique & Outil IA",
    subtitle: "Numérisation et extraction automatique des données",
    targetUrl: "/importer-cv",
    icon: "fa-camera-retro",
    badgeColor: "emerald",
    keywords: "scanner scan document cni passeport ocr ia analyse numérisation rubriques photo",
  },
  {
    id: "sec_score",
    title: "Analyseur de Score ATS & Diagnostic CV",
    type: "Service Diagnostic",
    subtitle: "Évaluez votre CV et recevez des recommandations instantanées",
    targetUrl: "/importer-cv",
    icon: "fa-wand-magic-sparkles",
    badgeColor: "purple",
    keywords: "score ats diagnostic analyseur ia importer cv évaluation recommandation",
  },
  {
    id: "sec_cv_pro",
    title: "Modèle CV Professionnel",
    type: "Modèle de CV",
    subtitle: "Structure haute performance pour cadres et experts",
    targetUrl: "/modeles",
    icon: "fa-file-lines",
    badgeColor: "blue",
    keywords: "modèle cv professionnel template cadre expert canva service",
  },
  {
    id: "sec_lettre",
    title: "Modèle Lettre de Motivation",
    type: "Modèle de Lettre",
    subtitle: "Mise en page percutante et professionnelle",
    targetUrl: "/modeles",
    icon: "fa-envelope-open-text",
    badgeColor: "blue",
    keywords: "modèle lettre motivation canva rédaction candidature service",
  },
  {
    id: "sec_cv_en",
    title: "Modèle CV Version Anglaise / Resume",
    type: "Modèle International",
    subtitle: "Optimisé pour les recruteurs internationaux et anglophones",
    targetUrl: "/modeles",
    icon: "fa-earth-americas",
    badgeColor: "blue",
    keywords: "modèle cv anglais english resume international canva service",
  },
  {
    id: "sec_cv_ca",
    title: "Modèle CV Canadien (Sans Photo)",
    type: "Modèle Nord-Américain",
    subtitle: "Conforme aux normes canadiennes et nord-américaines",
    targetUrl: "/modeles",
    icon: "fa-map-pin",
    badgeColor: "blue",
    keywords: "modèle cv canadien canada québec sans photo nord américain canva service",
  },
  {
    id: "sec_builder",
    title: "Créer un CV en ligne (CV Builder Pro)",
    type: "Outil de Création",
    subtitle: "Assistant étape par étape pour construire votre CV d'excellence",
    targetUrl: "/creer-cv",
    icon: "fa-palette",
    badgeColor: "emerald",
    keywords: "créer cv en ligne builder pro constructeur création étape assistant",
  },
  {
    id: "sec_offres",
    title: "Offres d'emploi & Opportunités",
    type: "Job Board",
    subtitle: "Consultez les postes ouverts au Sénégal et en Afrique de l'Ouest",
    targetUrl: "/offres",
    icon: "fa-briefcase",
    badgeColor: "blue",
    keywords: "offres emploi travail poste recrutement job board opportunité dakar sénégal cdi cdd",
  },
  {
    id: "sec_spontane",
    title: "Répertoire 77 Entreprises (Candidature Spontanée)",
    type: "Base de Données",
    subtitle: "Accès direct à la banque d'entreprises du Sénégal",
    targetUrl: "/recrutement-spontane",
    icon: "fa-building-user",
    badgeColor: "emerald",
    keywords: "candidature spontanée entreprises 77 répertoire banque réseau pétrolier société dakar",
  },
  {
    id: "sec_journalier",
    title: "Dépôts Physiques & Stations-Services",
    type: "Recrutement",
    subtitle: "Adresses et contacts pour dépôts physiques de CV",
    targetUrl: "/recrutement-journalier",
    icon: "fa-gas-pump",
    badgeColor: "purple",
    keywords: "dépôts physiques stations services journalier recrutement présentiel dakar adresse téléphone",
  },
  {
    id: "sec_concours",
    title: "Concours & Examens Directs",
    type: "Opportunité",
    subtitle: "Avis de concours d'entrée et recrutements publics",
    targetUrl: "/concours",
    icon: "fa-award",
    badgeColor: "purple",
    keywords: "concours examen direct fonction publique recrutement état ministère sénégal avis",
  },
  {
    id: "sec_formation",
    title: "Formations & Certifications Pro",
    type: "Formation",
    subtitle: "Programmes certifiants et diplômes professionnels",
    targetUrl: "/formations",
    icon: "fa-graduation-cap",
    badgeColor: "emerald",
    keywords: "formation certifiante diplôme apprentissage cours atelier compétences",
  },
  {
    id: "sec_messagerie",
    title: "Messagerie & Conversations en Direct",
    type: "Communication",
    subtitle: "Échangez en temps réel avec recruteurs et candidats",
    targetUrl: "/messagerie",
    icon: "fa-comments",
    badgeColor: "purple",
    keywords: "messagerie chat conversation discussion message recruteur candidat direct",
  },
  {
    id: "sec_profil",
    title: "Mon Profil, Rubriques & Compétences",
    type: "Espace Personnel",
    subtitle: "Gérez votre parcours, vos documents et vos paramètres",
    targetUrl: "/profil",
    icon: "fa-user-tie",
    badgeColor: "blue",
    keywords: "mon profil rubriques compétences mes documents paramètres à propos compte utilisateur juriste",
  },
  {
    id: "sec_boite",
    title: "Boîte à idées & Suggestions",
    type: "Communauté",
    subtitle: "Contribuez à l'évolution de la plateforme Facilité",
    targetUrl: "/boite-a-idees",
    icon: "fa-lightbulb",
    badgeColor: "emerald",
    keywords: "boîte à idées suggestions avis proposition innovation amélioration communauté",
  },
  {
    id: "sec_extracteur",
    title: "Extracteur de Profils & Espace Recruteur",
    type: "Outil Recruteur",
    subtitle: "Outil de détection et de sourcing pour professionnels RH",
    targetUrl: "/candidat/extracteur",
    icon: "fa-filter-circle-dollar",
    badgeColor: "purple",
    keywords: "extracteur profils cv sourcing recruteur rh détection candidats admin",
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  // Session/rôle/profil chargés une seule fois pour toute l'app par AuthContext
  const { session: userSession, profile: authProfile, loading: authLoading, signOut, isAdmin, isRecruiter } = useAuth();
  // Arbre des indicateurs de fonctionnalités (panneau admin /admin) — chargé
  // au montage depuis Supabase, tenu à jour par Realtime (voir l'effet plus
  // bas). Défaut fail-open : DEFAULT_FEATURE_TREE (tout activé) pendant le
  // chargement ou en cas d'erreur réseau.
  const [featureFlagsTree, setFeatureFlagsTree] = useState(DEFAULT_FEATURE_TREE);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const [fonctionnalitesExpanded, setFonctionnalitesExpanded] = useState(true);
  const plusDropdownRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileHelpOpen, setMobileHelpOpen] = useState(false);
  const [mobileLang, setMobileLang] = useState("FR");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Charge les indicateurs de fonctionnalités au montage, puis reste à jour
  // via Realtime (même patron que l'abonnement job_offers de
  // src/app/offres/page.js) — quand un admin bascule une fonctionnalité
  // depuis /admin, tous les onglets déjà ouverts d'autres utilisateurs le
  // voient sans avoir besoin de recharger la page.
  useEffect(() => {
    getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});

    const channel = supabase
      .channel("public-feature-flags-header")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, () => {
        getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved && (saved === "FR" || saved === "EN")) {
        setMobileLang(saved);
      }
    } catch {}
  }, []);

  const handleMobileChangeLang = (lang) => {
    setMobileLang(lang);
    try {
      localStorage.setItem("lang", lang);
    } catch {}
    window.location.reload();
  };

  // Centre de notifications Facebook 1:1 : deux flux distincts fusionnés à
  // l'affichage — dbNotifications (table notifications réelle, is_read
  // géré côté serveur par mark_notification_read) et jobOfferNotifs (flux
  // "offres récemment publiées", pas de ligne réelle donc lu/non-lu suivi
  // via localStorage). Séparés pour permettre un ajout incrémental (une
  // seule ligne prependée) sur les vraies notifications Realtime, sans
  // perturber le flux d'offres.
  const [dbNotifications, setDbNotifications] = useState([]);
  const [jobOfferNotifs, setJobOfferNotifs] = useState([]);
  const notifications = useMemo(
    () => [...dbNotifications, ...jobOfferNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [dbNotifications, jobOfferNotifs]
  );
  const [notificationFilter, setNotificationFilter] = useState("all"); // "all" | "unread"
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [notifOptionsMenuOpen, setNotifOptionsMenuOpen] = useState(false);
  const notificationsContainerRef = useRef(null);
  const notifOptionsRef = useRef(null);

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `${diffMin} min.`;
    if (diffHours < 24) return `${diffHours} h.`;
    if (diffDays === 1) return "1 j.";
    if (diffDays < 7) return `${diffDays} j.`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  // Normalise une ligne brute de la table notifications vers le format
  // d'affichage Facebook-style. is_read vient directement de la colonne
  // (source de vérité depuis mark_notification_read, Point B) — plus de
  // repli localStorage ici, contrairement au flux offres ci-dessous qui
  // n'a pas de ligne réelle donc pas de colonne is_read.
  const normalizeDbNotification = useCallback((n) => ({
    id: n.id,
    type: n.type || "system",
    title:
      n.type === "candidature"
        ? "Nouvelle candidature"
        : n.type === "reponse"
        ? "Réponse recruteur"
        : n.type === "jobs"
        ? "Offre d'emploi"
        : n.type === "message"
        ? "Nouveau message"
        : n.type === "badge"
        ? "Statut de votre badge"
        : n.type === "document_access"
        ? "Accès à vos documents"
        : "Notification Facilité",
    content: n.content,
    link: n.link || "/offres",
    created_at: n.created_at,
    is_read: n.is_read,
    avatar: "/logo.jpeg",
    badgeIcon:
      n.type === "candidature"
        ? "fa-gem"
        : n.type === "reponse"
        ? "fa-reply"
        : n.type === "jobs"
        ? "fa-briefcase"
        : n.type === "message"
        ? "fa-comment"
        : n.type === "document_access"
        ? "fa-folder-open"
        : "fa-bell",
    badgeBg:
      n.type === "jobs"
        ? "bg-[#1877F2]"
        : n.type === "candidature"
        ? "bg-[#9333EA]"
        : n.type === "message"
        ? "bg-[#10B981]"
        : "bg-[#1877F2]",
  }), []);

  const fetchDbNotifications = useCallback(async (userId) => {
    if (!userId) {
      setDbNotifications([]);
      return;
    }
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      setDbNotifications((data || []).map(normalizeDbNotification));
    } catch (err) {
      console.warn("[Notifications] Erreur chargement:", err);
    }
  }, [normalizeDbNotification]);

  // Flux "offres récemment publiées" — indépendant de la table
  // notifications, pas de ligne réelle donc lu/non-lu suivi via
  // localStorage (seul état persistant disponible pour ce flux).
  const fetchJobOfferNotifs = useCallback(async (userId) => {
    let readIds = [];
    if (userId) {
      try {
        const stored = localStorage.getItem(`FACILITE_READ_NOTIFS_${userId}`);
        if (stored) readIds = JSON.parse(stored);
      } catch {}
    }

    try {
      const { data: offersData } = await supabase
        .from("job_offers")
        .select("id, title, company, location, created_at, recruiter_id, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(15);

      const offerNotifs = (offersData || []).map((o) => {
        const isMine = userId && o.recruiter_id === userId;
        return {
          id: `offer_${o.id}`,
          type: "jobs",
          title: isMine ? "Votre offre d'emploi est en ligne" : (o.title || "Nouvelle offre d'emploi"),
          company: o.company || "Entreprise",
          content: isMine
            ? `« ${o.title} » (${o.company || "Entreprise"} - ${o.location || "Sénégal"}) est active et visible par tous les candidats.`
            : `a publié : « ${o.title} » (${o.company || "Entreprise"} - ${o.location || "Sénégal"}). Postulez dès maintenant !`,
          link: `/offres/${o.id}`,
          created_at: o.created_at,
          is_read: readIds.includes(`offer_${o.id}`),
          avatar: "/logo.jpeg",
          badgeIcon: "fa-briefcase",
          badgeBg: "bg-[#1877F2]",
        };
      });
      setJobOfferNotifs(offerNotifs);
    } catch (err) {
      console.warn("[Notifications] Erreur chargement offres:", err);
    }
  }, []);

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = async () => {
    const userId = userSession?.user?.id;
    const allOfferIds = jobOfferNotifs.map((n) => n.id);
    if (userId && allOfferIds.length > 0) {
      try {
        const stored = localStorage.getItem(`FACILITE_READ_NOTIFS_${userId}`);
        const readIds = new Set(stored ? JSON.parse(stored) : []);
        allOfferIds.forEach((id) => readIds.add(id));
        localStorage.setItem(`FACILITE_READ_NOTIFS_${userId}`, JSON.stringify([...readIds]));
      } catch {}
    }

    // Mise à jour optimiste : l'UI passe "tout lu" immédiatement, sans
    // attendre la réponse de mark_notification_read() pour chaque ligne.
    const unreadDbNotifs = dbNotifications.filter((n) => !n.is_read);
    setDbNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setJobOfferNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));

    if (userId) {
      unreadDbNotifs.forEach((n) => {
        // PostgrestBuilder n'implémente que .then(), pas .catch() — un
        // vrai Promise. .catch(...) directement dessus lève "catch is not
        // a function" (trouvé en testant ce clic en conditions réelles).
        supabase.rpc("mark_notification_read", { notification_id: n.id }).then(null, () => {});
      });
    }
  };

  const handleNotificationClick = (item) => {
    const userId = userSession?.user?.id;
    const isRealNotif = !item.id.startsWith("offer_");

    if (isRealNotif) {
      // Mise à jour optimiste : marque "lu" dans l'UI immédiatement, sans
      // attendre la réponse de mark_notification_read().
      setDbNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      if (userSession) {
        supabase.rpc("mark_notification_read", { notification_id: item.id }).then(null, () => {});
      }
    } else {
      // Flux offres : pas de ligne réelle, seul le suivi localStorage
      // existe pour marquer "lu".
      if (userId) {
        try {
          const stored = localStorage.getItem(`FACILITE_READ_NOTIFS_${userId}`);
          const readIds = stored ? JSON.parse(stored) : [];
          if (!readIds.includes(item.id)) {
            readIds.push(item.id);
            localStorage.setItem(`FACILITE_READ_NOTIFS_${userId}`, JSON.stringify(readIds));
          }
        } catch {}
      }
      setJobOfferNotifs((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
    }

    setNotificationsModalOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (notificationFilter === "unread") return !n.is_read;
    return true;
  });

  // États de la recherche globale reliée à l'API FastAPI
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isMobileSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);
  const searchContainerRef = useRef(null);

  // 1. Exclusion des routes Dashboard (admin et recruteur)
  const isDashboard = pathname.startsWith("/admin") || pathname.startsWith("/recruteur");

  const handleGuardedClick = (e, featureKey, featureName) => {
    const role = !userSession ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
    if (!isFeatureAllowed(featureFlagsTree, featureKey, role)) {
      e.preventDefault();
      triggerFeatureDisabledModal(
        `Module "${featureName}" temporairement indisponible`,
        `Cette fonctionnalité (${featureName}) est temporairement désactivée le temps de finaliser les travaux et chantiers sur la plateforme. Merci pour votre patience !`
      );
      return false;
    }
    return true;
  };

  const userRole = !userSession ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const checkFeatureAllowed = (featureKey) => {
    if (!featureKey) return true;
    return isFeatureAllowed(featureFlagsTree, featureKey, userRole);
  };

  const handleNavClick = (e, href, featureKey, featureName) => {
    if (featureKey && !handleGuardedClick(e, featureKey, featureName)) {
      return;
    }
    setMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
    setIsOpen(false);
    setPlusDropdownOpen(false);

    // À chaque fois que l'utilisateur clique sur la page courante ou sur le logo/accueil, on actualise la page !
    if (pathname === href || (href === "/" && pathname === "/")) {
      e.preventDefault();
      window.location.href = href;
      return;
    }
  };

  const handleLogoOrHomeClick = (e) => {
    handleNavClick(e, "/", "nav_home", "Accueil");
  };

  // Session/rôle ne sont plus chargés ici (voir useAuth() ci-dessus) — cet
  // abonnement séparé, minimal, ne sert plus qu'à un seul effet de bord :
  // notifier /api/auth/confirm-after-login après une connexion OAuth
  // (Google), qui atterrit directement sur /profil sans repasser par
  // /login — Header étant monté partout, c'est le seul point commun à
  // toutes les connexions. login/page.js et PhoneAuthForm.jsx appellent
  // déjà cette route pour leurs propres flux. Idempotent (annule une
  // suppression en attente, best-effort).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_IN") {
        // notifierConnexion() dédoublonne par session de navigation :
        // supabase-js émet SIGNED_IN à chaque rafraîchissement de jeton et à
        // chaque montage de page, pas seulement à une vraie connexion.
        notifierConnexion(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Chargement + Realtime des notifications & des offres d'emploi. Deux
  // canaux distincts : les vraies notifications reçoivent un ajout
  // incrémental (une ligne prependée en tête + badge mis à jour) au lieu
  // d'un refetch complet à chaque événement ; le flux offres garde son
  // comportement existant (refetch sur tout changement job_offers).
  useEffect(() => {
    if (authLoading) return;
    const userId = userSession?.user?.id;

    fetchDbNotifications(userId);
    fetchJobOfferNotifs(userId);

    const channels = [];

    if (userId) {
      const notifChannel = supabase
        .channel(`header-notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            setDbNotifications((prev) => [normalizeDbNotification(payload.new), ...prev].slice(0, 20));
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            setDbNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? { ...n, is_read: payload.new.is_read } : n))
            );
          }
        )
        .subscribe();
      channels.push(notifChannel);
    }

    const offersChannel = supabase
      .channel("header-job-offers-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "job_offers" }, () => {
        fetchJobOfferNotifs(userId);
      })
      .subscribe();
    channels.push(offersChannel);

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [authLoading, userSession, fetchDbNotifications, fetchJobOfferNotifs, normalizeDbNotification]);

  // 2. Debounce de 300ms pour éviter d'inonder le backend FastAPI
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    if (!isOpen && query.trim().length >= 1) {
      setIsOpen(true);
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 3. Appel au moteur de recherche global FastAPI (/api/search)
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    let isMounted = true;

    async function fetchSearchResults() {
      try {
        const q = debouncedQuery.toLowerCase().trim();
        const combinedResults = [];
        const seenTitles = new Set();

        const addResult = (item) => {
          const key = (item.title || "").toLowerCase().trim();
          if (key && !seenTitles.has(key)) {
            seenTitles.add(key);
            combinedResults.push(item);
          }
        };

        // A. Recherche instantanée dans les sections et rubriques de la plateforme
        QUICK_SECTIONS_INDEX.forEach((sec) => {
          const content = `${sec.title} ${sec.subtitle} ${sec.keywords}`.toLowerCase();
          if (content.includes(q)) {
            addResult(sec);
          }
        });

        // B. Recherche locale dans la base des 77 Entreprises Spontanées
        if (typeof SPONTANEOUS_COMPANIES !== "undefined" && Array.isArray(SPONTANEOUS_COMPANIES)) {
          SPONTANEOUS_COMPANIES.forEach((comp, idx) => {
            const content = `${comp.company} ${comp.domains || ""} ${(comp.poles || []).join(" ")} ${comp.rawContact || ""} ${comp.description || ""}`.toLowerCase();
            if (content.includes(q)) {
              addResult({
                id: `spont_${idx}_${comp.company}`,
                title: comp.company,
                type: "Spontané",
                subtitle: `📍 ${comp.rawContact || "Sénégal"} • ${comp.domains || "Secteur d'activité"}`,
                targetUrl: `/recrutement-spontane?entreprise=${encodeURIComponent(comp.company)}`,
                icon: "fa-building-user",
                badgeColor: "emerald",
              });
            }
          });
        }

        // C. Requête en direct vers Supabase (Tables job_offers et profiles)
        try {
          const { data: jobData } = await supabase
            .from("job_offers")
            .select("id, title, company, location, contract_type")
            .or(`title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`)
            .limit(5);

          if (jobData && Array.isArray(jobData)) {
            jobData.forEach((off) => {
              addResult({
                id: `sb_off_${off.id}`,
                title: off.title || "Offre d'emploi",
                type: "Offre d'emploi",
                subtitle: `${off.company || "Recruteur confidentiel"} • 📍 ${off.location || "Sénégal"} (${off.contract_type || "CDI"})`,
                targetUrl: `/offres?id=${off.id}`,
                icon: "fa-briefcase",
                badgeColor: "blue",
              });
            });
          }
        } catch (err) {
          console.warn("Recherche directe job_offers ignorée:", err.message);
        }

        try {
          const { data: profData } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .ilike("full_name", `%${q}%`)
            .limit(5);

          if (profData && Array.isArray(profData)) {
            profData.forEach((prof) => {
              const displayName = prof.full_name || prof.email?.split("@")[0] || "Profil Membre";
              addResult({
                id: `sb_prof_${prof.id}`,
                title: displayName,
                type: "Candidat",
                subtitle: "Membre actif Facilite",
                targetUrl: `/in/${prof.id}`,
                icon: "fa-user-check",
                badgeColor: "blue",
              });
            });
          }
        } catch (err) {
          console.warn("Recherche directe profiles ignorée:", err.message);
        }

        // D. Appel sécurisé au moteur de recherche global FastAPI (/api/search) sans erreur CSP/Mixed Content
        try {
          const isSiteOnLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
          const isLocalhostApi = API_URL.includes("localhost") || API_URL.includes("127.0.0.1");

          if (!isLocalhostApi || isSiteOnLocalhost) {
            const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
            if (res.ok) {
              const data = await res.json();
              if (data && Array.isArray(data.results)) {
                data.results.forEach((item) => addResult(item));
              }
            }
          }
        } catch (err) {
          // Silence si l'API FastAPI n'est pas atteignable
        }

        if (isMounted) {
          setResults(combinedResults.slice(0, 12));
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("Erreur générale dans le moteur de recherche:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSearchResults();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 4. Gestion du clic extérieur pour fermer le menu déroulant
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
      }
      if (
        plusDropdownRef.current &&
        !plusDropdownRef.current.contains(event.target)
      ) {
        setPlusDropdownOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
      if (
        notifOptionsRef.current &&
        !notifOptionsRef.current.contains(event.target)
      ) {
        setNotifOptionsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 5. Navigation au clavier dans la liste de résultats
  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearch(query);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        const item = results[selectedIndex];
        executeSearch(item.title || query, item.targetUrl);
      } else {
        executeSearch(query);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const executeSearch = (queryText, targetUrl = null) => {
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    if (targetUrl) {
      router.push(targetUrl);
    } else if (queryText.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(queryText.trim())}`);
    }
  };

  const handleClearInput = () => {
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Helper pour styliser dynamiquement les badges selon badgeColor renvoyé par l'API
  const getBadgeStyles = (color) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "blue":
        return "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "purple":
        return "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700";
    }
  };

  if (isDashboard) return null;

  return (
    <header className="sticky top-0 z-50 bg-[#FAF6F1]/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors" suppressHydrationWarning>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3" suppressHydrationWarning>
        
        {/* Brand Logo & Name */}
        <div className={`items-center space-x-2.5 flex-shrink-0 ${
          isMobileSearchOpen ? "hidden md:flex" : "flex"
        }`}>
          <Link
            href="/"
            onClick={handleLogoOrHomeClick}
            className="flex items-center space-x-2 group flex-shrink-0 cursor-pointer"
          >
            <img
              src="/logo.jpeg"
              alt="Logo Facilité"
              className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform"
            />
            <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors hidden sm:inline">
              Facilite
            </span>
          </Link>

          {/* 🏪 Logo / Bouton Marketplace */}
          <Link
            href="/marketplace"
            title="Marketplace — Sélection du jour"
            className={`p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center group flex-shrink-0 ${
              pathname?.startsWith("/marketplace")
                ? "bg-sky-100/80 dark:bg-sky-950/60 ring-2 ring-sky-400 shadow-xs"
                : "hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:scale-105"
            }`}
          >
            <img
              src="/marketplace.svg"
              alt="Marketplace"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain transition-transform group-hover:scale-110 drop-shadow-xs"
            />
          </Link>
        </div>

        {/* 🔍 BARRE DE RECHERCHE GLOBALE AVEC AUTOCOMPLÉTION FASTAPI */}
        <div
          ref={searchContainerRef}
          className={`relative md:block md:flex-1 md:max-w-[280px] lg:max-w-[340px] md:mx-2 ${
            isMobileSearchOpen ? "flex flex-1 w-full max-w-none mx-0 items-center gap-2" : "hidden"
          }`}
        >
          <div className="relative flex-1 w-full">
            <div className="relative flex items-center w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 text-gray-400 text-sm pointer-events-none"></i>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (debouncedQuery.length >= 1 || results.length > 0) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une offre, une entreprise..."
              className={`w-full pl-10 pr-10 py-2 bg-white/80 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-full text-xs sm:text-sm font-medium border transition-all shadow-xs ${
                isOpen
                  ? "rounded-b-none border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-gray-800"
                  : "border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              }`}
            />

            {/* Spinner ou Bouton X d'effacement rapide */}
            <div className="absolute right-3.5 flex items-center gap-1.5">
              {isLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xs"></i>
              ) : query ? (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  title="Effacer la recherche"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              ) : null}
            </div>
          </div>

          {/* 🔽 MENU DÉROULANT DES RÉSULTATS (DROPDOWN) */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 rounded-b-2xl shadow-2xl border-x border-b border-gray-200 dark:border-gray-800 overflow-hidden z-[100] transition-all animate-in fade-in duration-150">
              
              {/* Statut en cours de chargement */}
              {isLoading && (
                <div className="p-4 text-xs font-bold text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
                  Recherche en cours...
                </div>
              )}

              {/* Aucun résultat trouvé */}
              {!isLoading && results.length === 0 && debouncedQuery.length >= 1 && (
                <div className="p-5 text-center">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Aucun résultat trouvé pour "{debouncedQuery}"
                  </p>
                  <button
                    onClick={() => executeSearch(debouncedQuery)}
                    className="mt-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 transition-colors"
                  >
                    Lancer la recherche globale →
                  </button>
                </div>
              )}

              {/* Liste des résultats stylisée avec défilement interne (hauteur calibrée pour ~5 éléments visibles) */}
              {!isLoading && results.length > 0 && (
                <div className="py-1 divide-y divide-gray-100 dark:divide-gray-800/60 max-h-[260px] sm:max-h-[320px] overflow-y-auto scroll-smooth overscroll-contain">
                  {results.map((item, index) => {
                    const isSelected = selectedIndex === index;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setQuery(item.title);
                          executeSearch(item.title, item.targetUrl);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-50/60 dark:bg-gray-800"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-[60%] overflow-hidden flex-1">
                          {/* Icône de l'item fournie par l'API dans un macaron élégant */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          } transition-colors`}>
                            <i className={`fa-solid ${item.icon || "fa-magnifying-glass"} text-xs`}></i>
                          </div>
                          
                          <div className="truncate flex-1">
                            <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Badge de catégorie avec couleur fournie par l'API */}
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex-shrink-0 max-w-[90px] sm:max-w-[130px] truncate text-center shadow-2xs ${getBadgeStyles(item.badgeColor)}`}>
                          {item.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pied du menu */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                <span className="italic">
                  <kbd className="font-mono bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-[10px]">↑</kbd>{" "}
                  <kbd className="font-mono bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-[10px]">↓</kbd> pour naviguer,{" "}
                  <kbd className="font-mono bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-[10px]">Entrée</kbd> pour valider
                </span>
                <span
                  onClick={() => executeSearch(query)}
                  className="font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline"
                >
                  Voir tout ({results.length}) →
                </span>
              </div>
            </div>
          )}
          </div>

          {/* Bouton Annuler / X pour refermer la recherche sur mobile */}
          {isMobileSearchOpen && (
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setIsOpen(false);
              }}
              className="md:hidden flex items-center gap-1 px-3 py-2 text-xs font-extrabold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition shadow-2xs flex-shrink-0"
              aria-label="Fermer la recherche"
            >
              <span>Annuler</span>
              <i className="fa-solid fa-xmark text-xs ml-0.5"></i>
            </button>
          )}
        </div>


        {/* Navigation Links (Desktop - Regroupement propre sans saturation de la barre) */}
        <nav className="hidden lg:flex items-center space-x-5 flex-shrink-0">
          <Link
            href="/"
            onClick={handleLogoOrHomeClick}
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              pathname === "/"
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <i className="fa-solid fa-house text-sm"></i>
            <span>Accueil</span>
          </Link>
          <Link
            href="/offres"
            onClick={(e) => handleNavClick(e, "/offres", "nav_offres", "Offres d'emploi")}
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              pathname?.startsWith("/offres")
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <i className="fa-solid fa-briefcase text-sm"></i>
            <span>Offres d&apos;emploi</span>
          </Link>
          {userSession && (
            <Link
              href="/candidat/extracteur"
              onClick={(e) => handleNavClick(e, "/candidat/extracteur", "nav_extracteur", "Extracteur")}
              className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                pathname === "/candidat/extracteur"
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                  : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <i className="fa-solid fa-bolt text-amber-500 text-sm"></i>
              <span>Extracteur</span>
            </Link>
          )}
          {userSession && (
            <Link
              href="/messagerie"
              onClick={(e) => handleNavClick(e, "/messagerie", "nav_messagerie", "Messagerie")}
              className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                pathname === "/messagerie"
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                  : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <i className="fa-solid fa-comments text-sm"></i>
              <span>Messagerie</span>
            </Link>
          )}

          {/* Menu déroulant "Plus" (visible uniquement si l'utilisateur est connecté) */}
          {userSession && (
            <div className="relative" ref={plusDropdownRef}>
              <button
                type="button"
                onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
                className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  plusDropdownOpen || pathname === "/service" || pathname === "/candidat/extracteur" || pathname === "/boite-a-idees" || pathname.startsWith("/recrutement-") || pathname === "/faq"
                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                    : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                }`}
              >
                <i className="fa-solid fa-layer-group text-sm"></i>
                <span>Plus</span>
                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${plusDropdownOpen ? "rotate-180" : ""}`}></i>
              </button>

              {plusDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 z-[100] animate-in fade-in zoom-in-95 duration-150">
                  
                  {/* 1. Recrutement Spontané */}
                  <Link
                    href="/recrutement-spontane"
                    onClick={(e) => handleNavClick(e, "/recrutement-spontane", "nav_plus_recrutement_spontane", "Recrutement Spontané")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_recrutement_spontane")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname.startsWith("/recrutement-spontane")
                        ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-building-user text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>Recrutement Spontané</span>
                        {!checkFeatureAllowed("nav_plus_recrutement_spontane") && (
                          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded-md">Bientôt</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Répertoire des 77 entreprises</div>
                    </div>
                  </Link>

                  {/* 2. Dépôts Physiques */}
                  <Link
                    href="/recrutement-journalier"
                    onClick={(e) => handleNavClick(e, "/recrutement-journalier", "nav_plus_depots", "Dépôts Physiques")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_depots")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/recrutement-journalier"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-gas-pump text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>Dépôts Physiques</span>
                        {!checkFeatureAllowed("nav_plus_depots") && (
                          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded-md">Bientôt</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Stations-services & contacts</div>
                    </div>
                  </Link>

                  {/* Concours */}
                  <Link
                    href="/concours"
                    onClick={(e) => handleNavClick(e, "/concours", "nav_plus_concours", "Concours")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_concours")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/concours"
                        ? "bg-amber-50 text-amber-700 dark:bg-gray-800 dark:text-amber-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-award text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>Concours</span>
                        <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[8px] font-black rounded-md">Public</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Avis & Examens d'État</div>
                    </div>
                  </Link>

                  {/* Formation */}
                  <Link
                    href="/formations"
                    onClick={(e) => handleNavClick(e, "/formations", "nav_plus_formation", "Formation")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_formation")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/formations"
                        ? "bg-teal-50 text-teal-700 dark:bg-gray-800 dark:text-teal-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-graduation-cap text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>Formation</span>
                        <span className="px-1.5 py-0.2 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-[8px] font-black rounded-md">Pro</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Certifications & Cours</div>
                    </div>
                  </Link>

                  {/* 3. Boîte à idées */}
                  <Link
                    href="/boite-a-idees"
                    onClick={(e) => handleNavClick(e, "/boite-a-idees", "nav_plus_boite_idees", "Boîte à idées")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_boite_idees")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/boite-a-idees"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950 text-pink-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-lightbulb text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>Boîte à idées</span>
                        {!checkFeatureAllowed("nav_plus_boite_idees") && (
                          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded-md">Bientôt</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Votez pour les fonctionnalités</div>
                    </div>
                  </Link>

                  {/* 5. FAQ & Aide */}
                  <Link
                    href="/faq"
                    onClick={(e) => handleNavClick(e, "/faq", "nav_plus_faq", "FAQ & Aide")}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_faq")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/faq"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-circle-question text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center justify-between">
                        <span>FAQ & Aide</span>
                        {!checkFeatureAllowed("nav_plus_faq") && (
                          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded-md">Bientôt</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Questions fréquentes</div>
                    </div>
                  </Link>

                  <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>

                  {/* 6. Page Fonctionnalités Complètes */}
                  <Link
                    href="/fonctionnalites"
                    onClick={(e) => handleNavClick(e, "/fonctionnalites", "nav_plus_fonctionnalites", "Toutes les fonctionnalités")}
                    className={`flex items-center gap-3 px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                      !checkFeatureAllowed("nav_plus_fonctionnalites")
                        ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500"
                        : pathname === "/fonctionnalites"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold flex items-center gap-1.5 justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>Fonctionnalités</span>
                          <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[8px] font-black rounded-md">Page & Outils</span>
                        </div>
                        {!checkFeatureAllowed("nav_plus_fonctionnalites") && (
                          <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[8px] font-black rounded-md">Bientôt</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-normal">Outils PDF, IA & Modèles</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Auth / Action (Sans doublon Accueil, avec liens Admin/Recruteur et Notifications) */}
        <div className={`items-center gap-1.5 sm:gap-2 flex-shrink-0 ${isMobileSearchOpen ? "hidden md:flex" : "flex"}`}>
          {/* Liens Admin (si role='admin') et Recruteur (si has_badge='verified_recruiter') */}
          {userSession && (
            <div className="hidden sm:flex items-center">
              <RoleNavLink session={userSession} variant="header-desktop" />
            </div>
          )}

          {/* Centre de Notifications Interactif avec Compteur Dynamique (Desktop uniquement, seulement si l'utilisateur est connecté) */}
          {userSession && (
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className="hidden lg:flex p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-[#10E688] dark:hover:text-[#10E688] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition relative items-center justify-center flex-shrink-0 cursor-pointer"
              title="Centre de notifications"
              aria-label="Ouvrir les notifications"
            >
              <i className="fa-regular fa-bell text-base sm:text-lg"></i>
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-pulse shadow-sm">
                  {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Bouton Loupe pour ouvrir la recherche sur mobile */}
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none transition flex-shrink-0"
            title="Rechercher"
            aria-label="Ouvrir la recherche"
          >
            <i className="fa-solid fa-magnifying-glass text-base sm:text-lg"></i>
          </button>

          {userSession ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="px-2 sm:px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-2xs"
              >
                {authProfile?.avatar_url && authProfile.avatar_url !== "/logo.jpeg" ? (
                  <img
                    src={authProfile.avatar_url}
                    alt="Photo de profil"
                    className="w-5 h-5 rounded-full object-cover border border-emerald-500 shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    {authProfile?.full_name ? authProfile.full_name.charAt(0).toUpperCase() : "👤"}
                  </div>
                )}
                <span className="max-w-[90px] truncate">{authProfile?.full_name || "Profil"}</span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-sans">
                  <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
                    {authProfile?.avatar_url && authProfile.avatar_url !== "/logo.jpeg" ? (
                      <img
                        src={authProfile.avatar_url}
                        alt="Photo de profil"
                        className="w-9 h-9 rounded-full object-cover border border-emerald-500 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                        {authProfile?.full_name ? authProfile.full_name.charAt(0).toUpperCase() : "👤"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                        {authProfile?.full_name || "Mon Profil"}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {userSession?.user?.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/profil"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800 hover:text-emerald-700 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-user text-emerald-600 text-sm"></i>
                    <span>Mon Profil</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileDropdownOpen(false);
                      if (signOut) {
                        await signOut();
                      } else {
                        await supabase.auth.signOut();
                      }
                      window.location.href = "/login";
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket text-red-500 text-sm"></i>
                    <span>Se déconnecter</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={pathname && pathname !== "/" && pathname !== "/login" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login"}
              className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
            >
              <i className="fa-solid fa-right-to-bracket text-xs"></i>
              <span>Connexion</span>
            </Link>
          )}

          {/* Mobile Menu Toggle (Hamburger) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none flex-shrink-0"
            aria-label="Toggle menu"
          >
            <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-base sm:text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Barre d'onglets horizontale sur mobile (sous-header calibré et garanti sans débordement à 320px) */}
      {!isMobileSearchOpen && (
        <div className="flex lg:hidden items-center justify-around w-full border-t border-gray-200/60 dark:border-gray-800 py-1 bg-[#FAF6F1]/95 dark:bg-gray-900/95 overflow-hidden px-0.5">
          <Link
            href="/"
            onClick={handleLogoOrHomeClick}
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
              pathname === "/" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-house text-sm sm:text-base"></i>
            <span className="text-[9px] font-bold tracking-tight truncate w-full">Accueil</span>
          </Link>
          {userSession && (
            <Link
              href="/candidat/extracteur"
              onClick={(e) => handleNavClick(e, "/candidat/extracteur", "nav_extracteur", "Extracteur")}
              className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
                pathname === "/candidat/extracteur" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
              title="L'Extracteur 1-Click"
            >
              <i className="fa-solid fa-bolt text-sm sm:text-base text-amber-500"></i>
              <span className="text-[9px] font-bold tracking-tight truncate w-full">Extracteur</span>
            </Link>
          )}
          <Link
            href="/offres"
            onClick={(e) => handleNavClick(e, "/offres", "nav_offres", "Offres d'emploi")}
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
              pathname.startsWith("/offres") ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-list-check text-sm sm:text-base"></i>
            <span className="text-[9px] font-bold tracking-tight truncate w-full">Offres</span>
          </Link>
          {userSession && (
            <Link
              href="/messagerie"
              onClick={(e) => handleNavClick(e, "/messagerie", "nav_messagerie", "Messagerie")}
              className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
                pathname === "/messagerie" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <i className="fa-regular fa-comments text-sm sm:text-base"></i>
              <span className="text-[9px] font-bold tracking-tight truncate w-full">Messages</span>
            </Link>
          )}
          {userSession && (
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition relative text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              aria-label="Notifications"
            >
              <div className="relative">
                <i className="fa-regular fa-bell text-sm sm:text-base"></i>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold tracking-tight truncate w-full">Notifs</span>
            </button>
          )}
          <RoleNavLink session={userSession} variant="bottom-bar" />
        </div>
      )}

      {/* Mobile Drawer Menu (Menu Hub Facebook 1:1 via React Portal pour défilement plein écran 100% natif) */}
      {mounted && mobileMenuOpen && typeof document !== "undefined" && createPortal(
        <div className="lg:hidden fixed inset-0 z-[99999] bg-[#F0F2F5] dark:bg-gray-950 flex flex-col h-[100dvh] w-screen overflow-hidden animate-in fade-in duration-200">
          
          {/* 1. Header fixe du Menu (Style Facebook : < Menu + Recherche rapide + Fermer) */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200/80 dark:border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-2xs z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-gray-900 dark:text-white font-black text-lg cursor-pointer"
            >
              <i className="fa-solid fa-chevron-left text-base text-gray-700 dark:text-gray-300"></i>
              <span>Menu</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsMobileSearchOpen(true);
                }}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-xs border border-gray-200/80 dark:border-gray-700 cursor-pointer active:scale-95 transition"
                title="Rechercher"
              >
                <i className="fa-solid fa-magnifying-glass text-sm"></i>
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-xs border border-gray-200/80 dark:border-gray-700 cursor-pointer active:scale-95 transition"
                title="Fermer le menu"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>
          </div>

          {/* 2. Corps Défilable Plein Écran (Scroll fluide natif avec tous les éléments) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 py-4 space-y-3.5 max-w-lg mx-auto w-full pb-36">
            
            {/* Carte Profil Utilisateur (Style Facebook 1:1) */}
            {userSession ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-3.5 border border-gray-200/80 dark:border-gray-800 shadow-xs">
                <Link
                  href="/profil"
                  onClick={(e) => handleNavClick(e, "/profil", "nav_profil", "Profil")}
                  className="flex items-center gap-3 group"
                >
                  <div className="relative">
                    {authProfile?.avatar_url && authProfile.avatar_url !== "/logo.jpeg" ? (
                      <img
                        src={authProfile.avatar_url}
                        alt="Photo de profil"
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-xs border-2 border-white dark:border-gray-800">
                        {(authProfile?.full_name || userSession.user?.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                      {authProfile?.full_name || userSession.user?.email?.split("@")[0] || "Mon Profil"}
                    </h3>
                    <p className="text-xs text-gray-500 font-bold flex items-center gap-1">
                      <span>Voir votre profil</span>
                      <i className="fa-solid fa-chevron-right text-[10px] text-gray-400 group-hover:translate-x-0.5 transition-transform"></i>
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                    <i className="fa-solid fa-chevron-down text-xs"></i>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-800 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-xs">
                    <i className="fa-solid fa-user-plus"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Bienvenue sur Facilité</h3>
                    <p className="text-xs text-gray-500 font-medium">Connectez-vous pour accéder à tous vos outils</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={pathname && pathname !== "/" && pathname !== "/login" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl text-center shadow-xs transition"
                  >
                    Connexion
                  </Link>
                  <Link
                    href={pathname && pathname !== "/" && pathname !== "/register" ? `/register?redirect=${encodeURIComponent(pathname)}` : "/register"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-900 dark:text-white font-black text-xs rounded-xl text-center border border-gray-200/80 dark:border-gray-700 transition"
                  >
                    Inscription
                  </Link>
                </div>
              </div>
            )}

            {/* Carte En Vedette : Diagnostic CV Gratuit (Format compact et élégant) */}
            <div>
              <div className="bg-gradient-to-br from-[#161d31] via-[#1b254b] to-[#0f172a] rounded-2xl p-3.5 border border-emerald-500/30 shadow-md text-white relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 flex items-center justify-center text-sm shadow-inner">
                    <i className="fa-solid fa-stethoscope"></i>
                  </div>
                  <span className="px-2 py-0.5 bg-[#10E688] text-gray-950 text-[9px] font-black uppercase tracking-wider rounded-full shadow-xs">
                    GRATUIT
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-black text-white mb-1">
                  Diagnostic CV Gratuit
                </h4>
                <p className="text-[11px] text-gray-300 font-medium leading-normal mb-2.5">
                  Importez votre CV pour obtenir une analyse IA complète de votre score ATS et vos mots-clés.
                </p>
                <Link
                  href="/importer-cv"
                  onClick={(e) => handleNavClick(e, "/importer-cv", "nav_plus_importer", "Diagnostic CV")}
                  className="w-full py-2 bg-[#10E688] hover:bg-[#0fd07b] text-gray-950 font-black text-[11px] rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                  <span>Diagnostiquer mon CV</span>
                </Link>
              </div>
            </div>

            {/* Grille de Raccourcis 2 Colonnes (Style Facebook Mobile Menu Hub 1:1) */}
            <div className="space-y-2">
              <div className="px-1 text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Tous les raccourcis
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* 0. Fonctionnalités */}
                <Link
                  href="/fonctionnalites"
                  onClick={(e) => handleNavClick(e, "/fonctionnalites", "nav_plus_fonctionnalites", "Fonctionnalités")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_fonctionnalites")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase ${
                      !checkFeatureAllowed("nav_plus_fonctionnalites")
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-emerald-500 text-white"
                    }`}>
                      {!checkFeatureAllowed("nav_plus_fonctionnalites") ? "Bientôt" : "Tous"}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Fonctionnalités</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Tous les outils & modèles</p>
                  </div>
                </Link>

                {/* 1. Messages */}
                <Link
                  href="/messagerie"
                  onClick={(e) => handleNavClick(e, "/messagerie", "nav_messagerie", "Messagerie")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_messagerie")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-comments"></i>
                    </div>
                    {!checkFeatureAllowed("nav_messagerie") && (
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-black rounded-md uppercase">Bientôt</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Messages</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Échanges directs</p>
                  </div>
                </Link>

                {/* 2. Offres d'emploi */}
                <Link
                  href="/offres"
                  onClick={(e) => handleNavClick(e, "/offres", "nav_offres", "Offres d'emploi")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_offres")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-briefcase"></i>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase ${
                      !checkFeatureAllowed("nav_offres")
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-emerald-500 text-white"
                    }`}>
                      {!checkFeatureAllowed("nav_offres") ? "Bientôt" : "Live"}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Offres d'emploi</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Postuler en 1 clic</p>
                  </div>
                </Link>

                {/* 6. Recrutement Spontané (77 entr.) */}
                <Link
                  href="/recrutement-spontane"
                  onClick={(e) => handleNavClick(e, "/recrutement-spontane", "nav_plus_recrutement_spontane", "Spontané")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_recrutement_spontane")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-building-user"></i>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase ${
                      !checkFeatureAllowed("nav_plus_recrutement_spontane")
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-blue-600 text-white"
                    }`}>
                      {!checkFeatureAllowed("nav_plus_recrutement_spontane") ? "Bientôt" : "77 entr."}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Candidature Spontanée</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Grandes entreprises</p>
                  </div>
                </Link>

                {/* 7. Dépôts Physiques & Stations */}
                <Link
                  href="/recrutement-journalier"
                  onClick={(e) => handleNavClick(e, "/recrutement-journalier", "nav_plus_depots", "Dépôts Physiques")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_depots")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-gas-pump"></i>
                    </div>
                    {!checkFeatureAllowed("nav_plus_depots") && (
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-black rounded-md uppercase">Bientôt</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Dépôts Physiques</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Stations & Adresses</p>
                  </div>
                </Link>

                {/* Concours */}
                <Link
                  href="/concours"
                  onClick={(e) => handleNavClick(e, "/concours", "nav_plus_concours", "Concours")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_concours")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-award"></i>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase ${
                      !checkFeatureAllowed("nav_plus_concours")
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-amber-500 text-white"
                    }`}>
                      {!checkFeatureAllowed("nav_plus_concours") ? "Bientôt" : "Public"}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Concours</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Avis & Examens</p>
                  </div>
                </Link>

                {/* Formation */}
                <Link
                  href="/formations"
                  onClick={(e) => handleNavClick(e, "/formations", "nav_plus_formation", "Formation")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_formation")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-graduation-cap"></i>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase ${
                      !checkFeatureAllowed("nav_plus_formation")
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        : "bg-teal-500 text-white"
                    }`}>
                      {!checkFeatureAllowed("nav_plus_formation") ? "Bientôt" : "Pro"}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Formation</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Certifications & Cours</p>
                  </div>
                </Link>

                {/* 8. Marketplace */}
                <Link
                  href="/marketplace"
                  onClick={(e) => handleNavClick(e, "/marketplace", "nav_marketplace", "Marketplace")}
                  className="rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950 text-[#1877F2] flex items-center justify-center text-sm shadow-2xs">
                      <img src="/marketplace.svg" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                    </div>
                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-[#1877F2] text-[9px] font-black rounded-md uppercase">Nouveau</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Marketplace</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Sélection du jour & Ventes</p>
                  </div>
                </Link>

                {/* 11. Boîte à idées & Suggestions */}
                <Link
                  href="/boite-a-idees"
                  onClick={(e) => handleNavClick(e, "/boite-a-idees", "nav_plus_boite_idees", "Idées")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_plus_boite_idees")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-yellow-100 dark:bg-yellow-950 text-yellow-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-lightbulb"></i>
                    </div>
                    {!checkFeatureAllowed("nav_plus_boite_idees") && (
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-black rounded-md uppercase">Bientôt</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Boîte à idées</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Vos suggestions</p>
                  </div>
                </Link>

                {/* 12. FAQ & Centre d'aide */}
                <Link
                  href="/faq"
                  onClick={(e) => handleNavClick(e, "/faq", "nav_faq", "FAQ")}
                  className={`rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] ${
                    !checkFeatureAllowed("nav_faq")
                      ? "opacity-40 grayscale cursor-not-allowed bg-gray-100/90 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-400 pointer-events-none select-none shadow-none"
                      : "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center text-sm shadow-2xs">
                      <i className="fa-solid fa-circle-question"></i>
                    </div>
                    {!checkFeatureAllowed("nav_faq") && (
                      <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-black rounded-md uppercase">Bientôt</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">FAQ & Centre d'aide</h4>
                    <p className="text-[10px] text-gray-500 font-medium truncate">Questions fréquentes</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Accordéons de Paramètres & Assistance (Style Facebook) */}
            <div className="pt-2 border-t border-gray-200/80 dark:border-gray-800 space-y-1.5">
              
              {/* Accordéon 1 : Paramètres et langue */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-bold text-gray-900 dark:text-white cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs">
                      <i className="fa-solid fa-gear"></i>
                    </div>
                    <span>Paramètres et langue</span>
                  </div>
                  <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${mobileSettingsOpen ? "rotate-180" : ""}`}></i>
                </button>
                {mobileSettingsOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="font-bold text-gray-600 dark:text-gray-300 mb-1.5">Langue de l'application :</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMobileChangeLang("FR")}
                        className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-2 border transition ${
                          mobileLang === "FR"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        <img src="/francais.avif" alt="FR" className="w-4 h-4 rounded-full object-cover" />
                        <span>Français</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileChangeLang("EN")}
                        className={`py-2 px-3 rounded-xl font-black flex items-center justify-center gap-2 border transition ${
                          mobileLang === "EN"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        <img src="/anglais.jpeg" alt="EN" className="w-4 h-4 rounded-full object-cover" />
                        <span>English</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordéon 2 : Aide et assistance */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMobileHelpOpen(!mobileHelpOpen)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left text-sm font-bold text-gray-900 dark:text-white cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs">
                      <i className="fa-solid fa-circle-question"></i>
                    </div>
                    <span>Aide et assistance</span>
                  </div>
                  <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${mobileHelpOpen ? "rotate-180" : ""}`}></i>
                </button>
                {mobileHelpOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <a
                      href={getFaciliteWhatsAppUrl({ page: "Menu Mobile / Centre d'Aide" })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 text-emerald-900 font-bold border border-emerald-200 hover:bg-emerald-100 transition"
                    >
                      <i className="fa-brands fa-whatsapp text-lg text-emerald-600"></i>
                      <span>Assistance directe WhatsApp (24/7)</span>
                    </a>
                    <Link
                      href="/faq"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 text-gray-800 font-bold hover:bg-gray-100"
                    >
                      <i className="fa-solid fa-book-open text-base text-gray-500"></i>
                      <span>Centre d'aide & Questions fréquentes</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Bouton de Déconnexion (si connecté) */}
              {userSession && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full px-4 py-3.5 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-2xl border border-gray-200/80 dark:border-gray-800 flex items-center gap-3 text-red-600 font-black text-sm transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                  </div>
                  <span>Déconnexion</span>
                </button>
              )}

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* 🔔 POPUP DE NOTIFICATIONS 1:1 FACEBOOK PIXEL-PERFECT */}
      {notificationsModalOpen && (
        <>
          {/* Overlay sombre discret pour fermer au clic extérieur */}
          <div
            className="fixed inset-0 z-[840] bg-black/20 backdrop-blur-2xs transition-opacity"
            onClick={() => {
              setNotificationsModalOpen(false);
              setNotifOptionsMenuOpen(false);
            }}
          />

          {/* Popup Déroulant Facebook */}
          <div
            ref={notificationsContainerRef}
            className="fixed top-12 md:top-14 left-2 right-2 sm:left-auto sm:right-4 md:right-10 w-auto sm:w-[380px] max-w-[390px] mx-auto sm:mx-0 h-[520px] max-h-[85vh] bg-white dark:bg-gray-900 z-[850] shadow-2xl rounded-2xl border border-gray-200/90 dark:border-gray-800 flex flex-col min-h-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Facebook : Titre "Notifications" en gras + Options (...) */}
            <div className="px-4 pt-3.5 pb-2 flex items-center justify-between flex-shrink-0 bg-white dark:bg-gray-900">
              <h2 className="text-2xl font-bold text-gray-950 dark:text-white tracking-tight">
                Notifications
              </h2>

              <div className="flex items-center gap-1 relative" ref={notifOptionsRef}>
                {/* Bouton Options 3 petits points (...) */}
                <button
                  type="button"
                  onClick={() => setNotifOptionsMenuOpen(!notifOptionsMenuOpen)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 transition cursor-pointer"
                  title="Options"
                  aria-label="Options"
                >
                  <i className="fa-solid fa-ellipsis text-base"></i>
                </button>

                {/* Dropdown Options Facebook */}
                {notifOptionsMenuOpen && (
                  <div className="absolute right-0 top-9 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        handleMarkAllAsRead();
                        setNotifOptionsMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-check text-emerald-600 text-sm w-4 text-center"></i>
                      <span>Tout marquer comme lu</span>
                    </button>
                    <Link
                      href="/offres"
                      onClick={() => {
                        setNotifOptionsMenuOpen(false);
                        setNotificationsModalOpen(false);
                      }}
                      className="w-full px-3.5 py-2 flex items-center gap-2.5 text-left text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer border-t border-gray-100 dark:border-gray-700"
                    >
                      <i className="fa-solid fa-briefcase text-[#1877F2] text-sm w-4 text-center"></i>
                      <span>Voir toutes les offres</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Pilules Facebook : Tout / Non lu */}
            <div className="px-4 pb-2.5 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setNotificationFilter("all")}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer ${
                  notificationFilter === "all"
                    ? "bg-[#E7F3FF] text-[#1877F2] dark:bg-blue-950 dark:text-blue-400 font-extrabold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                }`}
              >
                Tout
              </button>
              <button
                type="button"
                onClick={() => setNotificationFilter("unread")}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold transition cursor-pointer ${
                  notificationFilter === "unread"
                    ? "bg-[#E7F3FF] text-[#1877F2] dark:bg-blue-950 dark:text-blue-400 font-extrabold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                }`}
              >
                Non lu {unreadNotificationsCount > 0 ? `(${unreadNotificationsCount})` : ""}
              </button>
            </div>

            {/* Liste Défilante des Notifications Facebook */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
              {/* Section Nouveau + Voir tout */}
              <div className="px-2 pt-1.5 pb-1 flex items-center justify-between">
                <span className="text-[15px] font-bold text-gray-950 dark:text-white">
                  Nouveau
                </span>
                <Link
                  href="/offres"
                  onClick={() => setNotificationsModalOpen(false)}
                  className="text-sm font-semibold text-[#1877F2] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Voir tout
                </Link>
              </div>

              {filteredNotifications.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mx-auto mb-2.5">
                    <i className="fa-regular fa-bell-slash text-lg"></i>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    Aucune notification
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs mx-auto">
                    {notificationFilter === "unread"
                      ? "Vous avez lu toutes vos notifications !"
                      : "Vous n'avez aucune notification pour le moment."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-2 flex items-start gap-3 rounded-xl hover:bg-[#F2F2F2] dark:hover:bg-gray-800/80 transition cursor-pointer group relative ${
                      !item.is_read ? "bg-[#EBF5FF]/40 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    {/* Avatar 52px avec Badge circulaire en bas à droite */}
                    <div className="relative w-13 h-13 flex-shrink-0">
                      <div className="w-13 h-13 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xs">
                        {item.avatar && item.avatar !== "/logo.jpeg" ? (
                          <img src={item.avatar} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <img src="/logo.jpeg" alt="Facilite" className="w-full h-full object-cover" />
                        )}
                      </div>

                      {/* Badge Icon en bas à droite (Style Facebook 1:1) */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] border-2 border-white dark:border-gray-900 shadow-xs ${
                          item.badgeBg || "bg-[#1877F2]"
                        }`}
                      >
                        <i className={`fa-solid ${item.badgeIcon || "fa-user"}`}></i>
                      </div>
                    </div>

                    {/* Texte de la notification */}
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="text-[13px] leading-snug text-gray-900 dark:text-gray-100 font-normal line-clamp-3">
                        <strong className="font-bold text-gray-950 dark:text-white">
                          {item.title}
                        </strong>{" "}
                        {item.content}
                      </p>
                      <span
                        className={`text-xs font-bold mt-0.5 block ${
                          !item.is_read
                            ? "text-[#1877F2] dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400 font-normal"
                        }`}
                      >
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    {/* Point bleu non-lu Facebook */}
                    {!item.is_read && (
                      <span className="w-2.5 h-2.5 bg-[#1877F2] rounded-full flex-shrink-0 self-center shadow-xs"></span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
