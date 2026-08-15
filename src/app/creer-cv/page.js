/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PricingModal from "@/components/PricingModal";
import TemplatePreviewModal from "@/components/TemplatePreviewModal";

// --- DICTIONNAIRE DE TRADUCTION POUR LE CREATEUR DE CV ---
const translations = {
  FR: {
    navHome: "Accueil",
    navService: "Service",
    navMessages: "Messagerie",
    navRecruitment: "Recrutement",
    navContact: "Contactez-nous",
    navLogin: "Se connecter",
    
    // Sidebar
    step0: "Coordonnées",
    step1: "Expérience",
    step2: "Formation",
    step3: "Compétences",
    step4: "Profil",
    step5: "Langue",
    step6: "Compléments",
    step7: "Finalisation",
    
    sidebarFooter1: "Conditions d'utilisation",
    sidebarFooter2: "Politique de confidentialité",
    sidebarFooter3: "Nous contacter",
    sidebarFooterCopyright: "© 2026 Facilite.",

    // Actions
    btnBack: "Retour",
    btnContinue: "Continuer",
    btnFinish: "Télécharger mon CV (PDF)",
    btnAdding: "+ Ajouter",
    btnDelete: "Supprimer",

    // Step 0 - Coordonnées
    step0Title: "Commencez par compléter vos coordonnées",
    step0Subtitle: "Indiquez au moins votre nom et votre adresse e-mail afin que les employeurs puissent vous joindre.",
    labelPhoto: "Importer une photo",
    labelCvLang: "Langue du CV",
    labelFirstName: "Prénom",
    labelLastName: "Nom",
    labelAddress: "Adresse postale (Facultatif)",
    labelPostalCode: "Code postal",
    labelCity: "Ville",
    labelPhone: "Téléphone",
    labelEmail: "Adresse e-mail",
    extraFieldsTitle: "Informations supplémentaires",
    extraAge: "Âge / Date de naissance",
    extraLicense: "Permis de conduire / Véhicule",
    extraNationality: "Nationalité",
    extraMarital: "Situation familiale",
    extraLinkedin: "LinkedIn / Autre site",
    extraAvailability: "Disponibilité / Mobilité",

    // Step 1 - Expérience
    step1Title: "Parlez-nous de vos expériences professionnelles",
    step1Subtitle: "Ajoutez vos emplois précédents pour montrer vos compétences et vos réalisations aux recruteurs.",
    btnAddExp: "+ Ajouter une expérience",
    labelJobTitle: "Poste / Titre",
    labelEmployer: "Employeur / Entreprise",
    labelStartDate: "Date de début",
    labelEndDate: "Date de fin",
    labelCurrent: "Poste actuel",
    labelDescription: "Description des tâches / Réalisations",
    helperExpTitle: "Phrases suggérées pour vous aider :",
    helperExpText1: "• Gérer la relation client et traiter les demandes téléphoniques.",
    helperExpText2: "• Concevoir et développer des interfaces utilisateurs modernes.",
    helperExpText3: "• Coordonner les plannings et animer les réunions d'équipe.",

    // Step 2 - Formation
    step2Title: "Quel est votre parcours scolaire ?",
    step2Subtitle: "Indiquez vos diplômes et vos écoles pour valoriser vos connaissances théoriques.",
    btnAddEdu: "+ Ajouter une formation",
    labelDegree: "Diplôme / Titre",
    labelSchool: "École / Établissement",

    // Step 3 - Compétences
    step3Title: "Quelles sont vos compétences clés ?",
    step3Subtitle: "Ajoutez vos forces techniques, humaines ou informatiques. Évaluez votre niveau.",
    btnAddSkill: "+ Ajouter une compétence",
    labelSkillName: "Compétence (ex: Next.js, Gestion de projet)",
    labelSkillLevel: "Niveau",
    levelBeg: "Débutant",
    levelInt: "Intermédiaire",
    levelAdv: "Avancé",
    levelExp: "Expert",

    // Step 4 - Profil
    step4Title: "Rédigez une courte présentation professionnelle",
    step4Subtitle: "En quelques lignes, résumez vos objectifs professionnels, vos points forts et ce que vous pouvez apporter.",
    labelProfileText: "Description de votre profil",
    placeholderProfile: "Professionnel passionné par... fort de X années d'expérience en... je souhaite apporter mes compétences en...",

    // Step 5 - Langue
    step5Title: "Quelles langues maîtrisez-vous ?",
    step5Subtitle: "Ajoutez les langues parlées et votre niveau de maîtrise associé.",
    btnAddLang: "+ Ajouter une langue",
    labelLangName: "Langue (ex: Français, Wolof, Anglais)",
    labelLangLevel: "Niveau de maîtrise",

    // Step 6 - Compléments
    step6Title: "Ajoutez vos informations complémentaires",
    step6Subtitle: "Qualités, compétences informatiques et centres d'intérêt pour enrichir votre profil.",
    btnAddQuality: "+ Ajouter une qualité",
    btnAddItSkill: "+ Ajouter un outil informatique",
    btnAddHobby: "+ Ajouter un centre d'intérêt",
    labelQuality: "Qualité (ex: Rigueur, Polyvalence)",
    labelItSkill: "Informatique (ex: Pack Office, Réseaux Sociaux)",
    labelHobby: "Centre d'intérêt (ex: Sport, Lecture)",

    // Step 7 - Finalisation
    step7Title: "Personnalisez et téléchargez votre CV",
    step7Subtitle: "Choisissez le modèle et la couleur d'accent qui vous correspondent le mieux, puis téléchargez votre document prêt à l'emploi.",
    chooseTemplate: "1. Choisissez un modèle de CV",
    templateModern: "Moderne",
    templateMinimal: "Minimaliste",
    templateClassic: "Classique",
    templateExecutif: "Exécutif",
    templateCreatif: "Créatif",
    templateTechnique: "Technique",
    templateProfessionnel: "Professionnel",
    templateEntrepreneur: "Entrepreneur",
    templateElegance: "Élégance",
    chooseColor: "2. Choisissez une couleur d'accentuation",
    previewNotice: "Vous pourrez toujours modifier les informations et le design ultérieurement.",
    
    // Success Toast & Modals
    modalSuccessTitle: "Votre CV est prêt !",
    modalSuccessDesc: "Le téléchargement PDF va démarrer dans quelques instants. Vous pouvez maintenant postuler directement aux offres.",
    btnGoToJobs: "Voir les offres d'emploi",
    toastFileUploaded: "Photo importée avec succès !",
    toastContactOpen: "Formulaire de contact ouvert.",
  },
  GB: {
    navHome: "Home",
    navService: "Service",
    navMessages: "Messaging",
    navRecruitment: "Recruitment",
    navContact: "Contact us",
    navLogin: "Sign in",
    
    // Sidebar
    step0: "Contact Info",
    step1: "Experience",
    step2: "Education",
    step3: "Skills",
    step4: "Profile",
    step5: "Languages",
    step6: "Complements",
    step7: "Finalization",
    
    sidebarFooter1: "Terms of use",
    sidebarFooter2: "Privacy policy",
    sidebarFooter3: "Contact us",
    sidebarFooterCopyright: "© 2026 Facilite.",

    // Actions
    btnBack: "Back",
    btnContinue: "Continue",
    btnFinish: "Download my CV (PDF)",
    btnAdding: "+ Add",
    btnDelete: "Delete",

    // Step 0 - Coordonnées
    step0Title: "Start by completing your contact info",
    step0Subtitle: "Provide at least your name and email address so employers can reach you.",
    labelPhoto: "Upload photo",
    labelCvLang: "CV Language",
    labelFirstName: "First Name",
    labelLastName: "Last Name",
    labelAddress: "Postal Address (Optional)",
    labelPostalCode: "Postal Code",
    labelCity: "City",
    labelPhone: "Phone",
    labelEmail: "Email address",
    extraFieldsTitle: "Additional Information",
    extraAge: "Age / Birthdate",
    extraLicense: "Driving license / Vehicle",
    extraNationality: "Nationality",
    extraMarital: "Marital status",
    extraLinkedin: "LinkedIn / Website",
    extraAvailability: "Availability / Mobility",

    // Step 1 - Expérience
    step1Title: "Tell us about your work experience",
    step1Subtitle: "Add your previous jobs to showcase your skills and accomplishments to recruiters.",
    btnAddExp: "+ Add work experience",
    labelJobTitle: "Job Title / Role",
    labelEmployer: "Employer / Company",
    labelStartDate: "Start Date",
    labelEndDate: "End Date",
    labelCurrent: "Current job",
    labelDescription: "Description of duties / Achievements",
    helperExpTitle: "Suggested bullet points to help you:",
    helperExpText1: "• Manage client relations and handle incoming phone inquiries.",
    helperExpText2: "• Design and develop modern, responsive user interfaces.",
    helperExpText3: "• Coordinate team schedules and facilitate alignment meetings.",

    // Step 2 - Formation
    step2Title: "What is your educational background?",
    step2Subtitle: "Add your degrees and schools to highlight your academic credentials.",
    btnAddEdu: "+ Add education",
    labelDegree: "Degree / Diploma",
    labelSchool: "School / Institution",

    // Step 3 - Compétences
    step3Title: "What are your key skills?",
    step3Subtitle: "Add your technical, soft, or computing skills. Evaluate your proficiency level.",
    btnAddSkill: "+ Add skill",
    labelSkillName: "Skill (e.g. Next.js, Project Management)",
    labelSkillLevel: "Level",
    levelBeg: "Beginner",
    levelInt: "Intermediate",
    levelAdv: "Advanced",
    levelExp: "Expert",

    // Step 4 - Profil
    step4Title: "Write a short professional profile summary",
    step4Subtitle: "In a few sentences, summarize your professional goals, strengths, and what value you offer.",
    labelProfileText: "Profile description",
    placeholderProfile: "Passionate professional with X years of experience in... looking to bring skills in...",

    // Step 5 - Langue
    step5Title: "What languages do you speak?",
    step5Subtitle: "Add the languages you speak and your proficiency level.",
    btnAddLang: "+ Add language",
    labelLangName: "Language (e.g. English, French, Wolof)",
    labelLangLevel: "Proficiency level",

    // Step 6 - Compléments
    step6Title: "Add additional information",
    step6Subtitle: "Qualities, IT skills, and interests to enrich your profile.",
    btnAddQuality: "+ Add quality",
    btnAddItSkill: "+ Add IT skill",
    btnAddHobby: "+ Add interest",
    labelQuality: "Quality (e.g. Rigorous, Versatile)",
    labelItSkill: "IT (e.g. MS Office, Social Media)",
    labelHobby: "Interest (e.g. Sport, Reading)",

    // Step 7 - Finalisation
    step7Title: "Customize and download your CV",
    step7Subtitle: "Choose the template and accent color that best suit you, then download your ready-to-use document.",
    chooseTemplate: "1. Choose a CV template",
    templateModern: "Modern",
    templateMinimal: "Minimalist",
    templateClassic: "Classic",
    templateExecutif: "Executive",
    templateCreatif: "Creative",
    templateTechnique: "Technical",
    templateProfessionnel: "Professional",
    templateEntrepreneur: "Entrepreneur",
    templateElegance: "Elegance",
    chooseColor: "2. Choose an accent color",
    previewNotice: "You can always edit the information and design later.",
    
    // Success Toast & Modals
    modalSuccessTitle: "Your CV is ready!",
    modalSuccessDesc: "The PDF download will start in a few seconds. You can now apply directly to job offers.",
    btnGoToJobs: "Browse Job Offers",
    toastFileUploaded: "Photo uploaded successfully!",
    toastContactOpen: "Contact form opened.",
  }
};

// --- LISTE DES MODÈLES DE CV DU STUDIO ---
const cvTemplates = [
  { id: "entrepreneur", num: 1, name: "Modèle 1 — Entrepreneur Pro", category: "Officiel Facilité (Photo & 2 Col)", icon: "fa-rocket", previewUrl: "/model4.png", accentColor: "#10E688" },
  { id: "modern", num: 2, name: "Modèle 2 — Moderne", category: "2 Colonnes structuré", icon: "fa-grip", previewUrl: "/model1.png", accentColor: "#2563EB" },
  { id: "minimalist", num: 3, name: "Modèle 3 — Minimaliste", category: "Aéré & Moderne", icon: "fa-align-left", previewUrl: "/model2.png", accentColor: "#0EA5E9" },
  { id: "classic", num: 4, name: "Modèle 4 — Classique", category: "Traditionnel & Chic", icon: "fa-newspaper", previewUrl: "/model3.png", accentColor: "#475569" },
  { id: "executif", num: 5, name: "Modèle 5 — Exécutif", category: "Bandeau formel & dense", icon: "fa-briefcase", previewUrl: "/model5.png", accentColor: "#1E293B" },
  { id: "creatif", num: 6, name: "Modèle 6 — Créatif", category: "Coloré & asymétrique", icon: "fa-palette", previewUrl: "/model6.png", accentColor: "#8B5CF6" },
  { id: "technique", num: 7, name: "Modèle 7 — Technique", category: "Grille de compétences", icon: "fa-code", previewUrl: "/model7.png", accentColor: "#059669" },
  { id: "professionnel", num: 8, name: "Modèle 8 — Professionnel Canva", category: "Style Canva 1:1 (Cadres & Badges)", icon: "fa-palette", previewUrl: "/model8.png", accentColor: "#382F2D" },
  { id: "elegance", num: 9, name: "Modèle 9 — Élégance", category: "Sidebar noire, touches dorées", icon: "fa-crown", previewUrl: "/model9.png", accentColor: "#B45309" }
];

// --- CONTEXTE REACT DU STUDIO CANVA ---
const CanvaStudioContext = createContext({
  lockedElementIds: [],
  selectedCanvasElement: null,
  isAdvancedEditOpen: false,
  setSelectedCanvasElement: () => {},
  openContextMenu: () => {},
  handleMoveItem: () => {},
  handleDuplicateElement: () => {},
  handleToggleLock: () => {},
  handleMagicWrite: () => {},
  handleDeleteElement: () => {},
  elementOffsets: {},
  setElementOffsets: () => {},
  canvaZoom: 1
});

// --- COMPOSANT D'ÉDITION DE TEXTE DIRECTE EN LIGNE (STABLE, ZERO-REMUNTING, ULTRA-RÉACTIF) ---
function CanvaText({
  value = "",
  onChange,
  tagName: Tag = "span",
  className = "",
  placeholder = "Texte...",
  id = "",
  type = "text",
  name = "Texte",
  multiline = false
}) {
  const {
    lockedElementIds,
    selectedCanvasElement,
    isAdvancedEditOpen,
    setSelectedCanvasElement,
    openContextMenu
  } = useContext(CanvaStudioContext);

  const isLocked = lockedElementIds?.includes(id);
  const isSelected = selectedCanvasElement?.id === id;
  const elementRef = useRef(null);
  const isFocusedRef = useRef(false);

  // Synchronise la valeur venant du parent uniquement lorsque l'utilisateur n'a PAS le focus actif de frappe
  useEffect(() => {
    if (elementRef.current && !isFocusedRef.current) {
      const currentVal = elementRef.current.innerText;
      const targetVal = value || (isAdvancedEditOpen ? placeholder : "");
      if (currentVal !== targetVal) {
        elementRef.current.innerText = targetVal;
      }
    }
  }, [value, isAdvancedEditOpen, placeholder]);

  const handleInput = (e) => {
    const newText = e.currentTarget.innerText;
    if (onChange) {
      onChange(newText);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    setSelectedCanvasElement({ id, type, name, value: elementRef.current?.innerText || value });
  };

  const handleBlur = (e) => {
    isFocusedRef.current = false;
    const newText = e.currentTarget.innerText;
    if (onChange && newText !== value) {
      onChange(newText);
    }
  };

  return (
    <Tag
      ref={elementRef}
      contentEditable={!isLocked}
      suppressContentEditableWarning={true}
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedCanvasElement({ id, type, name, value: elementRef.current?.innerText || value });
      }}
      onKeyDown={(e) => {
        // Empêche les touches Suppr/Backspace de déclencher les raccourcis globaux du canva pendant la saisie
        e.stopPropagation();
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCanvasElement({ id, type, name, value: elementRef.current?.innerText || value });
        if (openContextMenu) {
          openContextMenu(e, { id, type, name, value: elementRef.current?.innerText || value });
        }
      }}
      className={`outline-none transition-all ${
        isSelected
          ? "ring-2 ring-[#8B3DFF] ring-offset-1 rounded-sm bg-purple-500/10 px-0.5"
          : isAdvancedEditOpen
          ? "hover:ring-1 hover:ring-purple-400/60 rounded-xs cursor-text"
          : "cursor-text hover:outline-dashed hover:outline-1 hover:outline-gray-300"
      } ${className}`}
      data-placeholder={placeholder}
      dangerouslySetInnerHTML={{ __html: value || (isAdvancedEditOpen ? placeholder : "") }}
    />
  );
}

