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
    category: "Service",
    description: "Concevez un CV professionnel optimisé ATS",
    icon: "fa-file-signature",
    path: "/service",
  },
  {
    id: "importer-cv",
    title: "Diagnostic CV IA & Score ATS",
    category: "Service",
    description: "Importez votre CV pour analyse IA",
    icon: "fa-wand-magic-sparkles",
    path: "/importer-cv",
  },
  {
    id: "recrutement-spontane",
    title: "Candidatures Spontanées (77 Entreprises)",
    category: "Service",
    description: "Postulez en direct aux entreprises au Sénégal",
    icon: "fa-paper-plane",
    path: "/recrutement-spontane",
  },
  {
    id: "recrutement-journalier",
    title: "Dépôts Physiques & Stations-Services",
    category: "Service",
    description: "Adresses de dépôt physique à Dakar (Total, Shell, EDK...)",
    icon: "fa-gas-pump",
    path: "/recrutement-journalier",
  },
  {
    id: "messagerie-candidat",
    title: "Messagerie Recruteur & Candidat",
    category: "Service",
    description: "Échangez en temps réel avec des recruteurs",
    icon: "fa-comments",
    path: "/messagerie",
  },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [userSession, setUserSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // États de la recherche style YouTube
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [predictions, setPredictions] = useState([]);

  const searchInputRef = useRef(null);
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

  // 2. Debounce de 250ms de la recherche style YouTube
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedQuery("");
      setPredictions([]);
      setIsOpen(false);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Extraction dynamique des prédictions (Titres, Entreprises, Lieux, Contrats, Services)
  useEffect(() => {
    if (!debouncedQuery) {
      setPredictions([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    let isMounted = true;

    async function generatePredictions() {
      const q = debouncedQuery.toLowerCase();
      const resultsMap = new Map();

      // a) Titres & Entreprises dans la base de données Supabase `job_offers`
      try {
        const { data: jobData } = await supabase
          .from("job_offers")
          .select("id, title, company, location, contract_type")
          .or(
            `title.ilike.%${debouncedQuery}%,company.ilike.%${debouncedQuery}%,location.ilike.%${debouncedQuery}%`
          )
          .limit(8);

        if (jobData && jobData.length > 0) {
          jobData.forEach((item) => {
            if (item.title && item.title.toLowerCase().includes(q)) {
              resultsMap.set(`offer_${item.id}`, {
                id: `offer_${item.id}`,
                text: item.title,
                type: "Offre",
                subtitle: `${item.company || "Recruteur"} • ${item.location || "Dakar"}`,
                targetUrl: `/offres?id=${item.id}`,
                icon: "fa-briefcase",
              });
            }
            if (item.company && item.company.toLowerCase().includes(q)) {
              resultsMap.set(`company_${item.company}`, {
                id: `company_${item.company}`,
                text: item.company,
                type: "Entreprise",
                subtitle: `Entreprise partenaire à ${item.location || "Sénégal"}`,
                targetUrl: `/offres?q=${encodeURIComponent(item.company)}`,
                icon: "fa-building",
              });
            }
          });
        }
      } catch (err) {
        console.error("Erreur de requête des prédictions:", err);
      }

      // b) Entreprises de la liste Spontanée / Réseaux Pétroliers (77 Entreprises)
      SPONTANEOUS_COMPANIES.forEach((comp) => {
        if (
          comp.company.toLowerCase().includes(q) ||
          comp.domains.toLowerCase().includes(q) ||
          (comp.poles || []).some((p) => p.toLowerCase().includes(q))
        ) {
          resultsMap.set(`spont_${comp.id}`, {
            id: `spont_${comp.id}`,
            text: comp.company,
            type: "Entreprise",
            subtitle: comp.domains,
            targetUrl: `/recrutement-spontane/${comp.slug}`,
            icon: "fa-gas-pump",
          });
        }
      });

      // c) Services statiques du site
      SITE_SERVICES.forEach((srv) => {
        if (
          srv.title.toLowerCase().includes(q) ||
          srv.description.toLowerCase().includes(q)
        ) {
          resultsMap.set(`srv_${srv.id}`, {
            id: `srv_${srv.id}`,
            text: srv.title,
            type: "Service",
            subtitle: srv.description,
            targetUrl: srv.path,
            icon: srv.icon,
          });
        }
      });

      // d) Prédictions génériques basées sur le mot-clé saisi (style YouTube)
      const commonSuffixes = ["dakar", "cdi", "stage", "sénégal", "droit privé", "support it", "commercial", "pompiste"];
      commonSuffixes.forEach((suf) => {
        if (!q.includes(suf) && (suf.startsWith(q) || q.length >= 3)) {
          const predText = `${debouncedQuery} ${suf}`;
          if (!resultsMap.has(`pred_${predText}`)) {
            resultsMap.set(`pred_${predText}`, {
              id: `pred_${predText}`,
              text: predText,
              type: "Saisie",
              subtitle: `Rechercher "${predText}" sur tout le site`,
              targetUrl: `/recherche?q=${encodeURIComponent(predText)}`,
              icon: "fa-magnifying-glass",
            });
          }
        }
      });

      const list = Array.from(resultsMap.values()).slice(0, 8);

      if (isMounted) {
        setPredictions(list);
        setIsLoading(false);
        setIsOpen(true);
        setSelectedIndex(-1);
      }
    }

    generatePredictions();

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

  // 5. Navigation au clavier (Flèche Haut, Flèche Bas, Entrée, Échap)
  const handleKeyDown = (e) => {
    if (!isOpen || predictions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearch(searchQuery);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && predictions[selectedIndex]) {
        const item = predictions[selectedIndex];
        setSearchQuery(item.text);
        executeSearch(item.text, item.targetUrl);
      } else {
        executeSearch(searchQuery);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const executeSearch = (queryText, targetUrl = null) => {
    setIsOpen(false);
    if (targetUrl) {
      router.push(targetUrl);
    } else if (queryText.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(queryText.trim())}`);
    }
  };

  const handleClearInput = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setPredictions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Helper pour afficher le texte prédit style YouTube : terme saisi en normal, suite suggérée en GRAS
  const renderBoldPrediction = (fullText, query) => {
    if (!query || !fullText) return <span className="font-normal">{fullText}</span>;

    const lowerText = fullText.toLowerCase();
    const lowerQ = query.toLowerCase().trim();
    const matchIndex = lowerText.indexOf(lowerQ);

    if (matchIndex === -1) {
      return <span className="font-bold">{fullText}</span>;
    }

    const prefix = fullText.substring(0, matchIndex);
    const matched = fullText.substring(matchIndex, matchIndex + lowerQ.length);
    const suffix = fullText.substring(matchIndex + lowerQ.length);

    return (
      <span className="text-gray-800 dark:text-gray-200">
        {prefix}
        <span className="font-normal text-gray-600 dark:text-gray-400">{matched}</span>
        <strong className="font-extrabold text-gray-900 dark:text-white">{suffix}</strong>
      </span>
    );
  };

  if (isDashboard) return null;

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

        {/* 🔍 BARRE DE RECHERCHE STYLE YOUTUBE AVEC PRÉDICTIONS DYNAMIQUES & NATIVE KEYBOARD NAV */}
        <div className="relative flex-1 max-w-lg mx-2" ref={searchContainerRef}>
          <div className="relative flex items-center">
            {/* Input avec bordure verte lors du focus style YouTube / Facilite */}
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 text-gray-400 text-sm pointer-events-none"></i>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isOpen && e.target.value.trim().length >= 2) {
                  setIsOpen(true);
                }
              }}
              onFocus={() => {
                if (debouncedQuery.length >= 2 || predictions.length > 0) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une offre d'emploi..."
              className={`w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-full text-xs sm:text-sm font-medium border transition-all shadow-xs ${
                isOpen
                  ? "rounded-b-none border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-gray-800"
                  : "border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              }`}
            />

            {/* Spinner ou Bouton X d'effacement rapide */}
            <div className="absolute right-3.5 flex items-center gap-1.5">
              {isLoading ? (
                <i className="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xs"></i>
              ) : searchQuery ? (
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

          {/* 🔽 MENU OVERLAY DÉROULANT DE PRÉDICTIONS (DROPDOWN STYLE YOUTUBE) */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 rounded-b-2xl shadow-2xl border-x border-b border-gray-200 dark:border-gray-800 overflow-hidden z-[100] transition-all animate-in fade-in duration-150">
              
              {/* Statut si chargement */}
              {isLoading && (
                <div className="p-3.5 text-xs font-bold text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
                  Recherche des suggestions en cours...
                </div>
              )}

              {/* Si aucune prédiction */}
              {!isLoading && predictions.length === 0 && debouncedQuery.length >= 2 && (
                <div className="p-4 text-center">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Aucun résultat trouvé pour "{debouncedQuery}"
                  </p>
                  <button
                    onClick={() => executeSearch(debouncedQuery)}
                    className="mt-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700"
                  >
                    Lancer la recherche dans toutes les offres →
                  </button>
                </div>
              )}

              {/* LISTE DES LIGNES DE SUGGESTION STYLE YOUTUBE */}
              {!isLoading && predictions.length > 0 && (
                <div className="py-1">
                  {predictions.map((item, index) => {
                    const isSelected = selectedIndex === index;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSearchQuery(item.text);
                          executeSearch(item.text, item.targetUrl);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-gray-100 dark:bg-gray-800"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 overflow-hidden">
                          {/* Icône de loupe 🔍 discrète style YouTube */}
                          <i className={`fa-solid ${item.icon || "fa-magnifying-glass"} text-gray-400 dark:text-gray-500 text-xs flex-shrink-0`}></i>
                          
                          <div className="truncate text-xs sm:text-sm">
                            {/* Formatage : terme saisi en normal, suite en BOLD */}
                            {renderBoldPrediction(item.text, debouncedQuery)}
                          </div>
                        </div>

                        {/* Tag explicatif à droite (ex: Offre, Entreprise, Service) */}
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                          {item.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PIED DU MENU STYLE YOUTUBE */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                <span className="italic">Appuyez sur <kbd className="font-mono bg-white dark:bg-gray-700 px-1 py-0.5 rounded border text-[10px]">↑</kbd> <kbd className="font-mono bg-white dark:bg-gray-700 px-1 py-0.5 rounded border text-[10px]">↓</kbd> puis <kbd className="font-mono bg-white dark:bg-gray-700 px-1 py-0.5 rounded border text-[10px]">Entrée</kbd></span>
                <span
                  onClick={() => executeSearch(searchQuery)}
                  className="font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:underline"
                >
                  Voir tous les résultats →
                </span>
              </div>
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
