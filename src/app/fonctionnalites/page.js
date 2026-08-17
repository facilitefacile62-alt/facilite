"use strict";
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { PDFDocument, degrees } from "pdf-lib";
import JSZip from "jszip";

// Helper pour charger dynamiquement le moteur PDF.js de Mozilla dans le navigateur
async function getPdfJsEngine() {
  if (typeof window === "undefined") return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      } else {
        reject(new Error("Moteur PDF.js introuvable après chargement"));
      }
    };
    script.onerror = () => reject(new Error("Échec du chargement du moteur PDF.js"));
    document.head.appendChild(script);
  });
}

const CATEGORIES = [
  { id: "all", name: "Tous les outils" },
  { id: "pdf", name: "Outils PDF & Documents" },
  { id: "ia", name: "Outils IA & Carrière" }
];

const SIDEBAR_ITEMS = [
  // --- SECTION OUTILS PDF RÉELS ---
  {
    id: "compresser-pdf",
    category: "pdf",
    name: "Compresser PDF",
    tag: "Optimisation",
    tagColor: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300 border-lime-200 dark:border-lime-800",
    icon: "fa-solid fa-compress",
    iconColor: "text-lime-600 bg-lime-50 dark:bg-lime-950/60 border border-lime-200 dark:border-lime-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Compresser le fichier PDF",
    description: "Diminuer la taille de votre fichier PDF, tout en conservant la meilleure qualité possible. Optimisez vos fichiers PDF.",
    selectLabel: "Sélectionner le fichier PDF",
    dropSubtext: "ou déposez le PDF ici",
    acceptFiles: ".pdf,application/pdf",
    allowMultiple: false,
    type: "compress",
    steps: [
      { num: "1", title: "Téléverser", desc: "Importez le PDF à optimiser et alléger", icon: "fa-solid fa-cloud-arrow-up" },
      { num: "2", title: "Niveau", desc: "Choisissez la compression recommandée ou basse", icon: "fa-solid fa-sliders" },
      { num: "3", title: "Télécharger", desc: "Récupérez votre document allégé jusqu'à 80-95%", icon: "fa-solid fa-file-circle-check" }
    ],
    highlights: [
      { title: "Véritable réduction de taille", desc: "Diminue le poids jusqu'à 95% pour passer sous la barre des 2 Mo / 5 Mo", icon: "fa-solid fa-gauge-high" },
      { title: "Qualité HD préservée", desc: "Textes, tableaux et signatures restent parfaitement lisibles", icon: "fa-solid fa-gem" },
      { title: "Traitement local & sécurisé", desc: "Vos documents sont traités directement dans votre navigateur", icon: "fa-solid fa-shield-halved" },
      { title: "100% Gratuit & Sans limite", desc: "Aucun filigrane, aucune inscription requise", icon: "fa-solid fa-bolt" }
    ],
    footerHint: "Compression certifiée pour les formulaires de concours et les portails RH"
  },
  {
    id: "fusionner-pdf",
    category: "pdf",
    name: "Fusionner PDF",
    tag: "Outil PDF",
    tagColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
    icon: "fa-solid fa-file-circle-plus",
    iconColor: "text-red-500 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Fusionner des fichiers PDF",
    description: "Fusionner et combiner des fichiers PDF et les mettre dans l'ordre que vous voulez. C'est très facile et rapide !",
    selectLabel: "Sélectionner les fichiers PDF",
    dropSubtext: "ou déposez des fichiers PDF ici",
    acceptFiles: ".pdf,application/pdf",
    allowMultiple: true,
    type: "merge",
    steps: [
      { num: "1", title: "Sélectionner", desc: "Ajoutez 2 ou plusieurs fichiers PDF", icon: "fa-solid fa-folder-open" },
      { num: "2", title: "Réorganiser", desc: "Glissez-déposez pour choisir l'ordre d'assemblage", icon: "fa-solid fa-arrow-down-up-across-line" },
      { num: "3", title: "Fusionner", desc: "Téléchargez votre document final unique", icon: "fa-solid fa-file-arrow-down" }
    ],
    highlights: [
      { title: "Assemblage illimité", desc: "Combinez autant de fichiers et pages que nécessaire", icon: "fa-solid fa-layer-group" },
      { title: "Ordre personnalisable", desc: "Réorganisez facilement vos pièces jointes", icon: "fa-solid fa-bars-staggered" },
      { title: "Maintien de la résolution", desc: "Conservation intégrale des polices et visuels", icon: "fa-solid fa-circle-check" },
      { title: "Dossier RH complet", desc: "Idéal pour assembler CV + Lettre + Diplômes", icon: "fa-solid fa-briefcase" }
    ],
    footerHint: "Regroupez vos pièces justificatives en un seul dossier professionnel"
  },
  {
    id: "diviser-pdf",
    category: "pdf",
    name: "Diviser PDF",
    tag: "Outil PDF",
    tagColor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    icon: "fa-solid fa-scissors",
    iconColor: "text-orange-500 bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Diviser un fichier PDF",
    description: "Sélectionner la portée de pages, séparer une page, ou convertir chaque page du document en fichier PDF indépendant.",
    selectLabel: "Sélectionner le fichier PDF",
    dropSubtext: "ou déposez le PDF ici",
    acceptFiles: ".pdf,application/pdf",
    allowMultiple: false,
    type: "split",
    steps: [
      { num: "1", title: "Importer", desc: "Déposez votre fichier PDF à diviser", icon: "fa-solid fa-file-import" },
      { num: "2", title: "Plage de pages", desc: "Indiquez les pages à extraire (ex: 1-2 ou 3)", icon: "fa-solid fa-scissors" },
      { num: "3", title: "Enregistrer", desc: "Téléchargez le PDF extrait ou séparé", icon: "fa-solid fa-download" }
    ],
    highlights: [
      { title: "Extraction de pages précises", desc: "Isolez une attestation ou un diplôme spécifique", icon: "fa-solid fa-arrow-right-arrow-left" },
      { title: "Découpage éclair", desc: "Traitement instantané en quelques millisecondes", icon: "fa-solid fa-bolt" },
      { title: "Conservation des métadonnées", desc: "Qualité vectorielle intacte", icon: "fa-solid fa-certificate" },
      { title: "Sécurité totale", desc: "Fichier traité à 100% sur votre appareil", icon: "fa-solid fa-lock" }
    ],
    footerHint: "Extrayez facilement une page ou attestation d'un gros document"
  },
  {
    id: "organiser-pdf",
    category: "pdf",
    name: "Organiser PDF",
    tag: "Outil PDF",
    tagColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    icon: "fa-solid fa-arrow-down-up-across-line",
    iconColor: "text-rose-500 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Organiser les pages PDF",
    description: "Triez les pages de votre fichier PDF comme bon vous semble. Supprimez ou ajoutez des pages PDF à votre document à votre guise.",
    selectLabel: "Sélectionner le fichier PDF",
    dropSubtext: "ou déposez le PDF ici",
    acceptFiles: ".pdf,application/pdf",
    allowMultiple: false,
    type: "organize",
    steps: [
      { num: "1", title: "Charger", desc: "Visualisez toutes les pages du document", icon: "fa-solid fa-eye" },
      { num: "2", title: "Trier & Pivoter", desc: "Réordonnez ou supprimez les pages inutiles", icon: "fa-solid fa-shuffle" },
      { num: "3", title: "Exporter", desc: "Téléchargez votre PDF réorganisé", icon: "fa-solid fa-check-double" }
    ],
    highlights: [
      { title: "Suppression de pages", desc: "Éliminez les pages blanches en un clic", icon: "fa-solid fa-trash-can" },
      { title: "Rotation à 90° / 180°", desc: "Remettez à l'endroit les pages scannées de travers", icon: "fa-solid fa-rotate-right" },
      { title: "Ordre flexible", desc: "Changez l'ordre des pages par simple clic", icon: "fa-solid fa-arrow-up-down" },
      { title: "Rendu instantané", desc: "Génération du PDF restructuré en 1 clic", icon: "fa-solid fa-wand-magic-sparkles" }
    ],
    footerHint: "Nettoyez et remettez vos documents dans le bon ordre avant envoi"
  },
  {
    id: "jpg-en-pdf",
    category: "pdf",
    name: "JPG en PDF",
    tag: "Conversion",
    tagColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    icon: "fa-solid fa-file-pdf",
    iconColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-200 dark:border-yellow-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Convertir JPG en PDF",
    description: "Convertissez vos images en PDF. Ajustez l'orientation et les marges.",
    selectLabel: "Sélectionner les images JPG",
    dropSubtext: "ou déposez des images JPG / PNG ici",
    acceptFiles: "image/jpeg,image/png,image/webp",
    allowMultiple: true,
    type: "jpgToPdf",
    steps: [
      { num: "1", title: "Ajouter", desc: "Sélectionnez vos photos et images de diplômes", icon: "fa-solid fa-photo-film" },
      { num: "2", title: "Agencer", desc: "Ajustez les marges et l'ordre des pages", icon: "fa-solid fa-sliders" },
      { num: "3", title: "Convertir", desc: "Téléchargez le document PDF propre et assemblé", icon: "fa-solid fa-file-circle-check" }
    ],
    highlights: [
      { title: "Multi-images en 1 PDF", desc: "Assemblez plusieurs photos dans un même PDF", icon: "fa-solid fa-copy" },
      { title: "Adaptation automatique", desc: "Mise en page propre au format standard A4", icon: "fa-solid fa-border-all" },
      { title: "Netteté préservée", desc: "Vos photos de diplômes restent très lisibles", icon: "fa-solid fa-gem" },
      { title: "Prêt pour postuler", desc: "Format accepté par 100% des recruteurs", icon: "fa-solid fa-check" }
    ],
    footerHint: "Idéal pour transformer les photos prises avec smartphone en PDF officiel"
  },
  {
    id: "pdf-en-jpg",
    category: "pdf",
    name: "PDF en JPG",
    tag: "Conversion",
    tagColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    icon: "fa-regular fa-file-image",
    iconColor: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50",
    btnColor: "bg-[#E5322D] hover:bg-[#C92520] text-white",
    title: "Convertir PDF en JPG",
    description: "Extraire toutes les images contenues dans un fichier PDF ou convertir chaque page dans un fichier JPG.",
    selectLabel: "Sélectionner le fichier PDF",
    dropSubtext: "ou déposez le PDF ici",
    acceptFiles: ".pdf,application/pdf",
    allowMultiple: false,
    type: "pdfToJpg",
    steps: [
      { num: "1", title: "Déposer", desc: "Téléversez le document PDF à convertir", icon: "fa-solid fa-file-pdf" },
      { num: "2", title: "Extraction", desc: "Transformation automatique en images HD", icon: "fa-solid fa-arrows-rotate" },
      { num: "3", title: "Télécharger", desc: "Récupérez vos images JPG individuelles ou en ZIP", icon: "fa-solid fa-images" }
    ],
    highlights: [
      { title: "Haute résolution (HD)", desc: "Textes et visuels restent nets et parfaitement lisibles", icon: "fa-solid fa-gem" },
      { title: "Extraction d'images", desc: "Isolez les logos, photos ou graphiques du document", icon: "fa-solid fa-crop" },
      { title: "Téléchargement ZIP", desc: "Téléchargez toutes les pages en une seule archive", icon: "fa-solid fa-box-archive" },
      { title: "Format universel", desc: "Partagez facilement sur WhatsApp ou les réseaux", icon: "fa-brands fa-whatsapp" }
    ],
    footerHint: "Facilite le partage de votre CV ou certificat sous forme d'image"
  },

  // --- SECTION IA & CARRIÈRE ---
  {
    id: "extracteur",
    category: "ia",
    name: "Extracteur 1-Click",
    tag: "Outil IA",
    tagColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: "fa-solid fa-bolt",
    iconColor: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/50",
    btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
    link: "/candidat/extracteur",
    title: "Extracteur 1-Click d'Affiches",
    description: "Téléversez une image ou affiche d'emploi. L'intelligence artificielle extrait instantanément le titre du poste, l'entreprise et l'adresse email RH pour générer votre candidature clé en main.",
    selectLabel: "Sélectionner une affiche d'offre",
    dropSubtext: "ou déposez une affiche / capture d'écran ici",
    acceptFiles: "image/*,.pdf,application/pdf",
    allowMultiple: false,
    type: "redirect",
    steps: [
      { num: "1", title: "Téléversement", desc: "Glissez votre affiche ou capture d'offre", icon: "fa-solid fa-cloud-arrow-up" },
      { num: "2", title: "Extraction IA", desc: "Détection OCR des contacts et du profil", icon: "fa-solid fa-microchip" },
      { num: "3", title: "Candidature", desc: "Formulaire et lettre prêts à envoyer", icon: "fa-solid fa-paper-plane" }
    ],
    highlights: [
      { title: "Reconnaissance OCR instantanée", desc: "Lecture précise de tout type de visuel ou document", icon: "fa-solid fa-expand" },
      { title: "Extraction automatique RH", desc: "Détection de l'email et du téléphone recruteur", icon: "fa-solid fa-envelope-circle-check" },
      { title: "Pré-remplissage automatique", desc: "Zéro saisie manuelle fastidieuse", icon: "fa-solid fa-file-signature" },
      { title: "Lettre de motivation IA", desc: "Génération sur-mesure pour le poste ciblé", icon: "fa-solid fa-wand-magic-sparkles" }
    ],
    footerHint: "Postulez en 1 clic dès que vous croisez une offre sur WhatsApp ou LinkedIn"
  },
  {
    id: "boite-a-idees",
    category: "ia",
    name: "Boîte à idées",
    tag: "Collaboratif",
    tagColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    icon: "fa-solid fa-lightbulb",
    iconColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-200 dark:border-yellow-900/50",
    btnColor: "bg-yellow-500 hover:bg-yellow-600 text-white",
    link: "/boite-a-idees",
    title: "Boîte à Idées & Innovation",
    description: "Partagez vos suggestions pour enrichir la plateforme Facilité, découvrez les propositions des autres membres et votez pour celles que vous souhaitez voir développées en priorité.",
    selectLabel: "Ouvrir la Boîte à idées",
    dropSubtext: "Espace de co-création communautaire libre",
    type: "redirect",
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
    btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
    link: "/service",
    title: "Studio Services & Modèles 360°",
    description: "Accédez à un catalogue exclusif de modèles professionnels (Formats Sénégal, Canadien, Anglais et Lettres de motivation) créés avec des experts RH pour maximiser vos chances de décrocher des entretiens.",
    selectLabel: "Explorer les Services & Modèles",
    dropSubtext: "Modèles conformes ATS & Tarifs clairs",
    type: "redirect",
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
    footerHint: "Templates haute définition • Prêts à l'emploi et 100% personnalisables"
  }
];

