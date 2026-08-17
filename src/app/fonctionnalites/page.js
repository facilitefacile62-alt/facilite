"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

const SIDEBAR_ITEMS = [
  {
    id: "extracteur",
    name: "Extracteur 1-Click",
    tag: "Outil IA",
    tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: "fa-solid fa-bolt",
    iconColor: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50",
    link: "/candidat/extracteur",
    tagline: "Extraction intelligente des coordonnées & génération de candidature express",
    description: "Téléversez une affiche, capture d'écran ou document d'offre d'emploi. L'intelligence artificielle extrait automatiquement le titre du poste, l'entreprise et l'adresse email RH pour préparer votre candidature en quelques secondes.",
    steps: [
      { num: "1", title: "Téléversement", desc: "Glissez votre affiche ou image d'offre", icon: "fa-solid fa-cloud-arrow-up" },
      { num: "2", title: "Extraction IA", desc: "Détection OCR des contacts et du profil", icon: "fa-solid fa-microchip" },
      { num: "3", title: "Candidature", desc: "Formulaire et lettre prêts à envoyer", icon: "fa-solid fa-paper-plane" }
    ],
    highlights: [
      { title: "Reconnaissance OCR instantanée", desc: "Lecture précise de tout type de visuel ou document", icon: "fa-solid fa-expand" },
      { title: "Extraction automatique RH", desc: "Détection de l'email, du téléphone et du contact recruteur", icon: "fa-solid fa-envelope-circle-check" },
      { title: "Formulaire pré-rempli", desc: "Zéro saisie manuelle fastidieuse", icon: "fa-solid fa-file-signature" },
      { title: "Lettre de motivation IA", desc: "Rédaction assistée et sur-mesure pour le poste", icon: "fa-solid fa-wand-magic-sparkles" }
    ],
    actionLabel: "Lancer l'Extracteur 1-Click",
    footerHint: "100% Automatisé • Compatible images PNG, JPG et captures d'écran"
  },
  {
    id: "boite-a-idees",
    name: "Boîte à idées",
    tag: "Collaboratif",
    tagColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    icon: "fa-solid fa-lightbulb",
    iconColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-200 dark:border-yellow-900/50",
    link: "/boite-a-idees",
    tagline: "Espace communautaire pour proposer, voter et co-créer les futures fonctionnalités",
    description: "Partagez vos suggestions pour enrichir la plateforme Facilité, découvrez les propositions des autres membres et votez pour celles que vous souhaitez voir développées en priorité.",
    steps: [
      { num: "1", title: "Proposition", desc: "Soumettez votre idée ou suggestion", icon: "fa-solid fa-pen-fancy" },
      { num: "2", title: "Vote Communautaire", desc: "Les membres votent pour les meilleures idées", icon: "fa-solid fa-thumbs-up" },
      { num: "3", title: "Déploiement", desc: "Suivi en direct de l'intégration par l'équipe", icon: "fa-solid fa-code-merge" }
    ],
    highlights: [
      { title: "Dépôt d'idées libre", desc: "Accessible à tous les membres en 1 clic", icon: "fa-solid fa-feather-pointed" },
      { title: "Système de vote en direct", desc: "Classement par popularité et pertinence", icon: "fa-solid fa-chart-line" },
      { title: "Suivi de statut transparent", desc: "En étude, En développement, Déployé", icon: "fa-solid fa-list-check" },
      { title: "Innovation continue", desc: "La plateforme évolue selon vos besoins réels", icon: "fa-solid fa-rocket" }
    ],
    actionLabel: "Accéder à la Boîte à idées",
    footerHint: "Espace ouvert • Vos suggestions façonnent l'avenir de Facilité"
  },
  {
    id: "services-modeles",
    name: "Services & Modèles",
    tag: "Studio CV Pro",
    tagColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: "fa-solid fa-briefcase",
    iconColor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/50",
    link: "/service",
    tagline: "Modèles de CVs et lettres aux normes internationales et conformes aux filtres ATS",
    description: "Accédez à un catalogue exclusif de modèles professionnels (Formats Sénégal, Canadien, Anglais et Lettres de motivation) créés avec des experts RH pour maximiser vos chances de décrocher des entretiens.",
    steps: [
      { num: "1", title: "Sélection", desc: "Choisissez le modèle adapté à votre cible", icon: "fa-solid fa-cubes" },
      { num: "2", title: "Personnalisation", desc: "Éditez vos informations sur Canva", icon: "fa-solid fa-sliders" },
      { num: "3", title: "Export Pro", desc: "Téléchargez votre CV prêt pour les recruteurs", icon: "fa-solid fa-file-arrow-down" }
    ],
    highlights: [
      { title: "Conformité ATS 100%", desc: "Structure optimisée pour passer les filtres automatiques", icon: "fa-solid fa-shield-halved" },
      { title: "Standards Internationaux", desc: "Formats Sénégal, UEMOA, Canada et Version Anglaise", icon: "fa-solid fa-earth-americas" },
      { title: "Carrousel 360° immersif", desc: "Testez et visualisez les modèles sous tous les angles", icon: "fa-solid fa-rotate" },
      { title: "Tarifs transparents", desc: "Offres claires et accompagnement personnalisé", icon: "fa-solid fa-tag" }
    ],
    actionLabel: "Explorer les Services & Modèles",
    footerHint: "Templates haute définition • Prêts à l'emploi et 100% personnalisables"
  }
];

