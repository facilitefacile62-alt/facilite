"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Liste des entreprises pour le recrutement journalier / dépôt physique
const companiesList = [
  // --- GRANDS RÉSEAUX PÉTROLIERS & STATIONS-SERVICES ---
  {
    id: "totalenergies-senegal-siege",
    company_name: "TotalEnergies Sénégal (Siège Bel-Air)",
    location: "Route des Hydrocarbures, Bel-Air, BP 355, Dakar",
    phone: "+221338390139",
    website: "https://totalenergies.sn",
    category: "Stations & Énergie",
    activityFR: "Réseau de stations-services, Carburants & Dépôt physique",
    activityEN: "Gas stations network, Fuels & Physical drop-off",
    icon: "fa-gas-pump",
    logoColor: "bg-red-600"
  },
  {
    id: "vivoenergy-shell-senegal",
    company_name: "Vivo Energy Sénégal (Réseau Shell)",
    location: "Route des Hydrocarbures, Bel-Air, BP 144, Dakar",
    phone: "+221338293000",
    website: "https://www.vivoenergy.com",
    category: "Stations & Énergie",
    activityFR: "Réseau Shell, Distribution carburants & Dépôt sur place",
    activityEN: "Shell Network, Fuel distribution & On-site drop-off",
    icon: "fa-gas-pump",
    logoColor: "bg-amber-500"
  },
  {
    id: "ola-energy-senegal-siege",
    company_name: "OLA Energy Sénégal (Ex-Oilibya)",
    location: "Route des Hydrocarbures, Bel-Air, Dakar",
    phone: "+221338592929",
    website: "https://olaenergy.com",
    category: "Stations & Énergie",
    activityFR: "Réseau de stations, Lubrifiants & Dépôt de dossier",
    activityEN: "Gas stations network, Lubricants & Application drop-off",
    icon: "fa-gas-pump",
    logoColor: "bg-blue-600"
  },
  {
    id: "puma-energy-senegal-siege",
    company_name: "Puma Energy Sénégal",
    location: "Route des Hydrocarbures, Bel-Air, Dakar",
    phone: "+221338399999",
    website: "https://pumaenergy.com",
    category: "Stations & Énergie",
    activityFR: "Stockage, Lubrifiants & Réseau de distribution",
    activityEN: "Storage, Lubricants & Distribution network",
    icon: "fa-gas-pump",
    logoColor: "bg-emerald-600"
  },
  {
    id: "oryx-energies-senegal-siege",
    company_name: "Oryx Energies Sénégal",
    location: "Route des Hydrocarbures, Bel-Air, BP 224, Dakar",
    phone: "+221338398888",
    website: "https://oryxenergies.com",
    category: "Stations & Énergie",
    activityFR: "Pétrole, Gaz de pétrole liquéfié & Réseau stations",
    activityEN: "Oil, LPG & Gas station network",
    icon: "fa-gas-pump",
    logoColor: "bg-red-700"
  },
  {
    id: "petrosen-trading",
    company_name: "Petrosen (Trading & Services)",
    location: "Route du Service Géographique, Hann, Dakar",
    phone: "+221338399298",
    website: "https://petrosen.sn",
    category: "Stations & Énergie",
    activityFR: "Société des Pétroles du Sénégal (Trading & Stations)",
    activityEN: "Senegal Oil Company (Trading & Gas Stations)",
    icon: "fa-building-flag",
    logoColor: "bg-green-700"
  },
  {
    id: "elton-oil-company-siege",
    company_name: "ELTON Oil Company (Siège)",
    location: "Route de l'Aéroport, Carrefour Ngor Virage, Dakar",
    phone: "+221338690101",
    website: "https://elton.sn",
    category: "Stations & Énergie",
    activityFR: "Réseau national de stations-services & Siège social",
    activityEN: "National gas stations network & Headquarters",
    icon: "fa-gas-pump",
    logoColor: "bg-sky-600"
  },
  {
    id: "edk-oil-mermoz",
    company_name: "EDK Oil (Groupe EDK Siège)",
    location: "Ancienne Piste, Mermoz / Ouakam, Dakar",
    phone: "+221338606262",
    category: "Stations & Énergie",
    activityFR: "Stations-services, Supermarché Low Price & Restauration",
    activityEN: "Gas stations, Low Price supermarket & Fast food",
    icon: "fa-gas-pump",
    logoColor: "bg-purple-600"
  },
  {
    id: "star-oil-senegal-almadies",
    company_name: "Star Oil Sénégal (Siège Almadies)",
    location: "Route de Ngor, Les Almadies, Dakar",
    phone: "+221338696969",
    website: "https://staroilgroup.com",
    category: "Stations & Énergie",
    activityFR: "Exploitation pétrolière & Réseau stations-services",
    activityEN: "Oil operations & Gas stations network",
    icon: "fa-gas-pump",
    logoColor: "bg-indigo-600"
  },
  {
    id: "eydon-petroleum-almadies",
    company_name: "Eydon Petroleum (Siège)",
    location: "Les Almadies, Zone 14, Dakar",
    phone: "+221338683333",
    website: "https://eydonpetroleum.com",
    category: "Stations & Énergie",
    activityFR: "Distribution carburants & Stations-services",
    activityEN: "Fuel distribution & Gas stations",
    icon: "fa-gas-pump",
    logoColor: "bg-teal-600"
  },
  {
    id: "sgf-serigne-gueye",
    company_name: "SGF (Sérigne Gueye et Fils)",
    location: "Km 11, Route de Rufisque, Thiaroye / Dakar",
    phone: "+221338340826",
    category: "Stations & Énergie",
    activityFR: "Réseau de stations-services & Pompistes",
    activityEN: "Gas stations network & Pump attendants",
    icon: "fa-gas-pump",
    logoColor: "bg-slate-700"
  },
  {
    id: "ciel-oil-dakar",
    company_name: "Ciel Oil (Direction Générale)",
    location: "Route de Rufisque / Hann Maristes, Dakar",
    phone: "+221338329999",
    category: "Stations & Énergie",
    activityFR: "Distribution pétrolière & Dépôt de candidature",
    activityEN: "Petroleum distribution & Physical application",
    icon: "fa-gas-pump",
    logoColor: "bg-cyan-600"
  },
  {
    id: "maack-mka-excellence",
    company_name: "Maack Petroleum / MKA Excellence",
    location: "Yoff / Route de l'Aéroport, Dakar",
    phone: "+221338688249",
    website: "https://mkaexcellence.com",
    category: "Stations & Énergie",
    activityFR: "Stations-services, Lavage, Vidange & Restauration",
    activityEN: "Gas stations, Car wash, Oil change & Restaurant",
    icon: "fa-gas-pump",
    logoColor: "bg-orange-600"
  },
  {
    id: "touba-clean-delta-oil",
    company_name: "Touba Oil, Clean Oil & Delta Oil",
    location: "Sièges logistiques : Pikine, Guédiawaye, Route de Rufisque, Dakar",
    phone: "+221338798716",
    category: "Stations & Énergie",
    activityFR: "Réseaux locaux de stations (Dépôts sur place & gérants)",
    activityEN: "Local gas station networks (In-person drop-off)",
    icon: "fa-gas-pump",
    logoColor: "bg-yellow-600"
  },

  // --- ENTREPRISES INDUSTRIELLES & FABRICATION ---
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
    company_name: "SIVOP SENEGAL (SOCIETE IVOIRIENNE DE PARFUMERIE DU SENEGAL)",
    location: "Autoroute prolongée, en face de SDE Pikine, BP 3313, Dakar - Sénégal",
    phone: "+221338798585",
    fax: "+221338546400",
    website: "https://www.sivop.com",
    category: "Cosmétique",
    activityFR: "Produits cosmétiques & Parfumerie (Recrutement sur place)",
    activityEN: "Cosmetics & Perfumery (On-site Recruitment)",
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
    subtitle: "Ce répertoire liste les entreprises industrielles et réseaux de stations recrutant des journaliers et agents de piste à Dakar. Les candidatures se font par dépôt physique de dossier ou contact direct.",
    searchPlaceholder: "Rechercher une entreprise, une station ou une adresse (Total, Shell, EDK, Bel-Air...)",
    noResults: "Aucune entreprise ne correspond à votre recherche.",
    locationLabel: "Adresse de dépôt",
    phoneLabel: "Téléphone",
    phoneNotListed: "Non répertorié",
    categoryLabel: "Secteur",
    depositTypeLabel: "Dépôt Physique & Contact Direct",
    callBtn: "Appeler",
    mapsBtn: "Itinéraire Google Maps",
    filterAll: "Tous les secteurs",
    depositInstruction: "Présentez-vous directement à l'adresse indiquée ci-dessous avec votre dossier de candidature physique.",
    viewOnlineSpontaneousBtn: "Voir le recrutement spontané en ligne",
    onlineRecruitmentTip: "Vous cherchez plutôt des candidatures spontanées en ligne (SETER, SOBOA, etc.) ?",
    sectors: {
      "Stations & Énergie": "Stations & Énergie",
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
    tagline: "Find daily worker and station jobs in Dakar by applying in person directly.",
    subtitle: "This directory lists manufacturing companies and gas station networks recruiting in Dakar. Applications can be dropped off physically.",
    searchPlaceholder: "Search for a company, station or address (Total, Shell, EDK, Bel-Air...)",
    noResults: "No companies match your search.",
    locationLabel: "Drop-off Address",
    phoneLabel: "Phone Number",
    phoneNotListed: "Not listed",
    categoryLabel: "Sector",
    depositTypeLabel: "In-Person Drop-off & Direct Contact",
    callBtn: "Call",
    mapsBtn: "Google Maps Directions",
    filterAll: "All Sectors",
    depositInstruction: "Please present yourself directly at the address below with your physical application file.",
    viewOnlineSpontaneousBtn: "See online spontaneous recruitment",
    onlineRecruitmentTip: "Looking for online spontaneous applications (SETER, SOBOA, etc.) instead?",
    sectors: {
      "Stations & Énergie": "Gas Stations & Energy",
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
    <div className="min-h-screen flex flex-col bg-[#FAF6F1] selection:bg-emerald-200 selection:text-emerald-900 font-sans pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 w-full">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-amber-800 via-orange-900 to-amber-950 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-gas-pump text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-amber-300 uppercase tracking-widest block mb-2 relative z-10">
            Dépôts Physiques & Réseaux de Stations
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">
            {t.title}
          </h1>
          <p className="text-base text-amber-100 font-medium leading-relaxed max-w-2xl relative z-10">
            {t.subtitle}
          </p>
        </div>

        {/* Tip banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-laptop-code"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{t.onlineRecruitmentTip}</p>
              <p className="text-xs font-semibold text-gray-500">
                Consultez notre répertoire de 77 entreprises proposant des formulaires et emails directs.
              </p>
            </div>
          </div>
          <Link
            href="/recrutement-spontane"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs text-center whitespace-nowrap"
          >
            <i className="fa-solid fa-paper-plane mr-1.5"></i> {t.viewOnlineSpontaneousBtn}
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat === "All" ? t.filterAll : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Company Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-6"
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl ${company.logoColor} text-white flex items-center justify-center text-xl shadow-md`}
                >
                  <i className={`fa-solid ${company.icon}`}></i>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black rounded-full uppercase tracking-wider">
                  {company.category}
                </span>
              </div>

              <h2 className="text-xl font-extrabold text-gray-900 mb-2">
                {company.company_name}
              </h2>

              <p className="text-xs font-semibold text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed">
                {selectedLang === "FR" ? company.activityFR : company.activityEN}
              </p>

              <div className="space-y-2 mb-6 text-xs">
                <div className="flex items-start gap-2 text-gray-700">
                  <i className="fa-solid fa-location-dot text-amber-600 mt-0.5"></i>
                  <div>
                    <span className="font-bold block text-gray-400 uppercase text-[10px]">
                      {t.locationLabel} :
                    </span>
                    <span className="font-semibold">{company.location}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <i className="fa-solid fa-phone text-amber-600"></i>
                  <div>
                    <span className="font-bold block text-gray-400 uppercase text-[10px]">
                      {t.phoneLabel} :
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                      {company.phone || t.phoneNotListed}
                    </span>
                  </div>
                </div>

                {company.website && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <i className="fa-solid fa-globe text-amber-600"></i>
                    <div>
                      <span className="font-bold block text-gray-400 uppercase text-[10px]">
                        Site officiel :
                      </span>
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 hover:underline truncate block"
                      >
                        {company.website.replace("https://", "")}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-100">
                {company.phone ? (
                  <a
                    href={`tel:${company.phone}`}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-phone"></i>
                    {t.callBtn}
                  </a>
                ) : null}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${company.company_name} ${company.location}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition text-center shadow-xs flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-map-location-dot"></i>
                  {t.mapsBtn}
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm font-medium text-gray-500">
        © 2026 Facilite. Tous droits réservés.
      </footer>
    </div>
  );
}
