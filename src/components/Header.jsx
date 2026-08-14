"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";
import RoleNavLink from "@/components/RoleNavLink";
import { isFeatureAllowed } from "@/lib/featureFlags";
import { triggerFeatureDisabledModal } from "@/components/FeatureDisabledModal";

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
    subtitle: "Contribuez à l'évolution de la plateforme Facilite",
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

  const [userSession, setUserSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const plusDropdownRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Centre de notifications interactif connecté à Supabase et aux offres publiées
  const [notifications, setNotifications] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const loadNotifications = useCallback(async (session) => {
    const userId = session?.user?.id;
    let readIds = [];
    if (userId) {
      try {
        const stored = localStorage.getItem(`FACILITE_READ_NOTIFS_${userId}`);
        if (stored) readIds = JSON.parse(stored);
      } catch {}
    }

    try {
      // 1. Notifications depuis Supabase (table notifications)
      let dbNotifs = [];
      if (userId) {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (data) dbNotifs = data;
      }

      // 2. Dernières offres d'emploi publiées sur la plateforme (job_offers)
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
          title: isMine ? "Votre offre d'emploi est active" : "Nouvelle opportunité d'emploi",
          content: isMine
            ? `Votre offre « ${o.title} » (${o.company || "Entreprise"} - ${o.location || "Sénégal"}) est bien en ligne et visible par tous les candidats.`
            : `Nouvelle offre publiée : « ${o.title} » chez ${o.company || "Entreprise"} (${o.location || "Sénégal"}).`,
          link: `/offres/${o.id}`,
          created_at: o.created_at,
          is_read: readIds.includes(`offer_${o.id}`),
          icon: "fa-briefcase",
          badgeColor: "emerald",
        };
      });

      const normalizedDbNotifs = (dbNotifs || []).map((n) => ({
        id: n.id,
        type: n.type || "system",
        title:
          n.type === "candidature"
            ? "Nouvelle candidature reçue"
            : n.type === "reponse"
            ? "Réponse à votre candidature"
            : n.type === "jobs"
            ? "Offre d'emploi"
            : n.type === "message"
            ? "Nouveau message"
            : n.type === "badge"
            ? "Statut de votre badge"
            : "Notification Facilité",
        content: n.content,
        link: n.link || "/offres",
        created_at: n.created_at,
        is_read: n.is_read || readIds.includes(n.id),
        icon:
          n.type === "candidature"
            ? "fa-file-user"
            : n.type === "reponse"
            ? "fa-reply"
            : n.type === "jobs"
            ? "fa-briefcase"
            : n.type === "message"
            ? "fa-comments"
            : "fa-bell",
        badgeColor: n.type === "jobs" ? "emerald" : n.type === "candidature" ? "blue" : "purple",
      }));

      // Fusion et déduplication antéchronologique
      const merged = [...normalizedDbNotifs, ...offerNotifs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setNotifications(merged);
    } catch (err) {
      console.warn("[Notifications] Erreur chargement:", err);
    }
  }, []);

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = async () => {
    const userId = userSession?.user?.id;
    const allIds = notifications.map((n) => n.id);
    if (userId) {
      try {
        localStorage.setItem(`FACILITE_READ_NOTIFS_${userId}`, JSON.stringify(allIds));
      } catch {}
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    if (userId) {
      notifications
        .filter((n) => !n.id.startsWith("offer_") && !n.is_read)
        .forEach((n) => {
          supabase.rpc("mark_notification_read", { notification_id: n.id }).catch(() => {});
        });
    }
  };

  const handleNotificationClick = (item) => {
    const userId = userSession?.user?.id;
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

    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
    );

    if (!item.id.startsWith("offer_") && userSession) {
      supabase.rpc("mark_notification_read", { notification_id: item.id }).catch(() => {});
    }

    setNotificationsModalOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (notificationFilter === "all") return true;
    if (notificationFilter === "jobs") return n.type === "jobs";
    if (notificationFilter === "candidature") return n.type === "candidature" || n.type === "reponse";
    if (notificationFilter === "messages") return n.type === "message" || n.type === "mentions" || n.type === "posts";
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
    const role = userSession
      ? (userSession.user?.email === "facilitefacile62@gmail.com" ? "admin" : "user")
      : "visitor";
    if (!isFeatureAllowed(featureKey, role)) {
      e.preventDefault();
      triggerFeatureDisabledModal(
        `Module "${featureName}" temporairement indisponible`,
        `Cette fonctionnalité (${featureName}) est temporairement désactivée le temps de finaliser les travaux et chantiers sur la plateforme. Merci pour votre patience !`
      );
      return false;
    }
    return true;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
      // Filet de sécurité pour les connexions OAuth (Google) et tout futur
      // point d'entrée : login/page.js et PhoneAuthForm.jsx appellent déjà
      // cette route explicitement pour leurs propres flux, mais l'OAuth
      // atterrit directement sur /profil sans repasser par /login — Header
      // étant monté partout, c'est le seul point commun à toutes les
      // connexions. Idempotent (annule une suppression en attente, best-effort).
      if (_event === "SIGNED_IN" && session?.access_token) {
        fetch("/api/auth/confirm-after-login", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Synchronisation Realtime des notifications & des offres d'emploi
  useEffect(() => {
    loadNotifications(userSession);

    const channel = supabase
      .channel("header-notifications-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_offers" },
        () => {
          loadNotifications(userSession);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          loadNotifications(userSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userSession, loadNotifications]);

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
    <header className="sticky top-0 z-50 bg-[#FAF6F1]/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Brand Logo & Name */}
        <Link
          href="/"
          onClick={handleLogoOrHomeClick}
          className={`items-center space-x-2 group flex-shrink-0 cursor-pointer ${
            isMobileSearchOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <img
            src="/logo.jpeg"
            alt="Logo Facilite"
            className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform"
          />
          <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors hidden sm:inline">
            Facilite
          </span>
        </Link>

        {/* 🔍 BARRE DE RECHERCHE GLOBALE AVEC AUTOCOMPLÉTION FASTAPI */}
        <div
          ref={searchContainerRef}
          className={`relative md:block md:flex-1 md:max-w-lg md:mx-2 ${
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
              pathname.startsWith("/offres")
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <i className="fa-solid fa-briefcase text-sm"></i>
            <span>Offres d&apos;emploi</span>
          </Link>
          <Link
            href="/candidat/extracteur"
            onClick={(e) => handleNavClick(e, "/candidat/extracteur", "nav_extracteur", "Extracteur")}
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              pathname === "/candidat/extracteur"
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            }`}
            title="L'Extracteur 1-Click"
          >
            <i className="fa-solid fa-bolt text-amber-500 text-sm"></i>
            <span>Extracteur</span>
          </Link>
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

          {/* Menu déroulant "Plus" pour regrouper les rubriques secondaires sans saturer */}
          <div className="relative" ref={plusDropdownRef}>
            <button
              type="button"
              onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
              className={`text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                plusDropdownOpen || pathname === "/modeles" || pathname === "/importer-cv" || pathname.startsWith("/recrutement-") || pathname === "/boite-a-idees"
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                  : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <i className="fa-solid fa-layer-group text-sm"></i>
              <span>Plus</span>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${plusDropdownOpen ? "rotate-180" : ""}`}></i>
            </button>

            {plusDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 z-[100] animate-in fade-in zoom-in-95 duration-150">
                <Link
                  href="/importer-cv"
                  onClick={(e) => handleNavClick(e, "/importer-cv", "nav_plus_importer", "Importer CV")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname === "/importer-cv" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-file-arrow-up text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">Importer CV</div>
                    <div className="text-[10px] text-gray-500 font-normal">Analyse IA et recommandations</div>
                  </div>
                </Link>

                <Link
                  href="/service"
                  onClick={(e) => handleNavClick(e, "/service", "nav_plus_service", "Services & Modèles")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname === "/service" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-briefcase text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">Services & Modèles</div>
                    <div className="text-[10px] text-gray-500 font-normal">CVs Pro, Canada, Anglais & Lettres</div>
                  </div>
                </Link>

                <Link
                  href="/recrutement-spontane"
                  onClick={(e) => handleNavClick(e, "/recrutement-spontane", "nav_plus_recrutement_spontane", "Recrutement Spontané")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname.startsWith("/recrutement-spontane") ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-building-user text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">Recrutement Spontané</div>
                    <div className="text-[10px] text-gray-500 font-normal">Répertoire des 77 entreprises</div>
                  </div>
                </Link>

                <Link
                  href="/recrutement-journalier"
                  onClick={(e) => handleNavClick(e, "/recrutement-journalier", "nav_plus_depots", "Dépôts Physiques")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname === "/recrutement-journalier" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-gas-pump text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">Dépôts Physiques</div>
                    <div className="text-[10px] text-gray-500 font-normal">Stations-services & contacts</div>
                  </div>
                </Link>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>

                <Link
                  href="/boite-a-idees"
                  onClick={(e) => handleNavClick(e, "/boite-a-idees", "nav_plus_boite_idees", "Boîte à idées")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname === "/boite-a-idees" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-lightbulb text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">Boîte à idées</div>
                    <div className="text-[10px] text-gray-500 font-normal">Suggestions & innovation</div>
                  </div>
                </Link>

                <Link
                  href="/faq"
                  onClick={(e) => handleNavClick(e, "/faq", "nav_faq", "FAQ & Aide")}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    pathname === "/faq" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-circle-question text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold">FAQ & Aide</div>
                    <div className="text-[10px] text-gray-500 font-normal">Questions fréquentes & réponses</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Auth / Action (Sans doublon Accueil, avec liens Admin/Recruteur et Notifications) */}
        <div className={`items-center gap-1.5 sm:gap-2 flex-shrink-0 ${isMobileSearchOpen ? "hidden md:flex" : "flex"}`}>
          {/* Liens Admin (si role='admin') et Recruteur (si has_badge='verified_recruiter') */}
          {userSession && (
            <div className="hidden sm:flex items-center">
              <RoleNavLink session={userSession} variant="header-desktop" />
            </div>
          )}

          {/* Centre de Notifications Interactif avec Compteur Dynamique */}
          <button
            type="button"
            onClick={() => setNotificationsModalOpen(true)}
            className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-[#10E688] dark:hover:text-[#10E688] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition relative flex items-center justify-center flex-shrink-0 cursor-pointer"
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
                className="px-2 sm:px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1 sm:gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-user-check text-xs sm:text-sm"></i>
                <span>Profil</span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50 animate-fade-in-up">
                  <Link
                    href="/profil"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="block px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                  >
                    <i className="fa-solid fa-user-circle mr-2"></i> Mon Profil
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
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
          <RoleNavLink session={userSession} variant="bottom-bar" />
        </div>
      )}

      {/* Mobile Drawer Menu (Menu hamburger parfaitement utilisable sur 320px de large) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-3 pb-6 space-y-1.5 shadow-xl max-h-[85vh] overflow-y-auto">
          {/* Action principale en vedette au sommet du tiroir tactile */}
          <div className="space-y-2 pb-2 border-b border-gray-100 dark:border-gray-800">
            <Link
              href="/importer-cv"
              onClick={(e) => handleNavClick(e, "/importer-cv", "nav_plus_importer", "Importer CV")}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-extrabold transition text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-gray-800 hover:bg-emerald-100 cursor-pointer"
            >
              <i className="fa-solid fa-file-arrow-up text-base"></i>
              <span>Importer CV (Scanner IA)</span>
            </Link>
          </div>

          <div className="py-1">
            <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              Plus d'outils & services
            </div>
            <Link
              href="/service"
              onClick={(e) => handleNavClick(e, "/service", "nav_plus_service", "Services & Modèles")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fa-solid fa-file-lines w-5 text-center text-emerald-600"></i>
              <span>Services & Modèles CV</span>
            </Link>
            <Link
              href="/recrutement-spontane"
              onClick={(e) => handleNavClick(e, "/recrutement-spontane", "nav_plus_recrutement_spontane", "Recrutement Spontané")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fa-solid fa-building-user w-5 text-center text-blue-600"></i>
              <span>Recrutement Spontané (77 entr.)</span>
            </Link>
            <Link
              href="/recrutement-journalier"
              onClick={(e) => handleNavClick(e, "/recrutement-journalier", "nav_plus_depots", "Dépôts Physiques")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fa-solid fa-gas-pump w-5 text-center text-purple-600"></i>
              <span>Dépôts Physiques & Stations</span>
            </Link>
            <Link
              href="/boite-a-idees"
              onClick={(e) => handleNavClick(e, "/boite-a-idees", "nav_plus_boite_idees", "Boîte à idées")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fa-solid fa-lightbulb w-5 text-center text-amber-500"></i>
              <span>Boîte à idées & Suggestions</span>
            </Link>
            <Link
              href="/faq"
              onClick={(e) => handleNavClick(e, "/faq", "nav_faq", "FAQ & Aide")}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fa-solid fa-circle-question w-5 text-center text-teal-600"></i>
              <span>FAQ & Questions Fréquentes</span>
            </Link>
          </div>

          {userSession ? (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <Link
                href="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition justify-center"
              >
                <i className="fa-solid fa-user-check"></i>
                <span>Mon Profil Candidat</span>
              </Link>
            </div>
          ) : (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-extrabold text-xs rounded-xl border border-gray-200 dark:border-gray-700"
              >
                Inscription
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Centre de Notifications Interactif (Style LinkedIn) */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-xs flex justify-center md:items-start md:pt-16 p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh]">
            
            {/* Header du Modal */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#FAF6F1] dark:bg-gray-800/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <i className="fa-solid fa-bell text-base"></i>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                        {unreadNotificationsCount} non lue{unreadNotificationsCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-gray-800 transition cursor-pointer"
                    title="Tout marquer comme lu"
                  >
                    <i className="fa-solid fa-check-double text-xs"></i>
                    <span className="hidden sm:inline">Tout marquer comme lu</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotificationsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 transition cursor-pointer"
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            {/* Filtres par Pilules */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto bg-gray-50/50 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setNotificationFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  notificationFilter === "all"
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                Toutes ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setNotificationFilter("jobs")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  notificationFilter === "jobs"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                Offres d'emploi ({notifications.filter((n) => n.type === "jobs").length})
              </button>
              <button
                type="button"
                onClick={() => setNotificationFilter("candidature")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  notificationFilter === "candidature"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                Candidatures ({notifications.filter((n) => n.type === "candidature" || n.type === "reponse").length})
              </button>
              <button
                type="button"
                onClick={() => setNotificationFilter("messages")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  notificationFilter === "messages"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                Messages ({notifications.filter((n) => n.type === "message" || n.type === "mentions" || n.type === "posts").length})
              </button>
            </div>

            {/* Liste Défilante des Notifications */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 max-h-[55vh]">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 mx-auto mb-3">
                    <i className="fa-regular fa-bell-slash text-2xl"></i>
                  </div>
                  <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300">
                    Aucune notification
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
                    {notificationFilter === "all"
                      ? "Vous n'avez aucune nouvelle notification pour le moment."
                      : "Aucune notification ne correspond à ce filtre."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-4 flex items-start gap-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition cursor-pointer group ${
                      !item.is_read ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                    }`}
                  >
                    {/* Icône du type */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs ${
                        item.badgeColor === "emerald"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : item.badgeColor === "blue"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                      }`}
                    >
                      <i className={`fa-solid ${item.icon} text-base`}></i>
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2 leading-relaxed font-normal">
                        {item.content}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                          <span>Voir les détails</span>
                          <i className="fa-solid fa-arrow-right text-[9px]"></i>
                        </span>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#10E688] shadow-xs" title="Non lu"></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pied du Modal */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-[#FAF6F1] dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                {notifications.length} notification{notifications.length > 1 ? "s" : ""} au total
              </span>
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(false)}
                className="px-3.5 py-1.5 bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-extrabold rounded-xl hover:opacity-90 transition cursor-pointer text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
