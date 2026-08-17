"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  { id: "all", name: "Tous les outils" },
  { id: "ia", name: "Outils IA & Carrière" },
  { id: "pdf", name: "Outils PDF & Documents" }
];

const SIDEBAR_ITEMS = [
  // --- SECTION IA & CARRIÈRE ---
  {
    id: "extracteur",
    category: "ia",
    name: "Extracteur 1-Click",
    tag: "Outil IA",
    tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: "fa-solid fa-bolt",
    iconColor: "text-amber-500 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50",
    link: "/candidat/extracteur",
    tagline: "Extraction intelligente des coordonnées & génération de candidature express",
    description: "Téléversez une image ou affiche d'emploi. L'intelligence artificielle extrait instantanément le titre du poste, l'entreprise et l'adresse email RH pour générer votre candidature clé en main.",
    steps: [
      { num: "1", title: "Téléversement", desc: "Glissez votre affiche ou capture d'offre", icon: "fa-solid fa-cloud-arrow-up" },
      { num: "2", title: "Extraction IA", desc: "Détection OCR des contacts et du profil", icon: "fa-solid fa-microchip" },
      { num: "3", title: "Candidature", desc: "Formulaire et lettre prêts à envoyer", icon: "fa-solid fa-paper-plane" }
    ],
    highlights: [
      { title: "Reconnaissance optique de caractères (OCR) instantanée", desc: "Lecture précise de tout type de visuel ou document", icon: "fa-solid fa-expand" },
      { title: "Extraction automatique de l'adresse email et du téléphone RH", desc: "Détection du contact recruteur sans ressaisie", icon: "fa-solid fa-envelope-circle-check" },
      { title: "Pré-remplissage automatique du formulaire de candidature", desc: "Zéro saisie manuelle fastidieuse", icon: "fa-solid fa-file-signature" },
      { title: "Rédaction assistée de votre lettre de motivation", desc: "Génération sur-mesure pour le poste ciblé", icon: "fa-solid fa-wand-magic-sparkles" }
    ],
    actionLabel: "Lancer l'Extracteur 1-Click",
    footerHint: "100% Automatisé • Compatible images PNG, JPG et captures d'écran"
  },
  {
    id: "boite-a-idees",
    category: "ia",
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
    category: "ia",
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
  },

  // --- SECTION OUTILS PDF ---
  {
    id: "fusionner-pdf",
    category: "pdf",
    name: "Fusionner PDF",
    tag: "Outil PDF",
    tagColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
    icon: "fa-solid fa-file-circle-plus",
    iconColor: "text-red-500 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50",
    link: "#fusionner",
    isToolModal: true,
    tagline: "Combinez plusieurs fichiers PDF en un seul document ordonné",
    description: "Fusionner et combiner des fichiers PDF et les mettre dans l'ordre que vous voulez. C'est très facile et rapide !",
    steps: [
      { num: "1", title: "Sélectionner", desc: "Glissez vos fichiers PDF dans l'outil", icon: "fa-solid fa-folder-open" },
      { num: "2", title: "Organiser", desc: "Glissez-déposez pour définir l'ordre exact", icon: "fa-solid fa-arrow-down-up-across-line" },
      { num: "3", title: "Télécharger", desc: "Obtenez votre PDF fusionné instantanément", icon: "fa-solid fa-file-arrow-down" }
    ],
    highlights: [
      { title: "Fusion illimitée", desc: "Combinez autant de documents PDF que nécessaire", icon: "fa-solid fa-layer-group" },
      { title: "Ordre sur-mesure", desc: "Réorganisez facilement vos pages et pièces jointes", icon: "fa-solid fa-bars-staggered" },
      { title: "Qualité originale préservée", desc: "Aucune perte de résolution ou de lisibilité", icon: "fa-solid fa-circle-check" },
      { title: "Traitement confidentiel", desc: "Fichiers traités de façon sécurisée et privée", icon: "fa-solid fa-lock" }
    ],
    actionLabel: "Fusionner mes fichiers PDF",
    footerHint: "Idéal pour regrouper CV, Lettre et Diplômes dans un dossier unique"
  },
  {
    id: "diviser-pdf",
    category: "pdf",
    name: "Diviser PDF",
    tag: "Outil PDF",
    tagColor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    icon: "fa-solid fa-scissors",
    iconColor: "text-orange-500 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/50",
    link: "#diviser",
    isToolModal: true,
    tagline: "Extrayez des pages spécifiques ou séparez chaque page en PDF distinct",
    description: "Sélectionner la portée de pages, séparer une page, ou convertir chaque page du document en fichier PDF indépendant.",
    steps: [
      { num: "1", title: "Importer", desc: "Déposez votre fichier PDF à diviser", icon: "fa-solid fa-file-import" },
      { num: "2", title: "Découper", desc: "Indiquez les pages ou plages à extraire", icon: "fa-solid fa-scissors" },
      { num: "3", title: "Enregistrer", desc: "Téléchargez vos fichiers séparés", icon: "fa-solid fa-download" }
    ],
    highlights: [
      { title: "Extraction par plage", desc: "Extrayez précisément les pages 1-3, 5 ou 8", icon: "fa-solid fa-arrow-right-arrow-left" },
      { title: "Séparation en pages uniques", desc: "Découpez chaque page en PDF autonome", icon: "fa-solid fa-table-cells-large" },
      { title: "Vitesse d'exécution", desc: "Découpage instantané en quelques fractions de seconde", icon: "fa-solid fa-bolt" },
      { title: "100% gratuit et direct", desc: "Aucun filigrane ni restriction", icon: "fa-solid fa-certificate" }
    ],
    actionLabel: "Diviser mon document PDF",
    footerHint: "Pratique pour extraire une attestation ou un certificat précis"
  },
  {
    id: "organiser-pdf",
    category: "pdf",
    name: "Organiser PDF",
    tag: "Outil PDF",
    tagColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    icon: "fa-solid fa-arrow-down-up-across-line",
    iconColor: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50",
    link: "#organiser",
    isToolModal: true,
    tagline: "Triez, supprimez, faites pivoter ou réordonnez les pages d'un PDF",
    description: "Triez les pages de votre fichier PDF comme bon vous semble. Supprimez ou ajoutez des pages PDF à votre document à votre guise.",
    steps: [
      { num: "1", title: "Charger", desc: "Visualisez les vignettes de toutes les pages", icon: "fa-solid fa-eye" },
      { num: "2", title: "Organiser", desc: "Déplacez, supprimez ou pivotez les pages", icon: "fa-solid fa-shuffle" },
      { num: "3", title: "Finaliser", desc: "Générez votre PDF réorganisé", icon: "fa-solid fa-check-double" }
    ],
    highlights: [
      { title: "Glisser-déposer intuitif", desc: "Déplacez l'ordre des pages en un geste simple", icon: "fa-solid fa-hand-pointer" },
      { title: "Suppression en 1 clic", desc: "Éliminez les pages blanches ou superflues", icon: "fa-solid fa-trash-can" },
      { title: "Rotation des pages", desc: "Remettez dans le bon sens les pages scannées de travers", icon: "fa-solid fa-rotate-right" },
      { title: "Prévisualisation HD", desc: "Vérifiez chaque page avant validation finale", icon: "fa-solid fa-magnifying-glass" }
    ],
    actionLabel: "Organiser mon fichier PDF",
    footerHint: "Parfait pour nettoyer et ordonner un dossier de candidature"
  },
  {
    id: "pdf-en-jpg",
    category: "pdf",
    name: "PDF en JPG",
    tag: "Conversion",
    tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: "fa-regular fa-file-image",
    iconColor: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50",
    link: "#pdf-en-jpg",
    isToolModal: true,
    tagline: "Convertissez chaque page d'un document PDF en image JPG haute définition",
    description: "Extraire toutes les images contenues dans un fichier PDF ou convertir chaque page dans un fichier JPG.",
    steps: [
      { num: "1", title: "Déposer", desc: "Téléversez le document PDF à convertir", icon: "fa-solid fa-file-pdf" },
      { num: "2", title: "Conversion", desc: "Transformation automatique en images HD", icon: "fa-solid fa-arrows-rotate" },
      { num: "3", title: "Télécharger", desc: "Récupérez vos images JPG individuelles ou en ZIP", icon: "fa-solid fa-images" }
    ],
    highlights: [
      { title: "Haute résolution (HD)", desc: "Textes et visuels restent nets et parfaitement lisibles", icon: "fa-solid fa-gem" },
      { title: "Extraction d'images", desc: "Isolez les logos, photos ou graphiques du document", icon: "fa-solid fa-crop" },
      { title: "Téléchargement ZIP", desc: "Téléchargez toutes les pages en une seule archive", icon: "fa-solid fa-box-archive" },
      { title: "Format universel", desc: "Partagez facilement sur WhatsApp ou les réseaux", icon: "fa-brands fa-whatsapp" }
    ],
    actionLabel: "Convertir PDF en JPG",
    footerHint: "Facilite le partage de votre CV ou certificat sous forme d'image"
  },
  {
    id: "jpg-en-pdf",
    category: "pdf",
    name: "JPG en PDF",
    tag: "Conversion",
    tagColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    icon: "fa-solid fa-file-pdf",
    iconColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-200 dark:border-yellow-900/50",
    link: "#jpg-en-pdf",
    isToolModal: true,
    tagline: "Transformez vos photos, scans et images JPG en un document PDF propre",
    description: "Convertissez vos images en PDF. Ajustez l'orientation et les marges.",
    steps: [
      { num: "1", title: "Ajouter", desc: "Sélectionnez vos images (JPG, PNG, WebP)", icon: "fa-solid fa-photo-film" },
      { num: "2", title: "Ajuster", desc: "Définissez l'orientation (Portrait/Paysage) et marges", icon: "fa-solid fa-sliders" },
      { num: "3", title: "Générer", desc: "Téléchargez votre document PDF prêt à l'emploi", icon: "fa-solid fa-file-circle-check" }
    ],
    highlights: [
      { title: "Multi-images en 1 PDF", desc: "Assemblez plusieurs photos de diplômes en un seul PDF", icon: "fa-solid fa-copy" },
      { title: "Ajustement des marges", desc: "Marges automatiques pour un rendu professionnel", icon: "fa-solid fa-border-all" },
      { title: "Compression intelligente", desc: "Poids de fichier réduit tout en gardant une netteté max", icon: "fa-solid fa-compress" },
      { title: "Prêt pour les candidatures", desc: "Conforme aux exigences de pièces jointes des recruteurs", icon: "fa-solid fa-check" }
    ],
    actionLabel: "Convertir JPG en PDF",
    footerHint: "Idéal pour convertir des photos prises avec votre smartphone"
  }
];

