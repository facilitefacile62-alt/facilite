"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Liste des entreprises pour le recrutement journalier / dépôt physique
const companiesList = [
  {
    id: "madar",
    company_name: "H&D INDUSTRIE S.A - Madar",
    location: "Km 22, Route de Rufisque, Dakar",
    phone: "+221338700190",
    category: "Industrie",
    activityFR: "Produits d'entretien & Détergents",
    activityEN: "Cleaning Products & Detergents",
    icon: "fa-industry",
    logoColor: "bg-blue-600"
  },
  {
    id: "gandour",
    company_name: "Nouvelle Parfumerie Gandour Sénégal",
    location: "Km 7,5 Boulevard du Centenaire, Dakar",
    phone: "+221338321854",
    category: "Cosmétique",
    activityFR: "Parfumerie & Cosmétique",
    activityEN: "Perfume & Cosmetics",
    icon: "fa-spray-can-sparkles",
    logoColor: "bg-pink-600"
  },
  {
    id: "sivop",
    company_name: "SIVOP Parfums Cosmétique",
    location: "Autoroute prolongée en face SDE, Pikine",
    phone: "+221338798585",
    category: "Cosmétique",
    activityFR: "Cosmétique & Soins",
    activityEN: "Cosmetics & Body Care",
    icon: "fa-bottle-droplet",
    logoColor: "bg-purple-600"
  },
  {
    id: "uniparco",
    company_name: "Uniparco",
    location: "Zone Industrielle, Dakar",
    phone: "+221338320744",
    category: "Fabrication",
    activityFR: "Fabrication & Cosmétique",
    activityEN: "Manufacturing & Cosmetics",
    icon: "fa-gears",
    logoColor: "bg-indigo-600"
  },
  {
    id: "secos",
    company_name: "SECOS INDUSTRIES",
    location: "3945 Dakar",
    phone: "+221771771818",
    category: "Industrie",
    activityFR: "Industrie Plastique & Emballages",
    activityEN: "Plastic Industry & Packaging",
    icon: "fa-box-open",
    logoColor: "bg-amber-600"
  },
  {
    id: "seneouest",
    company_name: "SENEOUEST",
    location: "Zone de Captage / Hann, Dakar",
    phone: "+221776035353",
    category: "Agroalimentaire",
    activityFR: "Agroalimentaire & Transformation",
    activityEN: "Agri-food & Food Processing",
    icon: "fa-wheat-awn",
    logoColor: "bg-emerald-600"
  },
  {
    id: "oleosen",
    company_name: "OLEOSEN",
    location: "Rue 4, Dakar",
    phone: "+221338596070",
    category: "Agroalimentaire",
    activityFR: "Agroalimentaire (Huilerie)",
    activityEN: "Agri-food (Oil Mills)",
    icon: "fa-droplet",
    logoColor: "bg-teal-600"
  },
  {
    id: "valdafrique",
    company_name: "Valdafrique",
    location: "Route de Rufisque, Dakar",
    phone: "+221338398780",
    category: "Pharmaceutique",
    activityFR: "Pharmaceutique & Confiserie",
    activityEN: "Pharmaceuticals & Confectionery",
    icon: "fa-prescription-bottle-medical",
    logoColor: "bg-red-600"
  },
  {
    id: "bioessence",
    company_name: "Laboratoires Bioessence",
    location: "15 Rue 15, Dakar",
    phone: "+221338647341",
    category: "Cosmétique",
    activityFR: "Cosmétique naturelle & Huiles",
    activityEN: "Natural Cosmetics & Essential Oils",
    icon: "fa-leaf",
    logoColor: "bg-green-600"
  },
  {
    id: "biopharma",
    company_name: "Bio Pharma Senegal",
    location: "Dakar",
    phone: "+221707611334",
    category: "Pharmaceutique",
    activityFR: "Pharmaceutique & Cosmétique",
    activityEN: "Pharmaceuticals & Cosmetics",
    icon: "fa-heart-pulse",
    logoColor: "bg-rose-600"
  },
  {
    id: "socosen",
    company_name: "Socosen",
    location: "46 Rue Mousse Diop, Dakar",
    phone: null,
    category: "Industrie",
    activityFR: "Commerce & Industrie",
    activityEN: "Commerce & Industry",
    icon: "fa-dolly",
    logoColor: "bg-slate-600"
  },
  {
    id: "zena",
    company_name: "Zena Exotic Fruits SA",
    location: "Route de Rufisque, Dakar",
    phone: "+221338216999",
    category: "Agroalimentaire",
    activityFR: "Agroalimentaire (Jus & Confitures)",
    activityEN: "Agri-food (Juice & Jams)",
    icon: "fa-apple-whole",
    logoColor: "bg-orange-600"
  }
];

