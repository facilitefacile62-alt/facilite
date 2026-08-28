"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApplyModal from "@/components/ApplyModal";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";

export default function RecrutementSpontanePage() {
  const router = useRouter();
  const [applyingOffer, setApplyingOffer] = useState(null);
  // Stabilise la référence de job passé à ApplyModal — voir
  // OffreApplySection.jsx pour l'explication complète du bug.
  const stableApplyingJob = useMemo(() => {
    if (!applyingOffer) return null;
    return {
      id: applyingOffer.id,
      titleFR: applyingOffer.title,
      titleEN: applyingOffer.title,
      company: applyingOffer.company,
      isSpontaneous: true,
    };
  }, [applyingOffer?.id, applyingOffer?.title, applyingOffer?.company]);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all"); // 'all', 'stations', 'transport', 'banque', 'distribution'

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApplyClick = (offer) => {
    setApplyingOffer(offer);
  };

  const handleCopyEmail = (email, e) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(email);
      triggerToast(`Adresse e-mail copiée : ${email}`);
    }
  };

  // Helper pour vérifier si une entreprise appartient aux stations-services & hydrocarbures
  const isStationCompany = (item) => {
    const text = `${item.company} ${item.domains} ${(item.poles || []).join(" ")} ${item.description}`.toLowerCase();
    return (
      text.includes("station") ||
      text.includes("pétrole") ||
      text.includes("petroleum") ||
      text.includes("hydrocarbure") ||
      text.includes("pompiste") ||
      text.includes("carburant") ||
      text.includes("oil") ||
      text.includes("shell") ||
      text.includes("totalenergies") ||
      text.includes("elton") ||
      text.includes("star oil") ||
      text.includes("ola energy") ||
      text.includes("puma energy") ||
      text.includes("touba oil") ||
      text.includes("clean oil") ||
      text.includes("eydon") ||
      text.includes("mka excellence") ||
      text.includes("sgfp")
    );
  };

  const isHotelCompany = (item) => {
    const text = `${item.company} ${item.domains} ${(item.poles || []).join(" ")} ${item.description}`.toLowerCase();
    return (
      text.includes("hotel") ||
      text.includes("hôtel") ||
      text.includes("resort") ||
      text.includes("lodge") ||
      text.includes("tourisme") ||
      text.includes("hôtellerie") ||
      text.includes("hébergement") ||
      text.includes("palace") ||
      text.includes("club med") ||
      text.includes("spa")
    );
  };

  const filteredCompanies = SPONTANEOUS_COMPANIES.filter((item) => {
    // Filtrage par catégorie
    if (activeCategory === "stations" && !isStationCompany(item)) return false;
    if (activeCategory === "hotels" && !isHotelCompany(item)) return false;
    if (activeCategory === "transport") {
      const text = `${item.company} ${item.domains}`.toLowerCase();
      if (!text.includes("transport") && !text.includes("brt") && !text.includes("seter") && !text.includes("dem dikk") && !text.includes("logistique") && !text.includes("pêche") && !text.includes("aéronautique") && !text.includes("air")) return false;
    }
    if (activeCategory === "banque") {
      const text = `${item.company} ${item.domains}`.toLowerCase();
      if (!text.includes("banque") && !text.includes("bank") && !text.includes("finance") && !text.includes("assurances") && !text.includes("microfinance") && !text.includes("boad")) return false;
    }
    if (activeCategory === "distribution") {
      const text = `${item.company} ${item.domains}`.toLowerCase();
      if (!text.includes("auchan") && !text.includes("supeco") && !text.includes("mall") && !text.includes("bazar") && !text.includes("restauration") && !text.includes("cuisine") && !text.includes("djolof")) return false;
    }

    // Filtrage par terme de recherche
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      item.company.toLowerCase().includes(q) ||
      item.domains.toLowerCase().includes(q) ||
      item.rawContact.toLowerCase().includes(q)
    );
  });

  const stationCount = SPONTANEOUS_COMPANIES.filter(isStationCompany).length;
  const hotelCount = SPONTANEOUS_COMPANIES.filter(isHotelCompany).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 selection:bg-emerald-200 selection:text-emerald-900 font-sans">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 w-full">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-paper-plane text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2 relative z-10">
            Candidatures Spontanées
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">
            Répertoire Officiel des Entreprises
          </h1>
          <p className="text-base text-emerald-100 font-medium leading-relaxed max-w-2xl relative z-10">
            Envoyez votre profil directement aux entreprises partenaires pour de futures opportunités. Retrouvez la liste complète des canaux et contacts de recrutement direct au Sénégal.
          </p>
        </div>

        {/* Info Banner for Daily Workers */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-person-digging"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Vous recherchez plutôt des emplois de journalier ?</p>
              <p className="text-xs font-semibold text-gray-500">
                Découvrez notre répertoire d'entreprises acceptant les candidatures physiques en personne à Dakar.
              </p>
            </div>
          </div>
          <Link
            href="/recrutement-journalier"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs text-center whitespace-nowrap"
          >
            <i className="fa-solid fa-map-location-dot mr-1.5"></i> Voir les dépôts physiques
          </Link>
        </div>

        {/* SINGLE TOUCH FILTER BUTTONS (Filtres Rapides par Catégorie) */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
              activeCategory === "all"
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-grid-2"></i>
            Toutes les entreprises ({SPONTANEOUS_COMPANIES.length})
          </button>

          {/* LA TOUCHE UNIQUE DÉDIÉE AUX STATIONS-SERVICES */}
          <button
            onClick={() => setActiveCategory("stations")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 border ${
              activeCategory === "stations"
                ? "bg-amber-500 text-white border-amber-600 shadow-lg scale-105"
                : "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-300 hover:border-amber-500 hover:shadow-md"
            }`}
          >
            <span className="text-base">⛽</span>
            <span>Stations-Services</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeCategory === "stations" ? "bg-white text-amber-700" : "bg-amber-200 text-amber-900"
            }`}>
              {stationCount}
            </span>
          </button>

          {/* LA TOUCHE DÉDIÉE AUX HÔTELS & RESORTS */}
          <button
            onClick={() => setActiveCategory("hotels")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 border ${
              activeCategory === "hotels"
                ? "bg-purple-600 text-white border-purple-700 shadow-lg scale-105"
                : "bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-900 border-purple-300 hover:border-purple-500 hover:shadow-md"
            }`}
          >
            <span className="text-base">🏨</span>
            <span>Hôtellerie & Tourisme</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeCategory === "hotels" ? "bg-white text-purple-700" : "bg-purple-200 text-purple-900"
            }`}>
              {hotelCount}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory("transport")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
              activeCategory === "transport"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-bus"></i>
            Transport & Logistique
          </button>

          <button
            onClick={() => setActiveCategory("banque")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
              activeCategory === "banque"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-building-columns"></i>
            Banque & Finance
          </button>

          <button
            onClick={() => setActiveCategory("distribution")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
              activeCategory === "distribution"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            <i className="fa-solid fa-cart-shopping"></i>
            Distribution & Restauration
          </button>
        </div>

        {/* Search & Counter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="relative w-full sm:w-96">
            <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Rechercher une entreprise ou un domaine (Pompiste, Total, Shell, EDK...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {filteredCompanies.length} / {SPONTANEOUS_COMPANIES.length} Entreprises répertoriées
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push(`/recrutement-spontane/${item.slug}`)}
              className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
            >
              {/* Emplacement Carré pour Image (Square Image Container) */}
              <div className="relative w-full aspect-square bg-gradient-to-br from-emerald-50 via-teal-50 to-gray-100 overflow-hidden border-b border-gray-100 flex flex-col items-center justify-center p-6 text-center group-hover:bg-emerald-100/40 transition-colors">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.company}
                    className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 shadow-md flex items-center justify-center mb-3 text-emerald-600 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      {isStationCompany(item) ? (
                        <i className="fa-solid fa-gas-pump text-3xl text-amber-600"></i>
                      ) : (
                        <i className="fa-solid fa-building text-3xl"></i>
                      )}
                    </div>
                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full mb-1">
                      {item.company}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">
                      <i className="fa-solid fa-image mr-1 text-emerald-400"></i>
                      Zone Image Carrée
                    </span>
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-200 text-[10px] font-extrabold text-gray-600 shadow-xs">
                  {item.contactType === "email" ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <i className="fa-solid fa-envelope"></i> Email Direct
                    </span>
                  ) : (
                    <span className="text-blue-700 flex items-center gap-1">
                      <i className="fa-solid fa-globe"></i> Lien Web
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    {item.contract_type}
                  </span>
                  {isStationCompany(item) && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                      ⛽ Station-Service
                    </span>
                  )}
                </div>

                <h2 className="font-extrabold text-gray-900 text-xl mb-1 group-hover:text-emerald-700 transition-colors">
                  {item.company}
                </h2>

                <div className="mb-3">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    Domaines & Postes :
                  </p>
                  <p className="text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-100 p-2.5 rounded-xl leading-snug">
                    {item.domains}
                  </p>
                </div>

                {item.documentsRequired && (
                  <div className="mb-3">
                    <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider block mb-0.5">
                      <i className="fa-solid fa-file-lines mr-1 text-emerald-500"></i> Documents requis :
                    </span>
                    <span className="text-xs font-semibold text-gray-600">
                      {item.documentsRequired}
                    </span>
                  </div>
                )}

                {/* Direct Contact Info */}
                <div className="mb-4 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block mb-0.5">
                    Canal de Candidature Direct :
                  </span>
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <span className="text-xs font-mono font-bold text-gray-800 truncate selection:bg-emerald-300">
                      {item.rawContact}
                    </span>
                    {item.contactType === "email" && item.email && (
                      <button
                        onClick={(e) => handleCopyEmail(item.email, e)}
                        title="Copier l'e-mail"
                        className="p-1.5 text-emerald-700 hover:bg-emerald-200/60 rounded-lg transition"
                      >
                        <i className="fa-regular fa-copy text-xs"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 w-full mt-auto">
                  {item.contactType === "url" ? (
                    <a
                      href={item.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-external-link-alt"></i>
                      Postuler sur le site officiel
                    </a>
                  ) : (
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${item.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-paper-plane"></i>
                        Envoyer Email
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyClick({
                            id: item.id,
                            title: `Candidature Spontanée - ${item.company}`,
                            company: item.company,
                            isSpontaneous: true,
                          });
                        }}
                        className="px-3 py-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-extrabold text-xs rounded-xl transition cursor-pointer"
                        title="Formulaire rapide"
                      >
                        <i className="fa-solid fa-bolt"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Apply Modal */}
      <ApplyModal
        isOpen={!!applyingOffer}
        onClose={() => setApplyingOffer(null)}
        job={stableApplyingJob}
        selectedLang="FR"
        triggerToast={triggerToast}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm font-medium text-gray-500">
        © 2026 Facilité. Tous droits réservés.
      </footer>
    </div>
  );
}
