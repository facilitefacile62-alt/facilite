"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PDFDocument, degrees } from "pdf-lib";
import JSZip from "jszip";
import { compressPdfFile } from "@/lib/pdfCompression";
import { useAuth } from "@/context/AuthContext";
import AuthRequiredModal from "@/components/AuthRequiredModal";

// Helper pour charger dynamiquement le moteur PDF.js de Mozilla dans le navigateur
async function getPdfJsEngine() {
  if (typeof window === "undefined") return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/pdfjs/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      } else {
        reject(new Error("Moteur PDF.js introuvable après chargement"));
      }
    };
    script.onerror = () => {
      const cdnScript = document.createElement("script");
      cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      cdnScript.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("Moteur PDF.js introuvable après chargement CDN"));
        }
      };
      cdnScript.onerror = () => reject(new Error("Échec du chargement du moteur PDF.js"));
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
}

/**
 * Erreur dont le message est écrit POUR la personne qui utilise l'outil, et
 * peut donc être affiché tel quel. Distingue « ce fichier ne convient pas »
 * — que l'utilisateur peut corriger — d'un plantage technique, où un message
 * générique reste préférable.
 */
class ErreurOutil extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurOutil";
  }
}

/**
 * Convertit en JPEG une image que pdf-lib ne sait pas embarquer directement
 * (WebP, AVIF…), en la faisant transiter par un canvas.
 *
 * createImageBitmap plutôt qu'un <img> et son onload : il décode sans
 * dépendre du rendu, et rejette proprement sur un format que le navigateur
 * ne connaît pas — ce qui donne un message utile plutôt qu'une attente sans
 * fin. Le HEIC des iPhone, par exemple, n'est décodé par aucun navigateur de
 * bureau : la personne saura qu'il faut convertir en amont.
 */
async function convertirEnJpeg(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ErreurOutil(
      `Le format de « ${file.name} » n'est pas reconnu par votre navigateur. Convertissez l'image en JPG ou en PNG avant de réessayer.`
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  // Fond blanc : une image à fond transparent deviendrait noire en JPEG, qui
  // ne gère pas la transparence.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) {
    throw new ErreurOutil(`La conversion de « ${file.name} » a échoué. Essayez avec un fichier JPG ou PNG.`);
  }
  return await blob.arrayBuffer();
}

const MO = 1024 * 1024;

/**
 * Plafonds de taille, par outil.
 *
 * La contrainte n'est pas le stockage — tout est traité dans le navigateur,
 * rien n'est téléversé — mais la MÉMOIRE de l'onglet. pdf-lib charge le
 * fichier, le déserialise, puis construit une copie en sortie : le pic
 * approche 3 à 4 fois la taille du document. Sur un Android d'entrée de
 * gamme, un onglet dispose souvent de 256 à 384 Mo avant que le système ne
 * le ferme — sans message, ce que la personne lit comme un plantage.
 *
 * 25 Mo laisse donc environ 100 Mo de pic, et reste très au-dessus de
 * l'usage réel : sur les 167 documents du bucket au 2026-08-30, le plus gros
 * fait 0,92 Mo et la médiane 0,20 Mo. La marge sert au cas qui justifie
 * l'outil de compression — un dossier de concours scanné.
 *
 * `cumul` : pour la fusion et la conversion d'images, tous les fichiers sont
 * chargés SIMULTANÉMENT. C'est le total qui compte, pas l'unité.
 *
 * `pagesMax` : pour PDF en JPG, la mémoire dépend du NOMBRE DE PAGES et non
 * du poids. Chaque page est rendue dans un canvas d'environ 12 Mo, puis
 * JSZip conserve toutes les images en base64 en même temps — encodage qui
 * gonfle encore d'un tiers. Un PDF de 5 Mo à 200 pages est bien plus
 * dangereux qu'un PDF de 20 Mo à 10 pages : une limite en octets seule ne
 * protège pas de ce cas.
 */
const LIMITES_OUTIL = {
  compress: { octets: 25 * MO, cumul: false },
  split: { octets: 25 * MO, cumul: false },
  organize: { octets: 25 * MO, cumul: false },
  merge: { octets: 50 * MO, cumul: true },
  jpgToPdf: { octets: 25 * MO, cumul: true },
  pdfToJpg: { octets: 25 * MO, cumul: false, pagesMax: 50 },
};

