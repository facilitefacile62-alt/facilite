"use strict";
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const CATEGORIES = [
  { id: "all", label: "Toutes les fonctionnalités", icon: "fa-solid fa-layer-group" },
  { id: "ai", label: "Outils IA & Candidature", icon: "fa-solid fa-wand-magic-sparkles" },
  { id: "cv", label: "Modèles & Studio CV", icon: "fa-solid fa-file-invoice" },
  { id: "network", label: "Réseau & Recrutement", icon: "fa-solid fa-building-user" },
  { id: "opportunity", label: "Concours & Formations", icon: "fa-solid fa-graduation-cap" },
];

const FEATURES = [
  {
    id: "extracteur",
    category: "ai",
    badge: "1-Click IA",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
    icon: "fa-solid fa-bolt",
    iconBg: "bg-amber-500 text-white shadow-amber-500/20",
    title: "Extracteur 1-Click d'Affiches",
    subtitle: "Postulez en quelques secondes depuis une simple image d'offre",
    description: "Téléversez n'importe quelle affiche, photo ou capture d'écran d'offre d'emploi. Notre intelligence artificielle extrait instantanément le poste, les coordonnées RH et prépare votre dossier de candidature clé en main.",
    highlights: [
      "Reconnaissance optique (OCR) ultra-précise",
      "Détection automatique de l'email et du téléphone",
      "Génération assistée de lettre de motivation",
      "Gain de temps moyen de 85% par candidature"
    ],
    ctaText: "Lancer l'Extracteur",
    ctaLink: "/candidat/extracteur",
    isPopular: true
  },
  {
    id: "boite-idees",
    category: "ai",
    badge: "Collaboratif",
    badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50",
    icon: "fa-solid fa-lightbulb",
    iconBg: "bg-yellow-500 text-white shadow-yellow-500/20",
    title: "Boîte à Idées & Innovation",
    subtitle: "Co-construisez le futur de la plateforme Facilité",
    description: "Un espace d'expression communautaire où vous pouvez suggérer de nouvelles fonctionnalités, voter pour les meilleures propositions et suivre les innovations en cours de développement par notre équipe.",
    highlights: [
      "Soumission d'idées ouverte à tous les membres",
      "Système de vote et de popularité en temps réel",
      "Statuts de déploiement transparents (En étude, En cours, Livré)",
      "Récompenses et valorisation des meilleurs contributeurs"
    ],
    ctaText: "Déposer une idée",
    ctaLink: "/boite-a-idees",
    isPopular: false
  },
  {
    id: "services-modeles",
    category: "cv",
    badge: "Catalogue Premium",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
    icon: "fa-solid fa-briefcase",
    iconBg: "bg-emerald-500 text-white shadow-emerald-500/20",
    title: "Studio Services & Modèles 360°",
    subtitle: "Des modèles de CVs et lettres conçus pour décrocher des entretiens",
    description: "Accédez à une collection complète de modèles professionnels adaptés aux standards internationaux : formats Sénégal / UEMOA, CV Canadien, Version Anglaise et lettres de motivation percutantes.",
    highlights: [
      "Conformité garantie avec les logiciels ATS des recruteurs",
      "Carrousel 360° interactif pour tester les designs",
      "Édition ultra-rapide sur Canva et formats exportables",
      "Recommandé par des spécialistes en recrutement RH"
    ],
    ctaText: "Découvrir les modèles",
    ctaLink: "/service",
    isPopular: true
  },
  {
    id: "recrutement-spontane",
    category: "network",
    badge: "77 Entreprises",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
    icon: "fa-solid fa-building-user",
    iconBg: "bg-blue-600 text-white shadow-blue-600/20",
    title: "Répertoire Recrutement Spontané",
    subtitle: "Accédez directement aux directions des ressources humaines",
    description: "Ne vous limitez pas aux offres publiées. Explorez notre répertoire qualifié de plus de 77 grandes entreprises leaders au Sénégal pour envoyer vos candidatures spontanées aux bons interlocuteurs.",
    highlights: [
      "Coordonnées RH et adresses emails professionnelles vérifiées",
      "Classement thématique par secteur d'activité",
      "Conseils personnalisés pour capter l'attention des recruteurs",
      "Mise à jour permanente des entreprises partenaires"
    ],
    ctaText: "Explorer le répertoire",
    ctaLink: "/recrutement-spontane",
    isPopular: false
  },
  {
    id: "depots-physiques",
    category: "network",
    badge: "Terrain & Proximité",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800/50",
    icon: "fa-solid fa-gas-pump",
    iconBg: "bg-purple-600 text-white shadow-purple-600/20",
    title: "Dépôts Physiques & Terrain",
    subtitle: "Localisez les points stratégiques pour déposer votre dossier papier",
    description: "Pour les opportunités de proximité et les emplois terrain, découvrez les stations-services, commerces et entreprises qui acceptent les dépôts physiques de CV en main propre.",
    highlights: [
      "Cartographie des stations et points de dépôt locaux",
      "Conseils pratiques pour réussir son premier contact direct",
      "Horaires et modalités recommandées pour se présenter",
      "Opportunités pour profils opérationnels et débutants"
    ],
    ctaText: "Consulter les points de dépôt",
    ctaLink: "/recrutement-journalier",
    isPopular: false
  },
  {
    id: "diagnostic-ia",
    category: "ai",
    badge: "Scanner ATS",
    badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50",
    icon: "fa-solid fa-robot",
    iconBg: "bg-indigo-600 text-white shadow-indigo-600/20",
    title: "Analyseur & Scanner IA de CV",
    subtitle: "Évaluez votre score de performance face aux algorithmes",
    description: "Importez votre CV (PDF / DOCX) pour bénéficier d'un audit complet en direct : détection des mots-clés manquants, clarté structurelle, compatibilité ATS et conseils d'optimisation immédiats.",
    highlights: [
      "Score de lisibilité ATS sur 100",
      "Détection des points forts et axes d'amélioration",
      "Suggestions d'accroches professionnelles percutantes",
      "Recommandations de modèles adaptés à votre profil"
    ],
    ctaText: "Analyser mon CV",
    ctaLink: "/importer-cv",
    isPopular: false
  },
  {
    id: "messagerie-directe",
    category: "network",
    badge: "Temps Réel",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-200 dark:border-teal-800/50",
    icon: "fa-solid fa-comments",
    iconBg: "bg-teal-600 text-white shadow-teal-600/20",
    title: "Messagerie Candidat-Recruteur",
    subtitle: "Échangez en direct et planifiez vos entretiens",
    description: "Une messagerie fluide et sécurisée intégrée à la plateforme pour converser avec les recruteurs, répondre aux invitations d'entretien et transmettre vos documents complémentaires.",
    highlights: [
      "Notifications instantanées lors de réponses recruteurs",
      "Partage sécurisé de fichiers et pièces jointes",
      "Filtres de conversations et statut de lecture",
      "Confidentialité garantie de bout en bout"
    ],
    ctaText: "Ouvrir la messagerie",
    ctaLink: "/messagerie",
    isPopular: false
  },
  {
    id: "concours-fonction-publique",
    category: "opportunity",
    badge: "Fonction Publique",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800/50",
    icon: "fa-solid fa-award",
    iconBg: "bg-rose-600 text-white shadow-rose-600/20",
    title: "Avis de Concours Nationaux",
    subtitle: "Toutes les dates et conditions des concours d'État",
    description: "Centralisation quotidienne de tous les avis officiels de concours, examens professionnels et opportunités d'intégration dans la fonction publique et les grands corps de l'État.",
    highlights: [
      "Calendrier des dates limites d'inscription",
      "Conditions d'éligibilité et pièces requises détaillées",
      "Accès direct aux formulaires officiels",
      "Alertes pour ne manquer aucune date clé"
    ],
    ctaText: "Voir les concours",
    ctaLink: "/offres?q=Concours",
    isPopular: false
  },
  {
    id: "formations-certifiantes",
    category: "opportunity",
    badge: "Compétences Pro",
    badgeColor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50",
    icon: "fa-solid fa-graduation-cap",
    iconBg: "bg-cyan-600 text-white shadow-cyan-600/20",
    title: "Formations & Certifications",
    subtitle: "Montez en compétences sur les métiers porteurs",
    description: "Accédez à un catalogue ciblé de formations certifiantes et programmes e-learning pour booster votre employabilité dans le numérique, la gestion de projet, les langues et le commerce.",
    highlights: [
      "Programmes axés sur la pratique et l'insertion",
      "Certificats reconnus valorisables sur votre CV",
      "Formations accessibles à distance ou en présentiel",
      "Modules adaptés aux besoins actuels des employeurs"
    ],
    ctaText: "Découvrir les formations",
    ctaLink: "/offres?q=Formation",
    isPopular: false
  }
];