export default function FonctionnalitesPage() {
  const [activeTabId, setActiveTabId] = useState("extracteur");
  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeTabId) || SIDEBAR_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      
      {/* HEADER DE LA PAGE */}
      <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 px-4 sm:px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base shadow-sm">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Fonctionnalités</span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase">
                  Outils
                </span>
              </h1>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition cursor-pointer"
          >
            <i className="fa-solid fa-house text-xs"></i>
            <span>Accueil</span>
          </Link>
        </div>
      </header>

      {/* CONTENEUR PRINCIPAL */}
      <div className="max-w-6xl mx-auto w-full flex-grow flex flex-col md:flex-row p-4 sm:p-6 gap-6">
        
        {/* =========================================================================
            MENU LATÉRAL (SIDEBAR)
           ========================================================================= */}
        <aside className="w-full md:w-72 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-3 shadow-xs md:sticky md:top-20">
            
            <div className="px-3 py-2 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Fonctionnalités
              </span>
              <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                {SIDEBAR_ITEMS.length} Outils
              </span>
            </div>

            {/* Boutons de la sidebar */}
            <div className="space-y-1.5">
              {SIDEBAR_ITEMS.map((item) => {
                const isActive = item.id === activeTabId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTabId(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 text-gray-950 dark:text-white shadow-xs font-black"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent text-gray-700 dark:text-gray-300 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-transform group-hover:scale-105 ${item.iconColor}`}>
                        <i className={item.icon}></i>
                      </div>
                      <div className="text-xs truncate">
                        {item.name}
                      </div>
                    </div>

                    <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${isActive ? "text-emerald-600 translate-x-0.5" : "text-gray-300 dark:text-gray-600 group-hover:text-gray-400"}`}></i>
                  </button>
                );
              })}
            </div>

          </div>
        </aside>

        {/* =========================================================================
            ESPACE DE CONTENU PRINCIPAL (ÉPURÉ, SANS DOUBLONS DE BOUTONS)
           ========================================================================= */}
        <main className="flex-grow min-w-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[480px]">
            
            <div>
              {/* En-tête de la fiche */}
              <div className="flex items-center gap-3.5 mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xs ${activeItem.iconColor}`}>
                  <i className={activeItem.icon}></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${activeItem.tagColor}`}>
                      {activeItem.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Actif
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white tracking-tight">
                    {activeItem.name}
                  </h2>
                </div>
              </div>

              {/* Tagline & Description fluide */}
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6 font-normal">
                {activeItem.description}
              </p>

              {/* Workflow en 3 étapes */}
              <div className="mb-6">
                <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Comment ça fonctionne
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeItem.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black shadow-xs">
                          {step.num}
                        </div>
                        <div className="text-xs font-black text-gray-900 dark:text-white">
                          {step.title}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Atouts clés */}
              <div className="mb-8">
                <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Ce que cet outil vous apporte
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeItem.highlights.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-800"
                    >
                      <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        <i className={point.icon}></i>
                      </div>
                      <div>
                        <div className="text-xs font-black text-gray-900 dark:text-white">
                          {point.title}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                          {point.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SEUL ET UNIQUE BOUTON D'ACTION (EN BAS, VISIBLE ET ÉLÉGANT) */}
            <div className="pt-5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                <span>{activeItem.footerHint}</span>
              </div>

              <Link
                href={activeItem.link}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gray-950 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-gray-950 hover:text-white dark:hover:text-gray-950 text-xs font-black shadow-md transition-all transform hover:scale-[1.02] cursor-pointer"
              >
                <i className="fa-solid fa-bolt text-amber-400 dark:text-amber-500"></i>
                <span>{activeItem.actionLabel}</span>
              </Link>
            </div>

          </div>
        </main>

      </div>

    </div>
  );
}
