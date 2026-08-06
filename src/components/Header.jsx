"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [userSession, setUserSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

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
        const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("Erreur de communication avec l'API FastAPI de recherche:", err);
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

              {/* Liste des résultats stylisée */}
              {!isLoading && results.length > 0 && (
                <div className="py-1 divide-y divide-gray-100 dark:divide-gray-800/60">
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
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
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
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex-shrink-0 shadow-2xs ${getBadgeStyles(item.badgeColor)}`}>
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


        {/* Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-5 flex-shrink-0">
          <Link
            href="/"
            className={`text-xs font-bold transition-colors ${
              pathname === "/"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Accueil
          </Link>
          <Link
            href="/service"
            className={`text-xs font-bold transition-colors ${
              pathname === "/service"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Services & Modèles
          </Link>
          <Link
            href="/offres"
            className={`text-xs font-bold transition-colors ${
              pathname.startsWith("/offres")
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Offres d'emploi
          </Link>
          <Link
            href="/recrutement-spontane"
            className={`text-xs font-bold transition-colors ${
              pathname.startsWith("/recrutement-spontane")
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Recrutement Spontané
          </Link>
          <Link
            href="/importer-cv"
            className={`text-xs font-bold transition-colors ${
              pathname === "/importer-cv"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Importer CV
          </Link>
          <Link
            href="/messagerie"
            className={`text-xs font-bold transition-colors ${
              pathname === "/messagerie"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Messagerie
          </Link>
        </nav>

        {/* Auth / Action */}
        <div className={`items-center gap-2 flex-shrink-0 ${isMobileSearchOpen ? "hidden md:flex" : "flex"}`}>
          {pathname !== "/" && (
            <Link
              href="/"
              className="hidden xl:inline-flex text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition items-center gap-1.5"
            >
              <i className="fa-solid fa-house text-xs"></i>
              Accueil
            </Link>
          )}

          {userSession ? (
            <Link
              href="/profil"
              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-user-check"></i>
              Mon Profil
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-right-to-bracket"></i>
              Se connecter
            </Link>
          )}

          {/* Bouton Loupe pour ouvrir la recherche sur mobile */}
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none transition"
            title="Rechercher"
            aria-label="Ouvrir la recherche"
          >
            <i className="fa-solid fa-magnifying-glass text-lg"></i>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Barre d'onglets horizontale sur mobile (sous-header synchronisé) */}
      {!isMobileSearchOpen && (
        <div className="flex lg:hidden items-center justify-around w-full border-t border-gray-200/60 dark:border-gray-800 py-1.5 bg-[#FAF6F1]/95 dark:bg-gray-900/95">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 transition ${
              pathname === "/" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-house text-base"></i>
            <span className="text-[10px] font-bold tracking-tight">Accueil</span>
          </Link>
          <Link
            href="/service"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 transition ${
              pathname === "/service" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-briefcase text-base"></i>
            <span className="text-[10px] font-bold tracking-tight">Service</span>
          </Link>
          <Link
            href="/offres"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 transition ${
              pathname.startsWith("/offres") ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-list-check text-base"></i>
            <span className="text-[10px] font-bold tracking-tight">Offres</span>
          </Link>
          <Link
            href="/messagerie"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 transition ${
              pathname === "/messagerie" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-regular fa-comments text-base"></i>
            <span className="text-[10px] font-bold tracking-tight">Messagerie</span>
          </Link>
          <Link
            href="/importer-cv"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 transition ${
              pathname === "/importer-cv" ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-file-arrow-up text-base"></i>
            <span className="text-[10px] font-bold tracking-tight">Importer</span>
          </Link>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-3 pb-4 space-y-2 shadow-lg">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Accueil
          </Link>
          <Link
            href="/service"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Services & Modèles
          </Link>
          <Link
            href="/offres"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Offres d'emploi
          </Link>
          <Link
            href="/recrutement-spontane"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Recrutement Spontané
          </Link>
          <Link
            href="/importer-cv"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Importer CV
          </Link>
          <Link
            href="/messagerie"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Messagerie
          </Link>
          <Link
            href="/profil"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Mon Profil
          </Link>
        </div>
      )}
    </header>
  );
}
