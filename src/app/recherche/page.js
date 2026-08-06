"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";
import ApplyModal from "@/components/ApplyModal";

// Services statiques du site et rubriques
const SITE_SERVICES = [
  {
    id: "sec_scanner",
    title: "Scanner Document IA (CV, CNI, Passeport)",
    category: "Services & Outils",
    description: "Numérisation et extraction automatique de vos données et compétences via IA.",
    icon: "fa-camera-retro",
    path: "/importer-cv",
  },
  {
    id: "sec_score",
    title: "Analyseur de Score ATS & Diagnostic CV",
    category: "Services & Outils",
    description: "Importez votre CV (PDF/DOCX) pour obtenir un score ATS instantané et des recommandations.",
    icon: "fa-wand-magic-sparkles",
    path: "/importer-cv",
  },
  {
    id: "sec_cv_pro",
    title: "Modèle CV Professionnel",
    category: "Modèles de CV",
    description: "Concevez un CV haute performance optimisé pour les cadres, managers et experts.",
    icon: "fa-file-lines",
    path: "/service",
  },
  {
    id: "sec_lettre",
    title: "Modèle Lettre de Motivation",
    category: "Modèles",
    description: "Mise en page percutante et professionnelle pour accompagner votre CV.",
    icon: "fa-envelope-open-text",
    path: "/service",
  },
  {
    id: "sec_cv_en",
    title: "Modèle CV Version Anglaise / Resume",
    category: "Modèles",
    description: "Optimisé au format international pour postuler auprès d'entreprises anglophones.",
    icon: "fa-earth-americas",
    path: "/service",
  },
  {
    id: "sec_cv_ca",
    title: "Modèle CV Canadien (Sans Photo)",
    category: "Modèles",
    description: "Structure conforme aux normes canadiennes et nord-américaines sans photo ni âge.",
    icon: "fa-map-pin",
    path: "/service",
  },
  {
    id: "sec_builder",
    title: "Créer un CV en ligne (CV Builder Pro)",
    category: "Outil de Création",
    description: "Assistant étape par étape pour construire et éditer un CV d'excellence.",
    icon: "fa-palette",
    path: "/creer-cv",
  },
  {
    id: "sec_recrutement_spontane",
    title: "Répertoire Candidatures Spontanées (77 Entreprises)",
    category: "Services",
    description: "Accédez à la liste complète des grandes entreprises et réseaux au Sénégal pour postuler directement.",
    icon: "fa-paper-plane",
    path: "/recrutement-spontane",
  },
  {
    id: "sec_recrutement_journalier",
    title: "Dépôts Physiques & Stations-Services",
    category: "Services",
    description: "Consultez les adresses et contacts pour dépôts de candidatures physiques à Dakar et aux alentours.",
    icon: "fa-gas-pump",
    path: "/recrutement-journalier",
  },
  {
    id: "sec_messagerie",
    title: "Messagerie Recruteur & Candidat",
    category: "Services",
    description: "Échangez en temps réel avec des recruteurs et suivez l'avancement de vos échanges.",
    icon: "fa-comments",
    path: "/messagerie",
  },
  {
    id: "sec_profil",
    title: "Mon Profil, Rubriques & Documents",
    category: "Espace Personnel",
    description: "Gérez votre parcours professionnel, vos compétences et vos documents attachés.",
    icon: "fa-user-tie",
    path: "/profil",
  },
  {
    id: "sec_boite",
    title: "Boîte à idées & Suggestions",
    category: "Services",
    description: "Proposez des idées d'amélioration pour enrichir l'expérience sur la plateforme Facilite.",
    icon: "fa-lightbulb",
    path: "/boite-a-idees",
  },
];

function RechercheContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams?.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'offers', 'companies', 'recruiters', 'services'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [applyingOffer, setApplyingOffer] = useState(null);

  // Résultats multi-sources
  const [results, setResults] = useState({
    offers: [],
    companies: [],
    recruiters: [],
    services: [],
  });

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  // Effectuer la recherche globale multi-sources
  useEffect(() => {
    let isMounted = true;
    async function performGlobalSearch() {
      setLoading(true);
      const q = searchQuery.trim().toLowerCase();

      if (!q) {
        if (isMounted) {
          setResults({ offers: [], companies: [], recruiters: [], services: [] });
          setLoading(false);
        }
        return;
      }

      // 1. Filtrage des Services & Outils du site
      const matchedServices = SITE_SERVICES.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );

      // 2. Filtrage des Candidatures Spontanées (77 Entreprises)
      const matchedCompanies = SPONTANEOUS_COMPANIES.filter((c) => {
        const text = `${c.company} ${c.domains} ${(c.poles || []).join(" ")} ${c.rawContact} ${c.description}`.toLowerCase();
        return text.includes(q);
      });

      // 3. Requête Supabase pour les Offres d'emploi
      let matchedOffers = [];
      try {
        const { data: jobData } = await supabase
          .from("job_offers")
          .select("*")
          .or(
            `title.ilike.%${q}%,company.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`
          )
          .order("created_at", { ascending: false });

        if (jobData) {
          matchedOffers = jobData.filter((o) => o.is_active !== false);
        }
      } catch (err) {
        console.error("Erreur recherche offres Supabase:", err);
      }

      // 4. Requête Supabase pour les Recruteurs / Membres
      let matchedRecruiters = [];
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role, headline")
          .eq("role", "recruteur")
          .or(`full_name.ilike.%${q}%,headline.ilike.%${q}%`);

        if (profileData) {
          matchedRecruiters = profileData;
        }
      } catch (err) {
        console.error("Erreur recherche recruteurs Supabase:", err);
      }

      if (isMounted) {
        setResults({
          offers: matchedOffers,
          companies: matchedCompanies,
          recruiters: matchedRecruiters,
          services: matchedServices,
        });
        setLoading(false);
      }
    }

    performGlobalSearch();

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const totalResultsCount =
    results.offers.length +
    results.companies.length +
    results.recruiters.length +
    results.services.length;

  const handleSearchFormSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/recherche?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleCopyEmail = (email, e) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
      triggerToast(`Adresse e-mail copiée : ${email}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans pb-16">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 w-full">
        {/* Banner Hero avec barre de recherche globale */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-gray-900 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-globe text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2 relative z-10">
            Recherche Globale Multi-Sources
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">
            Résultats pour l'ensemble du site
          </h1>
          <p className="text-sm sm:text-base text-emerald-100 font-medium leading-relaxed max-w-2xl relative z-10 mb-6">
            Fouillez simultanément dans les offres d'emploi, les 77 entreprises de candidature spontanée, les recruteurs partenaires et tous nos services en un seul endroit.
          </p>

          {/* Formulaire de recherche dans la bannière */}
          <form onSubmit={handleSearchFormSubmit} className="relative max-w-xl z-10">
            <div className="relative flex items-center">
              <i className="fa-solid fa-search absolute left-4 text-gray-400 text-base"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tapez un mot-clé (ex: Pompiste, Total, IT, Juriste, Dakar...)"
                className="w-full pl-12 pr-28 py-3.5 bg-white text-gray-900 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-400 shadow-lg"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-sm"
              >
                Rechercher
              </button>
            </div>
          </form>
        </div>

        {/* Tabs de Filtres Multi-Sources */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 scrollbar-none">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-list-check"></i>
            Tous les résultats ({totalResultsCount})
          </button>

          <button
            onClick={() => setActiveTab("offers")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "offers"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-briefcase"></i>
            Offres d'emploi ({results.offers.length})
          </button>

          <button
            onClick={() => setActiveTab("companies")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "companies"
                ? "bg-amber-500 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-building"></i>
            Candidatures Spontanées ({results.companies.length})
          </button>

          <button
            onClick={() => setActiveTab("recruiters")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "recruiters"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-id-card"></i>
            Recruteurs ({results.recruiters.length})
          </button>

          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === "services"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-toolbox"></i>
            Services & Outils ({results.services.length})
          </button>
        </div>

        {/* État de chargement */}
        {loading && (
          <div className="py-20 text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-600 mb-3"></i>
            <p className="text-sm font-bold text-gray-500">Recherche dans toutes les bases de données...</p>
          </div>
        )}

        {/* Aucun résultat */}
        {!loading && totalResultsCount === 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Aucun résultat trouvé</h3>
            <p className="text-xs text-gray-500 mb-6">
              Aucune correspondance pour "{searchQuery}". Essayez avec d'autres termes comme "Conducteur", "Shell", "Comptabilité" ou "CV".
            </p>
            <Link
              href="/offres"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition inline-block"
            >
              Parcourir toutes les offres d'emploi
            </Link>
          </div>
        )}

        {/* AFFICHAGE DES RÉSULTATS DÉCOUPÉS PAR SECTIONS */}
        {!loading && totalResultsCount > 0 && (
          <div className="space-y-10">

            {/* SECTION 1: OFFRES D'EMPLOI */}
            {(activeTab === "all" || activeTab === "offers") && results.offers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-briefcase"></i>
                    </span>
                    Offres d'emploi ({results.offers.length})
                  </h2>
                  {activeTab === "all" && results.offers.length > 6 && (
                    <button
                      onClick={() => setActiveTab("offers")}
                      className="text-xs font-extrabold text-emerald-600 hover:underline"
                    >
                      Voir les {results.offers.length} offres →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(activeTab === "all" ? results.offers.slice(0, 6) : results.offers).map((offer) => (
                    <div
                      key={offer.id}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-6 group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                          {offer.contract_type || "CDI"}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-gray-900 mb-1 group-hover:text-emerald-700 transition-colors">
                        {offer.title}
                      </h3>
                      <p className="text-xs font-bold text-gray-500 mb-3">{offer.company || "Recruteur"}</p>

                      <p className="text-xs text-gray-600 line-clamp-2 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        {offer.description}
                      </p>

                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                        <Link
                          href={`/offres?id=${offer.id}`}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition text-center"
                        >
                          Détails
                        </Link>
                        <button
                          onClick={() => setApplyingOffer(offer)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs text-center"
                        >
                          Postuler
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 2: CANDIDATURES SPONTANÉES & ENTREPRISES */}
            {(activeTab === "all" || activeTab === "companies") && results.companies.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-building"></i>
                    </span>
                    Entreprises & Candidatures Spontanées ({results.companies.length})
                  </h2>
                  {activeTab === "all" && results.companies.length > 6 && (
                    <button
                      onClick={() => setActiveTab("companies")}
                      className="text-xs font-extrabold text-amber-600 hover:underline"
                    >
                      Voir les {results.companies.length} entreprises →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(activeTab === "all" ? results.companies.slice(0, 6) : results.companies).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/recrutement-spontane/${item.slug}`)}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-6 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                          {item.contract_type}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">
                          {item.contactType === "email" ? "Email Direct" : "Lien Web"}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold text-gray-900 mb-1 group-hover:text-amber-600 transition-colors">
                        {item.company}
                      </h3>
                      <p className="text-xs font-semibold text-gray-600 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100 line-clamp-2">
                        {item.domains}
                      </p>

                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-gray-700 truncate">
                          {item.rawContact}
                        </span>
                        {item.contactType === "email" && item.email ? (
                          <button
                            onClick={(e) => handleCopyEmail(item.email, e)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-extrabold rounded-xl transition"
                          >
                            Copier
                          </button>
                        ) : (
                          <a
                            href={item.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition"
                          >
                            Visiter
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 3: RECRUTEURS & MEMBRES */}
            {(activeTab === "all" || activeTab === "recruiters") && results.recruiters.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-id-card"></i>
                    </span>
                    Recruteurs & Partenaires ({results.recruiters.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.recruiters.map((recr) => (
                    <div
                      key={recr.id}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg">
                        {recr.full_name ? recr.full_name.charAt(0) : "R"}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900">{recr.full_name || recr.headline || "Recruteur vérifié"}</h4>
                        <p className="text-xs text-gray-500 font-medium">Recruteur vérifié Facilite</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 4: SERVICES & OUTILS DU SITE */}
            {(activeTab === "all" || activeTab === "services") && results.services.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-toolbox"></i>
                    </span>
                    Services & Outils du site ({results.services.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.services.map((srv) => (
                    <Link
                      key={srv.id}
                      href={srv.path}
                      className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all p-6 flex items-start gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        <i className={`fa-solid ${srv.icon}`}></i>
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                          {srv.title}
                        </h3>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                          {srv.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </main>

      {/* Modal de postulation */}
      <ApplyModal
        isOpen={!!applyingOffer}
        onClose={() => setApplyingOffer(null)}
        job={
          applyingOffer
            ? {
                id: applyingOffer.id,
                titleFR: applyingOffer.title,
                titleEN: applyingOffer.title,
                company: applyingOffer.company,
                isSpontaneous: applyingOffer.isSpontaneous,
              }
            : null
        }
        selectedLang="FR"
        triggerToast={triggerToast}
      />

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite. Moteur de Recherche Global.
      </footer>
    </div>
  );
}

export default function RecherchePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-600 mb-3"></i>
            <p className="text-sm font-bold text-gray-500">Chargement des résultats de recherche...</p>
          </div>
        </div>
      }
    >
      <RechercheContent />
    </Suspense>
  );
}