export default function FonctionnalitesPage() {
  const [activeTabId, setActiveTabId] = useState("extracteur");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingStatus, setProcessingStatus] = useState(null);

  const filteredItems = SIDEBAR_ITEMS.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeTabId) || SIDEBAR_ITEMS[0];

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) {
      const files = Array.from(e.dataTransfer.files);
      setUploadedFiles(files);
      setProcessingStatus(`Fichier(s) prêt(s) : ${files.map(f => f.name).join(", ")}`);
    }
  };

  const handleFileInput = (e) => {
    if (e.target?.files?.length) {
      const files = Array.from(e.target.files);
      setUploadedFiles(files);
      setProcessingStatus(`Fichier(s) sélectionné(s) : ${files.map(f => f.name).join(", ")}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      
      {/* HEADER DE LA PAGE */}
      <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 px-4 sm:px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base shadow-sm">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Fonctionnalités</span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase">
                  {SIDEBAR_ITEMS.length} Outils
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
      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col md:flex-row p-4 sm:p-6 gap-6">
        
        {/* =========================================================================
            MENU LATÉRAL (SIDEBAR)
           ========================================================================= */}
        <aside className="w-full md:w-80 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-3.5 shadow-xs md:sticky md:top-20">
            
            {/* Filtres par catégorie */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-xl transition cursor-pointer text-center ${
                    selectedCategory === cat.id
                      ? "bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Boutons de la sidebar groupés */}
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const isActive = item.id === activeTabId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTabId(item.id);
                      setUploadedFiles([]);
                      setProcessingStatus(null);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 text-gray-950 dark:text-white shadow-xs font-black"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent text-gray-700 dark:text-gray-300 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-transform group-hover:scale-105 ${item.iconColor}`}>
                        <i className={item.icon}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-normal truncate hidden sm:block">
                          {item.tag}
                        </div>
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
            ESPACE DE CONTENU PRINCIPAL (ÉPURÉ & FLUIDE)
           ========================================================================= */}
        <main className="flex-grow min-w-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[520px]">
            
            <div>
              {/* En-tête de la fiche */}
              <div className="flex items-center gap-3.5 mb-4">
                <div className={`w-13 h-13 rounded-2xl flex items-center justify-center text-2xl shadow-xs ${activeItem.iconColor}`}>
                  <i className={activeItem.icon}></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${activeItem.tagColor}`}>
                      {activeItem.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Actif & Prêt
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white tracking-tight">
                    {activeItem.name}
                  </h2>
                </div>
              </div>

              {/* Tagline & Description */}
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6 font-normal">
                {activeItem.description}
              </p>

              {/* Module Interactif de Drag & Drop pour les outils PDF */}
              {activeItem.category === "pdf" && (
                <div className="mb-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                      dragOver
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                        : "border-gray-200 dark:border-gray-800 hover:border-emerald-400 bg-gray-50/50 dark:bg-gray-800/20"
                    }`}
                  >
                    <input
                      type="file"
                      id="pdf-tool-input"
                      className="hidden"
                      multiple={activeItem.id === "fusionner-pdf" || activeItem.id === "jpg-en-pdf"}
                      accept={activeItem.id === "jpg-en-pdf" ? "image/*" : ".pdf,application/pdf"}
                      onChange={handleFileInput}
                    />
                    <label htmlFor="pdf-tool-input" className="cursor-pointer block">
                      <div className={`w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center text-lg ${activeItem.iconColor}`}>
                        <i className={activeItem.icon}></i>
                      </div>
                      <div className="text-xs font-black text-gray-900 dark:text-white mb-1">
                        Glissez-déposez vos fichiers ici ou <span className="text-emerald-600 dark:text-emerald-400 underline">parcourez</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {activeItem.id === "jpg-en-pdf" ? "Images JPG, PNG, WebP acceptées" : "Documents PDF acceptés"}
                      </div>
                    </label>

                    {processingStatus && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-black">
                        <i className="fa-solid fa-circle-check"></i>
                        <span>{processingStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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

            {/* SEUL ET UNIQUE BOUTON D'ACTION EN BAS */}
            <div className="pt-5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                <span>{activeItem.footerHint}</span>
              </div>

              {activeItem.link.startsWith("/") ? (
                <Link
                  href={activeItem.link}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gray-950 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-gray-950 hover:text-white dark:hover:text-gray-950 text-xs font-black shadow-md transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                  <i className="fa-solid fa-bolt text-amber-400 dark:text-amber-500"></i>
                  <span>{activeItem.actionLabel}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("pdf-tool-input");
                    if (input) input.click();
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gray-950 dark:bg-white hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-gray-950 hover:text-white dark:hover:text-gray-950 text-xs font-black shadow-md transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                  <i className="fa-solid fa-file-arrow-up text-amber-400 dark:text-amber-500"></i>
                  <span>{activeItem.actionLabel}</span>
                </button>
              )}
            </div>

          </div>
        </main>

      </div>

    </div>
  );
}