const translations = {
  FR: {
    navHome: "Accueil",
    navBack: "Retour",
    title: "Recrutement Journalier & Dépôts Physiques",
    tagline: "Trouvez un emploi de journalier à Dakar en postulant directement en personne.",
    subtitle: "Ce répertoire liste les entreprises industrielles et de production recrutant des journaliers à Dakar. Les candidatures se font exclusivement par dépôt physique de dossier.",
    searchPlaceholder: "Rechercher une entreprise ou une adresse...",
    noResults: "Aucune entreprise ne correspond à votre recherche.",
    locationLabel: "Adresse de dépôt",
    phoneLabel: "Téléphone",
    phoneNotListed: "Non répertorié",
    categoryLabel: "Secteur",
    depositTypeLabel: "Dépôt Physique Uniquement",
    callBtn: "Appeler",
    mapsBtn: "Itinéraire Google Maps",
    filterAll: "Tous les secteurs",
    depositInstruction: "Présentez-vous directement à l'adresse indiquée ci-dessous avec votre dossier de candidature physique.",
    viewOnlineSpontaneousBtn: "Voir le recrutement spontané en ligne",
    onlineRecruitmentTip: "Vous cherchez plutôt des candidatures spontanées en ligne (SETER, SOBOA, etc.) ?",
    sectors: {
      Industrie: "Industrie",
      Cosmétique: "Cosmétique",
      Fabrication: "Fabrication",
      Agroalimentaire: "Agroalimentaire",
      Pharmaceutique: "Pharmaceutique"
    }
  },
  GB: {
    navHome: "Home",
    navBack: "Back",
    title: "Daily Workers & In-Person Applications",
    tagline: "Find daily worker jobs in Dakar by applying in person directly.",
    subtitle: "This directory lists manufacturing and production companies recruiting daily workers in Dakar. Applications must be dropped off physically.",
    searchPlaceholder: "Search for a company or address...",
    noResults: "No companies match your search.",
    locationLabel: "Drop-off Address",
    phoneLabel: "Phone Number",
    phoneNotListed: "Not listed",
    categoryLabel: "Sector",
    depositTypeLabel: "In-Person Drop-off Only",
    callBtn: "Call",
    mapsBtn: "Google Maps Directions",
    filterAll: "All Sectors",
    depositInstruction: "Please present yourself directly at the address below with your physical application file.",
    viewOnlineSpontaneousBtn: "See online spontaneous recruitment",
    onlineRecruitmentTip: "Looking for online spontaneous applications (SETER, SOBOA, etc.) instead?",
    sectors: {
      Industry: "Industry",
      Cosmétique: "Cosmetics",
      Fabrication: "Manufacturing",
      Agroalimentaire: "Agri-food",
      Pharmaceutique: "Pharmaceuticals"
    }
  }
};