// --- CONTENEUR D'ÉLÉMENT CANVA INTERACTIF (DÉPLACEMENT LIBRE, GLISSER-DÉPOSER, ACTIONS FLOTTANTES) ---
function CanvaElementWrapper({ id, type, name, children, className = "", style = {} }) {
  const {
    lockedElementIds,
    selectedCanvasElement,
    isAdvancedEditOpen,
    setSelectedCanvasElement,
    openContextMenu,
    handleMoveItem,
    handleDuplicateElement,
    handleToggleLock,
    handleMagicWrite,
    handleDeleteElement,
    elementOffsets = {},
    setElementOffsets,
    canvaZoom = 1
  } = useContext(CanvaStudioContext);

  const isSelected = selectedCanvasElement?.id === id;
  const isLocked = lockedElementIds?.includes(id);
  const offset = elementOffsets?.[id] || { x: 0, y: 0 };
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const startDrag = (e) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: offset.x,
      initialY: offset.y
    };

    const handleMouseMove = (moveEvent) => {
      const zoom = canvaZoom || 1;
      const dx = (moveEvent.clientX - dragRef.current.startX) / zoom;
      const dy = (moveEvent.clientY - dragRef.current.startY) / zoom;
      if (setElementOffsets) {
        setElementOffsets(prev => ({
          ...prev,
          [id]: {
            x: Math.round(dragRef.current.initialX + dx),
            y: Math.round(dragRef.current.initialY + dy)
          }
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const startTouchDrag = (e) => {
    if (isLocked || !e.touches[0]) return;
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialX: offset.x,
      initialY: offset.y
    };

    const handleTouchMove = (moveEvent) => {
      if (!moveEvent.touches[0]) return;
      const zoom = canvaZoom || 1;
      const dx = (moveEvent.touches[0].clientX - dragRef.current.startX) / zoom;
      const dy = (moveEvent.touches[0].clientY - dragRef.current.startY) / zoom;
      if (setElementOffsets) {
        setElementOffsets(prev => ({
          ...prev,
          [id]: {
            x: Math.round(dragRef.current.initialX + dx),
            y: Math.round(dragRef.current.initialY + dy)
          }
        }));
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  };

  const transformStyle = (offset.x !== 0 || offset.y !== 0) ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined;

  if (!isAdvancedEditOpen) {
    return (
      <div
        className={className}
        style={{
          ...style,
          ...(transformStyle ? { transform: transformStyle } : {})
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        if (e.target.isContentEditable) return;
        e.stopPropagation();
        setSelectedCanvasElement({ id, type, name });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCanvasElement({ id, type, name });
        if (openContextMenu) {
          openContextMenu(e, { id, type, name });
        }
      }}
      className={`relative transition-all ${
        isSelected
          ? "ring-2 ring-[#8B3DFF] ring-offset-1 z-30 shadow-md rounded-lg"
          : "hover:outline hover:outline-1 hover:outline-purple-400/80 hover:outline-dashed cursor-pointer group/canva-elem"
      } ${className}`}
      style={{
        ...style,
        ...(transformStyle ? { transform: transformStyle } : {}),
        transition: isDragging ? "none" : "box-shadow 0.2s, outline 0.2s, transform 0.1s ease-out"
      }}
    >
      {isSelected && (
        <div className="absolute -top-3.5 -left-1 z-40 bg-[#8B3DFF] text-white text-[8px] font-black px-1.5 py-0.2 rounded shadow-md pointer-events-none select-none uppercase tracking-wider flex items-center gap-1">
          <span>{name}</span>
          {isLocked && <i className="fa-solid fa-lock text-[7px]"></i>}
        </div>
      )}

      {/* Floating Action Bar (Monter, Descendre, Dupliquer, Verrouiller, IA, Supprimer) */}
      {isSelected && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 bg-[#111827] text-white px-2 py-1 rounded-xl shadow-2xl flex items-center gap-1 border border-slate-700 select-none animate-fadeIn no-print"
        >
          <button
            type="button"
            onClick={() => handleMoveItem && handleMoveItem({ id, type }, "up")}
            className="w-6 h-6 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-[10px] transition cursor-pointer"
            title="Monter (Alt+Haut)"
          >
            <i className="fa-solid fa-arrow-up"></i>
          </button>
          <button
            type="button"
            onClick={() => handleMoveItem && handleMoveItem({ id, type }, "down")}
            className="w-6 h-6 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-[10px] transition cursor-pointer"
            title="Descendre (Alt+Bas)"
          >
            <i className="fa-solid fa-arrow-down"></i>
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateElement && handleDuplicateElement({ id, type })}
            className="w-6 h-6 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-[10px] transition cursor-pointer"
            title="Dupliquer (Ctrl+D)"
          >
            <i className="fa-regular fa-copy"></i>
          </button>
          <button
            type="button"
            onClick={() => handleToggleLock && handleToggleLock({ id, type, name })}
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition cursor-pointer ${
              isLocked ? "bg-amber-500/30 text-amber-300" : "hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
            title="Verrouiller"
          >
            <i className={`fa-solid ${isLocked ? "fa-lock" : "fa-lock-open"}`}></i>
          </button>
          <button
            type="button"
            onClick={() => handleMagicWrite && handleMagicWrite({ id, type })}
            className="w-6 h-6 rounded-lg hover:bg-purple-600/40 text-purple-300 hover:text-purple-200 flex items-center justify-center text-[10px] transition cursor-pointer"
            title="Écriture Magique IA"
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
          </button>
          <button
            type="button"
            onClick={() => handleDeleteElement && handleDeleteElement({ id, type })}
            className="w-6 h-6 rounded-lg hover:bg-red-600/40 text-red-400 hover:text-red-200 flex items-center justify-center text-[10px] transition cursor-pointer"
            title="Supprimer (Suppr)"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      )}

      {/* Poignée de déplacement libre 4 directions (Style Canva ✥) */}
      {isSelected && !isLocked && (
        <div
          onMouseDown={startDrag}
          onTouchStart={startTouchDrag}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-40 w-7 h-7 rounded-full bg-white text-[#8B3DFF] shadow-xl border-2 border-[#8B3DFF] flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-115 transition-transform select-none no-print group"
          title="Cliquez et glissez pour déplacer librement cet élément partout sur la page"
        >
          <i className="fa-solid fa-up-down-left-right text-[11px] group-hover:scale-110 transition-transform"></i>
        </div>
      )}

      {children}
    </div>
  );
}

export default function CreerCv() {
  const [selectedLang, setSelectedLang] = useState("FR");
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState("entrepreneur");
  const [accentColor, setAccentColor] = useState("#10E688"); // Primary Green by default
  const [showPricingModal, setShowPricingModal] = useState(false);
  // Id du brouillon (resumes.id) une fois sauvegardé — lie la commande KPay
  // au contenu exact qui a servi à la payer, pour pouvoir régénérer le PDF
  // après paiement (le state React est perdu au retour de la redirection
  // KPay, seul ce qui est persisté en base survit).
  const [savedResumeId, setSavedResumeId] = useState(null);
  // Mode téléchargement post-paiement (?resumeId=...&download=1, lien
  // envoyé depuis /candidat/facturation une fois la commande "paid").
  const [downloadMode, setDownloadMode] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  // Aperçu plein écran d'un modèle avant sélection (TemplatePreviewModal.tsx
  // est en TypeScript ; pas d'annotation de type ici, ce fichier reste en JS.
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAdvancedEditOpen, setIsAdvancedEditOpen] = useState(false);
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(true);
  const [activeCanvaTab, setActiveCanvaTab] = useState("models");
  const [canvaFontFamily, setCanvaFontFamily] = useState("font-sans");
  const [canvaFontSize, setCanvaFontSize] = useState(14);
  const [canvaScale, setCanvaScale] = useState(1);
  const [canvaSectionSpacing, setCanvaSectionSpacing] = useState(1);
  const [canvaPhotoBorderWidth, setCanvaPhotoBorderWidth] = useState(4);
  const [canvaPhotoBorderColor, setCanvaPhotoBorderColor] = useState("#1B2B3A");
  const [canvaPhotoShape, setCanvaPhotoShape] = useState("circle");
  const [canvaTextAlign, setCanvaTextAlign] = useState("left");
  const [canvaBold, setCanvaBold] = useState(false);
  const [canvaItalic, setCanvaItalic] = useState(false);
  const [canvaUnderline, setCanvaUnderline] = useState(false);
  const [canvaUppercase, setCanvaUppercase] = useState(false);
  const [canvaSearchQuery, setCanvaSearchQuery] = useState("");
  const [canvaZoom, setCanvaZoom] = useState(1);
  const [elementOffsets, setElementOffsets] = useState({});
  const [cvPages, setCvPages] = useState([
    { id: 1, type: "cv_p1", title: "Page 1 — CV Principal", isLocked: false }
  ]);
  const [showAddPageMenu, setShowAddPageMenu] = useState(false);
  const [coverLetterData, setCoverLetterData] = useState({
    recipientName: "Responsable du Recrutement",
    companyName: "Entreprise Cible",
    city: "Dakar",
    date: "14/08/2026",
    subject: "Candidature au poste de Entrepreneur numérique",
    body: "Madame, Monsieur,\n\nVivement intéressé(e) par les opportunités au sein de votre structure, je vous présente ma candidature.\n\nFort(e) de mon parcours et des compétences acquises, je serais ravi(e) de mettre mon dynamisme et mon expertise au service de vos projets.\n\nDans l'attente d'un échange, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées."
  });
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });
  const [photoPreview, setPhotoPreview] = useState(null);
  
  // Canva Interactive Element Selection & Context Menu
  const [selectedCanvasElement, setSelectedCanvasElement] = useState(null);
  const [lockedElementIds, setLockedElementIds] = useState([]);
  const [groupedElementIds, setGroupedElementIds] = useState([]);
  const [clipboardElement, setClipboardElement] = useState(null);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, element: null });
  const contextMenuRef = useRef(null);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  
  // Mobile tab switcher: "edit" (form) or "preview" (document sheet)
  const [mobileTab, setMobileTab] = useState("edit");

  // Contact Modal State (linked to header footer)
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Resume Form Data State
  const [cvData, setCvData] = useState({
    firstName: "Macoumba",
    lastName: "Samake",
    jobTitle: "Entrepreneur numérique",
    email: "facilitefacile@gmail.com",
    phone: "+221 77 140 08 32",
    address: "",
    postalCode: "",
    city: "Pikine",
    birthDate: "",
    drivingLicense: "",
    nationality: "Sénégalaise",
    maritalStatus: "",
    linkedin: "https://www.linkedin.com/company/facilite-digital",
    availability: "Disponible",
    cvLang: "Français",
    photoZoom: 1,
    photoX: 50,
    photoY: 50,
    experiences: [
      {
        id: 1,
        title: "ENTREPRENEURE",
        employer: "AZMA Collection",
        city: "Dakar",
        startDate: "Jan 2024",
        endDate: "",
        current: true,
        description: "• Piloter quotidiennement les activités, suivre les stocks, gérer les inventaires et les commandes.\n• Accueillir, conseiller, vendre et fidéliser la clientèle.\n• Promouvoir les produits et gérer la relation fournisseur.\n• Faire preuve de rigueur, d'autonomie, de gestion des priorités et d'esprit d'initiative."
      },
      {
        id: 2,
        title: "GÉRANTE",
        employer: "AZMA Collection",
        city: "Dakar",
        startDate: "Jan 2024",
        endDate: "",
        current: true,
        description: "• Piloter quotidiennement les activités, suivre les stocks, gérer les inventaires et les commandes.\n• Accueillir, conseiller, vendre et fidéliser la clientèle.\n• Promouvoir les produits et gérer la relation fournisseur.\n• Faire preuve de rigueur, d'autonomie, de gestion des priorités et d'esprit d'initiative."
      }
    ],
    educations: [
      {
        id: 1,
        degree: "FORMATION DE DÉLÉGUÉE MÉDICALE ET GESTIONNAIRE EN PHARMACIE",
        school: "CEFAS (Centre de Formation Africain du Sénégal)",
        city: "Dakar",
        startDate: "Jan 2026",
        endDate: "",
        current: true,
        description: ""
      },
      {
        id: 2,
        degree: "TERMINALE",
        school: "Lycée de Kébémer",
        city: "Kébémer",
        startDate: "Jan 2024",
        endDate: "Jan 2025",
        current: false,
        description: ""
      },
      {
        id: 3,
        degree: "BREVET DE FIN D'ÉTUDES MOYENNES (BFEM)",
        school: "CEM Commune 3, Kébémer",
        city: "Kébémer",
        startDate: "Jan 2021",
        endDate: "Jan 2022",
        current: false,
        description: ""
      }
    ],
    skills: [
      { id: 1, name: "Gestion des stocks et inventaires", level: "Avancé" },
      { id: 2, name: "Accueil et fidélisation client", level: "Avancé" },
      { id: 3, name: "Négociation & relation fournisseurs", level: "Avancé" },
      { id: 4, name: "Rigueur et autonomie opérationnelle", level: "Avancé" }
    ],
    profile: "Professionnelle polyvalente du secteur pharmaceutique, diplômée en déléguée médicale et gestionnaire en pharmacie du CEFAS, je conjugue rigueur scientifique et expertise opérationnelle. Forte d'une expérience entrepreneuriale réussie, je maîtrise les enjeux de la gestion des stocks, de l'approvisionnement et de la relation client. Dotée d'une solide compréhension de la pharmacologie et des normes pharmaceutiques, je suis reconnue pour mon aisance relationnelle, ma capacité d'analyse et ma proactivité. Passionnée par le secteur de la santé, je souhaite mettre mon sens de l'organisation et mon efficacité au service de votre structure pour optimiser la qualité du conseil et le développement de vos activités.",
    languages: [
      { id: 1, name: "Français", level: "Langue véhiculaire" },
      { id: 2, name: "Wolof", level: "Langue maternelle" },
      { id: 3, name: "Anglais", level: "Intermédiaire (B2)" }
    ],
    qualities: [
      { id: 1, name: "Déléguée Médicale CEFAS" },
      { id: 2, name: "Gestionnaire en Pharmacie" }
    ],
    itSkills: [
      { id: 1, name: "Pack Office (Word, Excel)" },
      { id: 2, name: "Logiciels de gestion de stock" },
      { id: 3, name: "Canva & Outils numériques" }
    ],
    hobbies: [
      { id: 1, name: "Entrepreneuriat & Commerce" },
      { id: 2, name: "Santé & Pharmacologie" },
      { id: 3, name: "Technologies & Digital" }
    ],
    sectionTitles: {
      contact: "Coordonnées",
      experience: "EXPÉRIENCE",
      education: "FORMATION",
      skills: "APTITUDES",
      profile: "PROFIL",
      languages: "LANGUES",
      itSkills: "LOGICIELS",
      qualities: "CERTIFICATIONS",
      hobbies: "CENTRES D'INTÉRÊT"
    }
  });

  // Toggles for optional info fields
  const [optionalFields, setOptionalFields] = useState({
    birthDate: false,
    drivingLicense: false,
    nationality: false,
    maritalStatus: false,
    linkedin: false,
    availability: false
  });

  const fileInputRef = useRef(null);

  const t = translations[selectedLang] || translations.FR;

  // Trigger floating notifications
  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => {
      setToast({ show: false, message: "", icon: "fa-circle-info" });
    }, 3500);
  };

  // Rechargement pour édition depuis /candidat/mes-cvs (?resumeId=...). Lecture
  // de window.location.search dans un effet (jamais pendant le rendu, pour
  // éviter un hydration mismatch — même raison que isRecoveryMode dans
  // login/page.js) plutôt que useSearchParams(), qui imposerait de découper
  // ce composant sous un <Suspense> rien que pour ce paramètre optionnel.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resumeId");
    if (!resumeId) return;

    const isDownload = params.get("download") === "1";

    async function loadExistingResume() {
      const { data, error } = await supabase.from("resumes").select("content").eq("id", resumeId).single();

      if (error || !data?.content) {
        console.error("Erreur chargement CV existant:", error?.message);
        return;
      }

      setCvData(data.content);
      // selectedTemplate/accentColor sont embarqués dans content depuis
      // saveCvDraftAndOpenPricing (des clés en plus des champs cvData
      // habituels) — absents sur les brouillons enregistrés avant cet ajout,
      // les valeurs par défaut du composant s'appliquent alors normalement.
      if (data.content.selectedTemplate) setSelectedTemplate(data.content.selectedTemplate);
      if (data.content.accentColor) setAccentColor(data.content.accentColor);

      setSavedResumeId(resumeId);
      if (isDownload) {
        setDownloadMode(true);
        setActiveStep(7);
      } else {
        triggerToast("CV chargé pour modification.", "fa-file-import");
      }
    }

    loadExistingResume();
  }, []);

  // Synchronize language check from URL search parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTemplate = params.get("template");
      // window.location.search n'existe pas côté serveur : cette lecture
      // doit rester dans un effet (jamais pendant le rendu, pour éviter un
      // hydration mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!urlTemplate || urlTemplate === "1" || urlTemplate === "s1" || urlTemplate === "entrepreneur") setSelectedTemplate("entrepreneur");
      if (urlTemplate === "2" || urlTemplate === "s2" || urlTemplate === "modern") setSelectedTemplate("modern");
      if (urlTemplate === "3" || urlTemplate === "s3" || urlTemplate === "minimal" || urlTemplate === "minimalist") setSelectedTemplate("minimalist");
      if (urlTemplate === "4" || urlTemplate === "s4" || urlTemplate === "classic") setSelectedTemplate("classic");
      if (urlTemplate === "5" || urlTemplate === "s5" || urlTemplate === "executif") setSelectedTemplate("executif");
      if (urlTemplate === "6" || urlTemplate === "s6" || urlTemplate === "creatif") setSelectedTemplate("creatif");
      if (urlTemplate === "7" || urlTemplate === "s7" || urlTemplate === "technique") setSelectedTemplate("technique");
      if (urlTemplate === "8" || urlTemplate === "s8" || urlTemplate === "elegance") setSelectedTemplate("elegance");

      // ?color=<hex> depuis /modeles (sélecteur d'accent de la galerie) —
      // appliqué directement comme accentColor initial. Validé (motif hex
      // strict) avant application : une valeur invalide est simplement
      // ignorée plutôt que transmise telle quelle à un style inline. Sans
      // effet visuel sur les modèles à couleur fixe (entrepreneur,
      // elegance), normal — ils n'utilisent pas accentColor.
      const urlColor = params.get("color");
      if (urlColor && /^#[0-9A-Fa-f]{6}$/.test(urlColor)) {
        setAccentColor(urlColor);
      }
    }
  }, []);

  // Load imported CV data from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const importedStr = localStorage.getItem("imported_cv_data");
      if (importedStr) {
        try {
          const imported = JSON.parse(importedStr);
          if (imported) {
            // localStorage n'existe pas côté serveur : cette lecture doit
            // rester dans un effet (jamais pendant le rendu, pour éviter un
            // hydration mismatch).
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCvData(prev => ({
              ...prev,
              firstName: imported.firstName || prev.firstName,
              lastName: imported.lastName || prev.lastName,
              email: imported.email || prev.email,
              phone: imported.phone || prev.phone,
              profile: imported.summary || prev.profile,
              experiences: (imported.experiences && imported.experiences.length > 0)
                ? imported.experiences
                : prev.experiences,
              skills: (imported.skills && imported.skills.length > 0)
                ? imported.skills.map((s, idx) => ({ id: idx + 1, name: s, level: "Avancé" }))
                : prev.skills,
            }));

            // Auto-enable toggles for optional fields if they have content in imported data
            const newToggles = {};
            if (imported.birthDate) newToggles.birthDate = true;
            if (imported.drivingLicense) newToggles.drivingLicense = true;
            if (imported.nationality) newToggles.nationality = true;
            if (imported.maritalStatus) newToggles.maritalStatus = true;
            if (imported.linkedin) newToggles.linkedin = true;
            if (imported.availability) newToggles.availability = true;
            
            if (Object.keys(newToggles).length > 0) {
              setOptionalFields(prev => ({ ...prev, ...newToggles }));
            }

            setTimeout(() => {
              triggerToast("Données de CV importées !", "fa-file-circle-check");
            }, 800);

            // Clean up to prevent duplicate populating on refresh
            localStorage.removeItem("imported_cv_data");
          }
        } catch (e) {
          console.error("Error parsing imported CV data:", e);
        }
      }
    }
  }, []);

  // Handle profile image upload
  const handlePhotoUploadClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setCvData(prev => ({
          ...prev,
          photoZoom: 1,
          photoX: 50,
          photoY: 50
        }));
        triggerToast(t.toastFileUploaded);
      };
      reader.readAsDataURL(file);
    }
  };

  // Profile image interactive drag-to-pan repositioning using object-position percentages
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, photoX: 50, photoY: 50 });

  const handlePhotoDragStart = (e) => {
    e.preventDefault();
    setIsDraggingPhoto(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({
      x: clientX,
      y: clientY,
      photoX: cvData.photoX !== undefined ? cvData.photoX : 50,
      photoY: cvData.photoY !== undefined ? cvData.photoY : 50
    });
  };

  const handlePhotoDragMove = (e) => {
    if (!isDraggingPhoto) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    // Scale movement speed based on zoom level
    const zoom = cvData.photoZoom || 1;
    const sensitivity = 0.85 / zoom; 
    
    // Convert drag pixel delta to percentage changes (0% to 100%)
    const newX = Math.max(0, Math.min(100, dragStart.photoX - deltaX * sensitivity));
    const newY = Math.max(0, Math.min(100, dragStart.photoY - deltaY * sensitivity));
    
    setCvData(prev => ({
      ...prev,
      photoX: newX,
      photoY: newY
    }));
  };

  const handlePhotoDragEnd = () => {
    setIsDraggingPhoto(false);
  };

  // Cropper Modal States
  const [isCropping, setIsCropping] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);
  const [modalX, setModalX] = useState(0);
  const [modalY, setModalY] = useState(0);
  const [isDraggingModalImage, setIsDraggingModalImage] = useState(false);
  const [modalDragStart, setModalDragStart] = useState({ x: 0, y: 0, photoX: 0, photoY: 0 });

  const handleOpenCropper = () => {
    setModalZoom(cvData.photoZoom || 1);
    setModalX(cvData.photoX || 0);
    setModalY(cvData.photoY || 0);
    setIsCropping(true);
  };

  const handleModalImageDragStart = (e) => {
    e.preventDefault();
    setIsDraggingModalImage(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setModalDragStart({
      x: clientX,
      y: clientY,
      photoX: modalX,
      photoY: modalY
    });
  };

  // Drag the modal image behind the fixed circle
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingModalImage) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - modalDragStart.x;
      const deltaY = clientY - modalDragStart.y;
      
      const imgElement = document.getElementById("modal-crop-image");
      if (!imgElement) return;
      const rect = imgElement.getBoundingClientRect();
      const imageWidth = rect.width || 300;
      const imageHeight = rect.height || 300;

      // Convert drag pixel delta to percentage changes (1:1 cursor movement)
      const deltaPercentX = (deltaX / imageWidth) * 100;
      const deltaPercentY = (deltaY / imageHeight) * 100;

      const newX = Math.max(-100, Math.min(100, modalDragStart.photoX + deltaPercentX));
      const newY = Math.max(-100, Math.min(100, modalDragStart.photoY + deltaPercentY));

      setModalX(newX);
      setModalY(newY);
    };

    const handlePointerUp = () => {
      setIsDraggingModalImage(false);
    };

    if (isDraggingModalImage) {
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchmove", handlePointerMove);
      window.addEventListener("touchend", handlePointerUp);
    }

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDraggingModalImage, modalDragStart, modalZoom]);

  const applyCrop = () => {
    setCvData(prev => ({
      ...prev,
      photoZoom: modalZoom,
      photoX: modalX,
      photoY: modalY
    }));
    setIsCropping(false);
    triggerToast("Photo rognée avec succès !");
  };

  // Toggle optional fields
  const toggleOptionalField = (field) => {
    setOptionalFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Form field helpers
  const handlePersonalChange = (field, val) => {
    setCvData(prev => ({ ...prev, [field]: val }));
  };

  // Experiences handlers
  const handleAddExperience = () => {
    const newExp = {
      id: Date.now(),
      title: "",
      employer: "",
      city: "",
      startDate: "",
      endDate: "",
      current: false,
      description: ""
    };
    setCvData(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };

  const handleExpChange = (id, field, val) => {
    setCvData(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp => exp.id === id ? { ...exp, [field]: val } : exp)
    }));
  };

  const [improvingExpId, setImprovingExpId] = useState(null);

  const handleImproveWithAI = async (exp) => {
    if (!exp.description?.trim()) {
      triggerToast("Rédigez d'abord une description à améliorer.", "fa-triangle-exclamation");
      return;
    }
    setImprovingExpId(exp.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        triggerToast("Session expirée, reconnectez-vous.", "fa-triangle-exclamation");
        return;
      }

      const res = await fetch("/api/cv/improve-text", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text: exp.description }),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 402) {
        triggerToast("Crédits insuffisants. Rechargez votre compte pour utiliser l'IA.", "fa-coins");
        return;
      }
      if (!res.ok || !data?.improvedText) {
        triggerToast(data?.error || "Échec de la reformulation IA.", "fa-triangle-exclamation");
        return;
      }

      handleExpChange(exp.id, "description", data.improvedText);
      triggerToast("Description améliorée par l'IA !", "fa-wand-magic-sparkles");
    } catch (err) {
      console.error("Erreur amélioration IA:", err);
      triggerToast("Échec de la reformulation IA.", "fa-triangle-exclamation");
    } finally {
      setImprovingExpId(null);
    }
  };

  const handleDeleteExp = (id) => {
    setCvData(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id)
    }));
  };

  // Educations handlers
  const handleAddEducation = () => {
    const newEdu = {
      id: Date.now(),
      degree: "",
      school: "",
      city: "",
      startDate: "",
      endDate: "",
      current: false,
      description: ""
    };
    setCvData(prev => ({ ...prev, educations: [...prev.educations, newEdu] }));
  };

  const handleEduChange = (id, field, val) => {
    setCvData(prev => ({
      ...prev,
      educations: prev.educations.map(edu => edu.id === id ? { ...edu, [field]: val } : edu)
    }));
  };

  const handleDeleteEdu = (id) => {
    setCvData(prev => ({
      ...prev,
      educations: prev.educations.filter(edu => edu.id !== id)
    }));
  };

  // Skills handlers
  const handleAddSkill = () => {
    const newSkill = { id: Date.now(), name: "", level: "Intermédiaire" };
    setCvData(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
  };

  const handleSkillChange = (id, field, val) => {
    setCvData(prev => ({
      ...prev,
      skills: prev.skills.map(sk => sk.id === id ? { ...sk, [field]: val } : sk)
    }));
  };

  const handleDeleteSkill = (id) => {
    setCvData(prev => ({
      ...prev,
      skills: prev.skills.filter(sk => sk.id !== id)
    }));
  };

  // Languages handlers
  const handleAddLanguage = () => {
    const newLang = { id: Date.now(), name: "", level: "Intermédiaire" };
    setCvData(prev => ({ ...prev, languages: [...prev.languages, newLang] }));
  };

  const handleLangChange = (id, field, val) => {
    setCvData(prev => ({
      ...prev,
      languages: prev.languages.map(ln => ln.id === id ? { ...ln, [field]: val } : ln)
    }));
  };

  const handleDeleteLang = (id) => {
    setCvData(prev => ({
      ...prev,
      languages: prev.languages.filter(ln => ln.id !== id)
    }));
  };

  // Qualities handlers
  const handleAddQuality = () => {
    const newQuality = { id: Date.now(), name: "" };
    setCvData(prev => ({ ...prev, qualities: [...(prev.qualities || []), newQuality] }));
  };

  const handleQualityChange = (id, val) => {
    setCvData(prev => ({
      ...prev,
      qualities: (prev.qualities || []).map(q => q.id === id ? { ...q, name: val } : q)
    }));
  };

  const handleDeleteQuality = (id) => {
    setCvData(prev => ({
      ...prev,
      qualities: (prev.qualities || []).filter(q => q.id !== id)
    }));
  };

  // IT Skills handlers
  const handleAddItSkill = () => {
    const newSkill = { id: Date.now(), name: "" };
    setCvData(prev => ({ ...prev, itSkills: [...(prev.itSkills || []), newSkill] }));
  };

  const handleItSkillChange = (id, val) => {
    setCvData(prev => ({
      ...prev,
      itSkills: (prev.itSkills || []).map(s => s.id === id ? { ...s, name: val } : s)
    }));
  };

  const handleDeleteItSkill = (id) => {
    setCvData(prev => ({
      ...prev,
      itSkills: (prev.itSkills || []).filter(s => s.id !== id)
    }));
  };

  // Hobbies handlers
  const handleAddHobby = () => {
    const newHobby = { id: Date.now(), name: "" };
    setCvData(prev => ({ ...prev, hobbies: [...(prev.hobbies || []), newHobby] }));
  };

  const handleHobbyChange = (id, val) => {
    setCvData(prev => ({
      ...prev,
      hobbies: (prev.hobbies || []).map(h => h.id === id ? { ...h, name: val } : h)
    }));
  };

  const handleDeleteHobby = (id) => {
    setCvData(prev => ({
      ...prev,
      hobbies: (prev.hobbies || []).filter(h => h.id !== id)
    }));
  };

  // Next / Back buttons
  const handleNextStep = () => {
    if (activeStep < 7) setActiveStep(activeStep + 1);
  };

  const handleBackStep = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  // Sauvegarde du brouillon de CV avant d'ouvrir la modale de paiement : la
  // confection finale (export PDF) est désormais une prestation payante
  // (voir PricingModal) — on ne perd pas pour autant le travail déjà saisi.
  const saveCvDraftAndOpenPricing = async () => {
    if (savingDraft) return; // évite une double insertion en base sur un double-clic
    setSavingDraft(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resumeTitle = cvData.firstName && cvData.lastName
        ? `CV - ${cvData.firstName} ${cvData.lastName}`
        : "Mon CV Facilité";

      const { data: savedResume, error: saveError } = await supabase
        .from("resumes")
        .insert({
          user_id: session?.user?.id || null,
          title: resumeTitle,
          type: "created",
          // selectedTemplate/accentColor embarqués aux côtés des champs
          // cvData habituels : régénérer le PDF après paiement (voir
          // pdfExport.js) a besoin des trois pour reconstruire le même rendu.
          content: { ...cvData, selectedTemplate, accentColor },
          ats_score: 95,
        })
        .select("id")
        .single();

      if (saveError) throw saveError;

      setSavedResumeId(savedResume.id);
      triggerToast("Brouillon sauvegardé sur votre compte Supabase !", "fa-cloud-arrow-up");
    } catch (e) {
      console.error("Erreur de sauvegarde Supabase CV:", e);
      triggerToast("Échec de la sauvegarde du brouillon. Réessayez.", "fa-triangle-exclamation");
    } finally {
      setSavingDraft(false);
    }

    setShowPricingModal(true);
  };

  // Génération réelle du PDF — n'existe qu'en mode téléchargement
  // (?resumeId=...&download=1, atteint uniquement depuis un lien "Télécharger
  // mon CV" sur une commande déjà payée dans /candidat/facturation). Capture
  // l'aperçu déjà rendu à l'écran, WYSIWYG garanti (voir src/lib/pdfExport.js).
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const { exportElementToPdf } = await import("@/lib/pdfExport");
      const element = document.getElementById("cv-preview-sheet");
      const filename = cvData.firstName && cvData.lastName
        ? `CV-${cvData.firstName}-${cvData.lastName}.pdf`
        : "Mon-CV-Facilite.pdf";
      await exportElementToPdf(element, filename);
      triggerToast("PDF téléchargé avec succès !", "fa-file-pdf");
    } catch (e) {
      console.error("Erreur export PDF:", e);
      triggerToast("Échec de la génération du PDF. Réessayez.", "fa-triangle-exclamation");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Contact form modal
  const handleOpenContactModal = (e) => {
    if (e) e.preventDefault();
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
    setTimeout(() => {
      setFormSubmitted(false);
      setIsSubmitting(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 300);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      triggerToast(t.modalSuccessTitle, "fa-paper-plane");
    }, 1200);
  };

  const changeLanguage = (lang) => {
    setSelectedLang(lang);
    triggerToast(lang === "FR" ? "Langue modifiée" : "Language changed", "fa-globe");
  };

  // Listen to Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseContactModal();
        if (showPricingModal) setShowPricingModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactModalOpen, showPricingModal]);

  // Sidebar navigation mapping
  const stepsList = [
    { num: 0, label: cvData.sectionTitles?.contact || t.step0, icon: "fa-address-card" },
    { num: 1, label: cvData.sectionTitles?.experience || t.step1, icon: "fa-briefcase" },
    { num: 2, label: cvData.sectionTitles?.education || t.step2, icon: "fa-graduation-cap" },
    { num: 3, label: cvData.sectionTitles?.skills || t.step3, icon: "fa-circle-nodes" },
    { num: 4, label: cvData.sectionTitles?.profile || t.step4, icon: "fa-pen-to-square" },
    { num: 5, label: cvData.sectionTitles?.languages || t.step5, icon: "fa-language" },
    { num: 6, label: t.step6, icon: "fa-plus" },
    { num: 7, label: t.step7, icon: "fa-download" }
  ];

  // Helper for Suggested Phrases
  const addSuggestedPhrase = (expId, phrase) => {
    setCvData(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp => {
        if (exp.id === expId) {
          const desc = exp.description ? exp.description + "\n" + phrase : phrase;
          return { ...exp, description: desc };
        }
        return exp;
      })
    }));
    triggerToast("Phrase ajoutée !");
  };

  // Change active step and force tab to edit mode (essential for mobile & desktop)
  const handleGoToStep = (stepNum) => {
    setActiveStep(stepNum);
    setMobileTab("edit");
    if (typeof window !== "undefined") {
      const editorElem = document.getElementById("cv-form-editor-section");
      if (editorElem) {
        editorElem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Show live preview tab and scroll to it on mobile
  const handleShowPreviewMobile = () => {
    setMobileTab("preview");
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const previewElem = document.getElementById("cv-preview-sheet");
        if (previewElem) {
          previewElem.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 60);
    }
  };

  // Canva full view auto-fit calculation
  const handleAutoFit = () => {
    if (typeof window !== "undefined") {
      const availableHeight = window.innerHeight - 150;
      const availableWidth = window.innerWidth - 60;
      const fitScale = Math.min(availableHeight / 842, availableWidth / 595, 1.35);
      setCanvaZoom(parseFloat(fitScale.toFixed(2)));
    }
  };

  // Canva Page Management
  const handleAddPage = (type = "blank") => {
    const newId = Date.now();
    const newPage = {
      id: newId,
      type: type,
      title: type === "blank"
        ? `Page ${cvPages.length + 1} — Page Blanche Vierge`
        : type === "cover_letter"
        ? `Page ${cvPages.length + 1} — Lettre de motivation`
        : `Page ${cvPages.length + 1} — Suite du CV`,
      isLocked: false,
      notes: ""
    };
    setCvPages(prev => [...prev, newPage]);
    setShowAddPageMenu(false);
    triggerToast(type === "blank" ? "Nouvelle page blanche ajoutée !" : `Page ${cvPages.length + 1} ajoutée avec succès !`, "fa-file-circle-plus");
  };

  const handleDuplicatePage = (pageIndex) => {
    const targetPage = cvPages[pageIndex] || cvPages[0];
    const newId = Date.now();
    const newPage = {
      ...targetPage,
      id: newId,
      type: "cv_duplicate",
      title: `Page ${cvPages.length + 1} (Copie exacte de la page ${pageIndex + 1})`,
      isLocked: false
    };
    setCvPages(prev => [...prev, newPage]);
    setShowAddPageMenu(false);
    triggerToast("Page dupliquée à l'identique !");
  };

  const handleDeletePage = (pageIndex) => {
    if (cvPages.length <= 1) return;
    setCvPages(prev => prev.filter((_, idx) => idx !== pageIndex));
    triggerToast("Page supprimée");
  };

  const handleToggleLockPage = (pageIndex) => {
    setCvPages(prev => prev.map((p, idx) => idx === pageIndex ? { ...p, isLocked: !p.isLocked } : p));
    triggerToast(cvPages[pageIndex]?.isLocked ? "Page déverrouillée" : "Page verrouillée");
  };

  // --- ÉTAPE 4 : FONCTION D'APPEL ÉCRITURE MAGIQUE IA GEMINI ---
  const utiliserEcritureMagique = async (texteSelectionne) => {
    if (!texteSelectionne || !texteSelectionne.trim()) {
      triggerToast("Le texte à améliorer est vide.", "fa-circle-exclamation");
      return texteSelectionne;
    }
    try {
      setIsMagicLoading(true);
      console.log("L'IA réfléchit..."); 
      triggerToast("✨ L'IA Gemini améliore votre texte...", "fa-wand-magic-sparkles");

      const reponse = await fetch('/api/magique', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texteInitial: texteSelectionne }),
      });

      const data = await reponse.json();

      if (data.success && data.texteAmeliore) {
        console.log("Texte amélioré :", data.texteAmeliore);
        triggerToast("✨ Texte optimisé avec succès par l'IA !", "fa-circle-check");
        return data.texteAmeliore; 
      } else {
        alert("Erreur lors de l'amélioration du texte.");
        return texteSelectionne; // Fallback
      }
    } catch (error) {
      console.error("Problème de connexion", error);
      triggerToast("Problème de connexion avec l'IA.", "fa-triangle-exclamation");
      return texteSelectionne;
    } finally {
      setIsMagicLoading(false);
    }
  };

  const handleAiRewriteSummary = async () => {
    const job = cvData.jobTitle || "Professionnel";
    const initialText = cvData.profile || cvData.profileSummary || `Professionnel dynamique et orienté résultats avec une solide expertise en ${job}. Reconnu(e) pour ma rigueur, ma capacité d'adaptation rapide et mon engagement vers l'excellence opérationnelle.`;
    const texteAmeliore = await utiliserEcritureMagique(initialText);
    if (texteAmeliore) {
      setCvData(prev => ({
        ...prev,
        profile: texteAmeliore,
        profileSummary: texteAmeliore
      }));
    }
  };

  const handleAiAddKeywords = () => {
    setCvData(prev => ({
      ...prev,
      skills: [
        ...prev.skills,
        { id: Date.now(), name: "Gestion de projet & Rigueur", level: "Avancé" },
        { id: Date.now() + 1, name: "Leadership & Collaboration", level: "Expert" }
      ]
    }));
    triggerToast("Mots-clés clés ajoutés au CV !");
  };

  // --- GESTIONNAIRES INTERACTIFS CANVA STUDIO (Déplacer, Dupliquer, Supprimer, Grouper, Verrouiller) ---
  const handleToggleLock = (elem) => {
    if (!elem) return;
    setLockedElementIds(prev => {
      const exists = prev.includes(elem.id);
      const updated = exists ? prev.filter(id => id !== elem.id) : [...prev, elem.id];
      triggerToast(exists ? `Élément ${elem.name || ""} déverrouillé` : `Élément ${elem.name || ""} verrouillé`, exists ? "fa-lock-open" : "fa-lock");
      return updated;
    });
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleToggleGroup = (elem) => {
    if (!elem) return;
    setGroupedElementIds(prev => {
      const exists = prev.includes(elem.id);
      const updated = exists ? prev.filter(id => id !== elem.id) : [...prev, elem.id];
      triggerToast(exists ? "Éléments dégroupés" : "Éléments groupés avec succès !", "fa-object-group");
      return updated;
    });
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleDuplicateElement = (elem) => {
    if (!elem) return;
    if (elem.type === "experience") {
      const expToClone = cvData.experiences.find(e => e.id === elem.id) || cvData.experiences[0];
      if (expToClone) {
        const newExp = { ...expToClone, id: Date.now(), title: `${expToClone.title} (Copie)` };
        setCvData(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
        triggerToast("Expérience dupliquée !", "fa-copy");
      }
    } else if (elem.type === "education") {
      const eduToClone = cvData.educations.find(e => e.id === elem.id) || cvData.educations[0];
      if (eduToClone) {
        const newEdu = { ...eduToClone, id: Date.now(), degree: `${eduToClone.degree} (Copie)` };
        setCvData(prev => ({ ...prev, educations: [...prev.educations, newEdu] }));
        triggerToast("Formation dupliquée !", "fa-copy");
      }
    } else if (elem.type === "skill") {
      const skillToClone = cvData.skills.find(s => s.id === elem.id) || cvData.skills[0];
      if (skillToClone) {
        const newSkill = { ...skillToClone, id: Date.now(), name: `${skillToClone.name} (Copie)` };
        setCvData(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
        triggerToast("Compétence dupliquée !", "fa-copy");
      }
    } else if (elem.type === "language") {
      const langToClone = cvData.languages.find(l => l.id === elem.id) || cvData.languages[0];
      if (langToClone) {
        const newLang = { ...langToClone, id: Date.now() };
        setCvData(prev => ({ ...prev, languages: [...prev.languages, newLang] }));
        triggerToast("Langue dupliquée !", "fa-copy");
      }
    } else if (elem.type === "itSkill") {
      const itToClone = cvData.itSkills.find(i => i.id === elem.id) || cvData.itSkills[0];
      if (itToClone) {
        const newIt = { ...itToClone, id: Date.now() };
        setCvData(prev => ({ ...prev, itSkills: [...prev.itSkills, newIt] }));
        triggerToast("Outil informatique dupliqué !", "fa-copy");
      }
    } else if (elem.type === "hobby") {
      const hobToClone = cvData.hobbies.find(h => h.id === elem.id) || cvData.hobbies[0];
      if (hobToClone) {
        const newHob = { ...hobToClone, id: Date.now() };
        setCvData(prev => ({ ...prev, hobbies: [...prev.hobbies, newHob] }));
        triggerToast("Centre d'intérêt dupliqué !", "fa-copy");
      }
    } else {
      triggerToast("Élément dupliqué avec succès !", "fa-copy");
    }
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleDeleteElement = (elem) => {
    if (!elem) return;
    if (elem.type === "experience") {
      setCvData(prev => ({ ...prev, experiences: prev.experiences.filter(e => e.id !== elem.id) }));
      triggerToast("Expérience supprimée", "fa-trash");
    } else if (elem.type === "education") {
      setCvData(prev => ({ ...prev, educations: prev.educations.filter(e => e.id !== elem.id) }));
      triggerToast("Formation supprimée", "fa-trash");
    } else if (elem.type === "skill") {
      setCvData(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== elem.id) }));
      triggerToast("Compétence supprimée", "fa-trash");
    } else if (elem.type === "language") {
      setCvData(prev => ({ ...prev, languages: prev.languages.filter(l => l.id !== elem.id) }));
      triggerToast("Langue supprimée", "fa-trash");
    } else if (elem.type === "itSkill") {
      setCvData(prev => ({ ...prev, itSkills: prev.itSkills.filter(i => i.id !== elem.id) }));
      triggerToast("Outil supprimé", "fa-trash");
    } else if (elem.type === "hobby") {
      setCvData(prev => ({ ...prev, hobbies: prev.hobbies.filter(h => h.id !== elem.id) }));
      triggerToast("Centre d'intérêt supprimé", "fa-trash");
    } else if (elem.type === "profile") {
      setCvData(prev => ({ ...prev, profile: "" }));
      triggerToast("Résumé de profil masqué", "fa-trash");
    }
    setSelectedCanvasElement(null);
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleMoveItem = (elem, direction) => {
    if (!elem) return;
    const shift = (arr) => {
      const idx = arr.findIndex(item => item.id === elem.id);
      if (idx === -1) return arr;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return arr;
      const newArr = [...arr];
      const temp = newArr[idx];
      newArr[idx] = newArr[targetIdx];
      newArr[targetIdx] = temp;
      return newArr;
    };

    if (elem.type === "experience") {
      setCvData(prev => ({ ...prev, experiences: shift(prev.experiences) }));
      triggerToast(`Expérience déplacée vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else if (elem.type === "education") {
      setCvData(prev => ({ ...prev, educations: shift(prev.educations) }));
      triggerToast(`Formation déplacée vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else if (elem.type === "skill") {
      setCvData(prev => ({ ...prev, skills: shift(prev.skills) }));
      triggerToast(`Compétence déplacée vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else if (elem.type === "language") {
      setCvData(prev => ({ ...prev, languages: shift(prev.languages) }));
      triggerToast(`Langue déplacée vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else if (elem.type === "itSkill") {
      setCvData(prev => ({ ...prev, itSkills: shift(prev.itSkills) }));
      triggerToast(`Outil déplacé vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else if (elem.type === "hobby") {
      setCvData(prev => ({ ...prev, hobbies: shift(prev.hobbies) }));
      triggerToast(`Centre d'intérêt déplacé vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    } else {
      // Pour les sections et blocs uniques (ex: Profil, Photo, En-tête, Contact, etc.) -> translation verticale
      const deltaY = direction === "up" ? -15 : 15;
      setElementOffsets(prev => ({
        ...prev,
        [elem.id]: {
          x: prev[elem.id]?.x || 0,
          y: (prev[elem.id]?.y || 0) + deltaY
        }
      }));
      triggerToast(`Élément déplacé vers le ${direction === "up" ? "haut" : "bas"}`, "fa-arrows-up-down");
    }
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleMagicWrite = async (elem) => {
    if (!elem) return;
    setContextMenu({ show: false, x: 0, y: 0, element: null });

    if (elem.type === "profile") {
      await handleAiRewriteSummary();
    } else if (elem.type === "experience") {
      const exp = cvData.experiences.find(e => e.id === elem.id);
      const initialText = exp?.description || `Poste : ${exp?.title || "Technicien"} chez ${exp?.employer || "Entreprise"}.\n• Missions principales et réalisations majeures.\n• Gestion d'équipe et optimisation des performances.`;
      const improved = await utiliserEcritureMagique(initialText);
      if (improved) {
        setCvData(prev => ({
          ...prev,
          experiences: prev.experiences.map(e => e.id === elem.id ? { ...e, description: improved } : e)
        }));
      }
    } else if (elem.type === "education") {
      const edu = cvData.educations.find(e => e.id === elem.id);
      const initialText = `${edu?.degree || "Diplôme"} à ${edu?.school || "Établissement"}`;
      const improved = await utiliserEcritureMagique(initialText);
      if (improved) {
        setCvData(prev => ({
          ...prev,
          educations: prev.educations.map(e => e.id === elem.id ? { ...e, degree: improved } : e)
        }));
      }
    } else if (elem.type === "skill") {
      const skill = cvData.skills.find(s => s.id === elem.id);
      const initialText = skill?.name || "Compétence technique et gestion de projet";
      const improved = await utiliserEcritureMagique(initialText);
      if (improved) {
        setCvData(prev => ({
          ...prev,
          skills: prev.skills.map(s => s.id === elem.id ? { ...s, name: improved } : s)
        }));
      }
    } else {
      const initialText = cvData.jobTitle || "Titre professionnel";
      const improved = await utiliserEcritureMagique(initialText);
      if (improved) {
        setCvData(prev => ({ ...prev, jobTitle: improved }));
      }
    }
  };

  const handleCopyElement = () => {
    if (selectedCanvasElement) {
      setClipboardElement(selectedCanvasElement);
      triggerToast("Élément copié dans le presse-papier !", "fa-copy");
    }
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handleCopyStyle = () => {
    triggerToast("Style graphique copié !", "fa-paintbrush");
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  const handlePasteStyle = () => {
    triggerToast("Style graphique appliqué !", "fa-paste");
    setContextMenu({ show: false, x: 0, y: 0, element: null });
  };

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ show: false, x: 0, y: 0, element: null });
      }
    };
    const handleKeyDown = (e) => {
      const isInputActive = document.activeElement?.isContentEditable || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (e.key === "Escape") {
        setContextMenu({ show: false, x: 0, y: 0, element: null });
        setSelectedCanvasElement(null);
      } else if (e.key === "Delete" && selectedCanvasElement && !isInputActive) {
        handleDeleteElement(selectedCanvasElement);
      } else if (e.ctrlKey && e.key === "d" && selectedCanvasElement && !isInputActive) {
        e.preventDefault();
        handleDuplicateElement(selectedCanvasElement);
      } else if (selectedCanvasElement && !isInputActive && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const elemId = selectedCanvasElement.id;
        setElementOffsets(prev => {
          const cur = prev[elemId] || { x: 0, y: 0 };
          return {
            ...prev,
            [elemId]: {
              x: cur.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
              y: cur.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0)
            }
          };
        });
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu.show, selectedCanvasElement]);

  const openContextMenu = (e, elem) => {
    setContextMenu({
      show: true,
      x: Math.min(e.clientX, typeof window !== "undefined" ? window.innerWidth - 270 : 500),
      y: Math.min(e.clientY, typeof window !== "undefined" ? window.innerHeight - 400 : 300),
      element: elem
    });
  };

  useEffect(() => {
    if (isPreviewOpen) {
      handleAutoFit();
      const onResize = () => handleAutoFit();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, [isPreviewOpen]);

  const studioContextValue = {
    lockedElementIds,
    selectedCanvasElement,
    isAdvancedEditOpen,
    setSelectedCanvasElement,
    openContextMenu,
    handleMoveItem,
    handleDuplicateElement,
    handleToggleLock,
    handleMagicWrite,
    handleDeleteElement,
    elementOffsets,
    setElementOffsets,
    canvaZoom
  };

  return (
    <CanvaStudioContext.Provider value={studioContextValue}>
      {/* Toast Notification Top Floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        } no-print`}
      >
        <i className={`fa-solid ${toast.icon} text-[#10E688] text-xl`}></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) */}
      <nav className="hidden">
        <div className="max-w-[1440px] mx-auto w-full h-full flex items-center justify-between">
          
          {/* Logo brand */}
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>
            <div className="hidden sm:flex items-center pl-4 border-l border-gray-300">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">CV Builder Pro</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="flex items-center space-x-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition"
            >
              <i className="fa-solid fa-house text-base"></i>
              <span>{t.navHome}</span>
            </Link>
            <Link
              href="/service"
              className="flex items-center space-x-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition"
            >
              <i className="fa-solid fa-briefcase text-base"></i>
              <span>{t.navService}</span>
            </Link>
            <a
              href="#"
              onClick={handleOpenContactModal}
              className="flex items-center space-x-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition"
            >
              <i className="fa-regular fa-comment-dots text-base"></i>
              <span>{t.navContact}</span>
            </a>
          </div>

          {/* Right Group */}
          <div className="flex items-center space-x-3">
            <Link
              href="/service"
              className="bg-gray-900 text-white text-xs font-extrabold px-4 py-2 rounded-full hover:bg-gray-800 transition active:scale-95"
            >
              Quitter
            </Link>
          </div>

        </div>
      </nav>

      {/* Main Workspace Wrapper (Full viewport, height minus navbar) */}
      <div className="flex-grow flex flex-col md:flex-row pt-16 min-h-[calc(100vh-4rem)] bg-gray-50 w-full max-w-full overflow-x-hidden">
        
        {/* SIDEBAR: EITHER CANVA LATERAL STUDIO OR STANDARD WIZARD STEPS */}
        {isAdvancedEditOpen ? (
          /* FULL CANVA LATERAL STUDIO */
          <div className="flex flex-row flex-shrink-0 z-30 no-print">
            {/* 1. VERTICAL ICON NAV RAIL (Canva Left Rail) */}
            <div className="w-20 bg-[#0A0E1A] border-r border-slate-800 flex flex-col justify-between py-3 items-center text-slate-400 select-none">
              <div className="flex flex-col items-center space-y-2.5 w-full px-1">
                {/* Modèles */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("models")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "models"
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "hover:bg-slate-800/70 hover:text-white"
                  }`}
                  title="Modèles de CV"
                >
                  <i className="fa-solid fa-table-cells-large text-sm mb-1"></i>
                  <span className="text-[9px] font-extrabold">Modèles</span>
                </button>

                {/* Éléments */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("elements")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "elements"
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "hover:bg-slate-800/70 hover:text-white"
                  }`}
                  title="Éléments & Structure"
                >
                  <i className="fa-solid fa-shapes text-sm mb-1"></i>
                  <span className="text-[9px] font-extrabold">Éléments</span>
                </button>

                {/* Texte */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("text")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "text"
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "hover:bg-slate-800/70 hover:text-white"
                  }`}
                  title="Texte & Typographie"
                >
                  <i className="fa-solid fa-font text-sm mb-1"></i>
                  <span className="text-[9px] font-extrabold">Texte</span>
                </button>

                {/* Marque / Couleurs */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("colors")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "colors"
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "hover:bg-slate-800/70 hover:text-white"
                  }`}
                  title="Couleurs & Marque"
                >
                  <i className="fa-solid fa-palette text-sm mb-1"></i>
                  <span className="text-[9px] font-extrabold">Marque</span>
                </button>

                {/* Importer / Photos */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("photo")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "photo"
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "hover:bg-slate-800/70 hover:text-white"
                  }`}
                  title="Importer photos & médias"
                >
                  <i className="fa-solid fa-cloud-arrow-up text-sm mb-1"></i>
                  <span className="text-[9px] font-extrabold">Importer</span>
                </button>

                {/* IA Studio */}
                <button
                  type="button"
                  onClick={() => setActiveCanvaTab("ai")}
                  className={`w-full py-2 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    activeCanvaTab === "ai"
                      ? "bg-purple-600/25 text-purple-300 border border-purple-500/40"
                      : "hover:bg-slate-800/70 hover:text-purple-300"
                  }`}
                  title="Assistant IA Facilité"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-sm mb-1 text-purple-400"></i>
                  <span className="text-[9px] font-extrabold">IA Studio</span>
                </button>
              </div>

              {/* Bouton Revenir aux étapes */}
              <div className="w-full px-1.5 pt-2 border-t border-slate-800 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setIsAdvancedEditOpen(false)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white flex flex-col items-center justify-center transition cursor-pointer border border-slate-700 shadow-sm"
                  title="Revenir aux étapes standards"
                >
                  <i className="fa-solid fa-arrow-left text-xs mb-1"></i>
                  <span className="text-[8px] font-black uppercase text-center leading-tight">Étapes</span>
                </button>
              </div>
            </div>

            {/* 2. CANVA DRAWER PANEL */}
            <div className="w-72 sm:w-80 md:w-88 bg-[#111726] border-r border-slate-750 text-white flex flex-col h-[calc(100vh-4rem)] overflow-hidden shadow-2xl">
              {/* Drawer Header */}
              <div className="p-3.5 border-b border-slate-750 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    {activeCanvaTab === "models" && "Modèles de CV"}
                    {activeCanvaTab === "elements" && "Éléments & Structure"}
                    {activeCanvaTab === "text" && "Texte & Typographie"}
                    {activeCanvaTab === "colors" && "Couleurs & Charte"}
                    {activeCanvaTab === "photo" && "Photo & Médias"}
                    {activeCanvaTab === "ai" && "Studio IA Facilité"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdvancedEditOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="Fermer la modification avancée"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>

              {/* Drawer Content Body */}
              <div className="p-4 flex-grow overflow-y-auto space-y-4">
                
                {/* TAB: MODÈLES */}
                {activeCanvaTab === "models" && (
                  <div className="space-y-3">
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        value={canvaSearchQuery}
                        onChange={(e) => setCanvaSearchQuery(e.target.value)}
                        placeholder="Rechercher un modèle..."
                        className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    {/* BANNIÈRE QUICK ACTION: COPIER / COLLER LE STYLE CANVA 1:1 */}
                    <div className="p-3 bg-gradient-to-br from-amber-950/80 via-slate-900 to-amber-900/60 rounded-2xl border border-amber-500/50 shadow-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs border border-amber-400/40">
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </span>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>Style Canva 1:1 Officiel</span>
                            <span className="text-[9px] bg-amber-500 text-gray-950 px-1.5 py-0.2 rounded font-black">Top</span>
                          </div>
                          <div className="text-[9px] text-amber-200/80 font-medium">Cadres espresso, cartes sable & badges</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplate("professionnel");
                          setAccentColor("#382F2D");
                          setCanvaFontFamily("font-sans");
                          setCanvaPhotoShape("rounded");
                          setCanvaPhotoBorderWidth(2);
                          setCanvaPhotoBorderColor("#382F2D");
                          triggerToast("Style Canva 1:1 appliqué à votre CV !", "fa-palette");
                        }}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <i className="fa-solid fa-copy"></i>
                        <span>Copier & Coller le Style Canva</span>
                      </button>
                    </div>

                    <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between pt-1">
                      <span>Tous les modèles ({cvTemplates.length})</span>
                      <span className="text-blue-400 text-[10px]">Actif: {selectedTemplate}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {cvTemplates
                        .filter(t => !canvaSearchQuery || t.name.toLowerCase().includes(canvaSearchQuery.toLowerCase()) || t.category.toLowerCase().includes(canvaSearchQuery.toLowerCase()))
                        .map((tpl) => {
                          const isCur = selectedTemplate === tpl.id;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                setSelectedTemplate(tpl.id);
                                triggerToast(`Modèle ${tpl.name} appliqué !`);
                              }}
                              className={`relative rounded-xl p-2 text-left transition border cursor-pointer group flex flex-col justify-between h-28 ${
                                isCur
                                  ? "bg-blue-950/60 border-blue-500 shadow-md ring-2 ring-blue-500/30"
                                  : "bg-slate-850 border-slate-750 hover:border-slate-600 hover:bg-slate-800"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-extrabold text-white truncate block">{tpl.name}</span>
                                  {isCur && <i className="fa-solid fa-circle-check text-blue-400 text-xs"></i>}
                                </div>
                                <span className="text-[9px] text-slate-400 block">{tpl.category}</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                <div className="h-full" style={{ backgroundColor: tpl.accentColor, width: "100%" }}></div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* TAB: TEXTE */}
                {activeCanvaTab === "text" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Police de caractères</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "font-sans", name: "Public Sans" },
                          { id: "font-inter", name: "Inter" },
                          { id: "font-outfit", name: "Outfit" },
                          { id: "font-montserrat", name: "Montserrat" },
                          { id: "font-roboto", name: "Roboto" },
                          { id: "font-serif", name: "Playfair" },
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setCanvaFontFamily(f.id);
                              triggerToast(`Police ${f.name} appliquée`);
                            }}
                            className={`p-2 rounded-xl text-left border text-xs transition cursor-pointer ${
                              canvaFontFamily === f.id
                                ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1.5">
                        <span>Échelle de taille du texte</span>
                        <span className="text-blue-400">{Math.round(canvaScale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.85"
                        max="1.25"
                        step="0.05"
                        value={canvaScale}
                        onChange={(e) => setCanvaScale(parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Alignement du texte</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "left", icon: "fa-align-left", label: "Gauche" },
                          { id: "center", icon: "fa-align-center", label: "Centré" },
                          { id: "justify", icon: "fa-align-justify", label: "Justifié" },
                        ].map(al => (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => setCanvaTextAlign(al.id)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center text-xs transition cursor-pointer ${
                              canvaTextAlign === al.id
                                ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                            }`}
                          >
                            <i className={`fa-solid ${al.icon} mb-1`}></i>
                            <span className="text-[10px]">{al.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: COULEURS & MARQUE */}
                {activeCanvaTab === "colors" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Palettes de couleurs recommandées</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { name: "Bleu Royal", hex: "#2563EB" },
                          { name: "Émeraude", hex: "#10E688" },
                          { name: "Or / Ambre", hex: "#D97706" },
                          { name: "Violet", hex: "#8B5CF6" },
                          { name: "Anthracite", hex: "#1E293B" },
                          { name: "Bordeaux", hex: "#991B1B" },
                          { name: "Cyan Océan", hex: "#0EA5E9" },
                          { name: "Rose Bonbon", hex: "#EC4899" },
                        ].map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => {
                              setAccentColor(c.hex);
                              triggerToast(`Couleur ${c.name} sélectionnée !`);
                            }}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${
                              accentColor === c.hex
                                ? "border-white ring-2 ring-blue-400 bg-slate-800"
                                : "border-slate-700 hover:border-slate-500 bg-slate-850"
                            }`}
                          >
                            <span className="w-6 h-6 rounded-full shadow-inner border border-white/20 mb-1" style={{ backgroundColor: c.hex }}></span>
                            <span className="text-[9px] text-slate-300 truncate w-full text-center">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Couleur personnalisée (HEX)</label>
                      <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="bg-transparent border-0 text-white font-mono text-xs font-bold uppercase focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: PHOTO & MÉDIAS */}
                {activeCanvaTab === "photo" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Photo du profil</label>
                      <div className="flex items-center gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-700 border-2 border-slate-500 flex items-center justify-center flex-shrink-0">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fa-solid fa-user text-slate-400 text-lg"></i>
                          )}
                        </div>
                        <div>
                          <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-1.5">
                            <i className="fa-solid fa-upload text-[10px]"></i>
                            <span>Changer la photo</span>
                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1.5">Forme du cadre photo</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "circle", label: "Cercle", icon: "fa-circle" },
                          { id: "rounded", label: "Arrondi", icon: "fa-square" },
                          { id: "square", label: "Carré", icon: "fa-square-full" },
                        ].map(sh => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => setCanvaPhotoShape(sh.id)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center text-xs transition cursor-pointer ${
                              canvaPhotoShape === sh.id
                                ? "bg-blue-600/20 border-blue-500 text-white font-bold"
                                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
                            }`}
                          >
                            <i className={`fa-solid ${sh.icon} mb-1 text-sm`}></i>
                            <span className="text-[10px]">{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1.5">
                        <span>Épaisseur de la bordure</span>
                        <span className="text-blue-400">{canvaPhotoBorderWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={canvaPhotoBorderWidth}
                        onChange={(e) => setCanvaPhotoBorderWidth(parseInt(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* TAB: ÉLÉMENTS & CALQUES (Canva Elements & Layer Tree) */}
                {activeCanvaTab === "elements" && (
                  <div className="space-y-4">
                    {/* Espacement & Échelle */}
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                      <div className="flex justify-between text-[11px] font-bold text-slate-300">
                        <span>Espacement entre les sections</span>
                        <span className="text-blue-400 font-mono">{Math.round(canvaSectionSpacing * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.3"
                        step="0.05"
                        value={canvaSectionSpacing}
                        onChange={(e) => setCanvaSectionSpacing(parseFloat(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>

                    {/* Arborescence des Calques / Sections du CV */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <i className="fa-solid fa-layer-group text-blue-400"></i>
                          <span>Calques & Blocs du Document</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Canva Studio</span>
                      </div>

                      <div className="space-y-1.5">
                        {[
                          { id: "header", name: "En-tête & Titre", icon: "fa-heading", type: "header" },
                          { id: "contact", name: "Coordonnées & Contact", icon: "fa-address-card", type: "contact" },
                          { id: "profile", name: "Profil Professionnel", icon: "fa-user-pen", type: "profile" },
                          { id: "experience", name: `Expériences (${cvData.experiences.length})`, icon: "fa-briefcase", type: "experience", addAction: () => handleAddExperience() },
                          { id: "education", name: `Formations (${cvData.educations.length})`, icon: "fa-graduation-cap", type: "education", addAction: () => handleAddEducation() },
                          { id: "skills", name: `Compétences (${cvData.skills.length})`, icon: "fa-star", type: "skill", addAction: () => handleAddSkill() },
                          { id: "itSkills", name: `Informatique (${cvData.itSkills.length})`, icon: "fa-laptop-code", type: "itSkill", addAction: () => handleAddItSkill() },
                          { id: "languages", name: `Langues (${cvData.languages.length})`, icon: "fa-language", type: "language", addAction: () => handleAddLanguage() },
                          { id: "hobbies", name: `Centres d'intérêt (${cvData.hobbies.length})`, icon: "fa-lightbulb", type: "hobby", addAction: () => handleAddHobby() },
                        ].map((sec) => {
                          const isCur = selectedCanvasElement?.type === sec.type || selectedCanvasElement?.id === sec.id;
                          const isLocked = lockedElementIds.includes(sec.id);
                          return (
                            <div
                              key={sec.id}
                              onClick={() => setSelectedCanvasElement({ id: sec.id, type: sec.type, name: sec.name })}
                              className={`p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer group ${
                                isCur
                                  ? "bg-purple-950/60 border-purple-500 ring-1 ring-purple-500/40 shadow-sm"
                                  : "bg-slate-800/80 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isCur ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                                  <i className={`fa-solid ${sec.icon}`}></i>
                                </span>
                                <span className="text-xs font-bold text-white truncate">{sec.name}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                {sec.addAction && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); sec.addAction(); }}
                                    className="w-6 h-6 rounded-lg hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center text-[10px] transition cursor-pointer"
                                    title="Ajouter une entrée"
                                  >
                                    <i className="fa-solid fa-plus"></i>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleToggleLock(sec); }}
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition cursor-pointer ${
                                    isLocked ? "bg-amber-500/30 text-amber-300" : "hover:bg-slate-700 text-slate-400 hover:text-white"
                                  }`}
                                  title="Verrouiller / Déverrouiller"
                                >
                                  <i className={`fa-solid ${isLocked ? "fa-lock" : "fa-lock-open"}`}></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDuplicateElement(sec); }}
                                  className="w-6 h-6 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px] transition cursor-pointer"
                                  title="Dupliquer"
                                >
                                  <i className="fa-regular fa-copy"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions d'ajout rapide globales */}
                    <div className="pt-2 border-t border-slate-750 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Ajouter au CV</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddExperience()}
                          className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-[10.5px] font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-emerald-400 text-[9px]"></i>
                          <span>Expérience</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddEducation()}
                          className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-[10.5px] font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-emerald-400 text-[9px]"></i>
                          <span>Formation</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSkill()}
                          className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-[10.5px] font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-emerald-400 text-[9px]"></i>
                          <span>Compétence</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddLanguage()}
                          className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-[10.5px] font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-emerald-400 text-[9px]"></i>
                          <span>Langue</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: IA STUDIO */}
                {activeCanvaTab === "ai" && (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-500/30">
                      <div className="flex items-center gap-2 text-purple-300 font-black text-xs mb-1">
                        <i className="fa-solid fa-sparkles"></i>
                        <span>Assistant IA Facilité</span>
                      </div>
                      <p className="text-[10px] text-slate-300">Boostez votre CV avec des descriptions percutantes adaptées aux recruteurs.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAiRewriteSummary()}
                      className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-900/60 text-purple-300 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-purple-300">Reformuler le profil</span>
                        <span className="text-[9px] text-slate-400">Rendre le résumé professionnel plus percutant</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAiAddKeywords()}
                      className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-900/60 text-blue-300 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-key text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block group-hover:text-blue-300">Enrichir mots-clés ATS</span>
                        <span className="text-[9px] text-slate-400">Optimiser pour passer les filtres de recrutement</span>
                      </div>
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        ) : (
          /* STANDARD WIZARD STEPS SIDEBAR */
          <aside className="w-full md:w-64 bg-[#0F172A] text-white flex flex-col justify-between flex-shrink-0 border-r border-slate-800 no-print">
            
            {/* Scrollable list of steps */}
            <div className="p-4 flex-grow overflow-y-auto">
              <div className="mb-6 px-2">
                <div className="flex items-center space-x-2 text-[#10E688] font-bold text-xs uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-[#10E688] animate-pulse"></span>
                  <span>Édition en cours</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Les modifications sont enregistrées localement</p>
              </div>

              <nav className="space-y-1.5">
                {stepsList.map((step) => {
                  const isActive = activeStep === step.num;
                  const isCompleted = activeStep > step.num;
                  return (
                    <button
                      key={step.num}
                      onClick={() => handleGoToStep(step.num)}
                      title={`Modifier l'étape ${step.num + 1} : ${step.label}`}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer text-sm font-semibold group ${
                        isActive
                          ? "bg-[#1E293B] text-white border-l-4 border-[#10E688] shadow-md"
                          : "text-slate-400 hover:bg-slate-850 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                          isActive
                            ? "bg-[#10E688] text-gray-900"
                            : isCompleted
                              ? "bg-emerald-900/40 text-[#10E688] border border-emerald-500/30 group-hover:bg-emerald-800/60"
                              : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                        }`}>
                          {isCompleted ? (
                            <>
                              <i className="fa-solid fa-check group-hover:hidden"></i>
                              <i className="fa-solid fa-pen text-[10px] hidden group-hover:inline-block text-[#10E688]"></i>
                            </>
                          ) : (
                            <>
                              <span className="group-hover:hidden">{step.num + 1}</span>
                              <i className="fa-solid fa-pen text-[10px] hidden group-hover:inline-block text-white"></i>
                            </>
                          )}
                        </span>
                        <span className="group-hover:text-white transition-colors">{step.label}</span>
                      </div>

                      {/* Stylo d'édition visible */}
                      <div className="flex items-center gap-2">
                        {isCompleted && (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-[#10E688] bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1">
                            <i className="fa-solid fa-pen text-[8px]"></i>
                            <span>Modifier</span>
                          </span>
                        )}
                        <i className={`fa-solid ${isActive ? "fa-pen-to-square text-[#10E688] opacity-100" : isCompleted ? "fa-pen-to-square text-emerald-400/80 group-hover:text-[#10E688] group-hover:opacity-100 opacity-70" : step.icon} text-xs transition-all ${isActive ? "opacity-100 text-[#10E688]" : "opacity-40 group-hover:opacity-80"}`}></i>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* BOUTON MODIFICATION AVANCÉE */}
              <div className="pt-4 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsAdvancedEditOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer text-xs font-black bg-gradient-to-r from-blue-950/70 via-indigo-950/50 to-slate-900 border border-blue-500/40 hover:border-blue-400 text-blue-300 hover:text-white shadow-lg hover:shadow-blue-500/10 group"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 group-hover:text-white group-hover:bg-blue-600 transition-all">
                      <i className="fa-solid fa-sliders text-xs"></i>
                    </span>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-white text-xs">Modification Avancée</span>
                      <span className="text-[9px] text-blue-300/70 font-medium">Options expertes & styles</span>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[10px] text-blue-400/70 group-hover:translate-x-0.5 transition-transform"></i>
                </button>
              </div>
            </div>

            {/* Sidebar Footer links */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-center space-y-2">
              <div className="flex justify-center space-x-3 text-[10px] text-slate-400 font-bold">
                <a href="#" onClick={handleOpenContactModal} className="hover:text-white transition">{t.sidebarFooter3}</a>
                <span>•</span>
                <a href="#" className="hover:text-white transition">{t.sidebarFooter1}</a>
              </div>
              <p className="text-[9px] text-slate-500">{t.sidebarFooterCopyright} All rights reserved.</p>
            </div>
          </aside>
        )}

        {/* WORKSPACE AREA: Form Editor (Middle) + CV Live Preview (Right) */}
        <div className="flex-grow flex flex-col lg:flex-row h-full">
          
          {/* MOBILE TOGGLE TABS (Form vs Preview) */}
          <div className="flex lg:hidden bg-white border-b border-gray-200 px-4 py-2 justify-around font-bold text-xs no-print">
            <button
              onClick={() => setMobileTab("edit")}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mobileTab === "edit" ? "bg-gray-100 text-gray-950 border border-gray-200 shadow-inner" : "text-gray-500"
              }`}
            >
              <i className="fa-solid fa-pen-clip mr-2 text-[#10E688]"></i>
              Édition du CV
            </button>
            <button
              onClick={handleShowPreviewMobile}
              className={`flex-1 py-2 text-center rounded-lg transition-all cursor-pointer ${
                mobileTab === "preview" ? "bg-gray-100 text-gray-950 border border-gray-200 shadow-inner font-extrabold" : "text-gray-500 font-semibold"
              }`}
            >
              <i className="fa-solid fa-eye mr-2 text-blue-600"></i>
              Aperçu (Feuille)
            </button>
          </div>

          {/* MIDDLE AREA: The Form Editor (Hides on mobile if mobileTab is 'preview', collapsible on desktop) */}
          {isFormPanelOpen ? (
            <section
              id="cv-form-editor-section"
              className={`relative flex-1 p-6 md:p-8 bg-white border-r border-gray-200 overflow-y-auto max-w-full lg:max-w-2xl no-print ${
                mobileTab === "preview" ? "hidden lg:block" : "block"
              }`}
            >
              {/* CANVA-STYLE TOGGLE PILL BUTTON ON BORDER (< to collapse) */}
              <button
                type="button"
                onClick={() => setIsFormPanelOpen(false)}
                className="hidden lg:flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 rounded-full bg-white border border-gray-300 shadow-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-all cursor-pointer z-30 group hover:scale-105 active:scale-95 select-none"
                title="Réduire le formulaire d'édition"
              >
                <i className="fa-solid fa-chevron-left text-[10px] group-hover:scale-125 transition-transform"></i>
              </button>
            
            {/* Steps Headings */}
            <div className="mb-8">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
                Étape {activeStep + 1} sur 8
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-3 leading-tight">
                {activeStep === 0 && t.step0Title}
                {activeStep === 1 && t.step1Title}
                {activeStep === 2 && t.step2Title}
                {activeStep === 3 && t.step3Title}
                {activeStep === 4 && t.step4Title}
                {activeStep === 5 && t.step5Title}
                {activeStep === 6 && t.step6Title}
                {activeStep === 7 && t.step7Title}
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-2.5">
                {activeStep === 0 && t.step0Subtitle}
                {activeStep === 1 && t.step1Subtitle}
                {activeStep === 2 && t.step2Subtitle}
                {activeStep === 3 && t.step3Subtitle}
                {activeStep === 4 && t.step4Subtitle}
                {activeStep === 5 && t.step5Subtitle}
                {activeStep === 6 && t.step6Subtitle}
                {activeStep === 7 && t.step7Subtitle}
              </p>
            </div>

            {/* STEP 0 FORM: COORDONNÉES */}
            {activeStep === 0 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de vos coordonnées</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.contact || "Coordonnées"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), contact: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Coordonnées"
                  />
                </div>
                
                {/* Photo uploader + CV Lang dropdown */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 p-4 border border-gray-150 rounded-2xl bg-gray-50/50">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xs border border-gray-200 select-none">
                      <div
                        onMouseDown={photoPreview ? handlePhotoDragStart : handlePhotoUploadClick}
                        onMouseMove={photoPreview ? handlePhotoDragMove : null}
                        onMouseUp={photoPreview ? handlePhotoDragEnd : null}
                        onMouseLeave={photoPreview ? handlePhotoDragEnd : null}
                        onTouchStart={photoPreview ? handlePhotoDragStart : handlePhotoUploadClick}
                        onTouchMove={photoPreview ? handlePhotoDragMove : null}
                        onTouchEnd={photoPreview ? handlePhotoDragEnd : null}
                        className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center relative cursor-pointer bg-transparent`}
                      >
                        {photoPreview ? (
                          <>
                            <img
                              src={photoPreview}
                              alt="Preview"
                              style={{
                                transform: `scale(${cvData.photoZoom || 1}) translate(${cvData.photoX || 0}%, ${cvData.photoY || 0}%)`,
                                transition: "none",
                                pointerEvents: "none"
                              }}
                              className="w-full h-full object-cover select-none"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition pointer-events-none">
                              <i className="fa-solid fa-arrows-up-down-left-right text-white text-xs"></i>
                            </div>
                          </>
                        ) : (
                          <div className="text-center">
                            <i className="fa-solid fa-user-plus text-gray-400 text-base"></i>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={handlePhotoUploadClick}
                        className="text-xs font-extrabold text-blue-600 hover:text-blue-800 flex items-center space-x-1.5"
                      >
                        <i className="fa-solid fa-upload"></i>
                        <span>{t.labelPhoto}</span>
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1">Fichiers recommandés : JPG, PNG (Max 2MB)</p>
                      
                      {/* Zoom range slider & Cropper trigger */}
                      {photoPreview && (
                        <div className="mt-3 flex flex-col space-y-2 p-2.5 bg-gray-100/60 rounded-xl border border-gray-200/50">
                          <div>
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-wide">Ajuster le Zoom :</span>
                            <div className="flex items-center space-x-2 mt-1">
                              <i className="fa-solid fa-magnifying-glass-minus text-[10px] text-gray-400"></i>
                              <input
                                type="range"
                                min="1"
                                max="3.5"
                                step="0.05"
                                value={cvData.photoZoom || 1}
                                onChange={(e) => handlePersonalChange("photoZoom", parseFloat(e.target.value))}
                                className="w-24 accent-[#10E688] h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <i className="fa-solid fa-magnifying-glass-plus text-[10px] text-gray-400"></i>
                              <span className="text-[9px] font-black text-gray-600">{Math.round((cvData.photoZoom || 1) * 100)}%</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-gray-200/60 mt-1">
                            <button
                              type="button"
                              onClick={handleOpenCropper}
                              className="flex-1 py-1.5 px-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 font-extrabold rounded-lg text-[9px] flex items-center justify-center space-x-1 transition cursor-pointer"
                            >
                              <i className="fa-solid fa-crop-simple"></i>
                              <span>Rogner et ajuster</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCvData(prev => ({ ...prev, photoZoom: 1, photoX: 50, photoY: 50 }))}
                              className="py-1.5 px-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 font-extrabold rounded-lg text-[9px] transition cursor-pointer"
                            >
                              Réinitialiser
                            </button>
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="w-full sm:w-44">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelCvLang}</label>
                    <select
                      value={cvData.cvLang}
                      onChange={(e) => handlePersonalChange("cvLang", e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#10E688]/30"
                    >
                      <option value="Français">Français</option>
                      <option value="Anglais">English</option>
                      <option value="Espagnol">Español</option>
                    </select>
                  </div>
                </div>

                {/* Titre professionnel */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                    {selectedLang === "FR" ? "Titre professionnel / Métier visé" : "Professional Job Title"}
                  </label>
                  <input
                    type="text"
                    value={cvData.jobTitle || ""}
                    onChange={(e) => handlePersonalChange("jobTitle", e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition"
                    placeholder="ex. Entrepreneur numérique, Développeur Web, etc."
                  />
                </div>

                {/* Prénom, Nom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelFirstName}</label>
                    <input
                      type="text"
                      value={cvData.firstName}
                      onChange={(e) => handlePersonalChange("firstName", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="Marie"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelLastName}</label>
                    <input
                      type="text"
                      value={cvData.lastName}
                      onChange={(e) => handlePersonalChange("lastName", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="Bernard"
                    />
                  </div>
                </div>

                {/* Adresse */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelAddress}</label>
                  <input
                    type="text"
                    value={cvData.address}
                    onChange={(e) => handlePersonalChange("address", e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="50 avenue du Marché, appt. 5"
                  />
                </div>

                {/* CP, Ville */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelPostalCode}</label>
                    <input
                      type="text"
                      value={cvData.postalCode}
                      onChange={(e) => handlePersonalChange("postalCode", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="75001"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelCity}</label>
                    <input
                      type="text"
                      value={cvData.city}
                      onChange={(e) => handlePersonalChange("city", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="Paris"
                    />
                  </div>
                </div>

                {/* Tel, Mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelPhone}</label>
                    <input
                      type="tel"
                      value={cvData.phone}
                      onChange={(e) => handlePersonalChange("phone", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="06 56 10 20 30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.labelEmail}</label>
                    <input
                      type="email"
                      value={cvData.email}
                      onChange={(e) => handlePersonalChange("email", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder="marie.bernard@mail.com"
                    />
                  </div>
                </div>

                {/* Info supplémentaires (toggles) */}
                <div className="pt-4 border-t border-gray-150">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-3.5">{t.extraFieldsTitle}</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { field: "birthDate", label: t.extraAge, icon: "fa-calendar" },
                      { field: "drivingLicense", label: t.extraLicense, icon: "fa-car" },
                      { field: "nationality", label: t.extraNationality, icon: "fa-flag" },
                      { field: "maritalStatus", label: t.extraMarital, icon: "fa-ring" },
                      { field: "linkedin", label: t.extraLinkedin, icon: "fa-linkedin" },
                      { field: "availability", label: t.extraAvailability, icon: "fa-clock" }
                    ].map((btn) => {
                      const active = optionalFields[btn.field];
                      return (
                        <button
                          key={btn.field}
                          type="button"
                          onClick={() => toggleOptionalField(btn.field)}
                          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          <i className={`fa-solid ${btn.icon}`}></i>
                          <span>{btn.label}</span>
                          <span>{active ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Render optional inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    {optionalFields.birthDate && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraAge}</label>
                        <input
                          type="text"
                          value={cvData.birthDate}
                          onChange={(e) => handlePersonalChange("birthDate", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="28 ans (12 Mars 1998)"
                        />
                      </div>
                    )}
                    {optionalFields.drivingLicense && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraLicense}</label>
                        <input
                          type="text"
                          value={cvData.drivingLicense}
                          onChange={(e) => handlePersonalChange("drivingLicense", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="Permis B (Véhiculé)"
                        />
                      </div>
                    )}
                    {optionalFields.nationality && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraNationality}</label>
                        <input
                          type="text"
                          value={cvData.nationality}
                          onChange={(e) => handlePersonalChange("nationality", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="Sénégalaise"
                        />
                      </div>
                    )}
                    {optionalFields.maritalStatus && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraMarital}</label>
                        <input
                          type="text"
                          value={cvData.maritalStatus}
                          onChange={(e) => handlePersonalChange("maritalStatus", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="Célibataire"
                        />
                      </div>
                    )}
                    {optionalFields.linkedin && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraLinkedin}</label>
                        <input
                          type="url"
                          value={cvData.linkedin}
                          onChange={(e) => handlePersonalChange("linkedin", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="linkedin.com/in/marie-bernard"
                        />
                      </div>
                    )}
                    {optionalFields.availability && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{t.extraAvailability}</label>
                        <input
                          type="text"
                          value={cvData.availability}
                          onChange={(e) => handlePersonalChange("availability", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition"
                          placeholder="Immédiate - Mobile à Dakar"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* STEP 1 FORM: EXPÉRIENCE */}
            {activeStep === 1 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de vos expériences</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.experience || "EXPÉRIENCE"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), experience: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="EXPÉRIENCE"
                  />
                </div>
                
                {cvData.experiences.map((exp, idx) => (
                  <div key={exp.id} className="p-5 border border-gray-200 bg-gray-50/30 rounded-2xl relative space-y-4 shadow-xs">
                    
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteExp(exp.id)}
                      className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can mr-1.5"></i>
                      {t.btnDelete}
                    </button>

                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Expérience n°{idx + 1}</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelJobTitle}</label>
                        <input
                          type="text"
                          value={exp.title}
                          onChange={(e) => handleExpChange(exp.id, "title", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Ex: Conseiller Clientèle"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelEmployer}</label>
                        <input
                          type="text"
                          value={exp.employer}
                          onChange={(e) => handleExpChange(exp.id, "employer", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Ex: Orange Sénégal"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ville</label>
                        <input
                          type="text"
                          value={exp.city}
                          onChange={(e) => handleExpChange(exp.id, "city", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Dakar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelStartDate}</label>
                        <input
                          type="month"
                          value={exp.startDate}
                          onChange={(e) => handleExpChange(exp.id, "startDate", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelEndDate}</label>
                        <input
                          type="month"
                          value={exp.endDate}
                          disabled={exp.current}
                          onChange={(e) => handleExpChange(exp.id, "endDate", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        id={`curr-${exp.id}`}
                        checked={exp.current}
                        onChange={(e) => handleExpChange(exp.id, "current", e.target.checked)}
                        className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`curr-${exp.id}`} className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                        {t.labelCurrent}
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">{t.labelDescription}</label>
                      <textarea
                        rows="3"
                        value={exp.description}
                        onChange={(e) => handleExpChange(exp.id, "description", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Rédigez les tâches réalisées..."
                      ></textarea>

                      <button
                        type="button"
                        onClick={() => handleImproveWithAI(exp)}
                        disabled={improvingExpId === exp.id}
                        className="mt-2 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-extrabold rounded-lg border border-purple-200 transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                      >
                        <i className={`fa-solid ${improvingExpId === exp.id ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}></i>
                        {improvingExpId === exp.id ? "Amélioration en cours..." : "Améliorer avec l'IA"}
                      </button>

                      {/* AI-like Assistant Phrase Suggester */}
                      <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-2">
                          <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i>
                          {t.helperExpTitle}
                        </p>
                        <div className="flex flex-col space-y-1.5 text-xs text-blue-900">
                          <button
                            type="button"
                            onClick={() => addSuggestedPhrase(exp.id, "Gérer la relation client et traiter les demandes téléphoniques.")}
                            className="text-left font-medium hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            {t.helperExpText1}
                          </button>
                          <button
                            type="button"
                            onClick={() => addSuggestedPhrase(exp.id, "Concevoir et développer des interfaces utilisateurs modernes en React/Next.js.")}
                            className="text-left font-medium hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            {t.helperExpText2}
                          </button>
                          <button
                            type="button"
                            onClick={() => addSuggestedPhrase(exp.id, "Coordonner les plannings et animer les réunions d'équipe hebdomadaires.")}
                            className="text-left font-medium hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            {t.helperExpText3}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/30 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-plus-circle text-lg"></i>
                  <span>{t.btnAddExp}</span>
                </button>

              </div>
            )}

            {/* STEP 2 FORM: FORMATION */}
            {activeStep === 2 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de vos formations</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.education || "FORMATION"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), education: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="FORMATION"
                  />
                </div>
                
                {cvData.educations.map((edu, idx) => (
                  <div key={edu.id} className="p-5 border border-gray-200 bg-gray-50/30 rounded-2xl relative space-y-4 shadow-xs">
                    
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteEdu(edu.id)}
                      className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can mr-1.5"></i>
                      {t.btnDelete}
                    </button>

                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Formation n°{idx + 1}</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelDegree}</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => handleEduChange(edu.id, "degree", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Ex: Baccalauréat Scientifique"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelSchool}</label>
                        <input
                          type="text"
                          value={edu.school}
                          onChange={(e) => handleEduChange(edu.id, "school", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Ex: Lycée Lamine Guèye"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ville</label>
                        <input
                          type="text"
                          value={edu.city}
                          onChange={(e) => handleEduChange(edu.id, "city", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                          placeholder="Dakar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelStartDate}</label>
                        <input
                          type="month"
                          value={edu.startDate}
                          onChange={(e) => handleEduChange(edu.id, "startDate", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t.labelEndDate}</label>
                        <input
                          type="month"
                          value={edu.endDate}
                          disabled={edu.current}
                          onChange={(e) => handleEduChange(edu.id, "endDate", e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        id={`edu-curr-${edu.id}`}
                        checked={edu.current}
                        onChange={(e) => handleEduChange(edu.id, "current", e.target.checked)}
                        className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`edu-curr-${edu.id}`} className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                        Formation en cours
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">{t.labelDescription}</label>
                      <textarea
                        rows="3"
                        value={edu.description}
                        onChange={(e) => handleEduChange(edu.id, "description", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Mention, spécialisation, projets notables..."
                      ></textarea>
                    </div>

                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/30 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-plus-circle text-lg"></i>
                  <span>{t.btnAddEdu}</span>
                </button>

              </div>
            )}

            {/* STEP 3 FORM: COMPÉTENCES */}
            {activeStep === 3 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de vos aptitudes & compétences</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.skills || "APTITUDES"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), skills: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="APTITUDES"
                  />
                </div>
                
                <div className="space-y-3.5">
                  {cvData.skills.map((skill, idx) => (
                    <div key={skill.id} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-250/50 shadow-xs relative">
                      
                      <div className="w-full sm:flex-1">
                        <label className="block sm:hidden text-[9px] font-black text-gray-500 uppercase mb-1">Compétence {idx + 1}</label>
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => handleSkillChange(skill.id, "name", e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-600"
                          placeholder="Next.js, Anglais pro, Négociation..."
                        />
                      </div>

                      <div className="w-full sm:w-44 flex items-center space-x-2.5">
                        <select
                          value={skill.level}
                          onChange={(e) => handleSkillChange(skill.id, "level", e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-white text-xs font-semibold text-gray-800 focus:outline-none"
                        >
                          <option value="Débutant">{t.levelBeg}</option>
                          <option value="Intermédiaire">{t.levelInt}</option>
                          <option value="Avancé">{t.levelAdv}</option>
                          <option value="Expert">{t.levelExp}</option>
                        </select>

                        <button
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100/60 rounded-lg transition border border-red-200/20 cursor-pointer"
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-xs font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/20 transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <i className="fa-solid fa-plus text-sm"></i>
                  <span>{t.btnAddSkill}</span>
                </button>

              </div>
            )}

            {/* STEP 4 FORM: PROFIL */}
            {activeStep === 4 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de votre résumé / profil</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.profile || "PROFIL"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), profile: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="PROFIL"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t.labelProfileText}</label>
                  <textarea
                    rows="8"
                    value={cvData.profile}
                    onChange={(e) => handlePersonalChange("profile", e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-blue-600 transition"
                    placeholder={t.placeholderProfile}
                  ></textarea>
                  <div className="flex justify-between items-center mt-2.5 text-xs text-gray-400">
                    <span>Recommandation : 2 à 4 phrases maximum.</span>
                    <span className="font-bold text-gray-500">{cvData.profile.length} caractères</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5 FORM: LANGUE */}
            {activeStep === 5 && (
              <div className="space-y-6">
                
                {/* Personnalisation du Titre de la Section sur le CV */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50/50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <i className="fa-solid fa-pen"></i>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la Section sur le CV</span>
                      <p className="text-[10px] text-gray-500">Nom qui apparaîtra en haut de vos langues parlées</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={cvData.sectionTitles?.languages || "LANGUES"}
                    onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), languages: e.target.value } }))}
                    className="w-full sm:w-60 p-2.5 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="LANGUES"
                  />
                </div>
                
                <div className="space-y-3">
                  {cvData.languages.map((lang, idx) => (
                    <div key={lang.id} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-gray-50/80 rounded-xl border border-gray-250/50 shadow-xs relative">
                      
                      <div className="w-full sm:flex-1">
                        <label className="block sm:hidden text-[9px] font-black text-gray-500 uppercase mb-1">Langue {idx + 1}</label>
                        <input
                          type="text"
                          value={lang.name}
                          onChange={(e) => handleLangChange(lang.id, "name", e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-600"
                          placeholder="Français, Anglais, Espagnol..."
                        />
                      </div>

                      <div className="w-full sm:w-48 flex items-center space-x-2.5">
                        <select
                          value={lang.level}
                          onChange={(e) => handleLangChange(lang.id, "level", e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-white text-xs font-semibold text-gray-800 focus:outline-none"
                        >
                          <option value="Langue maternelle">Langue maternelle / Bilingue</option>
                          <option value="Courant (C1/C2)">Courant (C1/C2)</option>
                          <option value="Intermédiaire (B2)">Intermédiaire (B2)</option>
                          <option value="Limité (A2/B1)">Limité (A2/B1)</option>
                          <option value="Débutant (A1)">Débutant (A1)</option>
                        </select>

                        <button
                          onClick={() => handleDeleteLang(lang.id)}
                          className="text-red-500 hover:text-red-700 p-2 bg-red-50 hover:bg-red-100/60 rounded-lg transition border border-red-200/20 cursor-pointer"
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>

                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddLanguage}
                  className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-xs font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/20 transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <i className="fa-solid fa-plus text-sm"></i>
                  <span>{t.btnAddLang}</span>
                </button>

              </div>
            )}

            {/* STEP 6 FORM: COMPLEMENTS */}
            {activeStep === 6 && (
              <div className="space-y-8">
                {/* Qualités / Certifications */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <i className="fa-solid fa-pen text-blue-600 text-xs"></i>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la section sur le CV :</h3>
                    </div>
                    <input
                      type="text"
                      value={cvData.sectionTitles?.qualities || "CERTIFICATIONS"}
                      onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), qualities: e.target.value } }))}
                      className="w-full sm:w-56 p-2 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="CERTIFICATIONS"
                    />
                  </div>
                  <div className="space-y-3">
                    {(cvData.qualities || []).map((quality, idx) => (
                      <div key={quality.id} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={quality.name}
                          onChange={(e) => handleQualityChange(quality.id, e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-600"
                          placeholder={t.labelQuality}
                        />
                        <button
                          onClick={() => handleDeleteQuality(quality.id)}
                          className="text-red-500 hover:text-red-700 p-2.5 bg-red-50 hover:bg-red-100/60 rounded-lg transition border border-red-200/20"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddQuality}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/20 transition flex items-center justify-center space-x-1.5"
                    >
                      <i className="fa-solid fa-plus text-sm"></i>
                      <span>{t.btnAddQuality}</span>
                    </button>
                  </div>
                </div>

                {/* Informatique / Logiciels */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <i className="fa-solid fa-pen text-blue-600 text-xs"></i>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la section sur le CV :</h3>
                    </div>
                    <input
                      type="text"
                      value={cvData.sectionTitles?.itSkills || "LOGICIELS"}
                      onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), itSkills: e.target.value } }))}
                      className="w-full sm:w-56 p-2 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="LOGICIELS"
                    />
                  </div>
                  <div className="space-y-3">
                    {(cvData.itSkills || []).map((skill, idx) => (
                      <div key={skill.id} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => handleItSkillChange(skill.id, e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-600"
                          placeholder={t.labelItSkill}
                        />
                        <button
                          onClick={() => handleDeleteItSkill(skill.id)}
                          className="text-red-500 hover:text-red-700 p-2.5 bg-red-50 hover:bg-red-100/60 rounded-lg transition border border-red-200/20"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddItSkill}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/20 transition flex items-center justify-center space-x-1.5"
                    >
                      <i className="fa-solid fa-plus text-sm"></i>
                      <span>{t.btnAddItSkill}</span>
                    </button>
                  </div>
                </div>

                {/* Centres d'intérêt */}
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                      <i className="fa-solid fa-pen text-blue-600 text-xs"></i>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">Titre de la section sur le CV :</h3>
                    </div>
                    <input
                      type="text"
                      value={cvData.sectionTitles?.hobbies || "CENTRES D'INTÉRÊT"}
                      onChange={(e) => setCvData(prev => ({ ...prev, sectionTitles: { ...(prev.sectionTitles || {}), hobbies: e.target.value } }))}
                      className="w-full sm:w-56 p-2 text-xs font-black border border-blue-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="CENTRES D'INTÉRÊT"
                    />
                  </div>
                  <div className="space-y-3">
                    {(cvData.hobbies || []).map((hobby, idx) => (
                      <div key={hobby.id} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={hobby.name}
                          onChange={(e) => handleHobbyChange(hobby.id, e.target.value)}
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-600"
                          placeholder={t.labelHobby}
                        />
                        <button
                          onClick={() => handleDeleteHobby(hobby.id)}
                          className="text-red-500 hover:text-red-700 p-2.5 bg-red-50 hover:bg-red-100/60 rounded-lg transition border border-red-200/20"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddHobby}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-xs font-extrabold text-blue-600 hover:border-blue-500 hover:bg-blue-50/20 transition flex items-center justify-center space-x-1.5"
                    >
                      <i className="fa-solid fa-plus text-sm"></i>
                      <span>{t.btnAddHobby}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7 FORM: FINALISATION */}
            {activeStep === 7 && (
              <div className="space-y-8">
                
                {/* Template picker */}
                <div className="space-y-3.5">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t.chooseTemplate}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "entrepreneur", num: 1, name: "Modèle 1 — Entrepreneur Pro", desc: "Officiel Facilité (Photo & 2 Col)", icon: "fa-rocket", previewUrl: "/model4.png" },
                      { id: "modern", num: 2, name: "Modèle 2 — Moderne", desc: "2 Colonnes structuré", icon: "fa-grip", previewUrl: "/model1.png" },
                      { id: "minimalist", num: 3, name: "Modèle 3 — Minimaliste", desc: "Aéré & Moderne", icon: "fa-align-left", previewUrl: "/model2.png" },
                      { id: "classic", num: 4, name: "Modèle 4 — Classique", desc: "Traditionnel & Chic", icon: "fa-newspaper", previewUrl: "/model3.png" },
                      { id: "executif", num: 5, name: "Modèle 5 — Exécutif", desc: "Bandeau formel & dense", icon: "fa-briefcase", previewUrl: "/model5.png" },
                      { id: "creatif", num: 6, name: "Modèle 6 — Créatif", desc: "Coloré & asymétrique", icon: "fa-palette", previewUrl: "/model6.png" },
                      { id: "technique", num: 7, name: "Modèle 7 — Technique", desc: "Grille de compétences", icon: "fa-code", previewUrl: "/model7.png" },
                      { id: "professionnel", num: 8, name: "Modèle 8 — Professionnel Canva", desc: "Style Canva 1:1 (Cadres & Badges)", icon: "fa-palette", previewUrl: "/model8.png" },
                      { id: "elegance", num: 9, name: "Modèle 9 — Élégance", desc: "Sidebar noire, touches dorées", icon: "fa-crown", previewUrl: "/model9.png" }
                    ].map((tpl) => {
                      const active = selectedTemplate === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTemplate(tpl.id)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            setSelectedTemplate(tpl.id);
                          }}
                          className={`relative p-4 border-2 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            active
                              ? "bg-blue-50/40 border-blue-600 text-blue-700 shadow-md ring-2 ring-blue-500/10"
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <button
                            type="button"
                            title="Aperçu plein écran"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTemplate(tpl);
                              setIsPreviewOpen(true);
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition cursor-pointer"
                          >
                            <i className="fa-solid fa-eye text-[10px]"></i>
                          </button>
                          <i className={`fa-solid ${tpl.icon} text-xl mb-2.5`}></i>
                          <span className="text-xs font-extrabold block">{tpl.name}</span>
                          <span className="text-[9px] text-gray-400 font-medium mt-1">{tpl.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Color picker */}
                <div className="space-y-3.5 pt-2">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t.chooseColor}</h3>
                  <div className="flex items-center space-x-3.5 bg-gray-50/60 p-3 rounded-2xl border border-gray-150">
                    {[
                      { code: "#10E688", name: "Green (Brand)", ring: "ring-[#10E688]/30" },
                      { code: "#2563EB", name: "Royal Blue", ring: "ring-blue-400/30" },
                      { code: "#E4B8F9", name: "Purple", ring: "ring-purple-400/30" },
                      { code: "#1F2937", name: "Slate Dark", ring: "ring-gray-400/30" },
                      { code: "#EF4444", name: "Cherry Red", ring: "ring-red-400/30" }
                    ].map((col) => {
                      const active = accentColor === col.code;
                      return (
                        <button
                          key={col.code}
                          onClick={() => setAccentColor(col.code)}
                          style={{ backgroundColor: col.code }}
                          className={`w-9 h-9 rounded-full cursor-pointer transition-all hover:scale-105 border border-white ${
                            active ? `scale-110 shadow-lg ring-3 ${col.ring}` : "opacity-80"
                          }`}
                          title={col.name}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Download banner trigger */}
                <div className="p-5 bg-gradient-to-tr from-[#FAF6F1] to-[#E3DBCC]/30 rounded-[1.5rem] border border-[#E3DBCC]/60 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs">
                  <div className="text-left">
                    <h4 className="text-sm font-extrabold text-gray-900">
                      <i className="fa-solid fa-file-circle-check text-blue-600 mr-2"></i>
                      Document optimisé & validé
                    </h4>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      {downloadMode ? "Paiement confirmé — votre PDF est prêt." : t.previewNotice}
                    </p>
                  </div>

                  <button
                    onClick={downloadMode ? handleDownloadPdf : saveCvDraftAndOpenPricing}
                    disabled={downloadingPdf || savingDraft}
                    className="bg-gray-900 text-white font-extrabold py-3 px-6 rounded-full text-sm shadow-lg hover:bg-gray-800 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-60"
                  >
                    <i className={`fa-solid ${downloadingPdf || savingDraft ? "fa-spinner fa-spin" : "fa-download"}`}></i>
                    <span>{downloadingPdf ? "Génération..." : savingDraft ? "Enregistrement..." : downloadMode ? "Télécharger le PDF" : t.btnFinish}</span>
                  </button>
                </div>

              </div>
            )}

            {/* ACTION FOOTER BUTTONS: Retour / Continuer */}
            <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-200/80">
              <button
                type="button"
                onClick={handleBackStep}
                disabled={activeStep === 0}
                className="px-6 py-3 border border-gray-300 rounded-full text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition cursor-pointer"
              >
                {t.btnBack}
              </button>

              {activeStep < 7 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-7 py-3 bg-[#10E688] text-gray-900 rounded-full text-xs font-extrabold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer"
                >
                  {t.btnContinue}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={downloadMode ? handleDownloadPdf : saveCvDraftAndOpenPricing}
                  disabled={downloadingPdf || savingDraft}
                  className="px-7 py-3 bg-[#2563EB] text-white rounded-full text-xs font-extrabold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer disabled:opacity-60"
                >
                  <i className={`fa-solid ${downloadingPdf || savingDraft ? "fa-spinner fa-spin" : "fa-download"} mr-1.5`}></i>
                  {downloadingPdf ? "Génération..." : savingDraft ? "Enregistrement..." : downloadMode ? "Télécharger le PDF" : t.btnFinish}
                </button>
              )}
            </div>

          </section>
        ) : (
          /* COLLAPSED FORM PANEL SLIM BAR (> to expand) */
          <div className="hidden lg:flex flex-col items-center justify-start relative w-10 bg-white border-r border-gray-200 py-6 select-none z-20 no-print flex-shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => setIsFormPanelOpen(true)}
              className="w-6 h-12 rounded-full bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-all cursor-pointer group hover:scale-105 active:scale-95"
              title="Déplier le formulaire d'édition"
            >
              <i className="fa-solid fa-chevron-right text-[10px] group-hover:scale-125 transition-transform"></i>
            </button>
            <div
              className="mt-12 [writing-mode:vertical-lr] rotate-180 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 cursor-pointer transition flex items-center gap-2"
              onClick={() => setIsFormPanelOpen(true)}
            >
              <i className="fa-solid fa-pen text-[8px]"></i>
              <span>Formulaire d'édition</span>
            </div>
          </div>
        )}

          {/* RIGHT AREA: Live CV Preview Paper (Hides on mobile if mobileTab is 'edit') */}
          <section className={`flex-1 bg-slate-200/90 p-4 md:p-8 flex items-start justify-center overflow-auto min-h-0 ${
            mobileTab === "edit" ? "hidden lg:flex" : "flex"
          }`}>
            
            {/* Styled Sheet Wrapper (scaled with CSS dynamically if needed, optimized for paper format) */}
            <div style={{ transform: `scale(${canvaZoom})`, transformOrigin: "top center", transition: "transform 0.15s ease-out" }} className="sticky top-6 flex flex-col items-center">
              
              <div className="hidden sm:flex justify-between items-center w-full max-w-[595px] mb-3 text-xs text-gray-700 font-bold px-2 no-print">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 shadow-2xs hover:shadow-xs transition active:scale-95 cursor-pointer text-xs font-black text-gray-800 group"
                  title="Cliquer pour ouvrir l'aperçu complet et zoomer"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  <i className="fa-solid fa-eye text-blue-600 group-hover:scale-110 transition-transform"></i>
                  <span className="hidden md:inline">Aperçu A4</span>
                </button>

                {/* CANVA ZOOM TOOLBAR CONTROL */}
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2.5 py-1 shadow-2xs gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCanvaZoom(z => Math.max(0.2, +(z - 0.05).toFixed(2)))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700 font-black cursor-pointer text-xs"
                    title="Zoom arrière (-)"
                  >
                    –
                  </button>
                  <input
                    type="range"
                    min="0.2"
                    max="1.8"
                    step="0.05"
                    value={canvaZoom}
                    onChange={(e) => setCanvaZoom(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setCanvaZoom(z => Math.min(2.0, +(z + 0.05).toFixed(2)))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700 font-black cursor-pointer text-xs"
                    title="Zoom avant (+)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoFit}
                    className="text-[11px] font-black text-blue-600 hover:text-blue-800 cursor-pointer min-w-[40px] text-center"
                    title="Ajuster à l'écran"
                  >
                    {Math.round(canvaZoom * 100)} %
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500 font-semibold capitalize hidden sm:inline">
                    Modèle <strong className="text-gray-800">{selectedTemplate}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 text-[11px] font-bold shadow-2xs transition cursor-pointer"
                    title="Imprimer ou enregistrer en PDF"
                  >
                    <i className="fa-solid fa-print text-gray-500"></i>
                    <span>Imprimer</span>
                  </button>
                </div>
              </div>

              {/* CANVA CONTEXTUAL TOP FORMATTING BAR (Style Canva Top Menu) */}
              <div className="w-full max-w-[595px] flex items-center justify-between py-1.5 px-3 mb-2 bg-white/95 backdrop-blur-xs border border-gray-200 shadow-sm rounded-2xl text-xs text-gray-700 font-bold overflow-x-auto no-print gap-2">
                {/* Font selector */}
                <select
                  value={canvaFontFamily}
                  onChange={(e) => setCanvaFontFamily(e.target.value)}
                  className="bg-gray-100 hover:bg-gray-200 border-0 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 cursor-pointer focus:outline-hidden"
                >
                  <option value="font-sans">Public Sans</option>
                  <option value="font-inter">Inter</option>
                  <option value="font-outfit">Outfit</option>
                  <option value="font-montserrat">Montserrat</option>
                  <option value="font-roboto">Roboto</option>
                  <option value="font-serif">Playfair</option>
                </select>

                {/* Font Size - / + */}
                <div className="flex items-center bg-gray-100 rounded-lg px-1 py-0.5 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCanvaScale(prev => Math.max(0.85, parseFloat((prev - 0.05).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-black cursor-pointer"
                  >
                    –
                  </button>
                  <span className="text-[11px] font-black px-1.5 min-w-[28px] text-center text-gray-900">
                    {Math.round(canvaScale * 14)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCanvaScale(prev => Math.min(1.25, parseFloat((prev + 0.05).toFixed(2))))}
                    className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700 font-black cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Text Color A */}
                <label className="flex items-center gap-1 px-1.5 py-1 hover:bg-gray-100 rounded-lg cursor-pointer" title="Changer la couleur principale">
                  <span className="font-serif font-black text-sm text-gray-900">A</span>
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-2xs" style={{ backgroundColor: accentColor }}></span>
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="hidden" />
                </label>

                {/* Format buttons B, I, U, aA */}
                <div className="flex items-center gap-0.5 border-l border-gray-200 pl-1.5">
                  <button
                    type="button"
                    onClick={() => setCanvaBold(prev => !prev)}
                    className={`w-6 h-6 rounded flex items-center justify-center font-black cursor-pointer transition ${canvaBold ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-800"}`}
                    title="Gras"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvaItalic(prev => !prev)}
                    className={`w-6 h-6 rounded flex items-center justify-center italic font-serif cursor-pointer transition ${canvaItalic ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-800"}`}
                    title="Italique"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvaUnderline(prev => !prev)}
                    className={`w-6 h-6 rounded flex items-center justify-center underline cursor-pointer transition ${canvaUnderline ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-800"}`}
                    title="Souligné"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvaUppercase(prev => !prev)}
                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition ${canvaUppercase ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-800"}`}
                    title="Majuscules"
                  >
                    aA
                  </button>
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-0.5 border-l border-gray-200 pl-1.5">
                  <button
                    type="button"
                    onClick={() => setCanvaTextAlign("left")}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition ${canvaTextAlign === "left" ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-700"}`}
                    title="Aligner à gauche"
                  >
                    <i className="fa-solid fa-align-left text-[11px]"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvaTextAlign("center")}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition ${canvaTextAlign === "center" ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-700"}`}
                    title="Centrer"
                  >
                    <i className="fa-solid fa-align-center text-[11px]"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvaTextAlign("justify")}
                    className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition ${canvaTextAlign === "justify" ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-700"}`}
                    title="Justifier"
                  >
                    <i className="fa-solid fa-align-justify text-[11px]"></i>
                  </button>
                </div>

                {/* AI Assistant Quick Pill */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAdvancedEditOpen(true);
                    setActiveCanvaTab("ai");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black flex items-center gap-1 transition cursor-pointer"
                  title="Ouvrir l'assistant IA"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-[10px] text-purple-600"></i>
                  <span>IA</span>
                </button>
              </div>

              {/* CANVA TOP FLOATING PAGE 1 BAR */}
              <div className="w-full max-w-[595px] flex items-center justify-between py-1.5 px-3 mb-2 bg-slate-900/80 backdrop-blur-xs border border-slate-750 rounded-xl text-white text-xs font-bold shadow-xs no-print">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-black text-slate-200">Page 1 sur {cvPages.length}</span>
                  {cvPages[0]?.isLocked && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/30">
                      <i className="fa-solid fa-lock text-[8px]"></i> Verrouillée
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleLockPage(0)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                      cvPages[0]?.isLocked ? "bg-amber-500/30 text-amber-300 border border-amber-500/40" : "hover:bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                    title={cvPages[0]?.isLocked ? "Déverrouiller la page 1" : "Verrouiller la page 1"}
                  >
                    <i className={`fa-solid ${cvPages[0]?.isLocked ? "fa-lock" : "fa-lock-open"} text-xs`}></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicatePage(0)}
                    className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                    title="Dupliquer la page 1"
                  >
                    <i className="fa-regular fa-copy text-xs"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPage("blank")}
                    className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                    title="Ajouter une page blanche vide"
                  >
                    <i className="fa-solid fa-file-circle-plus text-xs text-blue-400"></i>
                  </button>
                  {cvPages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePage(0)}
                      className="w-7 h-7 rounded-lg hover:bg-red-500/30 hover:text-red-300 text-slate-400 flex items-center justify-center transition cursor-pointer"
                      title="Supprimer la page 1"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* The CV Document Sheet to print/view */}
              <div
                id="cv-preview-sheet"
                className="bg-white shadow-2xl relative w-[595px] min-h-[842px] h-[842px] max-w-[595px] max-h-[842px] min-w-[595px] overflow-hidden text-gray-900 border border-gray-300 rounded-sm flex flex-col font-sans transition-all duration-305"
              >
                
                {/* --- TEMPLATE 1: MODERNE (Two columns: Left sidebar colored, Right body white) --- */}
                {selectedTemplate === "modern" && (
                  <div className="flex w-full h-full text-xs flex-grow">
                    
                    {/* Left Column (Accent Sidebar) */}
                    <div
                      style={{ backgroundColor: accentColor === "#10E688" ? "#1e293b" : accentColor }}
                      className="w-[200px] text-white p-5 flex flex-col justify-between flex-shrink-0"
                    >
                      <div>
                        {/* Profile Picture (Outer White Circle) */}
                        <CanvaElementWrapper id="photo" type="photo" name="Photo de Profil" className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-5 shadow-md flex-shrink-0 relative select-none">
                          {/* Inner Image Circle */}
                          <div className="w-[84px] h-[84px] rounded-full overflow-hidden bg-transparent flex items-center justify-center relative">
                            {photoPreview ? (
                              <img
                                src={photoPreview}
                                alt="Profile"
                                onMouseDown={handlePhotoDragStart}
                                onMouseMove={handlePhotoDragMove}
                                onMouseUp={handlePhotoDragEnd}
                                onMouseLeave={handlePhotoDragEnd}
                                onTouchStart={handlePhotoDragStart}
                                touchMove={handlePhotoDragMove}
                                onTouchEnd={handlePhotoDragEnd}
                                style={{
                                  objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                                  transform: `scale(${cvData.photoZoom || 1})`,
                                  transition: "none",
                                  cursor: "move"
                                }}
                                className="w-full h-full object-cover select-none"
                              />
                            ) : (
                              <i className="fa-solid fa-user text-gray-400 text-3xl"></i>
                            )}
                          </div>
                        </CanvaElementWrapper>

                        {/* Coordonnées */}
                        <div className="space-y-4">
                          <CanvaElementWrapper id="contact" type="contact" name="Coordonnées">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">{cvData.sectionTitles?.contact?.toUpperCase() || "COORDONNÉES"}</h3>
                            <ul className="space-y-2 text-[10px] text-slate-200">
                              <li className="flex items-start space-x-1.5 min-w-0">
                                <i className="fa-regular fa-envelope mt-0.5 flex-shrink-0 text-white/60"></i>
                                <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" className="break-all" />
                              </li>
                              <li className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-phone mt-0.5 flex-shrink-0 text-white/60"></i>
                                <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" />
                              </li>
                              <li className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-location-dot mt-0.5 flex-shrink-0 text-white/60"></i>
                                <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville / Adresse" placeholder="Dakar, Sénégal" />
                              </li>
                            </ul>
                          </CanvaElementWrapper>

                          {/* Extra info panel */}
                          {(cvData.birthDate || cvData.drivingLicense || cvData.nationality || cvData.maritalStatus || cvData.linkedin || cvData.availability) && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Détails</h3>
                              <ul className="space-y-1.5 text-[9px] text-slate-300">
                                {cvData.birthDate && <li><span className="font-bold text-white">Âge :</span> <CanvaText value={cvData.birthDate} onChange={(v) => setCvData(prev => ({ ...prev, birthDate: v }))} id="birthDate" name="Âge" /></li>}
                                {cvData.drivingLicense && <li><span className="font-bold text-white">Permis :</span> <CanvaText value={cvData.drivingLicense} onChange={(v) => setCvData(prev => ({ ...prev, drivingLicense: v }))} id="drivingLicense" name="Permis" /></li>}
                                {cvData.nationality && <li><span className="font-bold text-white">Nationalité :</span> <CanvaText value={cvData.nationality} onChange={(v) => setCvData(prev => ({ ...prev, nationality: v }))} id="nationality" name="Nationalité" /></li>}
                                {cvData.maritalStatus && <li><span className="font-bold text-white">Statut :</span> <CanvaText value={cvData.maritalStatus} onChange={(v) => setCvData(prev => ({ ...prev, maritalStatus: v }))} id="maritalStatus" name="Statut" /></li>}
                                {cvData.linkedin && <li><span className="font-bold text-white">LinkedIn :</span> <CanvaText value={cvData.linkedin} onChange={(v) => setCvData(prev => ({ ...prev, linkedin: v }))} id="linkedin" name="LinkedIn" className="break-all text-[8px]" /></li>}
                                {cvData.availability && <li><span className="font-bold text-white">Disponibilité :</span> <CanvaText value={cvData.availability} onChange={(v) => setCvData(prev => ({ ...prev, availability: v }))} id="availability" name="Disponibilité" /></li>}
                              </ul>
                            </div>
                          )}

                          {/* Compétences (Left sidebar) */}
                          <CanvaElementWrapper id="skills" type="skill" name="Compétences">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Compétences</h3>
                            <ul className="space-y-2">
                              {(cvData.skills?.length > 0 ? cvData.skills : [
                                { id: 1, name: "Gestion de projet", level: "Avancé" }
                              ]).map((skill) => (
                                <li key={skill.id} className="text-[10px] text-slate-200">
                                  <div className="flex justify-between items-center mb-0.5">
                                    <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" className="font-bold truncate max-w-[120px]" />
                                    <CanvaText value={skill.level} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, level: v } : s) }))} id={`skill-lvl-${skill.id}`} name="Niveau" className="text-[8px] text-slate-400 font-medium" />
                                  </div>
                                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      style={{
                                        width:
                                          skill.level === "Expert" ? "100%" :
                                          skill.level === "Avancé" ? "80%" :
                                          skill.level === "Intermédiaire" ? "55%" : "30%"
                                      }}
                                      className="h-full bg-[#10E688]"
                                    ></div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>

                          {/* Langues (Left sidebar) */}
                          <CanvaElementWrapper id="languages" type="language" name="Langues">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Langues</h3>
                            <ul className="space-y-1.5 text-[10px] text-slate-200">
                              {(cvData.languages?.length > 0 ? cvData.languages : [
                                { id: 1, name: "Français", level: "Courant" }
                              ]).map((lang) => (
                                <li key={lang.id} className="flex justify-between">
                                  <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" className="font-bold" />
                                  <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" className="text-[8px] text-slate-400 font-medium" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>
                        </div>
                      </div>

                      <div className="text-center text-[8px] text-slate-400/70 border-t border-white/5 pt-2">
                        <span>Créé via Facilite.fr</span>
                      </div>
                    </div>

                    {/* Right Column (Body) */}
                    <div className="flex-grow p-6 flex flex-col justify-between overflow-hidden bg-white">
                      <div className="space-y-5">
                        
                        {/* Header details */}
                        <CanvaElementWrapper id="header" type="header" name="En-tête" className="border-b border-gray-150 pb-4">
                          <h1 className="text-2xl font-black text-gray-900 tracking-tight capitalize flex items-center gap-2 flex-wrap">
                            <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                            <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                          </h1>
                          <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-widest mt-1">
                            <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                          </p>
                        </CanvaElementWrapper>

                        {/* Professional pitch */}
                        <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1">
                          <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">{cvData.sectionTitles?.profile || "Profil Professionnel"}</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">
                            <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                          </p>
                        </CanvaElementWrapper>

                        {/* Expériences */}
                        <div className="space-y-2">
                          <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">{cvData.sectionTitles?.experience || "Parcours Professionnel"}</h3>
                          <div className="space-y-3">
                            {cvData.experiences.map((exp) => (
                              <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="text-[10px] p-1 rounded-lg">
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                  </span>
                                  <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                    {" - "}
                                    <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                  {exp.city ? ` • ${exp.city}` : ""}
                                </div>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-600 mt-1 leading-relaxed whitespace-pre-line font-medium">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                        {/* Formation */}
                        <div className="space-y-2">
                          <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">Formation</h3>
                          <div className="space-y-3">
                            {cvData.educations.map((edu) => (
                              <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="text-[10px] p-1 rounded-lg">
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                  </span>
                                  <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                    {" - "}
                                    <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                  {edu.city ? ` • ${edu.city}` : ""}
                                </div>
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                      </div>

                      <div className="text-[8px] text-gray-400 font-medium flex justify-between border-t border-gray-100 pt-3">
                        <span>Langue du CV : {cvData.cvLang}</span>
                        <span>Dernière mise à jour : 2026</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* --- TEMPLATE 2: MINIMALIST (Clean 1-column layout, airy spaces) --- */}
                {selectedTemplate === "minimalist" && (
                  <div className="w-full h-full p-8 flex flex-col justify-between overflow-hidden bg-white text-xs">
                    <div className="space-y-6">
                      
                      {/* Center Header */}
                      <CanvaElementWrapper id="header" type="header" name="En-tête" className="text-center space-y-2 border-b border-gray-100 pb-5">
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight capitalize flex items-center justify-center gap-2 flex-wrap">
                          <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                          <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                        </h1>
                        <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-widest">
                          <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                        </p>
                        
                        {/* Contacts horizontally */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-gray-500 font-bold pt-1">
                          <span className="flex items-center"><i className="fa-regular fa-envelope mr-1 text-gray-400"></i><CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" /></span>
                          <span className="flex items-center"><i className="fa-solid fa-phone mr-1 text-gray-400"></i><CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" /></span>
                          <span className="flex items-center"><i className="fa-solid fa-location-dot mr-1 text-gray-400"></i><CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Dakar" /></span>
                          {cvData.linkedin && (
                            <span className="flex items-center"><i className="fa-brands fa-linkedin mr-1 text-gray-400"></i><CanvaText value={cvData.linkedin} onChange={(v) => setCvData(prev => ({ ...prev, linkedin: v }))} id="linkedin" name="LinkedIn" placeholder="linkedin.com/in/profil" /></span>
                          )}
                        </div>
                      </CanvaElementWrapper>

                      {/* Professional summary */}
                      <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1.5">
                        <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">{cvData.sectionTitles?.profile || "Profil"}</h3>
                        <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">
                          <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                        </p>
                      </CanvaElementWrapper>

                      {/* Experience list */}
                      <div className="space-y-2.5">
                        <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">{cvData.sectionTitles?.experience || "Expérience Professionnelle"}</h3>
                        <div className="space-y-3">
                          {cvData.experiences.map((exp) => (
                            <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="grid grid-cols-4 gap-2 text-[10px] p-1 rounded-lg">
                              <div className="col-span-1 text-gray-500 font-bold text-[8px] pt-0.5">
                                <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                {" - "}
                                <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                              </div>
                              <div className="col-span-3 text-[10px]">
                                <div className="font-black text-gray-950">
                                  <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                  <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                  {exp.city ? ` • ${exp.city}` : ""}
                                </div>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </div>
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      {/* Education list */}
                      <div className="space-y-2.5">
                        <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Formation</h3>
                        <div className="space-y-3">
                          {cvData.educations.map((edu) => (
                            <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="grid grid-cols-4 gap-2 text-[10px] p-1 rounded-lg">
                              <div className="col-span-1 text-gray-500 font-bold text-[8px] pt-0.5">
                                <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                {" - "}
                                <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                              </div>
                              <div className="col-span-3 text-[10px]">
                                <div className="font-black text-gray-950">
                                  <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                  <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                  {edu.city ? ` • ${edu.city}` : ""}
                                </div>
                              </div>
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      {/* Skills & Languages grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <CanvaElementWrapper id="skills" type="skill" name="Compétences" className="space-y-1.5">
                          <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Compétences</h3>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(cvData.skills?.length > 0 ? cvData.skills : [
                              { id: 1, name: "Gestion de projet", level: "Avancé" }
                            ]).map((skill) => (
                              <span key={skill.id} className="px-2 py-1 bg-gray-100 rounded text-[9px] font-semibold text-gray-700">
                                <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                <span className="text-[8px] text-gray-400 font-medium"> (<CanvaText value={skill.level} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, level: v } : s) }))} id={`skill-lvl-${skill.id}`} name="Niveau" />)</span>
                              </span>
                            ))}
                          </div>
                        </CanvaElementWrapper>

                        <CanvaElementWrapper id="languages" type="language" name="Langues" className="space-y-1.5">
                          <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Langues</h3>
                          <ul className="space-y-1 text-[10px] font-medium text-gray-600">
                            {(cvData.languages?.length > 0 ? cvData.languages : [
                              { id: 1, name: "Français", level: "Courant" }
                            ]).map((lang) => (
                              <li key={lang.id} className="flex justify-between">
                                <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" className="font-bold text-gray-900" />
                                <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" />
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>
                      </div>

                    </div>

                    <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 pt-3">
                      <span>Créé via Facilite.fr • Langue du document : {cvData.cvLang}</span>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 3: CLASSIC (Top banner header + high density) --- */}
                {selectedTemplate === "classic" && (
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden bg-white text-xs">
                    
                    {/* Top banner header */}
                    <CanvaElementWrapper id="header" type="header" name="En-tête" style={{ backgroundColor: accentColor }} className="p-6 text-white text-center space-y-2 relative">
                      {/* Profile Picture Classic (Outer White Circle) */}
                      <div className="absolute top-6 left-6 w-14 h-14 rounded-full bg-white hidden sm:flex items-center justify-center shadow-md select-none">
                        {/* Inner Image Circle */}
                        <div className="w-[50px] h-[50px] rounded-full overflow-hidden bg-transparent flex items-center justify-center relative">
                          {photoPreview ? (
                            <img
                              src={photoPreview}
                              alt="Profile"
                              onMouseDown={handlePhotoDragStart}
                              onMouseMove={handlePhotoDragMove}
                              onMouseUp={handlePhotoDragEnd}
                              onMouseLeave={handlePhotoDragEnd}
                              onTouchStart={handlePhotoDragStart}
                              onTouchMove={handlePhotoDragMove}
                              onTouchEnd={handlePhotoDragEnd}
                              style={{
                                transform: `scale(${cvData.photoZoom || 1}) translate(${cvData.photoX || 0}%, ${cvData.photoY || 0}%)`,
                                transition: "none",
                                cursor: "move"
                              }}
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <i className="fa-solid fa-user text-gray-400 text-xl"></i>
                          )}
                        </div>
                      </div>
                      
                      <h1 className="text-2xl font-black tracking-tight capitalize flex items-center justify-center gap-2 flex-wrap">
                        <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                        <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                      </h1>
                      <p className="text-xs font-black uppercase tracking-widest text-white/90">
                        <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-white/80 font-bold">
                        <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" />
                        <span>•</span>
                        <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" />
                        <span>•</span>
                        <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Dakar" />
                      </div>
                    </CanvaElementWrapper>

                    <div className="flex-grow p-6 space-y-4">
                      
                      {/* Summary */}
                      <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1">
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">{cvData.sectionTitles?.profile || "Résumé Professionnel"}</h3>
                        <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
                          <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                        </p>
                      </CanvaElementWrapper>

                      {/* Expériences */}
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">{cvData.sectionTitles?.experience || "Expérience Professionnelle"}</h3>
                        <div className="space-y-2.5 pt-1">
                          {cvData.experiences.map((exp) => (
                            <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="text-[10px] p-1 rounded-lg">
                              <div className="flex justify-between items-start font-bold">
                                <span className="text-gray-950 font-black">
                                  <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                </span>
                                <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                  <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                  {" - "}
                                  <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                                </span>
                              </div>
                              <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                {exp.city ? ` • ${exp.city}` : ""}
                              </div>
                              {exp.description && (
                                <div className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">
                                  <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                </div>
                              )}
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      {/* Formation */}
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Formation & Diplômes</h3>
                        <div className="space-y-2.5 pt-1">
                          {cvData.educations.map((edu) => (
                            <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="text-[10px] p-1 rounded-lg">
                              <div className="flex justify-between items-start font-bold">
                                <span className="text-gray-950 font-black">
                                  <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                </span>
                                <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                  <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                  {" - "}
                                  <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                </span>
                              </div>
                              <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                {edu.city ? ` • ${edu.city}` : ""}
                              </div>
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      {/* Skills & Lang grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <CanvaElementWrapper id="skills" type="skill" name="Compétences" className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Compétences</h3>
                          <ul className="grid grid-cols-1 gap-1 pt-1 text-[9px] font-semibold text-gray-700">
                            {(cvData.skills?.length > 0 ? cvData.skills : [
                              { id: 1, name: "Organisation", level: "Avancé" }
                            ]).map((skill) => (
                              <li key={skill.id} className="flex justify-between">
                                <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                <span className="text-gray-400 font-medium">(<CanvaText value={skill.level} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, level: v } : s) }))} id={`skill-lvl-${skill.id}`} name="Niveau" />)</span>
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>

                        <CanvaElementWrapper id="languages" type="language" name="Langues" className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Langues</h3>
                          <ul className="space-y-1 pt-1 text-[9px] text-gray-700">
                            {(cvData.languages?.length > 0 ? cvData.languages : [
                              { id: 1, name: "Français", level: "Courant" }
                            ]).map((lang) => (
                              <li key={lang.id} className="flex justify-between font-semibold">
                                <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" />
                                <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" className="text-gray-400 font-medium" />
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>
                      </div>

                    </div>

                    <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 p-3">
                      <span>Créé via Facilite.fr • Langue du document : {cvData.cvLang}</span>
                    </div>

                  </div>
                )}

                {/* --- TEMPLATE 4: EXÉCUTIF (Bandeau plein largeur, colonne unique, formel) --- */}
                {selectedTemplate === "executif" && (
                  <div className="w-full h-full flex flex-col overflow-hidden bg-white text-xs">

                    {/* Bandeau d'en-tête */}
                    <CanvaElementWrapper id="header" type="header" name="En-tête" style={{ backgroundColor: accentColor === "#10E688" ? "#0f172a" : accentColor }} className="p-6 text-white flex items-center space-x-5 flex-shrink-0">
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md flex-shrink-0 select-none">
                        <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-transparent flex items-center justify-center relative">
                          {photoPreview ? (
                            <img
                              src={photoPreview}
                              alt="Profile"
                              onMouseDown={handlePhotoDragStart}
                              onMouseMove={handlePhotoDragMove}
                              onMouseUp={handlePhotoDragEnd}
                              onMouseLeave={handlePhotoDragEnd}
                              onTouchStart={handlePhotoDragStart}
                              onTouchMove={handlePhotoDragMove}
                              onTouchEnd={handlePhotoDragEnd}
                              style={{
                                objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                                transform: `scale(${cvData.photoZoom || 1})`,
                                transition: "none",
                                cursor: "move"
                              }}
                              className="w-full h-full object-cover select-none"
                            />
                          ) : (
                            <i className="fa-solid fa-user text-gray-400 text-2xl"></i>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h1 className="text-2xl font-black tracking-tight capitalize truncate flex items-center gap-2 flex-wrap">
                          <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                          <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80 mt-1">
                          <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-white/70 font-semibold mt-2">
                          <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" />
                          <span>•</span>
                          <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" />
                          <span>•</span>
                          <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Dakar" />
                        </div>
                      </div>
                    </CanvaElementWrapper>

                    {/* Corps en colonne unique, aéré */}
                    <div className="flex-grow p-7 space-y-5 overflow-hidden">
                      <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1.5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Synthèse</h3>
                        <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">
                          <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                        </p>
                      </CanvaElementWrapper>

                      <div className="space-y-1.5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Expérience</h3>
                        <div className="space-y-3 pt-1">
                          {cvData.experiences.map((exp) => (
                            <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="text-[10px] flex items-start justify-between gap-3 p-1 rounded-lg">
                              <div className="min-w-0">
                                <span className="text-gray-950 font-black block">
                                  <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                </span>
                                <span className="text-[9px] font-bold text-gray-500">
                                  <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                  {exp.city ? ` • ${exp.city}` : ""}
                                </span>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </div>
                              <span className="text-gray-400 font-bold text-[8px] flex-shrink-0 whitespace-nowrap">
                                <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                {" — "}
                                <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                              </span>
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Formation</h3>
                        <div className="space-y-2 pt-1">
                          {cvData.educations.map((edu) => (
                            <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="text-[10px] flex items-start justify-between gap-3 p-1 rounded-lg">
                              <div className="min-w-0">
                                <span className="text-gray-950 font-black block">
                                  <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                </span>
                                <span className="text-[9px] font-bold text-gray-500">
                                  <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                </span>
                              </div>
                              <span className="text-gray-400 font-bold text-[8px] flex-shrink-0 whitespace-nowrap">
                                <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                {" — "}
                                <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                              </span>
                            </CanvaElementWrapper>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <CanvaElementWrapper id="skills" type="skill" name="Compétences" className="space-y-1.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Compétences</h3>
                          <ul className="space-y-1 pt-1 text-[9px] font-semibold text-gray-700">
                            {(cvData.skills?.length > 0 ? cvData.skills : [
                              { id: 1, name: "Gestion stratégique", level: "Expert" }
                            ]).map((skill) => (
                              <li key={skill.id} className="flex justify-between">
                                <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                <CanvaText value={skill.level} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, level: v } : s) }))} id={`skill-lvl-${skill.id}`} name="Niveau" className="text-gray-400 font-medium" />
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>

                        <CanvaElementWrapper id="languages" type="language" name="Langues" className="space-y-1.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Langues</h3>
                          <ul className="space-y-1 pt-1 text-[9px] font-semibold text-gray-700">
                            {(cvData.languages?.length > 0 ? cvData.languages : [
                              { id: 1, name: "Français", level: "Courant" }
                            ]).map((lang) => (
                              <li key={lang.id} className="flex justify-between">
                                <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" />
                                <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" className="text-gray-400 font-medium" />
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>
                      </div>
                    </div>

                    <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 p-3 flex-shrink-0">
                      <span>Créé via Facilite.fr • Langue du document : {cvData.cvLang}</span>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 5: CRÉATIF (Sidebar colorée à droite, bloc asymétrique) --- */}
                {selectedTemplate === "creatif" && (
                  <div className="flex w-full h-full text-xs flex-grow flex-row-reverse">

                    {/* Sidebar droite, entièrement colorée */}
                    <div
                      style={{ backgroundColor: accentColor }}
                      className="w-[210px] text-white p-5 flex flex-col justify-between flex-shrink-0"
                    >
                      <div>
                        <CanvaElementWrapper id="photo" type="photo" name="Photo de Profil" className="w-24 h-24 rounded-full bg-white/95 flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-white/30 flex-shrink-0 relative select-none">
                          <div className="w-[84px] h-[84px] rounded-full overflow-hidden bg-transparent flex items-center justify-center relative">
                            {photoPreview ? (
                              <img
                                src={photoPreview}
                                alt="Profile"
                                onMouseDown={handlePhotoDragStart}
                                onMouseMove={handlePhotoDragMove}
                                onMouseUp={handlePhotoDragEnd}
                                onMouseLeave={handlePhotoDragEnd}
                                onTouchStart={handlePhotoDragStart}
                                onTouchMove={handlePhotoDragMove}
                                onTouchEnd={handlePhotoDragEnd}
                                style={{
                                  objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                                  transform: `scale(${cvData.photoZoom || 1})`,
                                  transition: "none",
                                  cursor: "move"
                                }}
                                className="w-full h-full object-cover select-none"
                              />
                            ) : (
                              <i className="fa-solid fa-user text-gray-400 text-3xl"></i>
                            )}
                          </div>
                        </CanvaElementWrapper>

                        <CanvaElementWrapper id="header" type="header" name="En-tête" className="text-center mb-5">
                          <h1 className="text-lg font-black tracking-tight text-center capitalize mb-0.5 flex items-center justify-center gap-1.5 flex-wrap">
                            <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                            <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                          </h1>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-center text-white/85">
                            <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                          </p>
                        </CanvaElementWrapper>

                        <div className="space-y-4">
                          <CanvaElementWrapper id="contact" type="contact" name="Coordonnées">
                            <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>{cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}</h3>
                            <ul className="space-y-1.5 text-[9px] text-white/90 font-semibold">
                              <li className="break-all"><CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" /></li>
                              <li><CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" /></li>
                              <li><CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Dakar" /></li>
                            </ul>
                          </CanvaElementWrapper>

                          <CanvaElementWrapper id="skills" type="skill" name="Compétences">
                            <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>Compétences</h3>
                            <div className="flex flex-wrap gap-1.5">
                              {(cvData.skills?.length > 0 ? cvData.skills : [
                                { id: 1, name: "Design créatif" }
                              ]).map((skill) => (
                                <span key={skill.id} className="px-2 py-1 rounded-full bg-white/20 text-[8px] font-bold whitespace-nowrap">
                                  <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                </span>
                              ))}
                            </div>
                          </CanvaElementWrapper>

                          <CanvaElementWrapper id="languages" type="language" name="Langues">
                            <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>Langues</h3>
                            <ul className="space-y-1 text-[9px] text-white/90 font-semibold">
                              {(cvData.languages?.length > 0 ? cvData.languages : [
                                { id: 1, name: "Français", level: "Courant" }
                              ]).map((lang) => (
                                <li key={lang.id} className="flex justify-between">
                                  <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" />
                                  <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" className="text-white/60" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>
                        </div>
                      </div>

                      <div className="text-center text-[8px] text-white/60 border-t border-white/20 pt-2">
                        <span>Créé via Facilite.fr</span>
                      </div>
                    </div>

                    {/* Colonne principale (blanche) */}
                    <div className="flex-grow p-6 flex flex-col overflow-hidden bg-white">
                      <div className="space-y-5">
                        <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1">
                          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>À propos</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
                            <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                          </p>
                        </CanvaElementWrapper>

                        <div className="space-y-2">
                          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Expérience</h3>
                          <div className="space-y-3">
                            {cvData.experiences.map((exp) => (
                              <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="text-[10px] pl-3 border-l-2 p-1 rounded-r-lg" style={{ borderColor: accentColor }}>
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                  </span>
                                  <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                    {" - "}
                                    <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                  {exp.city ? ` • ${exp.city}` : ""}
                                </div>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Formation</h3>
                          <div className="space-y-2">
                            {cvData.educations.map((edu) => (
                              <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="text-[10px] pl-3 border-l-2 p-1 rounded-r-lg" style={{ borderColor: accentColor }}>
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                  </span>
                                  <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                    {" - "}
                                    <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                  {edu.city ? ` • ${edu.city}` : ""}
                                </div>
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 text-[8px] text-gray-400 font-medium border-t border-gray-100">
                        <span>Langue du CV : {cvData.cvLang}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 6: TECHNIQUE (Sidebar sombre, grille de compétences, timeline) --- */}
                {selectedTemplate === "technique" && (
                  <div className="flex w-full h-full text-xs flex-grow">

                    {/* Sidebar technique sombre */}
                    <div className="w-[190px] bg-[#0f172a] text-white p-5 flex flex-col justify-between flex-shrink-0">
                      <div>
                        <CanvaElementWrapper id="photo" type="photo" name="Photo de Profil" className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4 border-2 select-none" style={{ borderColor: accentColor }}>
                          <div className="w-[68px] h-[68px] rounded-lg overflow-hidden bg-transparent flex items-center justify-center relative">
                            {photoPreview ? (
                              <img
                                src={photoPreview}
                                alt="Profile"
                                onMouseDown={handlePhotoDragStart}
                                onMouseMove={handlePhotoDragMove}
                                onMouseUp={handlePhotoDragEnd}
                                onMouseLeave={handlePhotoDragEnd}
                                onTouchStart={handlePhotoDragStart}
                                onTouchMove={handlePhotoDragMove}
                                onTouchEnd={handlePhotoDragEnd}
                                style={{
                                  objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                                  transform: `scale(${cvData.photoZoom || 1})`,
                                  transition: "none",
                                  cursor: "move"
                                }}
                                className="w-full h-full object-cover select-none"
                              />
                            ) : (
                              <i className="fa-solid fa-user text-gray-400 text-2xl"></i>
                            )}
                          </div>
                        </CanvaElementWrapper>

                        <CanvaElementWrapper id="header" type="header" name="En-tête" className="text-center mb-4">
                          <h1 className="text-sm font-black text-center capitalize mb-0.5 flex items-center justify-center gap-1 flex-wrap">
                            <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                            <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                          </h1>
                          <p style={{ color: accentColor }} className="text-[9px] font-black uppercase tracking-wider text-center">
                            <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                          </p>
                        </CanvaElementWrapper>

                        <div className="space-y-4">
                          <CanvaElementWrapper id="contact" type="contact" name="Coordonnées">
                            <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Contact"}</h3>
                            <ul className="space-y-1 text-[9px] text-slate-200 font-medium">
                              <li className="break-all"><CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" /></li>
                              <li><CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" /></li>
                              <li><CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Dakar" /></li>
                            </ul>
                          </CanvaElementWrapper>

                          <CanvaElementWrapper id="skills" type="skill" name="Compétences">
                            <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Compétences"}</h3>
                            <ul className="space-y-2">
                              {(cvData.skills?.length > 0 ? cvData.skills : [
                                { id: 1, name: "Développement React", level: "Expert" }
                              ]).map((skill) => {
                                const segments =
                                  skill.level === "Expert" ? 4 :
                                  skill.level === "Avancé" ? 3 :
                                  skill.level === "Intermédiaire" ? 2 : 1;
                                return (
                                  <li key={skill.id} className="text-[9px] text-slate-200">
                                    <div className="font-bold truncate mb-1">
                                      <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                    </div>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4].map((seg) => (
                                        <div
                                          key={seg}
                                          style={{ backgroundColor: seg <= segments ? accentColor : "rgba(255,255,255,0.1)" }}
                                          className="h-1.5 flex-1 rounded-sm"
                                        ></div>
                                      ))}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </CanvaElementWrapper>

                          <CanvaElementWrapper id="languages" type="language" name="Langues">
                            <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Langues"}</h3>
                            <ul className="space-y-1 text-[9px] text-slate-200 font-medium">
                              {(cvData.languages?.length > 0 ? cvData.languages : [
                                { id: 1, name: "Français", level: "Courant" }
                              ]).map((lang) => (
                                <li key={lang.id} className="flex justify-between">
                                  <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-${lang.id}`} name="Langue" />
                                  <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" className="text-slate-400" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>
                        </div>
                      </div>

                      <div className="text-center text-[8px] text-slate-500 border-t border-white/10 pt-2">
                        <span>Créé via Facilite.fr</span>
                      </div>
                    </div>

                    {/* Colonne principale : timeline verticale */}
                    <div className="flex-grow p-6 flex flex-col justify-between overflow-hidden bg-white">
                      <div className="space-y-5">
                        <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Profil</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium">
                            <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez pour rédiger votre profil..." className="block text-justify" />
                          </p>
                        </CanvaElementWrapper>

                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Expérience</h3>
                          <div className="space-y-0 pt-1 relative pl-4 border-l-2 border-gray-150">
                            {cvData.experiences.map((exp) => (
                              <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="text-[10px] relative pb-3 p-1 rounded-lg">
                                <div
                                  style={{ backgroundColor: accentColor }}
                                  className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                                ></div>
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                  </span>
                                  <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                    {" - "}
                                    <CanvaText value={exp.current ? "Aujourd'hui" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Aujourd'hui" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Employeur" placeholder="Employeur" />
                                  {exp.city ? ` • ${exp.city}` : ""}
                                </div>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Formation</h3>
                          <div className="space-y-0 pt-1 relative pl-4 border-l-2 border-gray-150">
                            {cvData.educations.map((edu) => (
                              <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="text-[10px] relative pb-2.5 p-1 rounded-lg">
                                <div
                                  style={{ backgroundColor: accentColor }}
                                  className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                                ></div>
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">
                                    <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                  </span>
                                  <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                    <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                    {" - "}
                                    <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                  <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                  {edu.city ? ` • ${edu.city}` : ""}
                                </div>
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="text-[8px] text-gray-400 font-medium flex justify-between border-t border-gray-100 pt-3">
                        <span>Langue du CV : {cvData.cvLang}</span>
                        <span>Dernière mise à jour : 2026</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 8: PROFESSIONNEL CANVA (Style Canva 1:1 - Cadres, Cartes Sables & Badges) --- */}
                {selectedTemplate === "professionnel" && (
                  <div className="flex flex-col w-full h-full text-xs flex-grow font-sans bg-[#FBF9F5] border-[3px] border-[#382F2D] text-[#382F2D] select-none overflow-hidden">
                    
                    {/* TOP HEADER (Full Width with 3 zones) */}
                    <CanvaElementWrapper id="header" type="header" name="En-tête & Monogramme" className="bg-[#FAF7F2] border-b-2 border-[#382F2D] p-3 flex items-center justify-between gap-3 flex-shrink-0">
                      
                      {/* 1. Zone Photo (Cadre beige foncé avec photo centrée) */}
                      <CanvaElementWrapper id="photo" type="photo" name="Photo de Profil" className="w-20 h-20 sm:w-24 sm:h-24 bg-[#EDE6DC] border-2 border-[#382F2D] rounded-2xl p-1 flex items-center justify-center shadow-xs flex-shrink-0 relative overflow-hidden">
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Profile"
                            onMouseDown={handlePhotoDragStart}
                            onMouseMove={handlePhotoDragMove}
                            onMouseUp={handlePhotoDragEnd}
                            onMouseLeave={handlePhotoDragEnd}
                            onTouchStart={handlePhotoDragStart}
                            onTouchMove={handlePhotoDragMove}
                            onTouchEnd={handlePhotoDragEnd}
                            style={{
                              objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                              transform: `scale(${cvData.photoZoom || 1})`,
                              transition: "none",
                              cursor: "move"
                            }}
                            className="w-full h-full object-cover rounded-xl select-none"
                          />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-[#FAF7F2] border border-[#382F2D]/40 flex flex-col items-center justify-center text-[#382F2D]">
                            <i className="fa-solid fa-user text-2xl mb-0.5 text-[#382F2D]/70"></i>
                            <span className="text-[8px] font-black uppercase tracking-wider">Photo</span>
                          </div>
                        )}
                      </CanvaElementWrapper>

                      {/* 2. Zone Nom & Titre (Boîte encadrée principale) */}
                      <div className="flex-grow flex flex-col items-center justify-center text-center px-2">
                        {/* Name Box */}
                        <div className="w-full bg-[#FAF7F2] border-2 border-[#382F2D] rounded-xl px-4 py-1.5 shadow-xs">
                          <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#382F2D] leading-tight flex items-center justify-center gap-1.5 flex-wrap">
                            <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                            <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                          </h1>
                        </div>
                        {/* Title Pill Box */}
                        <div className="bg-[#EDE6DC] border border-[#382F2D] rounded-full px-4 py-0.5 mt-1 shadow-xs">
                          <h2 className="text-[9.5px] font-black uppercase tracking-wide text-[#382F2D]">
                            <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre Professionnel" />
                          </h2>
                        </div>
                      </div>

                      {/* 3. Zone Monogramme / Cachet Graphique Canva */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#EDE6DC] border-2 border-[#382F2D] rounded-2xl p-1.5 flex flex-col items-center justify-center flex-shrink-0 shadow-xs relative overflow-hidden">
                        <div className="relative w-8 h-8 flex flex-col justify-center items-center">
                          <div className="w-6 h-1.5 bg-[#382F2D] rounded-full -rotate-45 mb-0.5 transform translate-x-1"></div>
                          <div className="w-8 h-1.5 bg-[#382F2D] rounded-full -rotate-45 mb-0.5"></div>
                          <div className="w-5 h-1 bg-[#382F2D] rounded-full -rotate-45 -translate-x-1"></div>
                          <div className="absolute right-0.5 bottom-0.5 w-1.5 h-1.5 rounded-full border border-[#382F2D] bg-[#FAF7F2]"></div>
                        </div>
                      </div>

                    </CanvaElementWrapper>

                    {/* BODY AREA (2 Columns: Left Sidebar ~37% & Right Main ~63%) */}
                    <div className="flex flex-grow w-full overflow-hidden">
                      
                      {/* LEFT COLUMN (Sable / Beige Sidebar with Framed Cards) */}
                      <div className="w-[37%] bg-[#EDE6DC] border-r-2 border-[#382F2D] p-2 flex flex-col justify-between overflow-y-auto space-y-1.5">
                        <div>
                          
                          {/* CONTACT */}
                          <CanvaElementWrapper id="contact" type="contact" name="Coordonnées" className="mb-1.5">
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-lg px-2 py-0.5 text-[9px] font-black text-[#382F2D] uppercase tracking-wider mb-1 text-center shadow-xs">
                              {cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}
                            </div>
                            <div className="space-y-0.5">
                              <div className="bg-[#FAF7F2] border border-[#382F2D] rounded-lg px-2 py-0.5 text-[8px] font-bold text-[#382F2D] flex items-center gap-1.5 shadow-xs">
                                <i className="fa-solid fa-mobile-screen text-emerald-600 text-[8.5px] w-3 text-center"></i>
                                <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" className="truncate" />
                              </div>
                              <div className="bg-[#FAF7F2] border border-[#382F2D] rounded-lg px-2 py-0.5 text-[8px] font-bold text-[#382F2D] flex items-center gap-1.5 shadow-xs">
                                <i className="fa-solid fa-envelope text-blue-600 text-[8.5px] w-3 text-center"></i>
                                <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="email@exemple.com" className="break-all truncate" />
                              </div>
                              <div className="bg-[#FAF7F2] border border-[#382F2D] rounded-lg px-2 py-0.5 text-[8px] font-bold text-[#382F2D] flex items-center gap-1.5 shadow-xs">
                                <i className="fa-solid fa-location-dot text-red-600 text-[8.5px] w-3 text-center"></i>
                                <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville / Adresse" placeholder="Dakar, Sénégal" className="truncate" />
                              </div>
                            </div>
                          </CanvaElementWrapper>

                          {/* COMPÉTENCES (⭐) */}
                          <CanvaElementWrapper id="skills" type="skill" name="Compétences" className="mb-1.5">
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-lg px-2 py-0.5 text-[9px] font-black text-[#382F2D] uppercase tracking-wider mb-1 flex items-center justify-center gap-1 shadow-xs">
                              <i className="fa-solid fa-star text-amber-500 text-[8.5px]"></i>
                              <span>{cvData.sectionTitles?.skills?.toUpperCase() || "COMPÉTENCES"}</span>
                            </div>
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-xl p-1.5 text-[8px] text-[#382F2D] font-bold space-y-0.5 shadow-xs">
                              {(cvData.skills?.length > 0 ? cvData.skills : [
                                { id: 1, name: "Systèmes de réfrigération et de climatisation" },
                                { id: 2, name: "Électricité, plomberie et menuiserie" },
                                { id: 3, name: "Polyvalence & Gestion technique" },
                                { id: 4, name: "Rigueur technique & Organisation" },
                                { id: 5, name: "Esprit d'équipe & Adaptabilité" }
                              ]).map((skill) => (
                                <div key={skill.id} className="flex items-start gap-1 leading-tight">
                                  <span className="text-[#382F2D] font-black">•</span>
                                  <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Compétence" />
                                </div>
                              ))}
                            </div>
                          </CanvaElementWrapper>

                          {/* INFORMATIQUE / LOGICIELS (🛠️) */}
                          <CanvaElementWrapper id="itSkills" type="itSkill" name="Informatique" className="mb-1.5">
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-lg px-2 py-0.5 text-[9px] font-black text-[#382F2D] uppercase tracking-wider mb-1 flex items-center justify-center gap-1 shadow-xs">
                              <i className="fa-solid fa-screwdriver-wrench text-slate-700 text-[8.5px]"></i>
                              <span>{cvData.sectionTitles?.itSkills?.toUpperCase() || "INFORMATIQUE"}</span>
                            </div>
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-xl p-1.5 text-[8px] text-[#382F2D] font-bold space-y-0.5 shadow-xs">
                              {(cvData.itSkills?.length > 0 ? cvData.itSkills : [
                                { id: 1, name: "Word : Excellent" },
                                { id: 2, name: "Internet / Web : Excellent" }
                              ]).map((it) => (
                                <div key={it.id} className="flex items-start gap-1 leading-tight">
                                  <span className="text-[#382F2D] font-black">•</span>
                                  <CanvaText value={it.name} onChange={(v) => setCvData(prev => ({ ...prev, itSkills: prev.itSkills.map(i => i.id === it.id ? { ...i, name: v } : i) }))} id={`it-${it.id}`} name="Outil" />
                                </div>
                              ))}
                            </div>
                          </CanvaElementWrapper>

                          {/* LANGUES (🌍) */}
                          <CanvaElementWrapper id="languages" type="language" name="Langues" className="mb-1.5">
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-lg px-2 py-0.5 text-[9px] font-black text-[#382F2D] uppercase tracking-wider mb-1 flex items-center justify-center gap-1 shadow-xs">
                              <i className="fa-solid fa-globe text-blue-600 text-[8.5px]"></i>
                              <span>{cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}</span>
                            </div>
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-xl p-1.5 text-[8px] text-[#382F2D] font-bold space-y-0.5 shadow-xs">
                              {(cvData.languages?.length > 0 ? cvData.languages : [
                                { id: 1, name: "Français", level: "Couramment" },
                                { id: 2, name: "Anglais", level: "Faible" },
                                { id: 3, name: "Wolof", level: "Bien" }
                              ]).map((lang) => (
                                <div key={lang.id} className="flex items-start gap-1 leading-tight">
                                  <span className="text-[#382F2D] font-black">•</span>
                                  <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-name-${lang.id}`} name="Langue" />
                                  {lang.level && <span>: <CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" /></span>}
                                </div>
                              ))}
                            </div>
                          </CanvaElementWrapper>

                          {/* CENTRES D'INTÉRÊT (💡) */}
                          <CanvaElementWrapper id="hobbies" type="hobby" name="Centres d'intérêt">
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-lg px-2 py-0.5 text-[9px] font-black text-[#382F2D] uppercase tracking-wider mb-1 flex items-center justify-center gap-1 shadow-xs">
                              <i className="fa-regular fa-lightbulb text-amber-500 text-[8.5px]"></i>
                              <span>{cvData.sectionTitles?.hobbies?.toUpperCase() || "CENTRES D'INTÉRÊT"}</span>
                            </div>
                            <div className="bg-[#FAF7F2] border-2 border-[#382F2D] rounded-xl p-1.5 text-[8px] text-[#382F2D] font-bold space-y-0.5 shadow-xs">
                              {(cvData.hobbies?.length > 0 ? cvData.hobbies : [
                                { id: 1, name: "Sport collectif" },
                                { id: 2, name: "Voyages et découvertes" },
                                { id: 3, name: "Vie associative" }
                              ]).map((hob) => (
                                <div key={hob.id} className="flex items-start gap-1 leading-tight">
                                  <span className="text-[#382F2D] font-black">•</span>
                                  <CanvaText value={hob.name} onChange={(v) => setCvData(prev => ({ ...prev, hobbies: prev.hobbies.map(h => h.id === hob.id ? { ...h, name: v } : h) }))} id={`hobby-${hob.id}`} name="Centre d'intérêt" />
                                </div>
                              ))}
                            </div>
                          </CanvaElementWrapper>

                        </div>
                      </div>

                      {/* RIGHT MAIN COLUMN (~63% width) */}
                      <div className="w-[63%] bg-[#FAF7F2] p-2.5 flex flex-col justify-between overflow-y-auto space-y-2">
                        <div>
                          
                          {/* 1. PROFIL PROFESSIONNEL (🪪) */}
                          <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel" className="mb-2">
                            <div className="flex items-center gap-1.5 text-[#382F2D] font-black text-[10px] uppercase tracking-wider border-b-2 border-[#382F2D] pb-0.5 mb-1">
                              <i className="fa-solid fa-id-card text-purple-700 text-[10.5px]"></i>
                              <span>{cvData.sectionTitles?.profile || "Profil Professionnel"}</span>
                            </div>
                            <div className="bg-white border-2 border-[#382F2D] rounded-xl p-2 text-[8px] text-[#382F2D] font-medium leading-relaxed shadow-xs text-justify">
                              <CanvaText value={cvData.profile || "Technicien passionné et spécialisé dans l'installation, le dépannage et la maintenance d'équipements, avec une expérience diversifiée et un engagement continu envers l'excellence opérationnelle."} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} className="block text-justify" />
                            </div>
                          </CanvaElementWrapper>

                          {/* 2. EXPÉRIENCES PROFESSIONNELLES (💼) */}
                          <div className="mb-2">
                            <div className="flex items-center gap-1.5 text-[#382F2D] font-black text-[10px] uppercase tracking-wider border-b-2 border-[#382F2D] pb-0.5 mb-1">
                              <i className="fa-solid fa-briefcase text-amber-800 text-[10.5px]"></i>
                              <span>{cvData.sectionTitles?.experience || "Expériences Professionnelles"}</span>
                            </div>
                            
                            <div className="space-y-1.5">
                              {cvData.experiences.map((exp) => (
                                <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="space-y-0.5 p-1 rounded-lg">
                                  {/* Header line with chevron */}
                                  <div className="font-black text-[8.5px] text-[#382F2D] flex items-center gap-1 leading-tight flex-wrap">
                                    <span className="text-[#382F2D] text-[9.5px]">➤</span>
                                    <span>
                                      <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                      {" - "}
                                      <CanvaText value={exp.current ? "Présent" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Présent" />
                                      {" : "}
                                      <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Titre du poste" placeholder="Poste" />
                                    </span>
                                  </div>
                                  {/* Employer badge */}
                                  <div className="pl-3">
                                    <span className="bg-[#EDE6DC] border border-[#382F2D] rounded-md px-1.5 py-0.2 text-[7.5px] font-black text-[#382F2D] inline-block">
                                      <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Entreprise" placeholder="Entreprise" />
                                      {exp.city ? ` (${exp.city})` : ""}
                                    </span>
                                  </div>
                                  {/* Details bullet box */}
                                  {exp.description && (
                                    <div className="ml-3 bg-white border border-[#382F2D] rounded-lg p-1.5 text-[7.5px] text-[#382F2D] leading-tight space-y-0.5 shadow-xs">
                                      <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                    </div>
                                  )}
                                </CanvaElementWrapper>
                              ))}
                            </div>
                          </div>

                          {/* 3. FORMATION ET DIPLÔMES (🎓) */}
                          <div>
                            <div className="flex items-center gap-1.5 text-[#382F2D] font-black text-[10px] uppercase tracking-wider border-b-2 border-[#382F2D] pb-0.5 mb-1">
                              <i className="fa-solid fa-graduation-cap text-slate-800 text-[10.5px]"></i>
                              <span>{cvData.sectionTitles?.education || "FORMATION ET DIPLÔMES"}</span>
                            </div>
                            
                            <div className="space-y-1">
                              {cvData.educations.map((edu) => (
                                <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="space-y-0.5 p-1 rounded-lg">
                                  <div className="font-black text-[8.5px] text-[#382F2D] flex items-center gap-1 leading-tight flex-wrap">
                                    <span className="text-[#382F2D] text-[9.5px]">➤</span>
                                    <span>
                                      <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                      {" - "}
                                      <CanvaText value={edu.current ? "Présent" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                      {" : "}
                                      <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                    </span>
                                  </div>
                                  <div className="pl-3">
                                    <span className="bg-[#EDE6DC] border border-[#382F2D] rounded-md px-1.5 py-0.2 text-[7.5px] font-bold text-[#382F2D] inline-block">
                                      <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                      {edu.city ? ` • ${edu.city}` : ""}
                                    </span>
                                  </div>
                                </CanvaElementWrapper>
                              ))}
                            </div>
                          </div>

                        </div>

                        {/* Footer footnote */}
                        <div className="text-[7px] text-[#382F2D]/60 font-semibold text-center pt-1 border-t border-[#382F2D]/20">
                          Créé via Facilite.fr • Conforme aux standards professionnels
                        </div>
                      </div>

                    </div>

                  </div>
                )}

                {/* --- TEMPLATE: ENTREPRENEUR NUMÉRIQUE (Design Officiel Facilité) --- */}
                {/* --- TEMPLATE 1: ENTREPRENEUR (Officiel Facilité - Photo & 2 Colonnes) --- */}
                {selectedTemplate === "entrepreneur" && (
                  <div className="flex flex-col w-full h-full text-xs flex-grow font-sans bg-white relative">
                    
                    {/* Top Right Decoration (Pastel Green Bookmark) */}
                    <div className="absolute top-0 right-10 w-14 h-24 bg-[#D3E3D7] rounded-b-3xl z-0 pointer-events-none shadow-xs"></div>

                    {/* Header (Cliquer pour modifier le titre, le nom et la photo) */}
                    <CanvaElementWrapper
                      id="header"
                      type="header"
                      name="En-tête & Profil"
                      className="flex items-center px-8 pt-8 pb-4 relative z-10 cursor-pointer group/hdr hover:bg-slate-50/60 rounded-xl transition"
                    >
                      {/* Photo */}
                      <CanvaElementWrapper
                        id="photo"
                        type="photo"
                        name="Photo de profil"
                        className="w-28 h-28 rounded-full border-[4px] border-[#1B2B3A] bg-slate-100 flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0 relative cursor-pointer group"
                      >
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Profile"
                            onMouseDown={handlePhotoDragStart}
                            onMouseMove={handlePhotoDragMove}
                            onMouseUp={handlePhotoDragEnd}
                            onMouseLeave={handlePhotoDragEnd}
                            onTouchStart={handlePhotoDragStart}
                            onTouchMove={handlePhotoDragMove}
                            onTouchEnd={handlePhotoDragEnd}
                            style={{
                              objectPosition: `${cvData.photoX !== undefined ? cvData.photoX : 50}% ${cvData.photoY !== undefined ? cvData.photoY : 50}%`,
                              transform: `scale(${cvData.photoZoom || 1})`,
                              transition: "none",
                              cursor: "move"
                            }}
                            className="w-full h-full object-cover select-none bg-white"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-400 group-hover:bg-slate-200 transition">
                            <i className="fa-solid fa-user text-4xl text-slate-400 mb-1"></i>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight">Ajouter photo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold pointer-events-none">
                          <i className="fa-solid fa-camera"></i>
                        </div>
                      </CanvaElementWrapper>
                      
                      {/* Name & Title */}
                      <div className="ml-6 flex-grow">
                        <div className="flex items-center gap-2">
                          <h1 className="text-xl sm:text-2xl font-black text-[#285E8E] tracking-wide mb-1 leading-tight">
                            <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Entrepreneur numérique" />
                          </h1>
                          <i className="fa-solid fa-pen text-[#285E8E] text-xs opacity-0 group-hover/hdr:opacity-100 transition" title="Modifier"></i>
                        </div>
                        <h2 className="text-base font-bold text-gray-800 tracking-tight flex items-center gap-1.5 flex-wrap">
                          <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Macoumba" />
                          <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Samake" />
                        </h2>
                      </div>
                    </CanvaElementWrapper>

                    {/* Contact Bar */}
                    <CanvaElementWrapper
                      id="contact"
                      type="contact"
                      name="Coordonnées"
                      className="mx-8 border-y border-[#D3E3D7] py-2.5 mb-4 flex justify-between items-center text-[9.5px] font-semibold text-gray-700 cursor-pointer hover:bg-[#D3E3D7]/20 transition rounded-sm px-1 group/cnt flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-[#285E8E] text-[10px]"></i>
                        <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Pikine" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-envelope text-[#285E8E] text-[10px]"></i>
                        <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="facilitefacile@gmail.com" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-phone text-[#285E8E] text-[10px]"></i>
                        <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" />
                        <i className="fa-solid fa-pen text-[#285E8E] text-[8px] ml-1 opacity-0 group-hover/cnt:opacity-100 transition"></i>
                      </div>
                    </CanvaElementWrapper>

                    {/* Main Content (Profil + 2 columns) */}
                    <div className="px-8 flex-grow flex flex-col">
                      
                      {/* Profil */}
                      <CanvaElementWrapper id="profile" type="profile" name="Profil" className="mb-4 pb-3.5 border-b border-[#D1E2D7]">
                        <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                          <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                          {cvData.sectionTitles?.profile?.toUpperCase() || "PROFIL"}
                        </h3>
                        <p className="text-[8.5px] text-gray-700 leading-relaxed font-normal text-justify">
                          <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Cliquez ici pour décrire votre profil professionnel..." className="block text-justify" />
                        </p>
                      </CanvaElementWrapper>

                      <div className="flex gap-6 flex-grow">
                        {/* Left Column (Experiences & Formations) */}
                        <div className="w-[68%] flex flex-col">
                          
                          {/* Expériences */}
                          <div className="mb-4">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-2.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.experience?.toUpperCase() || "EXPÉRIENCE"}
                            </h3>
                            <div className="space-y-3.5">
                              {cvData.experiences.map((exp) => (
                                <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="p-1 rounded-lg">
                                  <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="text-[10px] font-black text-[#1B2B3A] uppercase tracking-tight">
                                      <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                    </h4>
                                    <span className="text-[8.5px] font-bold text-gray-600 border-b border-gray-300 pb-0.5 whitespace-nowrap">
                                      <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                      {" – "}
                                      <CanvaText value={exp.current ? "présent" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="présent" />
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-600 italic mb-1">
                                    <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Entreprise" placeholder="Entreprise" />
                                  </div>
                                  {exp.description && (
                                    <div className="text-[8.5px] text-gray-700 leading-snug space-y-0.5 pl-3 list-disc list-outside text-justify font-medium">
                                      <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                    </div>
                                  )}
                                </CanvaElementWrapper>
                              ))}
                            </div>
                          </div>

                          {/* Formations */}
                          <div className="mb-4">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-2.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.education?.toUpperCase() || "FORMATION"}
                            </h3>
                            <div className="space-y-3">
                              {cvData.educations.map((edu) => (
                                <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="p-1 rounded-lg">
                                  <div className="flex justify-between items-baseline mb-0.5">
                                    <h4 className="text-[10px] font-black text-[#1B2B3A] uppercase pr-2 tracking-tight">
                                      <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                    </h4>
                                    <span className="text-[8.5px] font-bold text-gray-600 border-b border-gray-300 pb-0.5 whitespace-nowrap">
                                      <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                      {" – "}
                                      <CanvaText value={edu.current ? "présent" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="présent" />
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-medium text-gray-600 italic mb-1">
                                    <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                    {edu.city ? `, ${edu.city}` : ""}
                                  </div>
                                </CanvaElementWrapper>
                              ))}
                            </div>
                          </div>

                        </div>

                        {/* Right Column (Aptitudes, Logiciels, Langues, Certifications, Centres d'intérêt) */}
                        <div className="w-[32%] flex flex-col space-y-3.5">
                          
                          {/* Aptitudes */}
                          <CanvaElementWrapper id="skills" type="skill" name="Aptitudes">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.skills?.toUpperCase() || "APTITUDES"}
                            </h3>
                            <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                              {(cvData.skills?.length > 0 ? cvData.skills : [
                                { id: 1, name: "Gestion de projet" },
                                { id: 2, name: "Leadership & Stratégie" }
                              ]).map((skill) => (
                                <li key={skill.id} className="tracking-tight">
                                  <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-${skill.id}`} name="Aptitude" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>

                          {/* Logiciels */}
                          <CanvaElementWrapper id="itSkills" type="itSkill" name="Informatique / Logiciels">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.itSkills?.toUpperCase() || "LOGICIELS"}
                            </h3>
                            <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                              {(cvData.itSkills?.length > 0 ? cvData.itSkills : [
                                { id: 1, name: "Pack Office" },
                                { id: 2, name: "Canva & Figma" }
                              ]).map((skill) => (
                                <li key={skill.id} className="tracking-tight">
                                  <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, itSkills: prev.itSkills.map(i => i.id === skill.id ? { ...i, name: v } : i) }))} id={`it-${skill.id}`} name="Logiciel" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>

                          {/* Langues */}
                          <CanvaElementWrapper id="languages" type="language" name="Langues">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}
                            </h3>
                            <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                              {(cvData.languages?.length > 0 ? cvData.languages : [
                                { id: 1, name: "Français", level: "Courant" },
                                { id: 2, name: "Anglais", level: "Intermédiaire" }
                              ]).map((lang) => (
                                <li key={lang.id} className="tracking-tight">
                                  <CanvaText value={lang.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, name: v } : l) }))} id={`lang-name-${lang.id}`} name="Langue" />{" "}
                                  {lang.level && <span className="text-gray-500 font-normal">(<CanvaText value={lang.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(l => l.id === lang.id ? { ...l, level: v } : l) }))} id={`lang-lvl-${lang.id}`} name="Niveau" />)</span>}
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>

                          {/* Certifications */}
                          {(cvData.qualities?.length > 0) && (
                            <CanvaElementWrapper id="qualities" type="quality" name="Certifications">
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                {cvData.sectionTitles?.qualities?.toUpperCase() || "CERTIFICATIONS"}
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.qualities.map((q) => (
                                  <li key={q.id} className="tracking-tight">
                                    <CanvaText value={q.name} onChange={(v) => setCvData(prev => ({ ...prev, qualities: prev.qualities.map(item => item.id === q.id ? { ...item, name: v } : item) }))} id={`quality-${q.id}`} name="Certification" />
                                  </li>
                                ))}
                              </ul>
                            </CanvaElementWrapper>
                          )}

                          {/* Centres d'intérêt */}
                          <CanvaElementWrapper id="hobbies" type="hobby" name="Centres d'intérêt">
                            <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                              <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                              {cvData.sectionTitles?.hobbies?.toUpperCase() || "CENTRES D'INTÉRÊT"}
                            </h3>
                            <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                              {(cvData.hobbies?.length > 0 ? cvData.hobbies : [
                                { id: 1, name: "Lecture & Innovation" },
                                { id: 2, name: "Voyages" }
                              ]).map((hobby) => (
                                <li key={hobby.id} className="tracking-tight">
                                  <CanvaText value={hobby.name} onChange={(v) => setCvData(prev => ({ ...prev, hobbies: prev.hobbies.map(h => h.id === hobby.id ? { ...h, name: v } : h) }))} id={`hobby-${hobby.id}`} name="Centre d'intérêt" />
                                </li>
                              ))}
                            </ul>
                          </CanvaElementWrapper>

                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 9: ÉLÉGANCE (Sidebar noire, touches dorées, sans photo) --- */}
                {selectedTemplate === "elegance" && (
                  <div className="flex w-full h-full text-xs flex-grow font-sans">

                    {/* Colonne gauche (sidebar noire) */}
                    <div className="w-[35%] bg-black text-white p-5 flex flex-col flex-shrink-0 overflow-hidden">
                      {/* Logo générique "CV" (jamais de photo sur ce modèle) */}
                      <div className="w-24 h-24 rounded-full border-2 border-[#D4AF37] bg-black flex items-center justify-center mx-auto mb-6 flex-shrink-0 select-none">
                        <span className="text-[#D4AF37] font-serif italic text-3xl">CV</span>
                      </div>

                      {/* Contact */}
                      <CanvaElementWrapper id="contact" type="contact" name="Coordonnées" className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-solid fa-address-card text-[#D4AF37] mr-2"></i>
                          {cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}
                        </h3>
                        <ul className="space-y-2 text-[10px] font-semibold">
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-mobile-screen text-[#D4AF37] w-4 text-center"></i>
                            <CanvaText value={cvData.phone} onChange={(v) => setCvData(prev => ({ ...prev, phone: v }))} id="phone" name="Téléphone" placeholder="+221 77 140 08 32" />
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-envelope text-[#D4AF37] w-4 text-center"></i>
                            <CanvaText value={cvData.email} onChange={(v) => setCvData(prev => ({ ...prev, email: v }))} id="email" name="Email" placeholder="facilitefacile@gmail.com" className="break-all" />
                          </li>
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-location-dot text-[#D4AF37] w-4 text-center"></i>
                            <CanvaText value={cvData.city || cvData.address} onChange={(v) => setCvData(prev => ({ ...prev, city: v }))} id="city" name="Ville" placeholder="Pikine" />
                          </li>
                        </ul>
                      </CanvaElementWrapper>

                      {/* Qualités */}
                      <CanvaElementWrapper id="qualities" type="quality" name="Qualités" className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-solid fa-star text-[#D4AF37] mr-2"></i>
                          {cvData.sectionTitles?.qualities?.toUpperCase() || "QUALITÉS"}
                        </h3>
                        <ul className="space-y-1.5 text-[10px] font-semibold">
                          {(cvData.qualities?.length > 0 ? cvData.qualities : [
                            { id: 1, name: "Sens de l'organisation" },
                            { id: 2, name: "Rigueur et autonomie" }
                          ]).map((q) => (
                            <li key={q.id} className="flex items-start space-x-1.5">
                              <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                              <CanvaText value={q.name} onChange={(v) => setCvData(prev => ({ ...prev, qualities: prev.qualities.map(item => item.id === q.id ? { ...item, name: v } : item) }))} id={`quality-${q.id}`} name="Qualité" />
                            </li>
                          ))}
                        </ul>
                      </CanvaElementWrapper>

                      {/* Informatique */}
                      <CanvaElementWrapper id="itSkills" type="itSkill" name="Informatique" className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-solid fa-screwdriver-wrench text-[#D4AF37] mr-2"></i>
                          INFORMATIQUE
                        </h3>
                        <ul className="space-y-1.5 text-[10px] font-semibold">
                          {(cvData.itSkills?.length > 0 ? cvData.itSkills : [
                            { id: 1, name: "Bureautique & Excel" },
                            { id: 2, name: "Gestion pharmaceutique" }
                          ]).map((s) => (
                            <li key={s.id} className="flex items-start space-x-1.5">
                              <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                              <CanvaText value={s.name} onChange={(v) => setCvData(prev => ({ ...prev, itSkills: prev.itSkills.map(item => item.id === s.id ? { ...item, name: v } : item) }))} id={`it-${s.id}`} name="Logiciel" />
                            </li>
                          ))}
                        </ul>
                      </CanvaElementWrapper>

                      {/* Langues */}
                      <CanvaElementWrapper id="languages" type="language" name="Langues" className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-solid fa-globe text-[#D4AF37] mr-2"></i>
                          {cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}
                        </h3>
                        <ul className="space-y-1.5 text-[10px] font-semibold">
                          {(cvData.languages?.length > 0 ? cvData.languages : [
                            { id: 1, name: "Français", level: "Courant" },
                            { id: 2, name: "Anglais", level: "Moyen" }
                          ]).map((l) => (
                            <li key={l.id} className="flex items-start space-x-1.5">
                              <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                              <span>
                                <CanvaText value={l.name} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(item => item.id === l.id ? { ...item, name: v } : item) }))} id={`lang-name-${l.id}`} name="Langue" />
                                {" : "}
                                <span className="font-normal opacity-80">
                                  <CanvaText value={l.level} onChange={(v) => setCvData(prev => ({ ...prev, languages: prev.languages.map(item => item.id === l.id ? { ...item, level: v } : item) }))} id={`lang-lvl-${l.id}`} name="Niveau" />
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CanvaElementWrapper>

                      {/* Centres d'intérêt */}
                      <CanvaElementWrapper id="hobbies" type="hobby" name="Centres d'intérêt" className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-regular fa-lightbulb text-[#D4AF37] mr-2"></i>
                          CENTRES D'INTÉRÊT
                        </h3>
                        <ul className="space-y-1.5 text-[10px] font-semibold">
                          {(cvData.hobbies?.length > 0 ? cvData.hobbies : [
                            { id: 1, name: "Santé et bien-être" },
                            { id: 2, name: "Lecture" }
                          ]).map((h) => (
                            <li key={h.id} className="flex items-start space-x-1.5">
                              <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                              <CanvaText value={h.name} onChange={(v) => setCvData(prev => ({ ...prev, hobbies: prev.hobbies.map(item => item.id === h.id ? { ...item, name: v } : item) }))} id={`hobby-${h.id}`} name="Centre d'intérêt" />
                            </li>
                          ))}
                        </ul>
                      </CanvaElementWrapper>
                    </div>

                    {/* Colonne droite (blanche) */}
                    <div className="w-[65%] bg-white flex flex-col overflow-hidden">
                      {/* Bandeau noir en tête */}
                      <CanvaElementWrapper id="header" type="header" name="En-tête" className="bg-black text-white px-6 py-6 flex-shrink-0">
                        <h1 className="text-2xl font-black uppercase tracking-wide leading-tight flex items-center gap-2 flex-wrap">
                          <CanvaText value={cvData.firstName} onChange={(v) => setCvData(prev => ({ ...prev, firstName: v }))} id="firstName" name="Prénom" placeholder="Prénom" />
                          <CanvaText value={cvData.lastName} onChange={(v) => setCvData(prev => ({ ...prev, lastName: v }))} id="lastName" name="Nom" placeholder="Nom" />
                        </h1>
                        <p className="text-[11px] font-light text-white/80 mt-1">
                          <CanvaText value={cvData.jobTitle || cvData.experiences[0]?.title} onChange={(v) => setCvData(prev => ({ ...prev, jobTitle: v }))} id="jobTitle" name="Titre professionnel" placeholder="Titre professionnel" />
                        </p>
                      </CanvaElementWrapper>

                      <div className="px-6 py-5 flex-grow flex flex-col space-y-4 overflow-hidden">
                        {/* Profil Professionnel */}
                        <CanvaElementWrapper id="profile" type="profile" name="Profil Professionnel">
                          <h3 className="text-sm font-bold text-black flex items-center mb-1.5">
                            <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                              <i className="fa-solid fa-bullseye text-white text-[8px]"></i>
                            </span>
                            {cvData.sectionTitles?.profile || "Profil Professionnel"}
                          </h3>
                          <p className="text-[10px] text-gray-800 leading-relaxed font-medium text-justify">
                            <CanvaText value={cvData.profile} onChange={(v) => setCvData(prev => ({ ...prev, profile: v }))} id="profile" name="Résumé de Profil" multiline={true} placeholder="Professionnelle polyvalente du secteur pharmaceutique..." className="block text-justify" />
                          </p>
                        </CanvaElementWrapper>

                        {/* Expériences Professionnelles */}
                        <div>
                          <h3 className="text-sm font-bold text-black flex items-center mb-2">
                            <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                              <i className="fa-solid fa-briefcase text-white text-[8px]"></i>
                            </span>
                            {cvData.sectionTitles?.experience || "Expériences Professionnelles"}
                          </h3>
                          <div className="space-y-2.5">
                            {cvData.experiences.map((exp) => (
                              <CanvaElementWrapper key={exp.id} id={exp.id} type="experience" name={`Expérience : ${exp.title || "Poste"}`} className="p-1 rounded-lg">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-bold text-[10.5px] text-gray-900">
                                    <CanvaText value={exp.title} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, title: v } : e) }))} id={`exp-title-${exp.id}`} name="Poste" placeholder="Poste" />
                                    {" — "}
                                    <CanvaText value={exp.employer} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, employer: v } : e) }))} id={`exp-emp-${exp.id}`} name="Entreprise" placeholder="Entreprise" />
                                  </span>
                                  <span className="text-[9px] font-semibold text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    <CanvaText value={exp.startDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, startDate: v } : e) }))} id={`exp-start-${exp.id}`} name="Date de début" placeholder="2024" />
                                    {" – "}
                                    <CanvaText value={exp.current ? "Présent" : exp.endDate} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, endDate: v } : e) }))} id={`exp-end-${exp.id}`} name="Date de fin" placeholder="Présent" />
                                  </span>
                                </div>
                                {exp.description && (
                                  <div className="text-[9px] text-gray-700 leading-tight space-y-0.5 mt-1 text-justify">
                                    <CanvaText value={exp.description} onChange={(v) => setCvData(prev => ({ ...prev, experiences: prev.experiences.map(e => e.id === exp.id ? { ...e, description: v } : e) }))} id={`exp-desc-${exp.id}`} name="Missions" multiline={true} className="block whitespace-pre-line" />
                                  </div>
                                )}
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                        {/* Formation et Diplômes */}
                        <div>
                          <h3 className="text-sm font-bold text-black flex items-center mb-2">
                            <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                              <i className="fa-solid fa-graduation-cap text-white text-[8px]"></i>
                            </span>
                            {cvData.sectionTitles?.education || "Formation et Diplômes"}
                          </h3>
                          <div className="space-y-1.5">
                            {cvData.educations.map((edu) => (
                              <CanvaElementWrapper key={edu.id} id={edu.id} type="education" name={`Formation : ${edu.degree || "Diplôme"}`} className="p-1 rounded-lg">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-bold text-[10px] text-gray-900">
                                    <CanvaText value={edu.degree} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, degree: v } : e) }))} id={`edu-deg-${edu.id}`} name="Diplôme" placeholder="Diplôme" />
                                    {" — "}
                                    <CanvaText value={edu.school} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, school: v } : e) }))} id={`edu-sch-${edu.id}`} name="Établissement" placeholder="Établissement" />
                                  </span>
                                  <span className="text-[9px] font-semibold text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    <CanvaText value={edu.startDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, startDate: v } : e) }))} id={`edu-start-${edu.id}`} name="Année début" placeholder="2023" />
                                    {" – "}
                                    <CanvaText value={edu.current ? "En cours" : edu.endDate} onChange={(v) => setCvData(prev => ({ ...prev, educations: prev.educations.map(e => e.id === edu.id ? { ...e, endDate: v } : e) }))} id={`edu-end-${edu.id}`} name="Année fin" placeholder="2025" />
                                  </span>
                                </div>
                              </CanvaElementWrapper>
                            ))}
                          </div>
                        </div>

                        {/* Compétences Clés */}
                        <CanvaElementWrapper id="skills" type="skill" name="Compétences Clés">
                          <h3 className="text-sm font-bold text-black flex items-center mb-2">
                            <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                              <i className="fa-solid fa-star text-white text-[8px]"></i>
                            </span>
                            {cvData.sectionTitles?.skills || "Compétences Clés"}
                          </h3>
                          <ul className="text-[10px] text-gray-800 leading-relaxed space-y-1">
                            {(cvData.skills?.length > 0 ? cvData.skills : [
                              { id: 1, name: "Gestion de stocks et relation client" }
                            ]).map((skill) => (
                              <li key={skill.id}>
                                <CanvaText value={skill.name} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, name: v } : s) }))} id={`skill-key-${skill.id}`} name="Compétence" className="font-bold text-gray-900" />
                                {skill.level && <span> : <CanvaText value={skill.level} onChange={(v) => setCvData(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skill.id ? { ...s, level: v } : s) }))} id={`skill-key-lvl-${skill.id}`} name="Niveau" /></span>}
                              </li>
                            ))}
                          </ul>
                        </CanvaElementWrapper>
                      </div>

                      <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 p-3 flex-shrink-0">
                        <span>Créé via Facilite.fr • Langue du document : {cvData.cvLang}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* RENDER ADDITIONAL PAGES (Page 2, Page 3, Cover Letters...) */}
              {cvPages.slice(1).map((page, pageIdx) => {
                const actualIdx = pageIdx + 1;
                return (
                  <div key={page.id} className="mt-8 flex flex-col items-center w-full">
                    {/* Top Floating Page Bar (Canva Style) */}
                    <div className="w-full max-w-[595px] flex items-center justify-between py-1.5 px-3 mb-2 bg-slate-900/80 backdrop-blur-xs border border-slate-750 rounded-xl text-white text-xs font-bold shadow-xs no-print">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-black text-slate-200">Page {actualIdx + 1} sur {cvPages.length}</span>
                        <span className="text-[10px] text-blue-300 bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-500/30">
                          {page.type === "blank" ? "Page Blanche" : page.type === "cover_letter" ? "Lettre de motivation" : "Suite du CV"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleLockPage(actualIdx)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                            page.isLocked ? "bg-amber-500/30 text-amber-300 border border-amber-500/40" : "hover:bg-slate-800 text-slate-300 hover:text-white"
                          }`}
                          title={page.isLocked ? "Déverrouiller la page" : "Verrouiller la page"}
                        >
                          <i className={`fa-solid ${page.isLocked ? "fa-lock" : "fa-lock-open"} text-xs`}></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePage(actualIdx)}
                          className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                          title="Dupliquer cette page"
                        >
                          <i className="fa-regular fa-copy text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPage("blank")}
                          className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                          title="Ajouter une page blanche vide"
                        >
                          <i className="fa-solid fa-file-circle-plus text-xs text-blue-400"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePage(actualIdx)}
                          className="w-7 h-7 rounded-lg hover:bg-red-500/30 hover:text-red-300 text-slate-400 flex items-center justify-center transition cursor-pointer"
                          title="Supprimer cette page"
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>

                    {/* Page Sheet Container */}
                    <div
                      id={`cv-page-${actualIdx + 1}-sheet`}
                      className="bg-white shadow-2xl relative w-[595px] min-h-[842px] h-[842px] max-w-[595px] max-h-[842px] min-w-[595px] overflow-hidden text-gray-900 border border-gray-300 rounded-sm flex flex-col font-sans"
                    >
                      {page.type === "blank" ? (
                        /* CANVA PURE BLANK WHITE PAGE (100% BLANC COMME SUR CANVA) */
                        <div
                          className="w-full h-full bg-white relative p-10 flex flex-col justify-between font-sans select-text overflow-hidden"
                          onClick={() => setSelectedCanvasElement({ id: `blank-page-${page.id}`, type: "blank_canvas", name: `Page Blanche ${actualIdx + 1}` })}
                        >
                          <textarea
                            placeholder={isAdvancedEditOpen ? "Page blanche Canva vierge. Cliquez ici pour taper du texte librement ou y insérer vos éléments..." : ""}
                            value={page.notes || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCvPages(prev => prev.map((p, idx) => idx === actualIdx ? { ...p, notes: val } : p));
                            }}
                            className="w-full h-full bg-transparent border-0 resize-none text-xs text-gray-900 placeholder:text-gray-300 focus:outline-hidden p-0 leading-relaxed font-sans"
                          />
                        </div>
                      ) : page.type === "cover_letter" ? (
                        /* COVER LETTER MATCHING TEMPLATE */
                        <div className="flex flex-col w-full h-full p-8 text-xs font-sans bg-white justify-between">
                          <div>
                            {/* Header matching CV style */}
                            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
                              <div>
                                <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight">{cvData.firstName} {cvData.lastName}</h1>
                                <p className="text-xs font-bold text-blue-600 tracking-wider uppercase mt-0.5">{cvData.jobTitle || "Professionnel"}</p>
                              </div>
                              <div className="text-[9px] text-gray-600 text-right leading-tight font-medium">
                                <p>{cvData.phone || "+221 77 140 08 32"}</p>
                                <p>{cvData.email || "facilitefacile@gmail.com"}</p>
                                <p>{cvData.city || "Dakar, Sénégal"}</p>
                              </div>
                            </div>

                            {/* Recipient & Date */}
                            <div className="flex justify-between text-[10px] text-gray-700 font-bold mb-6">
                              <div>
                                <p className="font-extrabold text-gray-900">{coverLetterData.recipientName}</p>
                                <p>{coverLetterData.companyName}</p>
                                <p>{coverLetterData.city}</p>
                              </div>
                              <div className="text-right">
                                <p>{coverLetterData.city}, le {coverLetterData.date}</p>
                              </div>
                            </div>

                            {/* Subject */}
                            <div className="mb-5">
                              <p className="font-black text-xs text-slate-900 border-b border-gray-200 pb-1">
                                {coverLetterData.subject}
                              </p>
                            </div>

                            {/* Letter Body */}
                            <div className="text-[10px] text-gray-800 leading-relaxed space-y-3 font-normal text-justify">
                              {coverLetterData.body.split("\n\n").map((para, pIdx) => (
                                <p key={pIdx}>{para}</p>
                              ))}
                            </div>
                          </div>

                          {/* Signature */}
                          <div className="text-right pt-6">
                            <p className="text-[10px] text-gray-600">Cordialement,</p>
                            <p className="text-xs font-black text-slate-900 mt-2">{cvData.firstName} {cvData.lastName}</p>
                          </div>
                        </div>
                      ) : page.type === "cv_p2" ? (
                        /* CV CONTINUATION PAGE 2 */
                        <div className="flex flex-col w-full h-full p-8 text-xs font-sans bg-white justify-between">
                          <div className="space-y-6">
                            {/* Page 2 Header */}
                            <div className="border-b border-gray-300 pb-3 flex justify-between items-center">
                              <div>
                                <h2 className="text-base font-black text-slate-900 uppercase">{cvData.firstName} {cvData.lastName}</h2>
                                <p className="text-[10px] font-bold text-gray-600">{cvData.jobTitle} — Page 2</p>
                              </div>
                              <div className="text-[9px] text-gray-500 font-semibold">
                                {cvData.email} • {cvData.phone}
                              </div>
                            </div>

                            {/* Section: Réalisations & Projets */}
                            <div>
                              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                                <i className="fa-solid fa-trophy text-amber-500 text-xs"></i>
                                PROJETS & RÉALISATIONS COMPLÉMENTAIRES
                              </h3>
                              <div className="space-y-3 text-[10px] text-gray-800">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                                  <div className="font-bold text-gray-900">Projet Clé — Optimisation & Déploiement</div>
                                  <p className="text-[9px] text-gray-600 mt-0.5">Pilotage stratégique, coordination des équipes et atteinte des objectifs fixés.</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                                  <div className="font-bold text-gray-900">Initiative & Innovation Opérationnelle</div>
                                  <p className="text-[9px] text-gray-600 mt-0.5">Amélioration continue des processus et satisfaction client renforcée.</p>
                                </div>
                              </div>
                            </div>

                            {/* Section: Références Professionnelles */}
                            <div>
                              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                                <i className="fa-solid fa-user-check text-blue-600 text-xs"></i>
                                RÉFÉRENCES PROFESSIONNELLES
                              </h3>
                              <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-800">
                                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200/80">
                                  <p className="font-bold text-gray-900">Direction Générale / Superviseur</p>
                                  <p className="text-[9px] text-gray-500">Contact disponible sur demande</p>
                                </div>
                                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200/80">
                                  <p className="font-bold text-gray-900">Responsable Pédagogique</p>
                                  <p className="text-[9px] text-gray-500">Contact disponible sur demande</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 pt-3">
                            Document généré via Facilite.fr • Page 2
                          </div>
                        </div>
                      ) : (
                        /* EXACT IDENTICAL CLONE OF PAGE 1 (CV DUPLICATE) */
                        <div
                          dangerouslySetInnerHTML={{
                            __html: typeof document !== "undefined" && document.getElementById("cv-preview-sheet") ? document.getElementById("cv-preview-sheet").innerHTML : ""
                          }}
                          className="w-full h-full flex flex-col font-sans"
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* CANVA-STYLE ADD PAGE BUTTON */}
              <div className="relative mt-6 mb-4 no-print flex flex-col items-center">
                <div className="inline-flex rounded-2xl shadow-md border border-gray-300 bg-white overflow-hidden group">
                  <button
                    type="button"
                    onClick={() => handleAddPage("blank")}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 hover:text-blue-600 font-extrabold text-xs transition flex items-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-plus text-blue-600 text-sm"></i>
                    <span>Ajouter une page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPageMenu(prev => !prev)}
                    className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border-l border-gray-200 text-gray-600 hover:text-blue-600 transition cursor-pointer"
                    title="Choisir le type de page à ajouter"
                  >
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showAddPageMenu ? "rotate-180" : ""}`}></i>
                  </button>
                </div>

                {/* Dropdown Menu */}
                {showAddPageMenu && (
                  <div className="absolute top-full mt-2 z-40 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 w-64 text-left animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => handleAddPage("blank")}
                      className="w-full p-2.5 rounded-xl hover:bg-blue-50/70 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-file text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-900 block group-hover:text-blue-600">Page Blanche Vierge</span>
                        <span className="text-[10px] text-gray-500">Page A4 vierge personnalisable</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPage("cv_p2")}
                      className="w-full p-2.5 rounded-xl hover:bg-blue-50/70 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-file-lines text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-900 block group-hover:text-emerald-600">Suite du CV (Page 2)</span>
                        <span className="text-[10px] text-gray-500">Expériences & projets additionnels</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPage("cover_letter")}
                      className="w-full p-2.5 rounded-xl hover:bg-purple-50/70 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-envelope-open-text text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-900 block group-hover:text-purple-600">Lettre de motivation</span>
                        <span className="text-[10px] text-gray-500">Design assorti au modèle</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicatePage(cvPages.length - 1)}
                      className="w-full p-2.5 rounded-xl hover:bg-emerald-50/70 text-left transition flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-copy text-xs"></i>
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-900 block group-hover:text-amber-600">Dupliquer la page</span>
                        <span className="text-[10px] text-gray-500">Copie conforme</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Print / Preview Notice */}
              <div className="mt-3 text-[10px] text-gray-400 text-center font-semibold px-2 no-print max-w-[595px]">
                Vous pouvez imprimer ou enregistrer en PDF avec votre navigateur. Les barres d'outils et de navigation seront automatiquement masquées.
              </div>

            </div>
          </section>

        </div>
      </div>

      {/* --- MODALE DE TARIFICATION (paiement KPay requis pour finaliser le CV) --- */}
      {showPricingModal && (
        <PricingModal cvModelId={selectedTemplate} resumeId={savedResumeId} onClose={() => setShowPricingModal(false)} />
      )}

      {/* --- APERÇU PLEIN ÉCRAN D'UN MODÈLE DE CV --- */}
      <TemplatePreviewModal
        template={previewTemplate}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={(tpl) => {
          setSelectedTemplate(tpl.id);
          setIsPreviewOpen(false);
        }}
      />

      {/* --- CONTACT MODAL (GLOBAL ACCORDING TO GEMINI.MD RULES) --- */}
      {contactModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] no-print animate-fade-in-up">
          <div className="bg-[#FAF6F1] rounded-3xl p-6 md:p-8 max-w-lg w-full relative shadow-2xl border border-[#E3DBCC]/60">
            
            {/* Close Button */}
            <button
              onClick={handleCloseContactModal}
              className="absolute top-4 right-4 w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-xs transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {!formSubmitted ? (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="text-left mb-6">
                  <h3 className="text-xl font-black text-gray-900">{t.modalTitle}</h3>
                  <p className="text-xs font-semibold text-gray-500 mt-1">{t.modalSubtitle}</p>
                </div>

                <div className="space-y-3.5 text-left text-xs font-bold text-gray-700">
                  <div>
                    <label className="block mb-1">{t.modalLabelName}</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-blue-600"
                      placeholder={t.modalPlaceholderName}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">{t.modalLabelEmail}</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-blue-600"
                      placeholder={t.modalPlaceholderEmail}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">{t.modalLabelSubject}</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-blue-600"
                      placeholder={t.modalPlaceholderSubject}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">{t.modalLabelMessage}</label>
                    <textarea
                      rows="3"
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl font-medium focus:outline-none focus:border-blue-600"
                      placeholder={t.modalPlaceholderMessage}
                    ></textarea>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 text-white font-extrabold py-3.5 rounded-xl hover:bg-gray-800 transition disabled:opacity-75 cursor-pointer mt-4"
                >
                  {isSubmitting ? t.modalSending : t.modalSubmit}
                </button>
              </form>
            ) : (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-[#10E688] text-2xl">
                  <i className="fa-solid fa-paper-plane animate-bounce"></i>
                </div>
                <h3 className="text-lg font-black text-gray-900">{t.modalSuccessTitle}</h3>
                <p className="text-xs text-gray-500 font-semibold">{t.modalSuccessDesc}</p>
                <button
                  onClick={handleCloseContactModal}
                  className="bg-gray-900 text-white font-bold py-2.5 px-6 rounded-full text-xs hover:bg-gray-800 transition cursor-pointer mt-4"
                >
                  {t.modalClose}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
      {/* PHOTO CROPPER MODAL */}
      {isCropping && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-150 animate-fadeIn">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black text-gray-900 flex items-center uppercase tracking-wider">
                <i className="fa-solid fa-crop-simple text-[#10E688] mr-2 text-base"></i>
                Ajuster & Rogner la Photo
              </h3>
              <button
                onClick={() => setIsCropping(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4">
              
              {/* Cropper Box Container */}
              <div
                className="relative bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center select-none border border-gray-200"
                style={{ width: "300px", height: "300px" }}
              >
                {/* Draggable Photo (placed behind centered crop frame) */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <img
                    id="modal-crop-image"
                    src={photoPreview}
                    alt="To Crop"
                    onMouseDown={handleModalImageDragStart}
                    onTouchStart={handleModalImageDragStart}
                    style={{
                      transform: `scale(${modalZoom}) translate(${modalX}%, ${modalY}%)`,
                      transition: "none",
                      cursor: isDraggingModalImage ? "grabbing" : "grab",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                    className="select-none"
                  />
                </div>

                {/* Circular Spotlight Overlay mask (Fixed in center) */}
                <div
                  style={{
                    position: "absolute",
                    left: "60px",
                    top: "60px",
                    width: "180px",
                    height: "180px",
                    border: "2.5px solid #10E688",
                    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.7)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                    zIndex: 20
                  }}
                  className="flex items-center justify-center"
                >
                  <div className="absolute inset-0 border border-white/40 rounded-full pointer-events-none"></div>
                </div>
              </div>

              {/* Photo Zoom slider */}
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-wide">
                  <span>Zoom de la photo</span>
                  <span>{Math.round(modalZoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3.5"
                  step="0.05"
                  value={modalZoom}
                  onChange={(e) => setModalZoom(parseFloat(e.target.value))}
                  className="w-full accent-[#10E688] h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <p className="text-[9px] text-gray-400 font-bold text-center leading-normal">
                Cliquez et glissez sur la photo pour la déplacer derrière le cercle de rognage vert, et utilisez le curseur pour l'agrandir.
              </p>

              {/* Action buttons */}
              <div className="flex space-x-2.5 w-full pt-1.5">
                <button
                  onClick={() => setIsCropping(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-xl text-xs transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={applyCrop}
                  className="flex-1 py-2.5 px-4 bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold rounded-xl text-xs transition shadow-md shadow-[#10E688]/20 cursor-pointer"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANVA-INSPIRED FULLSCREEN A4 WORKSPACE VIEWER */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[950] bg-[#0E131F] text-white flex flex-col overflow-hidden no-print animate-fadeIn select-none">
          
          {/* TOP TOOLBAR (Canva Style) */}
          <header className="h-16 px-4 sm:px-6 bg-[#161C2C] border-b border-slate-700/80 flex items-center justify-between flex-shrink-0 z-20 shadow-md">
            {/* Left: Brand & Document info */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <img src="/logo.jpeg" alt="Logo Facilité" className="w-8 h-8 rounded-full object-cover border border-slate-600 shadow-sm" />
                <span className="font-extrabold text-sm tracking-tight hidden md:inline">Facilité Studio</span>
              </div>
              <div className="h-5 w-[1px] bg-slate-700 hidden sm:block"></div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-black text-gray-100 truncate max-w-[160px] sm:max-w-xs">
                  {cvData.jobTitle || "CV Professionnel"} — {cvData.firstName} {cvData.lastName}
                </span>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Enregistré
                  </span>
                  <span>•</span>
                  <span>Format A4</span>
                  <span>•</span>
                  <span className="capitalize text-slate-300 font-semibold">Modèle {selectedTemplate}</span>
                </div>
              </div>
            </div>

            {/* Center: Zoom Presets (Desktop) */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setCanvaZoom(z => Math.max(0.3, +(z - 0.1).toFixed(2)))}
                className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                title="Zoomer en arrière"
              >
                –
              </button>
              <button
                type="button"
                onClick={handleAutoFit}
                className="px-2.5 py-1 rounded-lg bg-blue-600/40 hover:bg-blue-600 text-blue-200 hover:text-white transition cursor-pointer text-[11px]"
              >
                Adapter
              </button>
              <button
                type="button"
                onClick={() => setCanvaZoom(0.75)}
                className={`px-2 py-1 rounded-lg hover:bg-slate-700 transition cursor-pointer text-[11px] ${canvaZoom === 0.75 ? "bg-slate-700 text-[#10E688]" : "text-slate-300"}`}
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => setCanvaZoom(1)}
                className={`px-2 py-1 rounded-lg hover:bg-slate-700 transition cursor-pointer text-[11px] ${canvaZoom === 1 ? "bg-slate-700 text-[#10E688]" : "text-slate-300"}`}
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setCanvaZoom(1.25)}
                className={`px-2 py-1 rounded-lg hover:bg-slate-700 transition cursor-pointer text-[11px] ${canvaZoom === 1.25 ? "bg-slate-700 text-[#10E688]" : "text-slate-300"}`}
              >
                125%
              </button>
              <button
                type="button"
                onClick={() => setCanvaZoom(z => Math.min(2.0, +(z + 0.1).toFixed(2)))}
                className="w-6 h-6 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                title="Zoomer en avant"
              >
                +
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer border border-slate-600 shadow-sm"
              >
                <i className="fa-solid fa-print"></i>
                <span className="hidden sm:inline">Imprimer</span>
              </button>

              <button
                type="button"
                onClick={downloadMode ? handleDownloadPdf : saveCvDraftAndOpenPricing}
                disabled={downloadingPdf || savingDraft}
                className="px-4 sm:px-5 py-2 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-[#10E688]/25"
              >
                <i className={`fa-solid ${downloadingPdf || savingDraft ? "fa-spinner fa-spin" : "fa-download"}`}></i>
                <span>{downloadingPdf ? "Génération..." : savingDraft ? "Enregistrement..." : downloadMode ? "Télécharger PDF" : "Télécharger"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer text-base font-black ml-1"
                title="Quitter l'aperçu"
              >
                ✕
              </button>
            </div>
          </header>

          {/* MAIN INFINITE CANVAS (Canva Style) */}
          <main className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-10 relative bg-[#0E131F]">
            <div
              style={{
                transform: `scale(${canvaZoom})`,
                transformOrigin: "center center",
                transition: "transform 0.12s ease-out"
              }}
              className="relative shadow-[0_30px_90px_rgba(0,0,0,0.85)] rounded-xs bg-white flex-shrink-0 my-auto"
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: typeof document !== "undefined" && document.getElementById("cv-preview-sheet") ? document.getElementById("cv-preview-sheet").innerHTML : ""
                }}
                className="bg-white w-[595px] min-h-[842px] h-[842px] max-w-[595px] max-h-[842px] min-w-[595px] overflow-hidden text-gray-900 border border-gray-300 rounded-sm flex flex-col font-sans pointer-events-none select-none"
              />
            </div>
          </main>

          {/* FLOATING BOTTOM CONTROLS (Canva Style) */}
          <footer className="h-14 bg-[#161C2C]/90 backdrop-blur-md border-t border-slate-700/80 px-6 flex items-center justify-between flex-shrink-0 z-20 text-xs font-bold text-slate-300">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Page</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded-md text-white font-extrabold border border-slate-700">1 / 1</span>
            </div>

            {/* Bottom Floating Zoom Slider */}
            <div className="flex items-center space-x-3 bg-slate-900/90 border border-slate-700 px-4 py-1.5 rounded-full shadow-xl">
              <button
                type="button"
                onClick={() => setCanvaZoom(z => Math.max(0.3, +(z - 0.1).toFixed(2)))}
                className="w-5 h-5 rounded hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                title="Dézoomer"
              >
                –
              </button>
              <input
                type="range"
                min="0.35"
                max="2.0"
                step="0.05"
                value={canvaZoom}
                onChange={(e) => setCanvaZoom(parseFloat(e.target.value))}
                className="w-24 sm:w-36 accent-[#10E688] h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setCanvaZoom(z => Math.min(2.0, +(z + 0.1).toFixed(2)))}
                className="w-5 h-5 rounded hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                title="Zoomer"
              >
                +
              </button>
              <span className="w-12 text-center text-[11px] font-black text-emerald-400">
                {Math.round(canvaZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleAutoFit}
                className="p-1 hover:text-white text-slate-400 transition cursor-pointer ml-1"
                title="Adapter à la hauteur de l'écran"
              >
                <i className="fa-solid fa-expand text-xs"></i>
              </button>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
              <span>Haute Résolution 300 DPI</span>
            </div>
          </footer>

        </div>
      )}

      {/* MENU CONTEXTUEL CANVA STUDIO INTERACTIF (Exact replica of Canva context menu) */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[999] bg-white border border-gray-200 rounded-2xl shadow-2xl py-2 w-64 text-gray-800 text-xs font-semibold animate-fadeIn no-print select-none"
        >
          {contextMenu.element && (
            <div className="px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-purple-600 border-b border-gray-100 flex items-center justify-between mb-1">
              <span>{contextMenu.element.name || "Élément Canva"}</span>
              {lockedElementIds.includes(contextMenu.element.id) && (
                <span className="text-[9px] text-amber-600 flex items-center gap-1 font-bold">
                  <i className="fa-solid fa-lock text-[8px]"></i> Verrouillé
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleCopyElement()}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-regular fa-copy text-sm text-gray-600 w-4 text-center"></i>
              <span>Copier</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Ctrl+C</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyStyle()}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-paintbrush text-sm text-gray-600 w-4 text-center"></i>
              <span>Copier le style</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Ctrl+Alt+C</span>
          </button>

          <button
            type="button"
            onClick={() => handlePasteStyle()}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-paste text-sm text-gray-600 w-4 text-center"></i>
              <span>Coller</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Ctrl+V</span>
          </button>

          <button
            type="button"
            onClick={() => handleDuplicateElement(contextMenu.element)}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-clone text-sm text-gray-600 w-4 text-center"></i>
              <span>Dupliquer</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Ctrl+D</span>
          </button>

          <button
            type="button"
            onClick={() => handleDeleteElement(contextMenu.element)}
            className="w-full px-3.5 py-1.5 hover:bg-red-50 text-red-600 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-trash text-sm text-red-500 w-4 text-center"></i>
              <span>Effacer / Supprimer</span>
            </div>
            <span className="text-[10px] text-red-400 font-mono">DELETE</span>
          </button>

          <div className="my-1.5 border-t border-gray-100"></div>

          <button
            type="button"
            onClick={() => handleMoveItem(contextMenu.element, "up")}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-arrow-up text-sm text-gray-600 w-4 text-center"></i>
              <span>Monter / Avancer</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Alt+Haut</span>
          </button>

          <button
            type="button"
            onClick={() => handleMoveItem(contextMenu.element, "down")}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-arrow-down text-sm text-gray-600 w-4 text-center"></i>
              <span>Descendre / Reculer</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Alt+Bas</span>
          </button>

          {contextMenu.element && elementOffsets[contextMenu.element?.id] && (elementOffsets[contextMenu.element?.id].x !== 0 || elementOffsets[contextMenu.element?.id].y !== 0) && (
            <button
              type="button"
              onClick={() => {
                setElementOffsets(prev => ({ ...prev, [contextMenu.element?.id]: { x: 0, y: 0 } }));
                triggerToast("Position réinitialisée");
                setContextMenu({ show: false, x: 0, y: 0, element: null });
              }}
              className="w-full px-3.5 py-1.5 hover:bg-purple-50 text-purple-600 flex items-center justify-between transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-arrows-rotate text-sm text-purple-500 w-4 text-center"></i>
                <span>Réinitialiser la position</span>
              </div>
            </button>
          )}

          <div className="my-1.5 border-t border-gray-100"></div>

          <button
            type="button"
            onClick={() => handleToggleGroup(contextMenu.element)}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-object-group text-sm text-gray-600 w-4 text-center"></i>
              <span>Grouper les éléments</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Ctrl+G</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleLock(contextMenu.element)}
            className="w-full px-3.5 py-1.5 hover:bg-gray-100 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-lock text-sm text-gray-600 w-4 text-center"></i>
              <span>{lockedElementIds.includes(contextMenu.element?.id) ? "Déverrouiller" : "Verrouiller"}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Alt+Maj+L</span>
          </button>

          <div className="my-1.5 border-t border-gray-100"></div>

          <button
            type="button"
            onClick={() => handleMagicWrite(contextMenu.element)}
            className="w-full px-3.5 py-1.5 hover:bg-purple-50 text-purple-700 flex items-center justify-between transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-wand-magic-sparkles text-sm text-purple-600 w-4 text-center"></i>
              <span>✨ Écriture magique IA</span>
            </div>
          </button>
        </div>
      )}

      {/* Visual Loader when Magic AI is thinking */}
      {isMagicLoading && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center animate-fadeIn no-print">
          <div className="bg-slate-900 border border-purple-500/60 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3.5 text-white max-w-xs text-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 border-t-purple-400 animate-spin"></div>
              <i className="fa-solid fa-wand-magic-sparkles text-xl text-purple-300 animate-pulse"></i>
            </div>
            <div className="text-sm font-black tracking-wide text-purple-200">✨ Écriture Magique IA</div>
            <div className="text-xs text-slate-300 font-medium">L&apos;IA Gemini analyse et optimise votre texte en temps réel...</div>
          </div>
        </div>
      )}

      {/* CANVA FLOATING ZOOM BAR (Bottom Right - Always visible with high contrast) */}
      <div className="fixed bottom-8 right-8 z-[99999] bg-white border-2 border-slate-300 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 no-print select-none text-slate-800 pointer-events-auto">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider hidden sm:inline">Zoom</span>
        <button
          type="button"
          onClick={() => setCanvaZoom(z => Math.max(0.2, +(z - 0.05).toFixed(2)))}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-black font-extrabold transition flex items-center justify-center cursor-pointer text-xs"
          title="Zoom arrière (-)"
        >
          <i className="fa-solid fa-minus text-[10px]"></i>
        </button>
        
        <input
          type="range"
          min="0.2"
          max="1.8"
          step="0.05"
          value={canvaZoom}
          onChange={(e) => setCanvaZoom(parseFloat(e.target.value))}
          className="w-24 sm:w-32 accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
        />

        <button
          type="button"
          onClick={() => setCanvaZoom(z => Math.min(2.0, +(z + 0.05).toFixed(2)))}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-black font-extrabold transition flex items-center justify-center cursor-pointer text-xs"
          title="Zoom avant (+)"
        >
          <i className="fa-solid fa-plus text-[10px]"></i>
        </button>

        <button
          type="button"
          onClick={handleAutoFit}
          className="px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 text-xs font-black min-w-[52px] text-center transition cursor-pointer border border-blue-200"
          title="Ajuster à l'écran"
        >
          {Math.round(canvaZoom * 100)} %
        </button>
      </div>

      {/* GLOBAL MEDIA PRINT CUSTOM STYLES */}
      <style jsx global>{`
        @media print {
          /* Hide all headers, sidebar tools, action sections */
          nav, aside, section, .no-print, div.no-print, button, a {
            display: none !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          
          body, html {
            background-color: #fff !important;
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }

          /* Force the preview sheet to be full-page and fully visible */
          #cv-preview-sheet {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 595px !important;
            height: 842px !important;
            max-width: 595px !important;
            max-height: 842px !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </CanvaStudioContext.Provider>
  );
}