export default function FonctionnalitesPage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeatures = useMemo(() => {
    return FEATURES.filter((item) => {
      const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.highlights.some((h) => h.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* 1. HERO SECTION CINÉMATIQUE */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden border-b border-gray-200/70 dark:border-gray-800/80 bg-gradient-to-b from-white/90 via-[#FAF6F1] to-white/60 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Cercles de fond décoratifs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge en-tête */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/50 text-xs font-black uppercase tracking-wider mb-6 shadow-xs animate-fade-in-up">
            <i className="fa-solid fa-wand-magic-sparkles text-emerald-600 dark:text-emerald-400"></i>
            <span>Écosystème Tout-en-Un Facilité</span>
          </div>

          {/* Titre Principal */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-950 dark:text-white max-w-4xl mx-auto leading-[1.15] mb-6">
            Toutes les fonctionnalités réunies pour{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-400">
              propulser votre carrière.
            </span>
          </h1>

          {/* Sous-titre */}
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            De la création de CV assistée par IA à la candidature en 1-Click depuis une affiche, découvrez la suite complète d&apos;outils conçus pour maximiser vos opportunités et accélérer vos recrutements.
          </p>

          {/* Boutons d'action rapides */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
            <Link
              href="/candidat/extracteur"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <i className="fa-solid fa-bolt text-amber-300"></i>
              <span>Tester l&apos;Extracteur 1-Click</span>
            </Link>
            <Link
              href="/service"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold text-sm border border-gray-200 dark:border-gray-700 shadow-sm transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <i className="fa-solid fa-briefcase text-emerald-600 dark:text-emerald-400"></i>
              <span>Explorer les Modèles & Tarifs</span>
            </Link>
          </div>

          {/* Barre de statistiques clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm">
            <div className="p-3 text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">1-Click</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">Candidature IA Express</div>
            </div>
            <div className="p-3 text-center border-l border-gray-200/60 dark:border-gray-800">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">+77</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">Entreprises Répertoriées</div>
            </div>
            <div className="p-3 text-center border-l border-gray-200/60 dark:border-gray-800">
              <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">98%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">Conformité ATS</div>
            </div>
            <div className="p-3 text-center border-l border-gray-200/60 dark:border-gray-800">
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">100%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">Accessible & Évolutif</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FILTRES & BARRE DE RECHERCHE */}
      <section className="py-8 bg-[#FAF6F1] dark:bg-gray-950 sticky top-16 z-30 border-b border-gray-200/80 dark:border-gray-800/80 backdrop-blur-md bg-opacity-95 dark:bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Pilules de catégories */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02]"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <i className={`${cat.icon} text-xs`}></i>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Champ de recherche rapide */}
            <div className="relative w-full md:w-72">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un outil..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 3. GRILLE DES FONCTIONNALITÉS */}
      <section className="py-12 md:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {filteredFeatures.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fa-solid fa-filter"></i>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Aucune fonctionnalité ne correspond à votre recherche</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              Essayez de modifier votre mot-clé ou réinitialisez les filtres pour découvrir l&apos;ensemble des services.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeatures.map((feat) => (
              <div
                key={feat.id}
                className="group relative bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-7 flex flex-col justify-between hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all duration-200 transform hover:-translate-y-1"
              >
                {/* Badge populaire si applicable */}
                {feat.isPopular && (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                    <i className="fa-solid fa-star text-[9px]"></i>
                    <span>Populaire</span>
                  </div>
                )}

                <div>
                  {/* Icône et Badge Catégorie */}
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-md ${feat.iconBg}`}>
                      <i className={feat.icon}></i>
                    </div>
                    {!feat.isPopular && (
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${feat.badgeColor}`}>
                        {feat.badge}
                      </span>
                    )}
                  </div>

                  {/* Titre & Sous-titre */}
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {feat.title}
                  </h2>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                    {feat.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
                    {feat.description}
                  </p>

                  {/* Points forts */}
                  <div className="space-y-2 mb-6 pt-4 border-t border-gray-100 dark:border-gray-800/80">
                    {feat.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <i className="fa-solid fa-circle-check text-emerald-500 text-xs mt-0.5 flex-shrink-0"></i>
                        <span className="font-medium">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bouton d'action direct */}
                <Link
                  href={feat.ctaLink}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-gray-900 dark:text-white hover:text-white font-extrabold text-xs border border-gray-200 dark:border-gray-700 hover:border-emerald-600 transition-all cursor-pointer shadow-xs group-hover:shadow-md"
                >
                  <span>{feat.ctaText}</span>
                  <i className="fa-solid fa-arrow-right text-[10px] transform group-hover:translate-x-1 transition-transform"></i>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. COMPARATIF BENTO : SANS vs AVEC FACILITÉ */}
      <section className="py-16 bg-white dark:bg-gray-900 border-y border-gray-200/80 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/60">
              L&apos;Avantage Compétitif
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-gray-950 dark:text-white mt-3 mb-4">
              Pourquoi choisir l&apos;écosystème Facilité ?
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              Découvrez comment notre suite d&apos;outils intégrés transforme une démarche de candidature fastidieuse en un processus fluide et valorisant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Sans Facilité */}
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/40 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center text-base">
                  <i className="fa-solid fa-circle-xmark"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-red-950 dark:text-red-300">Méthodes Traditionnelles</h3>
                  <div className="text-xs text-red-700/80 dark:text-red-400">Sans les outils Facilité</div>
                </div>
              </div>
              <ul className="space-y-3.5 text-xs text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-xmark text-red-500 mt-0.5"></i>
                  <span>Heures passées à recopier manuellement les informations d&apos;une affiche d&apos;offre.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-xmark text-red-500 mt-0.5"></i>
                  <span>CVs rejetés par les filtres automatiques ATS en raison de structures inadaptées.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-xmark text-red-500 mt-0.5"></i>
                  <span>Difficulté à obtenir les coordonnées directes des responsables recrutement.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-xmark text-red-500 mt-0.5"></i>
                  <span>Aucun retour ni feedback sur les points d&apos;amélioration du profil.</span>
                </li>
              </ul>
            </div>

            {/* Avec Facilité */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 relative shadow-lg shadow-emerald-500/5">
              <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wide">
                Recommandé
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base shadow-sm">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-emerald-950 dark:text-emerald-300">Avec la Suite Facilité</h3>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">100% Digital & Intelligent</div>
                </div>
              </div>
              <ul className="space-y-3.5 text-xs text-gray-800 dark:text-gray-200">
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold mt-0.5"></i>
                  <span>Postulez en 1 clic grâce à l&apos;analyse intelligente d&apos;affiche par IA.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold mt-0.5"></i>
                  <span>Modèles de CVs et lettres validés conformes ATS et testés sur les marchés internationaux.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold mt-0.5"></i>
                  <span>Annuaire qualifié de 77+ grandes entreprises pour candidatures spontanées ciblées.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold mt-0.5"></i>
                  <span>Diagnostic IA immédiat et messagerie directe en temps réel avec les recruteurs.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BANNIÈRE D'APPEL À L'ACTION (CTA FINAL) */}
      <section className="py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-gray-900 via-gray-950 to-emerald-950 p-8 sm:p-12 lg:p-16 text-center text-white overflow-hidden shadow-2xl border border-emerald-800/40">
          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider mb-6">
              <i className="fa-solid fa-rocket"></i>
              Prêt à booster votre avenir ?
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
              Rejoignez des milliers de talents et recruteurs sur Facilité.
            </h2>
            <p className="text-xs sm:text-base text-gray-300 mb-8 leading-relaxed">
              Explorez nos outils dès aujourd&apos;hui et commencez à postuler avec un impact maximal.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/candidat/extracteur"
                className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs sm:text-sm transition-all transform hover:scale-105 cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                Tester l&apos;Extracteur 1-Click
              </Link>
              <Link
                href="/offres"
                className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer"
              >
                Consulter les offres d&apos;emploi
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
