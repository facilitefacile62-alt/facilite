"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";
import RoleNavLink from "@/components/RoleNavLink";

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

  // Système de Notifications au style LinkedIn
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState("all");
  const [unreadNotifCount, setUnreadNotifCount] = useState(2);
  const [notificationsList, setNotificationsList] = useState([
    {
      id: "notif-1",
      type: "jobs",
      author: "C2K Staffing",
      avatar: "/logo.jpeg",
      text: "a publié une offre prioritaire en tête du fil : Recrutement Massif Sabodala.",
      time: "Il y a 15 minutes",
      unread: true,
      link: "/"
    },
    {
      id: "notif-2",
      type: "posts",
      author: "Équipe Facilite",
      avatar: "/logo.jpeg",
      text: "Votre profil permet désormais l'envoi de documents multiples lors d'une candidature.",
      time: "Il y a 1 heure",
      unread: true,
      link: "/profil"
    },
  ]);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Restauration de l'état "lu" des notifications (persisté)
  useEffect(() => {
    try {
      const readNotifs = JSON.parse(localStorage.getItem("read_notifications") || "[]");
      if (readNotifs.length > 0) {
        setNotificationsList(prev => {
          const updated = prev.map(n => readNotifs.includes(n.id) ? { ...n, unread: false } : n);
          setUnreadNotifCount(updated.filter(n => n.unread).length);
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

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
          className={`items-center space-x-2 group flex-shrink-0 ${
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
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
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
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
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
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
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
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
              pathname === "/messagerie"
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <i className="fa-solid fa-comments text-sm"></i>
            <span>Messagerie</span>
          </Link>
          <Link
            href="/modeles"
            className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${
              pathname === "/modeles"
                ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <i className="fa-solid fa-file-lines text-sm"></i>
            <span>Modèles CV</span>
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
                  onClick={() => setPlusDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
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
                  href="/modeles"
                  onClick={() => setPlusDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
                    pathname === "/modeles" ? "bg-emerald-50 text-emerald-700 dark:bg-gray-800 dark:text-emerald-400" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
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
                  onClick={() => setPlusDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
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
                  onClick={() => setPlusDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
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
                  onClick={() => setPlusDropdownOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors ${
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

          {/* Centre de Notifications */}
          {userSession && (
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-[#10E688] dark:hover:text-[#10E688] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition relative flex items-center justify-center flex-shrink-0"
              title="Notifications"
              aria-label="Ouvrir les notifications"
            >
              <i className="fa-regular fa-bell text-base sm:text-lg"></i>
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-extrabold rounded-full h-4 w-4 flex items-center justify-center shadow-xs border border-white dark:border-gray-900 animate-pulse">
                  {unreadNotifCount}
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
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
              pathname === "/" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-house text-sm sm:text-base"></i>
            <span className="text-[9px] font-bold tracking-tight truncate w-full">Accueil</span>
          </Link>
          <Link
            href="/candidat/extracteur"
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
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer flex-1 py-0.5 max-w-[64px] transition ${
              pathname.startsWith("/offres") ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-list-check text-sm sm:text-base"></i>
            <span className="text-[9px] font-bold tracking-tight truncate w-full">Offres</span>
          </Link>
          <Link
            href="/messagerie"
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
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-extrabold transition text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-gray-800 hover:bg-emerald-100"
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
              href="/modeles"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <i className="fa-solid fa-file-lines w-5 text-center text-emerald-600"></i>
              <span>Services & Modèles CV</span>
            </Link>
            <Link
              href="/recrutement-spontane"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <i className="fa-solid fa-building-user w-5 text-center text-blue-600"></i>
              <span>Recrutement Spontané (77 entr.)</span>
            </Link>
            <Link
              href="/recrutement-journalier"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <i className="fa-solid fa-gas-pump w-5 text-center text-purple-600"></i>
              <span>Dépôts Physiques & Stations</span>
            </Link>
            <Link
              href="/boite-a-idees"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <i className="fa-solid fa-lightbulb w-5 text-center text-amber-500"></i>
              <span>Boîte à idées & Suggestions</span>
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

      {/* Centre de Notifications (LinkedIn Style) - Globalisé et synchronisé */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-[800] bg-black/50 backdrop-blur-xs flex justify-center md:items-start md:pt-16 p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col min-h-[400px] max-h-[85vh]">
            {/* Header Modal Notifications */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#FAF6F1] dark:bg-gray-800/60">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <i className="fa-solid fa-bell text-xl text-[#10E688]"></i>
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">Notifications</h3>
                {unreadNotifCount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {unreadNotifCount} nouvelle{unreadNotifCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2">
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const readNotifs = JSON.parse(localStorage.getItem("read_notifications") || "[]");
                        const newReadNotifs = [...new Set([...readNotifs, ...notificationsList.map(n => n.id)])];
                        localStorage.setItem("read_notifications", JSON.stringify(newReadNotifs));
                      } catch(e) {}
                      setNotificationsList(prev => prev.map(n => ({ ...n, unread: false })));
                      setUnreadNotifCount(0);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 transition mr-1 cursor-pointer"
                  >
                    Tout lire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotificationsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 transition cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            {/* Filter Pills Bar */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center space-x-2 overflow-x-auto bg-gray-50/70 dark:bg-gray-900 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveNotifFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  activeNotifFilter === "all" ? "bg-[#10E688] text-gray-950 shadow-2xs" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
                }`}
              >
                Toutes
              </button>
              <button
                type="button"
                onClick={() => setActiveNotifFilter("jobs")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  activeNotifFilter === "jobs" ? "bg-[#10E688] text-gray-950 shadow-2xs" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
                }`}
              >
                Offres d'emploi
              </button>
              <button
                type="button"
                onClick={() => setActiveNotifFilter("posts")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  activeNotifFilter === "posts" ? "bg-[#10E688] text-gray-950 shadow-2xs" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
                }`}
              >
                Mes posts
              </button>
              <button
                type="button"
                onClick={() => setActiveNotifFilter("mentions")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                  activeNotifFilter === "mentions" ? "bg-[#10E688] text-gray-950 shadow-2xs" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-gray-700"
                }`}
              >
                Mentions
              </button>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 flex-1">
              {notificationsList.filter(n => {
                if (activeNotifFilter === "jobs") return n.type === "jobs";
                if (activeNotifFilter === "posts") return n.type === "posts";
                if (activeNotifFilter === "mentions") return n.type === "mentions";
                return true;
              }).length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium text-sm">
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                notificationsList.filter(n => {
                  if (activeNotifFilter === "jobs") return n.type === "jobs";
                  if (activeNotifFilter === "posts") return n.type === "posts";
                  if (activeNotifFilter === "mentions") return n.type === "mentions";
                  return true;
                }).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (notif.link) {
                        try {
                          const readNotifs = JSON.parse(localStorage.getItem("read_notifications") || "[]");
                          if (!readNotifs.includes(notif.id)) {
                            localStorage.setItem("read_notifications", JSON.stringify([...readNotifs, notif.id]));
                          }
                        } catch(e) {}
                        
                        setNotificationsList(prev => {
                          const newList = prev.map(n => n.id === notif.id ? { ...n, unread: false } : n);
                          setUnreadNotifCount(newList.filter(n => n.unread).length);
                          return newList;
                        });
                        
                        router.push(notif.link);
                        setNotificationsModalOpen(false);
                      }
                    }}
                    className={`p-4 flex items-start space-x-3 sm:space-x-3.5 transition cursor-pointer ${
                      notif.unread ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    {/* Blue Unread Indicator Dot */}
                    <div className="pt-1.5 w-2 flex-shrink-0">
                      {notif.unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 block"></span>
                      )}
                    </div>

                    {/* Avatar / Icon */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-xs sm:text-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {notif.avatar ? (
                          <img src={notif.avatar} alt={notif.author} className="w-full h-full object-cover" />
                        ) : (
                          notif.author.slice(0, 2).toUpperCase()
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 dark:text-gray-200 font-normal leading-relaxed">
                        <span className="font-bold text-gray-900 dark:text-white">{notif.author} </span>
                        {notif.text}
                      </p>
                      <span className="text-[10px] text-gray-400 font-medium mt-1 block">{notif.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 text-center">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                Centre de notifications interactif En Direct
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
