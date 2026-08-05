"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";

// Services statiques du site pour la recherche rapide
const SITE_SERVICES = [
  {
    id: "creer-cv",
    title: "Création & Modèles de CV",
    category: "Services & Outils",
    description: "Concevez un CV professionnel optimisé pour les recruteurs et le format ATS.",
    icon: "fa-file-signature",
    path: "/service",
  },
  {
    id: "importer-cv",
    title: "Analyseur IA & Diagnostic CV",
    category: "Services & Outils",
    description: "Importez votre CV (PDF/DOCX) et obtenez un score ATS et des conseils IA.",
    icon: "fa-wand-magic-sparkles",
    path: "/importer-cv",
  },
  {
    id: "recrutement-spontane",
    slug: "recrutement-spontane",
    title: "Répertoire Candidatures Spontanées (77 Entreprises)",
    category: "Services & Outils",
    description: "Postulez directement aux entreprises et réseaux pétroliers au Sénégal.",
    icon: "fa-paper-plane",
    path: "/recrutement-spontane",
  },
  {
    id: "recrutement-journalier",
    title: "Dépôts Physiques & Stations-Services",
    category: "Services & Outils",
    description: "Consultez les adresses de dépôt physique à Dakar (Total, Shell, EDK...).",
    icon: "fa-gas-pump",
    path: "/recrutement-journalier",
  },
  {
    id: "messagerie-candidat",
    title: "Messagerie Recruteur & Candidat",
    category: "Services & Outils",
    description: "Échangez en temps réel avec des recruteurs et suivez vos échanges.",
    icon: "fa-comments",
    path: "/messagerie",
  },
  {
    id: "boite-a-idees",
    title: "Boîte à idées & Suggestions",
    category: "Services & Outils",
    description: "Partagez vos retours et idées pour améliorer la plateforme Facilite.",
    icon: "fa-lightbulb",
    path: "/boite-a-idees",
  },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [userSession, setUserSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // États de recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({
    offers: [],
    companies: [],
    services: [],
  });

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

  // 2. Debounce de la recherche (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedQuery("");
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Exécution de la recherche dès que debouncedQuery change
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults({ offers: [], companies: [], services: [] });
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    let isMounted = true;

    async function fetchResults() {
      const q = debouncedQuery.toLowerCase();

      // a) Filtrage des services du site
      const matchedServices = SITE_SERVICES.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      ).slice(0, 3);

      // b) Filtrage des entreprises de candidatures spontanées
      const matchedCompanies = SPONTANEOUS_COMPANIES.filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.domains.toLowerCase().includes(q) ||
          (c.poles || []).some((p) => p.toLowerCase().includes(q))
      ).slice(0, 4);

      // c) Requête Supabase pour les offres d'emploi réelles
      let matchedOffers = [];
      try {
        const { data, error } = await supabase
          .from("job_offers")
          .select("id, title, company, location, contract_type, category")
          .or(
            `title.ilike.%${debouncedQuery}%,company.ilike.%${debouncedQuery}%,location.ilike.%${debouncedQuery}%`
          )
          .limit(4);

        if (!error && data) {
          matchedOffers = data;
        }
      } catch (err) {
        console.error("Erreur de recherche Supabase:", err);
      }

      if (isMounted) {
        setSearchResults({
          offers: matchedOffers,
          companies: matchedCompanies,
          services: matchedServices,
        });
        setIsLoading(false);
        setIsOpen(true);
      }
    }

    fetchResults();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // 4. Gestion du clic extérieur (click-outside)
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Soumission via touche Entrée ou clic
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsOpen(false);
    router.push(`/offres?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleResultClick = (targetUrl) => {
    setIsOpen(false);
    setSearchQuery("");
    router.push(targetUrl);
  };

  // Ne rien afficher sur les dashboards admin/recruteur
  if (isDashboard) return null;

  const totalResultsCount =
    searchResults.offers.length +
    searchResults.companies.length +
    searchResults.services.length;

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center space-x-2 group flex-shrink-0">
          <img
            src="/logo.jpeg"
            alt="Logo Facilite"
            className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform"
          />
          <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors hidden sm:inline">
            Facilite
          </span>
        </Link>

        {/* 🔍 BARRE DE RECHERCHE PRINCIPALE AVEC AUTOCOMPLÉTION & DROPDOWN DYNAMIQUE */}
        <div className="relative flex-1 max-w-lg mx-2" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div className="relative flex items-center">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 text-gray-400 text-sm pointer-events-none"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen && e.target.value.trim().length >= 2) {
                    setIsOpen(true);
                  }
                }}
                onFocus={() => {
                  if (debouncedQuery.length >= 2) setIsOpen(true);
                }}
                placeholder="Rechercher une offre, entreprise, service..."
                className="w-full pl-10 pr-9 py-2 bg-gray-100 dark:bg-gray-800/90 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-full text-xs sm:text-sm font-medium border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-800 transition-all shadow-xs"
              />
              {isLoading ? (
                <div className="absolute right-3">
                  <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xs"></i>
                </div>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setIsOpen(false);
                  }}
                  className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              ) : null}
            </div>
          </form>

          {/* 🔽 MENU DÉROULANT DE RÉSULTATS (DROPDOWN) */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden z-[100] max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Statut si chargement */}
              {isLoading && (
                <div className="p-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-spinner fa-spin text-emerald-600"></i>
                  Recherche instantanée en cours...
                </div>
              )}

              {/* Si aucun résultat trouvé */}
              {!isLoading && totalResultsCount === 0 && debouncedQuery.length >= 2 && (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3 text-lg">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
                    Aucun résultat trouvé pour "{debouncedQuery}"
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Essayez d'autres mots-clés comme "Comptable", "TotalEnergies", "Pompiste" ou "CV".
                  </p>
                  <button
                    onClick={() => handleResultClick(`/offres?q=${encodeURIComponent(debouncedQuery)}`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition"
                  >
                    Voir toutes les offres répertoriées
                  </button>
                </div>
              )}

              {/* Catégorie 1: OFFRES D'EMPLOI */}
              {!isLoading && searchResults.offers.length > 0 && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 px-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-briefcase text-xs"></i>
                    Offres d'emploi correspondantes ({searchResults.offers.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.offers.map((offer) => (
                      <div
                        key={offer.id}
                        onClick={() => handleResultClick(`/offres?id=${offer.id}`)}
                        className="p-2.5 hover:bg-emerald-50/70 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 text-xs group-hover:scale-110 transition-transform">
                            <i className="fa-solid fa-building text-xs"></i>
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                              {offer.title}
                            </h4>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                              {offer.company} • {offer.location || "Dakar"}
                            </p>
                          </div>
                        </div>
                        {offer.contract_type && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 ml-2 flex-shrink-0">
                            {offer.contract_type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catégorie 2: ENTREPRISES & RECRUTEURS */}
              {!isLoading && searchResults.companies.length > 0 && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 px-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-building text-xs"></i>
                    Entreprises & Recruteurs ({searchResults.companies.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.companies.map((company) => (
                      <div
                        key={company.id}
                        onClick={() => handleResultClick(`/recrutement-spontane/${company.slug}`)}
                        className="p-2.5 hover:bg-amber-50/70 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center flex-shrink-0 text-xs group-hover:scale-110 transition-transform">
                            <i className="fa-solid fa-gas-pump text-xs"></i>
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate group-hover:text-amber-600 transition-colors">
                              {company.company}
                            </h4>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                              {company.domains}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                          Postuler
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catégorie 3: SERVICES & OUTILS DE LA PLATEFORME */}
              {!isLoading && searchResults.services.length > 0 && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2 px-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-toolbox text-xs"></i>
                    Services & Outils du site
                  </div>
                  <div className="space-y-1">
                    {searchResults.services.map((service) => (
                      <div
                        key={service.id}
                        onClick={() => handleResultClick(service.path)}
                        className="p-2.5 hover:bg-blue-50/70 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0 text-xs group-hover:scale-110 transition-transform">
                          <i className={`fa-solid ${service.icon}`}></i>
                        </div>
                        <div className="truncate">
                          <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                            {service.title}
                          </h4>
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                            {service.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🦶 FOOTER OPTION : VOIR TOUS LES RÉSULTATS POUR '[MOT-CLÉ]' */}
              {!isLoading && debouncedQuery && (
                <div
                  onClick={() => handleResultClick(`/offres?q=${encodeURIComponent(debouncedQuery)}`)}
                  className="p-3.5 bg-gray-50 dark:bg-gray-800/80 hover:bg-emerald-50 dark:hover:bg-gray-800 text-center cursor-pointer transition flex items-center justify-center gap-2 group"
                >
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 group-hover:underline">
                    Voir tous les résultats pour "{debouncedQuery}"
                  </span>
                  <i className="fa-solid fa-arrow-right text-xs text-emerald-700 dark:text-emerald-400 group-hover:translate-x-1 transition-transform"></i>
                </div>
              )}

            </div>
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
        <div className="flex items-center gap-2 flex-shrink-0">
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