export default function RecrutementJournalierPage() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState("FR");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lang");
      if (saved) {
        setSelectedLang(saved);
      }
    }
  }, []);

  const t = translations[selectedLang] || translations.FR;

  const categories = useMemo(() => {
    const list = new Set(companiesList.map((c) => c.category));
    return ["All", ...Array.from(list)];
  }, []);

  const filteredCompanies = useMemo(() => {
    return companiesList.filter((company) => {
      const matchesSearch =
        company.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (selectedLang === "FR" ? company.activityFR : company.activityEN)
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || company.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, selectedLang]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F1] selection:bg-emerald-200 selection:text-emerald-900 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition"
            >
              <i className="fa-solid fa-house mr-1.5"></i> {t.navHome}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 flex-1 w-full">
        
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-person-digging text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2 relative z-10">
            {t.tagline}
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">
            {t.title}
          </h1>
          <p className="text-base text-emerald-100 font-medium leading-relaxed max-w-3xl relative z-10">
            {t.subtitle}
          </p>
        </div>

        {/* Tip / Sp spontaneous Recruitment Link */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-circle-info"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{t.onlineRecruitmentTip}</p>
              <p className="text-xs font-semibold text-gray-500">
                {selectedLang === "FR" 
                  ? "Envoyez plutôt vos fichiers en ligne pour les grandes entreprises." 
                  : "Send your files online instead for large companies."}
              </p>
            </div>
          </div>
          <Link
            href="/recrutement-spontane"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs text-center whitespace-nowrap"
          >
            <i className="fa-solid fa-user-tie mr-1.5"></i> {t.viewOnlineSpontaneousBtn}
          </Link>
        </div>

        {/* Search & Filters Controls */}
        <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-6 mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            {/* Input Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            {/* Pill Filters */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {categories.map((category) => {
                const label = category === "All" ? t.filterAll : (t.sectors[category] || category);
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-tight transition cursor-pointer select-none whitespace-nowrap border ${
                      isActive 
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" 
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Directory Grid */}
        {filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-2xl mx-auto mb-4">
              <i className="fa-solid fa-building-circle-exclamation"></i>
            </div>
            <p className="text-gray-600 font-extrabold text-base mb-1">{t.noResults}</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("All");
              }}
              className="text-emerald-600 hover:underline text-sm font-bold mt-2"
            >
              {selectedLang === "FR" ? "Réinitialiser les filtres" : "Reset filters"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.company_name + " " + company.location)}`;
              const activityLabel = selectedLang === "FR" ? company.activityFR : company.activityEN;
              const sectorLabel = t.sectors[company.category] || company.category;
              
              return (
                <div
                  key={company.id}
                  className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group"
                >
                  {/* Top Bar with Icon & Badges */}
                  <div className="p-6 pb-0 flex items-start justify-between gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${company.logoColor} text-white flex items-center justify-center text-xl shadow-xs`}>
                      <i className={`fa-solid ${company.icon}`}></i>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {sectorLabel}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                        <i className="fa-solid fa-walkie-talkie text-[8px]"></i>
                        {t.depositTypeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <h2 className="font-extrabold text-gray-900 text-lg group-hover:text-emerald-700 transition duration-300 mb-1">
                      {company.company_name}
                    </h2>
                    <p className="text-xs text-gray-500 font-semibold mb-4">
                      {activityLabel}
                    </p>
                    
                    {/* Location */}
                    <div className="mb-4">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                        {t.locationLabel}
                      </p>
                      <p className="text-sm font-semibold text-gray-700 flex items-start gap-2">
                        <i className="fa-solid fa-location-dot text-gray-400 mt-0.5"></i>
                        <span>{company.location}</span>
                      </p>
                    </div>

                    {/* Phone */}
                    <div className="mb-6">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                        {t.phoneLabel}
                      </p>
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <i className="fa-solid fa-phone text-gray-400"></i>
                        <span>{company.phone || t.phoneNotListed}</span>
                      </p>
                    </div>

                    {/* Instructions Alert */}
                    <div className="mt-auto bg-gray-50 border border-gray-100 rounded-2xl p-3.5 flex items-start gap-2.5">
                      <i className="fa-solid fa-hand-holding-hand text-emerald-600 mt-0.5 text-sm"></i>
                      <p className="text-[11px] leading-normal text-gray-600 font-semibold">
                        {t.depositInstruction}
                      </p>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="px-6 pb-6 pt-0 flex gap-3 border-t border-gray-50 mt-4">
                    {company.phone && (
                      <a
                        href={`tel:${company.phone}`}
                        className="flex-1 py-3 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 border border-transparent hover:border-emerald-200"
                      >
                        <i className="fa-solid fa-phone-flip"></i>
                        {t.callBtn}
                      </a>
                    )}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <i className="fa-solid fa-map-location-dot"></i>
                      {t.mapsBtn}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm font-medium text-gray-500">
        © 2026 Facilite. Tous droits réservés.
      </footer>
    </div>
  );
}