function formaterTaille(octets) {
  if (octets < MO) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / MO).toFixed(octets < 10 * MO ? 1 : 0)} Mo`;
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
    footerHint: "Templates haute définition • Prêts à l'emploi"
  }
];

export default function FonctionnalitesPage() {
  const { session: userSession } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalFeature, setAuthModalFeature] = useState("");
  const [authModalIcon, setAuthModalIcon] = useState("fa-solid fa-lock");

  // Navigation & Vues
  const [selectedCategory, setSelectedCategory] = useState("all"); // 'all' | 'pdf' | 'ia'
  const [activeTabId, setActiveTabId] = useState("compresser-pdf");
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'tool'
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
  // Ordre d'affichage, exprimé en indices d'origine. Séparé de pageRotations
  // et deletedPages, qui restent indexés sur la page SOURCE : déplacer une
  // page ne doit pas déplacer sa rotation.
  const [pageOrder, setPageOrder] = useState([]);
  const [pageThumbs, setPageThumbs] = useState([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [draggedPage, setDraggedPage] = useState(null);

  // Accordéons
  const [openSteps, setOpenSteps] = useState(false);
  const [openHighlights, setOpenHighlights] = useState(false);

  const fileInputRef = useRef(null);

  const triggerAuthGuard = (featureName, icon) => {
    if (!userSession?.user) {
      setAuthModalFeature(featureName || activeItem.name);
      setAuthModalIcon(icon || activeItem.icon);
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get("tool");
    if (toolParam) {
      const match = SIDEBAR_ITEMS.find((item) => item.id === toolParam);
      if (match) {
        if (match.link) {
          if (!userSession?.user) {
            triggerAuthGuard(match.name, match.icon);
            return;
          }
          window.location.href = match.link;
          return;
        }
        setActiveTabId(match.id);
        setMobileView("tool");
      }
    }
  }, [userSession]);

  const filteredItems = SIDEBAR_ITEMS.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeTabId) || SIDEBAR_ITEMS[0];

  const resetToolState = () => {
    setProcessResult((precedent) => {
      if (precedent?.downloadUrl) URL.revokeObjectURL(precedent.downloadUrl);
      return null;
    });
    setSelectedFiles([]);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessResult(null);
    setPageRotations({});
    setDeletedPages({});
    setPageCount(1);
    setPageOrder([]);
    setPageThumbs([]);
    setThumbsLoading(false);
    setDraggedPage(null);
    // Ces deux-là manquaient. Une plage saisie dans « Diviser » survivait au
    // changement d'outil : on revenait avec un autre PDF, la plage périmée
    // s'appliquait, et le repli silencieux d'alors la transformait en
    // page 1. Le niveau de compression traînait de la même façon d'un
    // document à l'autre.
    setPageRange("1");
    setCompressionMode("recommended");
  };

  const handleSelectTab = (item) => {
    if (item.link) {
      if (!triggerAuthGuard(item.name, item.icon)) return;
      window.location.href = item.link;
      return;
    }
    setActiveTabId(item.id);
    resetToolState();
    setMobileView("tool");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFilesAdded = async (filesList) => {
    if (!triggerAuthGuard(activeItem.name, activeItem.icon)) return;
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList);

    // Refus AU MOMENT DE LA SÉLECTION, jamais après plusieurs secondes de
    // traitement : un échec tardif ressemble à une panne, un refus immédiat
    // se comprend. Le message nomme la taille réelle du fichier, sans quoi la
    // personne ne sait pas de combien elle dépasse.
    const limite = LIMITES_OUTIL[activeItem.type];
    if (limite) {
      const dejaSelectionne = limite.cumul && activeItem.allowMultiple
        ? selectedFiles.reduce((total, f) => total + f.size, 0)
        : 0;
      const ajout = newFiles.reduce((total, f) => total + f.size, 0);

      if (limite.cumul) {
        if (dejaSelectionne + ajout > limite.octets) {
          alert(
            `Ces fichiers totalisent ${formaterTaille(dejaSelectionne + ajout)}, au-delà de la limite de ${formaterTaille(limite.octets)}. ` +
              `Tous les fichiers sont traités en même temps dans votre navigateur : au-delà, l'onglet risque de se fermer. Retirez-en ou traitez-les en deux fois.`
          );
          return;
        }
      } else {
        const tropGros = newFiles.find((f) => f.size > limite.octets);
        if (tropGros) {
          alert(
            `« ${tropGros.name} » fait ${formaterTaille(tropGros.size)}, la limite est de ${formaterTaille(limite.octets)}. ` +
              `Le traitement se fait entièrement dans votre navigateur : au-delà, l'onglet risque de se fermer avant la fin.`
          );
          return;
        }
      }
    }

    if (activeItem.allowMultiple) {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    } else {
      setSelectedFiles([newFiles[0]]);
    }
    setProcessResult(null);

    // Lecture du nombre de pages : nécessaire à l'affichage pour organiser et
    // diviser, et au plafond de pages pour la conversion en images.
    const litPages = ["organize", "split", "pdfToJpg"].includes(activeItem.type);
    if (litPages && newFiles[0]) {
      try {
        const arrayBuffer = await newFiles[0].arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();

        if (limite?.pagesMax && count > limite.pagesMax) {
          setSelectedFiles([]);
          setPageCount(1);
          alert(
            `Ce document compte ${count} pages, la limite est de ${limite.pagesMax} pour la conversion en images. ` +
              `Chaque page est rendue puis compressée en mémoire : au-delà, l'onglet se ferme avant la fin. ` +
              `Extrayez d'abord un intervalle avec « Diviser PDF ».`
          );
          return;
        }

        setPageCount(count);
        if (activeItem.type === "organize") {
          setPageOrder(Array.from({ length: count }, (_, i) => i));
          setPageRotations({});
          setDeletedPages({});
          genererMiniatures(newFiles[0], count);
        }
      } catch (err) {
        console.error("Erreur lecture PDF:", err);
        // L'échec était avalé : pageCount gardait la valeur du document
        // précédent et l'écran d'organisation affichait un nombre de pages
        // faux, sur lequel la personne cliquait sans comprendre.
        setPageCount(1);
        setSelectedFiles([]);
        alert(
          `« ${newFiles[0].name} » n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un PDF valide et non protégé par un mot de passe.`
        );
      }
    }
  };

  /**
   * Rend une miniature de chaque page avec pdf.js, pour que la personne
   * VOIE ce qu'elle organise.
   *
   * Échelle volontairement basse : une page A4 à 0,3 fait environ 178×253,
   * soit ~15 Ko en JPEG. Même sur un document de 200 pages, l'ensemble reste
   * sous quelques mégaoctets — alors qu'un rendu pleine taille saturerait la
   * mémoire de l'onglet, exactement le travers évité côté PDF en JPG.
   *
   * Le canvas est réutilisé d'une page à l'autre plutôt que recréé : c'est ce
   * qui évite d'accumuler des centaines de contextes graphiques.
   */
  const genererMiniatures = async (file, total) => {
    setThumbsLoading(true);
    try {
      const pdfjs = await getPdfJsEngine();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const miniatures = [];

      for (let i = 1; i <= Math.min(total, doc.numPages); i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        miniatures.push(canvas.toDataURL("image/jpeg", 0.7));
      }
      setPageThumbs(miniatures);
    } catch (err) {
      // Sans miniature, l'outil reste utilisable : les pages s'affichent
      // alors sous forme de vignettes numérotées. On ne bloque pas.
      console.error("Miniatures indisponibles :", err);
      setPageThumbs([]);
    } finally {
      setThumbsLoading(false);
    }
  };

  const rotatePage = (indexOriginal) => {
    setPageRotations((prev) => ({ ...prev, [indexOriginal]: ((prev[indexOriginal] || 0) + 90) % 360 }));
  };

  const togglePageDeleted = (indexOriginal) => {
    setDeletedPages((prev) => {
      const suivant = { ...prev };
      if (suivant[indexOriginal]) delete suivant[indexOriginal];
      else suivant[indexOriginal] = true;
      return suivant;
    });
  };

  // Déplacement par bouton, en plus du glisser-déposer : sur téléphone le
  // glisser est peu fiable, et c'est le support majoritaire ici.
  const movePage = (positionActuelle, direction) => {
    setPageOrder((prev) => {
      const cible = positionActuelle + direction;
      if (cible < 0 || cible >= prev.length) return prev;
      const suivant = [...prev];
      [suivant[positionActuelle], suivant[cible]] = [suivant[cible], suivant[positionActuelle]];
      return suivant;
    });
  };

  const deposerPage = (positionCible) => {
    if (draggedPage === null || draggedPage === positionCible) return;
    setPageOrder((prev) => {
      const suivant = [...prev];
      const [deplacee] = suivant.splice(draggedPage, 1);
      suivant.splice(positionCible, 0, deplacee);
      return suivant;
    });
    setDraggedPage(null);
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
    // Le résultat précédent garde un blob en mémoire tant que son URL n'est
    // pas révoquée. Sur cette page on enchaîne les traitements sans jamais
    // recharger : un PDF de 30 Mo compressé cinq fois retenait cinq blobs.
    if (processResult?.downloadUrl) URL.revokeObjectURL(processResult.downloadUrl);
    setIsProcessing(true);
    setProcessingProgress(10);

    try {
      if (activeItem.type === "compress") {
        // --- 1. VÉRITABLE COMPRESSION HAUTE PERFORMANCE (factorisée, voir src/lib/pdfCompression.js) ---
        const file = selectedFiles[0];
        const result = await compressPdfFile(file, {
          mode: compressionMode,
          onProgress: setProcessingProgress,
        });
        const downloadUrl = URL.createObjectURL(result.blob);

        setProcessResult({
          downloadUrl,
          fileName: result.fileName,
          originalSize: result.originalSizeLabel,
          newSize: result.newSizeLabel,
          savingsPercent: `${result.savingsPercent}%`,
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
        if (indicesToKeep.length === 0) {
          throw new ErreurOutil(
            `Aucune page ne correspond à « ${pageRange.trim() || "(vide)"} ». ` +
              `Ce document compte ${totalPages} page${totalPages > 1 ? "s" : ""} : indiquez un numéro ou une plage dans cet intervalle, par exemple « 1-${totalPages} ».`
          );
        }
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

        // L'ordre choisi à l'écran fait foi. pageOrder reste vide tant que
        // rien n'a été chargé : on retombe alors sur l'ordre naturel.
        const ordre = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i);
        const validIndices = ordre.filter((i) => i < totalPages && !deletedPages[i]);

        // pdf-lib enregistre sans broncher un document de zéro page : vérifié,
        // save() rend 582 octets et ne lève rien. Le téléchargement se
        // proposait donc normalement et la personne repartait avec un fichier
        // qu'aucun lecteur n'ouvre. Mieux vaut refuser ici.
        if (validIndices.length === 0) {
          throw new ErreurOutil(
            "Vous avez supprimé toutes les pages : le document résultant serait vide et illisible. Conservez au moins une page."
          );
        }

        const copiedPages = await newPdf.copyPages(srcPdf, validIndices);
        copiedPages.forEach((page, idx) => {
          const originalIndex = validIndices[idx];
          const quartDeTour = pageRotations[originalIndex] || 0;
          if (quartDeTour !== 0) {
            // ADDITIVE, pas absolue : une page déjà orientée en paysage dans
            // le document source porte une rotation propre. Lui imposer 90°
            // en absolu ne produirait aucun quart de tour visible — la
            // personne verrait son clic sans effet.
            const dejaTournee = page.getRotation().angle || 0;
            page.setRotation(degrees((dejaTournee + quartDeTour) % 360));
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

          // pdf-lib n'embarque que du PNG et du JPEG. Le champ de sélection
          // acceptait pourtant image/webp — format que produisent beaucoup de
          // téléphones : le fichier partait alors dans embedJpg, échouait, et
          // l'utilisateur recevait un message parlant de PDF protégé par mot
          // de passe. On convertit plutôt que de refuser : le format accepté
          // à l'écran doit être un format réellement traité.
          let image;
          if (file.type === "image/png") {
            image = await pdfDoc.embedPng(arrayBuffer);
          } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
            image = await pdfDoc.embedJpg(arrayBuffer);
          } else {
            const jpegBuffer = await convertirEnJpeg(file);
            image = await pdfDoc.embedJpg(jpegBuffer);
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
      alert(error instanceof ErreurOutil ? error.message : messageEchec(activeItem.type, error));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Message d'échec adapté à l'outil et à la cause réelle.
   *
   * Auparavant, les six outils partageaient une seule phrase : « vérifiez que
   * le PDF n'est pas protégé par un mot de passe ». Elle s'affichait aussi
   * pour une image au mauvais format, où elle n'a aucun sens et empêche
   * quiconque de comprendre quoi corriger.
   */
  function messageEchec(typeOutil, error) {
    const brut = String(error?.message || "");

    if (/encrypt|password|protect/i.test(brut)) {
      return "Ce PDF est protégé par un mot de passe. Retirez la protection avant de l'importer.";
    }
    if (/is not a PDF|No PDF header|Failed to parse|Invalid PDF/i.test(brut)) {
      return "Ce fichier n'est pas un PDF valide, ou il est endommagé. Vérifiez le document et réessayez.";
    }
    if (typeOutil === "jpgToPdf") {
      return "Une des images n'a pas pu être lue. Utilisez des fichiers JPG ou PNG.";
    }
    if (typeOutil === "pdfToJpg") {
      return "La conversion en images a échoué. Si le document est très volumineux, essayez avec moins de pages.";
    }
    if (typeOutil === "merge") {
      return "La fusion a échoué : l'un des fichiers n'est pas un PDF valide ou est protégé.";
    }
    return "Le traitement du fichier a échoué. Vérifiez que le document est un PDF valide et non protégé.";
  }

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

    // Retourne un tableau VIDE quand rien n'est exploitable, au lieu du
    // [0] d'avant. Ce repli silencieux sur la page 1 était le pire des
    // comportements : « 3-5 » sur un document de 2 pages, « 99 », « abc »,
    // « 5-3 » et le champ vide donnaient tous la page 1, annoncée comme un
    // succès — « 1 page extraite ». La personne repartait avec un extrait
    // qu'elle n'avait pas demandé, sans le moindre avertissement.
    //
    // C'est à l'appelant de refuser explicitement, pas à ce lecteur de
    // deviner une intention.
    return Array.from(indices).sort((a, b) => a - b);
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
            <div className="w-9 h-9 rounded-xl bg-[#E3DBCC] border border-[#d3c7b3] text-gray-900 flex items-center justify-center text-base shadow-xs">
              <i className="fa-solid fa-wand-magic-sparkles text-gray-850"></i>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Fonctionnalités</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E3DBCC] text-gray-900 border border-[#d3c7b3] text-[10px] font-black uppercase">
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
            MENU LATÉRAL (SIDEBAR / LISTE DES OUTILS)
           ========================================================================= */}
        <aside className={`w-full md:w-80 flex-shrink-0 ${mobileView === "tool" ? "hidden md:block" : "block"}`}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-3.5 sm:p-4 shadow-xs md:sticky md:top-20">
            
            {/* Filtres par catégorie */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-3.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-1 py-2 text-[10px] sm:text-[11px] font-black rounded-xl transition cursor-pointer text-center ${
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
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isActive = item.id === activeTabId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? "bg-emerald-50/80 dark:bg-emerald-950/50 border-2 border-emerald-500 text-gray-950 dark:text-white shadow-xs font-black"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-gray-100 dark:border-gray-800/60 text-gray-800 dark:text-gray-200 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 transition-transform group-hover:scale-105 ${item.iconColor}`}>
                        <i className={item.icon}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium truncate">
                          {item.tag}
                        </div>
                      </div>
                    </div>

                    <i className={`fa-solid fa-chevron-right text-xs transition-transform ${isActive ? "text-emerald-600 translate-x-1" : "text-gray-300 dark:text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5"}`}></i>
                  </button>
                );
              })}
            </div>

          </div>
        </aside>

        {/* =========================================================================
            ESPACE DE TRAVAIL INTERACTIF (100% FONCTIONNEL & OPÉRATIONNEL)
           ========================================================================= */}
        <main className={`flex-grow min-w-0 ${mobileView === "list" ? "hidden md:block" : "block"}`}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[550px]">
            
            <div>
              {/* Barre de retour et tag */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileView("list");
                    resetToolState();
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-black transition cursor-pointer shadow-xs group"
                >
                  <i className="fa-solid fa-arrow-left text-sm text-[#E5322D] group-hover:-translate-x-1 transition-transform"></i>
                  <span>← Retour aux outils</span>
                </button>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${activeItem.tagColor}`}>
                  {activeItem.tag}
                </span>
              </div>

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
              {/* Champ de sélection de fichiers — MONTÉ EN PERMANENCE.
                  Il vivait auparavant dans la zone de dépôt (vue 3), rendue
                  uniquement quand aucun fichier n'est choisi. Dès la première
                  sélection l'affichage bascule sur la vue 2, l'input était
                  démonté, fileInputRef.current tombait à null, et le bouton
                  « Ajouter des fichiers » exécutait un ?.click() sur null :
                  aucun sélecteur ne s'ouvrait, aucun message. Il devenait donc
                  impossible d'ajouter un second document à une fusion.
                  Le sortir de la condition est la seule correction qui tienne :
                  le champ doit survivre aux changements de vue. */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple={Boolean(activeItem.allowMultiple)}
                accept={activeItem.acceptFiles || "*"}
                onChange={(e) => {
                  const champ = e.target;
                  // ORDRE CRITIQUE : on copie les références de fichiers, on
                  // vide le champ, ET SEULEMENT ENSUITE on traite.
                  //
                  // Vider après l'appel créait une course. handleFilesAdded est
                  // asynchrone : sur les outils qui lisent le PDF dès la
                  // sélection — organiser, diviser, PDF en JPG — il suspend sur
                  // `await arrayBuffer()`, la main revient ici, `value = ""`
                  // vide la FileList pendant que la lecture est en vol, et
                  // celle-ci échoue. Le catch effaçait alors la sélection en
                  // affichant « ce fichier n'a pas pu être lu » : l'outil
                  // paraissait refuser tout document.
                  //
                  // Le vidage reste indispensable : sans lui, resélectionner le
                  // MÊME fichier n'émet aucun événement `change`.
                  const fichiers = champ?.files ? Array.from(champ.files) : [];
                  champ.value = "";
                  if (fichiers.length > 0) handleFilesAdded(fichiers);
                }}
              />

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

                  {activeItem.type === "organize" && pageOrder.length > 0 && (
                    <div className="mb-6 text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                          {pageOrder.length - Object.keys(deletedPages).length} page(s) conservée(s) sur {pageCount}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPageOrder(Array.from({ length: pageCount }, (_, i) => i));
                            setPageRotations({});
                            setDeletedPages({});
                          }}
                          className="text-[11px] font-extrabold text-gray-500 hover:text-[#E5322D] underline underline-offset-2 cursor-pointer"
                        >
                          Tout réinitialiser
                        </button>
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-4 leading-relaxed">
                        Faites glisser une page pour la déplacer, ou utilisez les flèches. Le bouton de rotation tourne
                        la page d&apos;un quart de tour, la croix la retire du document final.
                      </p>

                      {thumbsLoading && (
                        <p className="text-xs font-bold text-gray-400 mb-3">
                          <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                          Préparation des aperçus…
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {pageOrder.map((indexOriginal, position) => {
                          const supprimee = Boolean(deletedPages[indexOriginal]);
                          const rotation = pageRotations[indexOriginal] || 0;
                          const miniature = pageThumbs[indexOriginal];
                          return (
                            <div
                              key={indexOriginal}
                              draggable={!supprimee}
                              onDragStart={() => setDraggedPage(position)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => deposerPage(position)}
                              onDragEnd={() => setDraggedPage(null)}
                              className={`group relative rounded-2xl border-2 p-2 transition select-none ${
                                supprimee
                                  ? "border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/50 opacity-60"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-[#E5322D] cursor-grab active:cursor-grabbing"
                              } ${draggedPage === position ? "ring-2 ring-[#E5322D] ring-offset-1" : ""}`}
                            >
                              {/* Aperçu réel de la page. Sans miniature — moteur
                                  indisponible — on affiche une vignette numérotée
                                  plutôt que de bloquer l'outil. */}
                              <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                                {miniature ? (
                                  // next/image ne convient pas ici : la source est
                                  // une data: URL produite dans le navigateur au
                                  // moment du rendu, jamais un fichier connu à la
                                  // compilation. L'optimiseur ne peut rien en faire,
                                  // et l'image pèse déjà ~15 Ko.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={miniature}
                                    alt={`Page ${indexOriginal + 1}`}
                                    className="max-h-full max-w-full object-contain transition-transform duration-200"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                  />
                                ) : (
                                  <span className="text-2xl font-black text-gray-300 dark:text-gray-600">
                                    {indexOriginal + 1}
                                  </span>
                                )}
                              </div>

                              {/* Actions : visibles en permanence sur écran tactile,
                                  où le survol n'existe pas. */}
                              <div className="absolute top-1 right-1 flex gap-1">
                                {!supprimee && (
                                  <button
                                    type="button"
                                    onClick={() => rotatePage(indexOriginal)}
                                    title="Tourner d'un quart de tour"
                                    aria-label={`Tourner la page ${indexOriginal + 1}`}
                                    className="w-7 h-7 rounded-full bg-white/95 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:text-[#E5322D] shadow-sm flex items-center justify-center cursor-pointer"
                                  >
                                    <i className="fa-solid fa-rotate-right text-[11px]"></i>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => togglePageDeleted(indexOriginal)}
                                  title={supprimee ? "Rétablir cette page" : "Retirer cette page"}
                                  aria-label={
                                    supprimee
                                      ? `Rétablir la page ${indexOriginal + 1}`
                                      : `Retirer la page ${indexOriginal + 1}`
                                  }
                                  className={`w-7 h-7 rounded-full border shadow-sm flex items-center justify-center cursor-pointer ${
                                    supprimee
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-white/95 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:text-[#E5322D]"
                                  }`}
                                >
                                  <i className={`fa-solid ${supprimee ? "fa-rotate-left" : "fa-xmark"} text-[11px]`}></i>
                                </button>
                              </div>

                              <div className="flex items-center justify-between mt-2 px-0.5">
                                <button
                                  type="button"
                                  onClick={() => movePage(position, -1)}
                                  disabled={position === 0}
                                  aria-label={`Déplacer la page ${indexOriginal + 1} vers la gauche`}
                                  className="w-6 h-6 rounded-lg text-gray-400 hover:text-[#E5322D] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                                </button>
                                <span className="text-[11px] font-black text-gray-600 dark:text-gray-300 tabular-nums">
                                  {supprimee ? "retirée" : position + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => movePage(position, 1)}
                                  disabled={position === pageOrder.length - 1}
                                  aria-label={`Déplacer la page ${indexOriginal + 1} vers la droite`}
                                  className="w-6 h-6 rounded-lg text-gray-400 hover:text-[#E5322D] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
                        : "border-[#E3DBCC] dark:border-gray-800 hover:border-red-400/80 bg-[#FAF6F1]/50 dark:bg-gray-800/10"
                    }`}
                  >

                    {/* Bouton Principal de Sélection de Fichier */}
                    <div className="flex items-center justify-center mb-3">
                      {activeItem.link ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (triggerAuthGuard(activeItem.name, activeItem.icon)) {
                              window.location.href = activeItem.link;
                            }
                          }}
                          className="inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-[#E5322D] hover:bg-[#C92520] text-white text-base sm:text-lg font-black shadow-xl shadow-red-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
                        >
                          <span>{activeItem.selectLabel}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (triggerAuthGuard(activeItem.name, activeItem.icon)) {
                              fileInputRef.current?.click();
                            }
                          }}
                          className="inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-[#E5322D] hover:bg-[#C92520] text-white text-base sm:text-lg font-black shadow-xl shadow-red-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
                        >
                          <span>{activeItem.selectLabel}</span>
                        </button>
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

      {/* Modale d'inscription requise pour les visiteurs */}
      <AuthRequiredModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        featureName={authModalFeature || activeItem.name}
        featureIcon={authModalIcon || activeItem.icon}
        redirectUrl={`/fonctionnalites?tool=${activeTabId}`}
      />

    </div>
  );
}
