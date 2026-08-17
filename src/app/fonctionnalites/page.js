"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SIDEBAR_ITEMS = [
  {
    id: "extracteur",
    name: "Extracteur 1-Click",
    tag: "Outil IA",
    tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    icon: "fa-solid fa-bolt",
    iconColor: "text-amber-500 bg-amber-50 dark:bg-amber-950/60",
    link: "/candidat/extracteur",
    shortDesc: "Postulez en 1 clic depuis une affiche ou capture d'offre",
    fullDesc: "Téléversez une image ou affiche d'emploi. L'intelligence artificielle extrait instantanément le titre du poste, l'entreprise et l'adresse email RH pour générer votre candidature clé en main.",
    actionLabel: "Ouvrir l'Extracteur 1-Click",
    highlights: [
      "Reconnaissance optique de caractères (OCR) instantanée",
      "Extraction automatique de l'adresse email et du téléphone RH",
      "Pré-remplissage automatique du formulaire de candidature",
      "Rédaction assistée de votre lettre de motivation"
    ]
  },
  {
    id: "boite-a-idees",
    name: "Boîte à idées",
    tag: "Communauté",
    tagColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    icon: "fa-solid fa-lightbulb",
    iconColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/60",
    link: "/boite-a-idees",
    shortDesc: "Suggestions, votes et innovations partagées",
    fullDesc: "Espace d'échange et d'innovation collective. Proposez de nouvelles idées pour améliorer Facilité, votez pour les meilleures fonctionnalités et suivez en direct leur déploiement.",
    actionLabel: "Accéder à la Boîte à idées",
    highlights: [
      "Dépôt d'idées libre et accessible à tous les membres",
      "Système de vote et d'appréciation en direct",
      "Suivi de l'état des suggestions (En étude, En cours, Validé)",
      "Transparence totale sur l'évolution de la plateforme"
    ]
  },
  {
    id: "services-modeles",
    name: "Services & Modèles",
    tag: "Catalogue",
    tagColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    icon: "fa-solid fa-briefcase",
    iconColor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60",
    link: "/service",
    shortDesc: "CVs Professionnels, Canada, Anglais & Lettres",
    fullDesc: "Catalogue complet de modèles de CV et lettres de motivation professionnels, conformes aux exigences ATS et adaptés aux standards nationaux et internationaux.",
    actionLabel: "Voir les Services & Modèles",
    highlights: [
      "Modèles adaptés au format Sénégal, UEMOA, Canada & Anglais",
      "Conception 100% conforme aux filtres de tri ATS",
      "Carrousel 360° interactif pour tester les designs",
      "Tarifs transparents et accompagnement sur-mesure"
    ]
  }
];

export default function FonctionnalitesPage() {
  const router = useRouter();
  const [activeTabId, setActiveTabId] = useState("extracteur");

  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeTabId) || SIDEBAR_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      
      {/* HEADER DE LA PAGE FONCTIONNALITÉS */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Fonctionnalités</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Suite Outils
                </span>
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                Sélectionnez une fonctionnalité dans le menu latéral pour la découvrir ou la lancer
              </p>
            </div>
          </div>

          {/* Bouton retour / Accueil */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition cursor-pointer"
          >
            <i className="fa-solid fa-house text-xs"></i>
            <span className="hidden sm:inline">Accueil</span>
          </Link>
        </div>
      </header>

      {/* CONTENEUR PRINCIPAL AVEC MENU LATÉRAL */}
      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col md:flex-row p-4 sm:p-6 gap-6">
        
        {/* =========================================================================
            MENU LATÉRAL (SIDEBAR)
           ========================================================================= */}
        <aside className="w-full md:w-80 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-3 sm:p-4 shadow-sm md:sticky md:top-24">
            
            <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Menu des fonctionnalités
              </span>
              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                {SIDEBAR_ITEMS.length} outils
              </span>
            </div>

            {/* Liste des boutons latéraux */}
            <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
              {SIDEBAR_ITEMS.map((item) => {
                const isActive = item.id === activeTabId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTabId(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap md:whitespace-normal group ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 text-gray-950 dark:text-white shadow-sm"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-transform group-hover:scale-105 ${item.iconColor}`}>
                        <i className={item.icon}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal truncate hidden sm:block">
                          {item.shortDesc}
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-1.5 ml-2 flex-shrink-0">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${item.tagColor}`}>
                        {item.tag}
                      </span>
                      <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isActive ? "text-emerald-600 translate-x-0.5" : "text-gray-300 dark:text-gray-600 group-hover:text-gray-400"}`}></i>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Note en bas du menu latéral */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 px-2 text-center hidden md:block">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                Plateforme Facilité • Outils professionnels & IA
              </p>
            </div>

          </div>
        </aside>

        {/* =========================================================================
            ESPACE PRINCIPAL DE CONTENU (ZONE DE TRAVAIL / DÉTAIL DE LA FONCTIONNALITÉ)
           ========================================================================= */}
        <main className="flex-grow min-w-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 lg:p-10 shadow-sm flex flex-col justify-between min-h-[500px]">
            
            {/* Haut de la fiche fonctionnalité */}
            <div>
              {/* En-tête avec badge et titre */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md ${activeItem.iconColor}`}>
                    <i className={activeItem.icon}></i>
                  </div>
                  <div>
                    <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md mb-1.5 ${activeItem.tagColor}`}>
                      {activeItem.tag}
                    </span>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-950 dark:text-white tracking-tight">
                      {activeItem.name}
                    </h2>
                  </div>
                </div>

                {/* Bouton de lancement direct */}
                <Link
                  href={activeItem.link}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                  <span>{activeItem.actionLabel}</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                </Link>
              </div>

              {/* Description complète */}
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Description de la fonctionnalité
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200 leading-relaxed font-normal bg-gray-50 dark:bg-gray-800/40 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                  {activeItem.fullDesc}
                </p>
              </div>

              {/* Atouts clés & Points forts */}
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Ce que cet outil vous apporte
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeItem.highlights.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-800"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        <i className="fa-solid fa-check"></i>
                      </div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {point}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Zone d'action basse */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <i className="fa-solid fa-circle-info text-emerald-500"></i>
                <span>Disponible et actif sur la plateforme Facilité</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Link
                  href={activeItem.link}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition cursor-pointer"
                >
                  <i className="fa-solid fa-rocket"></i>
                  <span>Lancer {activeItem.name}</span>
                </Link>
              </div>
            </div>

          </div>
        </main>

      </div>

    </div>
  );
}