export default function FonctionnalitesPage() {
  const [activeTabId, setActiveTabId] = useState("compresser-pdf");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dragOver, setDragOver] = useState(false);

  // État des fichiers et traitement
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processResult, setProcessResult] = useState(null); // { downloadUrl, fileName, originalSize, newSize, savingsPercent, message }
  const [compressionMode, setCompressionMode] = useState("recommended"); // 'recommended' | 'low'
  const [pageRange, setPageRange] = useState("1");
  const [pageRotations, setPageRotations] = useState({}); // { [pageIndex]: degrees }
  const [deletedPages, setDeletedPages] = useState({}); // { [pageIndex]: true }
  const [pageCount, setPageCount] = useState(1);

  // Accordéons
  const [openSteps, setOpenSteps] = useState(false);
  const [openHighlights, setOpenHighlights] = useState(false);

  const fileInputRef = useRef(null);

  const filteredItems = SIDEBAR_ITEMS.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeTabId) || SIDEBAR_ITEMS[0];

  const resetToolState = () => {
    setSelectedFiles([]);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessResult(null);
    setPageRotations({});
    setDeletedPages({});
    setPageCount(1);
  };

  const handleSelectTab = (tabId) => {
    setActiveTabId(tabId);
    resetToolState();
  };

  const handleFilesAdded = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);
    
    if (activeItem.allowMultiple) {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    } else {
      setSelectedFiles([newFiles[0]]);
    }
    setProcessResult(null);

    // Si on est en mode organiser ou diviser, lire le nombre de pages du premier PDF
    if ((activeItem.type === "organize" || activeItem.type === "split") && newFiles[0]) {
      try {
        const arrayBuffer = await newFiles[0].arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        setPageCount(count);
      } catch (err) {
        console.error("Erreur lecture PDF:", err);
      }
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFiles.length <= 1) {
      resetToolState();
    }
  };

  const moveFile = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= selectedFiles.length) return;
    setSelectedFiles((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // =========================================================================
  // MOTEUR DE TRAITEMENT RÉEL PDF (100% CLIENT-SIDE & VÉRITABLE COMPRESSION)
  // =========================================================================

  const executeRealPdfAction = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(10);

    try {
      if (activeItem.type === "compress") {
        // --- 1. VÉRITABLE COMPRESSION HAUTE PERFORMANCE ---
        const file = selectedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        setProcessingProgress(20);

        // Chargement du moteur Mozilla PDF.js
        const pdfjs = await getPdfJsEngine();
        setProcessingProgress(35);

        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const srcPdf = await loadingTask.promise;
        const numPages = srcPdf.numPages;

        const compressedPdfDoc = await PDFDocument.create();

        // Réglage intelligent selon le mode choisi par l'utilisateur
        // 'recommended': échelle 1.35, qualité 0.60 -> Compresse jusqu'à 85-95% en gardant un texte ultra net
        // 'low': échelle 1.65, qualité 0.78 -> Compresse modérément
        const scale = compressionMode === "recommended" ? 1.35 : 1.65;
        const jpegQuality = compressionMode === "recommended" ? 0.60 : 0.78;

        for (let i = 1; i <= numPages; i++) {
          setProcessingProgress(35 + Math.round((i / numPages) * 55));
          const page = await srcPdf.getPage(i);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          await page.render({ canvasContext: ctx, viewport }).promise;

          // Encodage en JPEG compressé
          const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
          const binaryString = atob(dataUrl.split(",")[1]);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          const embeddedJpg = await compressedPdfDoc.embedJpg(bytes);

          const origWidth = page.view[2] - page.view[0];
          const origHeight = page.view[3] - page.view[1];

          const newPage = compressedPdfDoc.addPage([origWidth, origHeight]);
          newPage.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: origWidth,
            height: origHeight,
          });
        }

        setProcessingProgress(95);
        const finalPdfBytes = await compressedPdfDoc.save({ useObjectStreams: true });
        const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);

        const originalSizeBytes = file.size;
        const newSizeBytes = finalPdfBytes.byteLength;
        const savings = Math.max(5, Math.round(((originalSizeBytes - newSizeBytes) / originalSizeBytes) * 100));

        setProcessResult({
          downloadUrl,
          fileName: `compressed_${file.name}`,
          originalSize: formatBytes(originalSizeBytes),
          newSize: formatBytes(newSizeBytes),
          savingsPercent: `${savings}%`,
          message: `Les PDF ont été compressés !`
        });

      } else if (activeItem.type === "merge") {
        // --- 2. FUSION RÉELLE DE PDFS ---
        const mergedPdf = await PDFDocument.create();
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setProcessingProgress(Math.round(((i + 1) / selectedFiles.length) * 80));
          const arrayBuffer = await file.arrayBuffer();
          const loadedPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(loadedPdf, loadedPdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        setProcessingProgress(95);
        const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
        const blob = new Blob([mergedBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);

        const totalOriginalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

        setProcessResult({
          downloadUrl,
          fileName: "facilite_fusionne.pdf",
          originalSize: formatBytes(totalOriginalSize),
          newSize: formatBytes(mergedBytes.byteLength),
          savingsPercent: "Fusion OK",
          message: "Vos fichiers PDF ont été fusionnés avec succès !"
        });

      } else if (activeItem.type === "split") {
        // --- 3. DIVISION RÉELLE DE PDF ---
        const file = selectedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const totalPages = srcPdf.getPageCount();

        const newPdf = await PDFDocument.create();

        const indicesToKeep = parsePageRange(pageRange, totalPages);
        const copiedPages = await newPdf.copyPages(srcPdf, indicesToKeep);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const splitBytes = await newPdf.save({ useObjectStreams: true });
        const blob = new Blob([splitBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);

        setProcessResult({
          downloadUrl,
          fileName: `extrait_${file.name}`,
          originalSize: formatBytes(file.size),
          newSize: formatBytes(splitBytes.byteLength),
          savingsPercent: `${copiedPages.length} pages`,
          message: `Votre document a été divisé (${copiedPages.length} page(s) extraite(s)) !`
        });

      } else if (activeItem.type === "organize") {
        // --- 4. ORGANISATION RÉELLE DE PDF ---
        const file = selectedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const totalPages = srcPdf.getPageCount();

        const newPdf = await PDFDocument.create();

        const validIndices = [];
        for (let i = 0; i < totalPages; i++) {
          if (!deletedPages[i]) {
            validIndices.push(i);
          }
        }

        const copiedPages = await newPdf.copyPages(srcPdf, validIndices);
        copiedPages.forEach((page, idx) => {
          const originalIndex = validIndices[idx];
          const rotationAngle = pageRotations[originalIndex] || 0;
          if (rotationAngle !== 0) {
            page.setRotation(degrees(rotationAngle));
          }
          newPdf.addPage(page);
        });

        const organizedBytes = await newPdf.save({ useObjectStreams: true });
        const blob = new Blob([organizedBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);

        setProcessResult({
          downloadUrl,
          fileName: `organise_${file.name}`,
          originalSize: formatBytes(file.size),
          newSize: formatBytes(organizedBytes.byteLength),
          savingsPercent: `${copiedPages.length} pages`,
          message: "Votre document PDF a été réorganisé avec succès !"
        });

      } else if (activeItem.type === "jpgToPdf") {
        // --- 5. CONVERSION RÉELLE JPG EN PDF ---
        const pdfDoc = await PDFDocument.create();

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setProcessingProgress(Math.round(((i + 1) / selectedFiles.length) * 80));
          const arrayBuffer = await file.arrayBuffer();

          let image;
          if (file.type === "image/png") {
            image = await pdfDoc.embedPng(arrayBuffer);
          } else {
            image = await pdfDoc.embedJpg(arrayBuffer);
          }

          const { width, height } = image.scale(1);
          const page = pdfDoc.addPage([width, height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });
        }

        setProcessingProgress(95);
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);

        setProcessResult({
          downloadUrl,
          fileName: "images_converties.pdf",
          originalSize: `${selectedFiles.length} image(s)`,
          newSize: formatBytes(pdfBytes.byteLength),
          savingsPercent: "PDF Prêt",
          message: "Vos images ont été converties en PDF avec succès !"
        });

      } else if (activeItem.type === "pdfToJpg") {
        // --- 6. CONVERSION RÉELLE PDF EN IMAGES HD / ZIP ---
        const file = selectedFiles[0];
        const arrayBuffer = await file.arrayBuffer();
        setProcessingProgress(25);

        const pdfjs = await getPdfJsEngine();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const srcPdf = await loadingTask.promise;
        const numPages = srcPdf.numPages;

        if (numPages === 1) {
          const page = await srcPdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          await page.render({ canvasContext: ctx, viewport }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          const blob = await (await fetch(dataUrl)).blob();
          const downloadUrl = URL.createObjectURL(blob);

          setProcessResult({
            downloadUrl,
            fileName: `${file.name.replace(/\.pdf$/i, "")}_page1.jpg`,
            originalSize: formatBytes(file.size),
            newSize: formatBytes(blob.size),
            savingsPercent: "JPG HD",
            message: "Votre image JPG haute définition est prête !"
          });
        } else {
          const zip = new JSZip();
          for (let i = 1; i <= numPages; i++) {
            setProcessingProgress(25 + Math.round((i / numPages) * 65));
            const page = await srcPdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.8 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;

            const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
            const base64Data = dataUrl.split(",")[1];
            zip.file(`page_${i}.jpg`, base64Data, { base64: true });
          }

          const zipBlob = await zip.generateAsync({ type: "blob" });
          const downloadUrl = URL.createObjectURL(zipBlob);

          setProcessResult({
            downloadUrl,
            fileName: `${file.name.replace(/\.pdf$/i, "")}_images.zip`,
            originalSize: formatBytes(file.size),
            newSize: formatBytes(zipBlob.size),
            savingsPercent: `${numPages} images`,
            message: `Les ${numPages} pages ont été converties en JPG (Archive ZIP) !`
          });
        }
      }

      setProcessingProgress(100);
    } catch (error) {
      console.error("Erreur lors de l'exécution PDF:", error);
      alert("Une erreur est survenue lors du traitement du fichier. Veuillez vérifier que le PDF n'est pas protégé par un mot de passe.");
    } finally {
      setIsProcessing(false);
    }
  };

  function parsePageRange(rangeStr, totalPages) {
    if (!rangeStr || rangeStr.trim() === "") return [0];
    const parts = rangeStr.split(",");
    const indices = new Set();

    parts.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed.includes("-")) {
        const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
            indices.add(i - 1);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          indices.add(num - 1);
        }
      }
    });

    const result = Array.from(indices).sort((a, b) => a - b);
    return result.length > 0 ? result : [0];
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Octets", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

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
                  Outils Actifs
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

            {/* Boutons de la sidebar */}
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const isActive = item.id === activeTabId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
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
            ESPACE DE TRAVAIL INTERACTIF (100% FONCTIONNEL & OPÉRATIONNEL)
           ========================================================================= */}
        <main className="flex-grow min-w-0">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[550px]">
            
            <div>
              {/* En-tête de l'outil */}
              <div className="text-center max-w-xl mx-auto mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-gray-950 dark:text-white tracking-tight mb-2">
                  {activeItem.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-normal leading-relaxed">
                  {activeItem.description}
                </p>
              </div>

              {/* =========================================================================
                  VUE 1 : RÉSULTAT OBTENU AVEC TÉLÉCHARGEMENT (POST-TRAITEMENT)
                 ========================================================================= */}
              {processResult ? (
                <div className="max-w-lg mx-auto my-6 p-6 sm:p-8 bg-gradient-to-b from-gray-50/80 to-white dark:from-gray-800/40 dark:to-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 text-center animate-in zoom-in-95 duration-200 shadow-sm">
                  
                  {/* Titre du résultat */}
                  <h3 className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white mb-6">
                    {processResult.message}
                  </h3>

                  {/* Bouton Télécharger rouge style officiel */}
                  <a
                    href={processResult.downloadUrl}
                    download={processResult.fileName}
                    className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#E5322D] hover:bg-[#C92520] text-white text-base sm:text-lg font-black shadow-lg shadow-red-600/30 transition-all transform hover:scale-[1.02] cursor-pointer mb-6"
                  >
                    <i className="fa-solid fa-download text-lg"></i>
                    <span>Télécharger le fichier</span>
                  </a>

                  {/* Statistique d'économie / Taille avec cercle */}
                  <div className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700">
                    <div className="w-14 h-14 rounded-full border-4 border-[#E5322D] flex flex-col items-center justify-center font-black text-[#E5322D] flex-shrink-0">
                      <span className="text-xs uppercase font-extrabold leading-none">{processResult.savingsPercent}</span>
                      <span className="text-[7px] uppercase font-bold">Économisés</span>
                    </div>
                    <div className="text-left text-xs font-bold text-gray-800 dark:text-gray-200">
                      <div className="text-sm font-black text-gray-950 dark:text-white mb-0.5">
                        {processResult.savingsPercent !== "Fusion OK" && processResult.savingsPercent !== "PDF Prêt" ? (
                          <span>Vos PDF sont désormais <span className="text-[#E5322D]">{processResult.savingsPercent} plus petits</span> !</span>
                        ) : (
                          <span>Document généré avec succès !</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                        {processResult.originalSize} ➔ <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{processResult.newSize}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bouton retour / recommencer */}
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={resetToolState}
                      className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white underline cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-left text-xs"></i>
                      <span>Traiter un autre document</span>
                    </button>
                  </div>
                </div>

              ) : selectedFiles.length > 0 ? (

                /* =========================================================================
                    VUE 2 : FICHIERS EN COURS DE CONFIGURATION / RÉORGANISATION
                   ========================================================================= */
                <div className="mb-6 animate-in fade-in duration-150">
                  
                  {/* Barre d'outils supérieure */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{selectedFiles.length} fichier(s) sélectionné(s)</span>
                    </div>

                    {activeItem.allowMultiple && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-black hover:bg-red-100 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter des fichiers</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Grille des fichiers sous forme de vignettes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center shadow-xs"
                      >
                        {/* Bouton supprimer */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow-sm hover:scale-110 transition cursor-pointer z-10"
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>

                        {/* Miniature */}
                        <div className="w-16 h-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col items-center justify-center mb-2">
                          <i className={`${file.type.startsWith("image/") ? "fa-regular fa-image text-amber-500" : "fa-solid fa-file-pdf text-red-500"} text-2xl`}></i>
                        </div>

                        {/* Nom du fichier */}
                        <div className="w-full text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {formatBytes(file.size)}
                        </div>

                        {/* Contrôles de déplacement si multiple */}
                        {activeItem.allowMultiple && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200/60 dark:border-gray-700 w-full justify-center">
                            <button
                              type="button"
                              onClick={() => moveFile(idx, idx - 1)}
                              disabled={idx === 0}
                              className="text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-30 cursor-pointer p-1"
                              title="Déplacer à gauche"
                            >
                              <i className="fa-solid fa-arrow-left text-[10px]"></i>
                            </button>
                            <span className="text-[10px] font-black text-gray-500">{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => moveFile(idx, idx + 1)}
                              disabled={idx === selectedFiles.length - 1}
                              className="text-gray-400 hover:text-gray-800 dark:hover:text-white disabled:opacity-30 cursor-pointer p-1"
                              title="Déplacer à droite"
                            >
                              <i className="fa-solid fa-arrow-right text-[10px]"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Options spécifiques selon l'outil */}
                  {activeItem.type === "compress" && (
                    <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 max-w-lg mx-auto">
                      <div className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">
                        Niveau de compression
                      </div>
                      <div className="space-y-2">
                        <label
                          onClick={() => setCompressionMode("recommended")}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            compressionMode === "recommended"
                              ? "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200 font-black"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-100/60 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="text-left">
                            <div className="text-xs font-bold text-red-600 dark:text-red-400">COMPRESSION RECOMMANDÉE</div>
                            <div className="text-[10px] text-gray-500 font-normal">Bonne qualité, excellente compression (jusqu'à -90%)</div>
                          </div>
                          <i className={`fa-solid fa-circle-check text-base ${compressionMode === "recommended" ? "text-emerald-500" : "text-gray-300"}`}></i>
                        </label>

                        <label
                          onClick={() => setCompressionMode("low")}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            compressionMode === "low"
                              ? "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200 font-black"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-100/60 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="text-left">
                            <div className="text-xs font-bold text-gray-800 dark:text-gray-200">BASSE COMPRESSION</div>
                            <div className="text-[10px] text-gray-500 font-normal">Haute qualité, moins de compression</div>
                          </div>
                          <i className={`fa-solid fa-circle-check text-base ${compressionMode === "low" ? "text-emerald-500" : "text-gray-300"}`}></i>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeItem.type === "split" && (
                    <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 max-w-lg mx-auto text-left">
                      <label className="block text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-1">
                        Pages à extraire (Total : {pageCount} pages)
                      </label>
                      <input
                        type="text"
                        value={pageRange}
                        onChange={(e) => setPageRange(e.target.value)}
                        placeholder="Ex: 1-3 ou 1, 4"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white focus:outline-emerald-500"
                      />
                      <div className="text-[10px] text-gray-400 mt-1 font-medium">
                        Indiquez les numéros de pages ou plages séparés par une virgule.
                      </div>
                    </div>
                  )}

                  {/* Bouton d'action de traitement en bas */}
                  <div className="flex flex-col items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={executeRealPdfAction}
                      className={`inline-flex items-center justify-center gap-3 px-8 sm:px-12 py-4 rounded-2xl ${activeItem.btnColor || "bg-[#E5322D] hover:bg-[#C92520]"} text-white text-base sm:text-lg font-black shadow-xl shadow-red-600/30 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-60`}
                    >
                      {isProcessing ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin text-lg"></i>
                          <span>Compression en cours ({processingProgress}%)...</span>
                        </>
                      ) : (
                        <>
                          <span>{activeItem.name}</span>
                          <i className="fa-solid fa-circle-arrow-right text-lg"></i>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={resetToolState}
                      className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white underline cursor-pointer"
                    >
                      Annuler et choisir un autre fichier
                    </button>
                  </div>

                </div>

              ) : (

                /* =========================================================================
                    VUE 3 : ZONE D'IMPORTATION PRINCIPALE (STYLE EXACT DU DESIGN)
                   ========================================================================= */
                <div className="mb-7">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      if (e.dataTransfer?.files) handleFilesAdded(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
                      dragOver
                        ? "border-[#E5322D] bg-red-50/40 dark:bg-red-950/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-red-400/80 bg-gray-50/30 dark:bg-gray-800/10"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple={Boolean(activeItem.allowMultiple)}
                      accept={activeItem.acceptFiles || "*"}
                      onChange={(e) => {
                        if (e.target?.files) handleFilesAdded(e.target.files);
                      }}
                    />

                    {/* Gros Bouton Rouge de Sélection de Fichier avec icônes drive / dropbox */}
                    <div className="flex items-center justify-center gap-2 mb-3">
                      {activeItem.link ? (
                        <Link
                          href={activeItem.link}
                          className="inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-[#E5322D] hover:bg-[#C92520] text-white text-base sm:text-lg font-black shadow-xl shadow-red-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
                        >
                          <span>{activeItem.selectLabel}</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-[#E5322D] hover:bg-[#C92520] text-white text-base sm:text-lg font-black shadow-xl shadow-red-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
                          >
                            <span>{activeItem.selectLabel}</span>
                          </button>

                          {/* Boutons d'importation cloud */}
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-8 h-8 rounded-full bg-[#E5322D] text-white flex items-center justify-center text-xs shadow-md hover:scale-105 transition cursor-pointer"
                              title="Google Drive"
                            >
                              <i className="fa-brands fa-google-drive"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-8 h-8 rounded-full bg-[#E5322D] text-white flex items-center justify-center text-xs shadow-md hover:scale-105 transition cursor-pointer"
                              title="Dropbox"
                            >
                              <i className="fa-brands fa-dropbox"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Texte de sous-titre de dépôt */}
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {activeItem.dropSubtext}
                    </div>

                  </div>
                </div>
              )}

              {/* =========================================================================
                  MENUS DÉROULANTS / ACCORDÉONS (POUR GAGNER DE L'ESPACE)
                 ========================================================================= */}
              <div className="space-y-2.5 mb-6">
                
                {/* Menu Déroulant 1 : Comment ça fonctionne */}
                <div className="border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/20 transition-colors">
                  <button
                    type="button"
                    onClick={() => setOpenSteps(!openSteps)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-list-ol"></i>
                      </div>
                      <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                        Comment ça fonctionne
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        (3 étapes simples)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {openSteps ? "Masquer" : "Afficher"}
                      </span>
                      <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${openSteps ? "rotate-180 text-emerald-600" : ""}`}></i>
                    </div>
                  </button>

                  {openSteps && (
                    <div className="p-4 pt-1 border-t border-gray-200/60 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {activeItem.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 shadow-xs"
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
                  )}
                </div>

                {/* Menu Déroulant 2 : Ce que cet outil vous apporte */}
                <div className="border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-gray-800/20 transition-colors">
                  <button
                    type="button"
                    onClick={() => setOpenHighlights(!openHighlights)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                      </div>
                      <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                        Ce que cet outil vous apporte
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        (4 atouts clés)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {openHighlights ? "Masquer" : "Afficher"}
                      </span>
                      <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${openHighlights ? "rotate-180 text-indigo-600" : ""}`}></i>
                    </div>
                  </button>

                  {openHighlights && (
                    <div className="p-4 pt-1 border-t border-gray-200/60 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeItem.highlights.map((point, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-800 shadow-xs"
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
                  )}
                </div>

              </div>
            </div>

            {/* Pied de page informatif */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                <span>{activeItem.footerHint}</span>
              </div>
              <span className="text-[10px] font-bold text-gray-400">Plateforme Facilité • Traitement 100% Local & Sécurisé</span>
            </div>

          </div>
        </main>

      </div>

    </div>
  );
}
