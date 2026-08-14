/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
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
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });
  const [photoPreview, setPhotoPreview] = useState(null);
  
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
    ]
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

  return (
    <>
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
        
        {/* SIDEBAR (WIZARD STEPS) - Hides on print */}
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
                    onClick={() => setActiveStep(step.num)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer text-sm font-semibold ${
                      isActive
                        ? "bg-[#1E293B] text-white border-l-4 border-[#10E688] shadow-md"
                        : "text-slate-400 hover:bg-slate-850 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                        isActive
                          ? "bg-[#10E688] text-gray-900"
                          : isCompleted
                            ? "bg-emerald-900/40 text-[#10E688] border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                      }`}>
                        {isCompleted ? (
                          <i className="fa-solid fa-check"></i>
                        ) : (
                          step.num + 1
                        )}
                      </span>
                      <span>{step.label}</span>
                    </div>
                    <i className={`fa-solid ${step.icon} text-xs transition-opacity ${isActive ? "opacity-100 text-[#10E688]" : "opacity-40"}`}></i>
                  </button>
                );
              })}
            </nav>
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
              onClick={() => setMobileTab("preview")}
              className={`flex-1 py-2 text-center rounded-lg transition-all ${
                mobileTab === "preview" ? "bg-gray-100 text-gray-950 border border-gray-200 shadow-inner" : "text-gray-500"
              }`}
            >
              <i className="fa-solid fa-eye mr-2 text-blue-600"></i>
              Aperçu (Feuille)
            </button>
          </div>

          {/* MIDDLE AREA: The Form Editor (Hides on mobile if mobileTab is 'preview') */}
          <section className={`flex-1 p-6 md:p-8 bg-white border-r border-gray-200 overflow-y-auto max-w-full lg:max-w-2xl no-print ${
            mobileTab === "preview" ? "hidden lg:block" : "block"
          }`}>
            
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
                {/* Qualités */}
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase mb-3">Qualités</h3>
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

                {/* Informatique */}
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase mb-3">Informatique</h3>
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
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase mb-3">Centres d'intérêt</h3>
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
                      { id: "entrepreneur", name: "Entrepreneur Pro", desc: "Officiel Facilité (Photo & 2 Col)", icon: "fa-rocket", previewUrl: "/model4.png" },
                      { id: "modern", name: t.templateModern, desc: "2 Colonnes structuré", icon: "fa-grip", previewUrl: "/model1.png" },
                      { id: "minimalist", name: t.templateMinimal, desc: "Aéré & Moderne", icon: "fa-align-left", previewUrl: "/model2.png" },
                      { id: "classic", name: t.templateClassic, desc: "Traditionnel & Chic", icon: "fa-newspaper", previewUrl: "/model3.png" },
                      { id: "executif", name: t.templateExecutif, desc: "Bandeau formel & dense", icon: "fa-briefcase", previewUrl: "/model5.png" },
                      { id: "creatif", name: t.templateCreatif, desc: "Coloré & asymétrique", icon: "fa-palette", previewUrl: "/model6.png" },
                      { id: "technique", name: t.templateTechnique, desc: "Grille de compétences", icon: "fa-code", previewUrl: "/model7.png" },
                      { id: "professionnel", name: t.templateProfessionnel, desc: "2 Colonnes Pro", icon: "fa-user-tie", previewUrl: "/model8.png" },
                      { id: "elegance", name: t.templateElegance, desc: "Sidebar noire, touches dorées", icon: "fa-crown", previewUrl: "/model9.png" }
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

          {/* RIGHT AREA: Live CV Preview Paper (Hides on mobile if mobileTab is 'edit') */}
          <section className={`flex-1 bg-slate-200/90 p-4 md:p-8 flex items-start justify-center overflow-auto min-h-0 ${
            mobileTab === "edit" ? "hidden lg:flex" : "flex"
          }`}>
            
            {/* Styled Sheet Wrapper (scaled with CSS dynamically if needed, optimized for paper format) */}
            <div className="sticky top-6 flex flex-col items-center">
              
              <div className="hidden sm:flex justify-between items-center w-full max-w-[595px] mb-3 text-xs text-gray-500 font-bold px-2 no-print">
                <span className="flex items-center">
                  <i className="fa-solid fa-eye text-blue-600 mr-2"></i>
                  Aperçu temps réel (A4)
                </span>
                <span className="capitalize">
                  Modèle {selectedTemplate} • Couleur : {accentColor}
                </span>
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
                        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-5 shadow-md flex-shrink-0 relative select-none">
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
                        </div>

                        {/* Coordonnées */}
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">{cvData.sectionTitles?.contact?.toUpperCase() || "COORDONNÉES"}</h3>
                            <ul className="space-y-2 text-[10px] text-slate-200">
                              {cvData.email && (
                                <li className="flex items-start space-x-1.5 min-w-0">
                                  <i className="fa-regular fa-envelope mt-0.5 flex-shrink-0 text-white/60"></i>
                                  <span className="break-all">{cvData.email}</span>
                                </li>
                              )}
                              {cvData.phone && (
                                <li className="flex items-start space-x-1.5">
                                  <i className="fa-solid fa-phone mt-0.5 flex-shrink-0 text-white/60"></i>
                                  <span>{cvData.phone}</span>
                                </li>
                              )}
                              {(cvData.address || cvData.city) && (
                                <li className="flex items-start space-x-1.5">
                                  <i className="fa-solid fa-location-dot mt-0.5 flex-shrink-0 text-white/60"></i>
                                  <span>
                                    {cvData.address && `${cvData.address}, `}
                                    {cvData.postalCode && `${cvData.postalCode} `}
                                    {cvData.city}
                                  </span>
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Extra info panel */}
                          {(cvData.birthDate || cvData.drivingLicense || cvData.nationality || cvData.maritalStatus || cvData.linkedin || cvData.availability) && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Détails</h3>
                              <ul className="space-y-1.5 text-[9px] text-slate-300">
                                {cvData.birthDate && <li><span className="font-bold text-white">Âge :</span> {cvData.birthDate}</li>}
                                {cvData.drivingLicense && <li><span className="font-bold text-white">Permis :</span> {cvData.drivingLicense}</li>}
                                {cvData.nationality && <li><span className="font-bold text-white">Nationalité :</span> {cvData.nationality}</li>}
                                {cvData.maritalStatus && <li><span className="font-bold text-white">Statut :</span> {cvData.maritalStatus}</li>}
                                {cvData.linkedin && <li><span className="font-bold text-white">LinkedIn :</span> <span className="break-all text-[8px]">{cvData.linkedin}</span></li>}
                                {cvData.availability && <li><span className="font-bold text-white">Disponibilité :</span> {cvData.availability}</li>}
                              </ul>
                            </div>
                          )}

                          {/* Compétences (Left sidebar) */}
                          {cvData.skills.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Compétences</h3>
                              <ul className="space-y-2">
                                {cvData.skills.map((skill) => (
                                  <li key={skill.id} className="text-[10px] text-slate-200">
                                    <div className="flex justify-between items-center mb-0.5">
                                      <span className="font-bold truncate max-w-[120px]">{skill.name || "Compétence"}</span>
                                      <span className="text-[8px] text-slate-400 font-medium">{skill.level}</span>
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
                            </div>
                          )}

                          {/* Langues (Left sidebar) */}
                          {cvData.languages.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider text-[#10E688] mb-2 border-b border-white/10 pb-1">Langues</h3>
                              <ul className="space-y-1.5 text-[10px] text-slate-200">
                                {cvData.languages.map((lang) => (
                                  <li key={lang.id} className="flex justify-between">
                                    <span className="font-bold">{lang.name || "Langue"}</span>
                                    <span className="text-[8px] text-slate-400 font-medium">{lang.level}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
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
                        <div className="border-b border-gray-150 pb-4">
                          <h1 className="text-2xl font-black text-gray-900 tracking-tight capitalize">
                            {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                          </h1>
                          <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-widest mt-1">
                            {cvData.experiences[0]?.title || "Titre professionnel"}
                          </p>
                        </div>

                        {/* Professional pitch */}
                        {cvData.profile && (
                          <div className="space-y-1">
                            <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">{cvData.sectionTitles?.profile || "Profil Professionnel"}</h3>
                            <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">{cvData.profile}</p>
                          </div>
                        )}

                        {/* Expériences */}
                        {cvData.experiences.length > 0 && (
                          <div className="space-y-2">
                            <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">{cvData.sectionTitles?.experience || "Parcours Professionnel"}</h3>
                            <div className="space-y-3">
                              {cvData.experiences.map((exp) => (
                                <div key={exp.id} className="text-[10px]">
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{exp.title || "Poste / Titre"}</span>
                                    <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                      {exp.startDate ? `${exp.startDate} - ` : ""}
                                      {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {exp.employer || "Employeur"} {exp.city ? `• ${exp.city}` : ""}
                                  </div>
                                  {exp.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed whitespace-pre-line font-medium">{exp.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Formation */}
                        {cvData.educations.length > 0 && (
                          <div className="space-y-2">
                            <h3 style={{ color: accentColor }} className="text-[10px] font-black uppercase tracking-wider">Formation</h3>
                            <div className="space-y-3">
                              {cvData.educations.map((edu) => (
                                <div key={edu.id} className="text-[10px]">
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{edu.degree || "Diplôme / Titre"}</span>
                                    <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                      {edu.startDate ? `${edu.startDate} - ` : ""}
                                      {edu.current ? "En cours" : edu.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {edu.school || "École / Établissement"} {edu.city ? `• ${edu.city}` : ""}
                                  </div>
                                  {edu.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{edu.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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
                      <div className="text-center space-y-2 border-b border-gray-100 pb-5">
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight capitalize">
                          {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                        </h1>
                        <p style={{ color: accentColor }} className="text-xs font-black uppercase tracking-widest">
                          {cvData.experiences[0]?.title || "Titre professionnel"}
                        </p>
                        
                        {/* Contacts horizontally */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-gray-500 font-bold pt-1">
                          {cvData.email && (
                            <span className="flex items-center"><i className="fa-regular fa-envelope mr-1 text-gray-400"></i>{cvData.email}</span>
                          )}
                          {cvData.phone && (
                            <span className="flex items-center"><i className="fa-solid fa-phone mr-1 text-gray-400"></i>{cvData.phone}</span>
                          )}
                          {cvData.city && (
                            <span className="flex items-center"><i className="fa-solid fa-location-dot mr-1 text-gray-400"></i>{cvData.city}</span>
                          )}
                          {cvData.linkedin && (
                            <span className="flex items-center"><i className="fa-brands fa-linkedin mr-1 text-gray-400"></i>{cvData.linkedin}</span>
                          )}
                        </div>
                      </div>

                      {/* Professional summary */}
                      {cvData.profile && (
                        <div className="space-y-1.5">
                          <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Profil</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">{cvData.profile}</p>
                        </div>
                      )}

                      {/* Experience list */}
                      {cvData.experiences.length > 0 && (
                        <div className="space-y-2.5">
                          <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">{cvData.sectionTitles?.experience || "Expérience Professionnelle"}</h3>
                          <div className="space-y-3">
                            {cvData.experiences.map((exp) => (
                              <div key={exp.id} className="grid grid-cols-4 gap-2 text-[10px]">
                                <div className="col-span-1 text-gray-500 font-bold text-[8px] pt-0.5">
                                  {exp.startDate ? `${exp.startDate} - ` : ""}
                                  {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                </div>
                                <div className="col-span-3 text-[10px]">
                                  <div className="font-black text-gray-950">{exp.title}</div>
                                  <div className="text-[9px] font-bold text-gray-400 mt-0.5">{exp.employer} {exp.city ? `• ${exp.city}` : ""}</div>
                                  {exp.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed whitespace-pre-line font-medium">{exp.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education list */}
                      {cvData.educations.length > 0 && (
                        <div className="space-y-2.5">
                          <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Formation</h3>
                          <div className="space-y-3">
                            {cvData.educations.map((edu) => (
                              <div key={edu.id} className="grid grid-cols-4 gap-2 text-[10px]">
                                <div className="col-span-1 text-gray-500 font-bold text-[8px] pt-0.5">
                                  {edu.startDate ? `${edu.startDate} - ` : ""}
                                  {edu.current ? "En cours" : edu.endDate || ""}
                                </div>
                                <div className="col-span-3 text-[10px]">
                                  <div className="font-black text-gray-950">{edu.degree}</div>
                                  <div className="text-[9px] font-bold text-gray-400 mt-0.5">{edu.school} {edu.city ? `• ${edu.city}` : ""}</div>
                                  {edu.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{edu.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills & Languages grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {cvData.skills.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Compétences</h3>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {cvData.skills.map((skill) => (
                                <span key={skill.id} className="px-2 py-1 bg-gray-100 rounded text-[9px] font-semibold text-gray-700">
                                  {skill.name} <span className="text-[8px] text-gray-400 font-medium">({skill.level})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {cvData.languages.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 style={{ borderColor: accentColor }} className="text-[10px] font-black uppercase tracking-wider border-l-3 pl-2.5">Langues</h3>
                            <ul className="space-y-1 text-[10px] font-medium text-gray-600">
                              {cvData.languages.map((lang) => (
                                <li key={lang.id} className="flex justify-between">
                                  <span className="font-bold text-gray-900">{lang.name}</span>
                                  <span>{lang.level}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                    <div style={{ backgroundColor: accentColor }} className="p-6 text-white text-center space-y-2 relative">
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
                      
                      <h1 className="text-2xl font-black tracking-tight capitalize">
                        {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                      </h1>
                      <p className="text-xs font-black uppercase tracking-widest text-white/90">
                        {cvData.experiences[0]?.title || "Titre professionnel"}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-white/80 font-bold">
                        {cvData.email && <span>{cvData.email}</span>}
                        {cvData.phone && <span>{cvData.phone}</span>}
                        {cvData.city && <span>{cvData.city}</span>}
                        {cvData.linkedin && <span className="break-all">{cvData.linkedin}</span>}
                      </div>
                    </div>

                    <div className="flex-grow p-6 space-y-4">
                      
                      {/* Summary */}
                      {cvData.profile && (
                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">{cvData.sectionTitles?.profile || "Résumé Professionnel"}</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium">{cvData.profile}</p>
                        </div>
                      )}

                      {/* Expériences */}
                      {cvData.experiences.length > 0 && (
                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">{cvData.sectionTitles?.experience || "Expérience Professionnelle"}</h3>
                          <div className="space-y-2.5 pt-1">
                            {cvData.experiences.map((exp) => (
                              <div key={exp.id} className="text-[10px]">
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">{exp.title}</span>
                                  <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                    {exp.startDate ? `${exp.startDate} - ` : ""}
                                    {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                  {exp.employer} {exp.city ? `• ${exp.city}` : ""}
                                </div>
                                {exp.description && (
                                  <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{exp.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Formation */}
                      {cvData.educations.length > 0 && (
                        <div className="space-y-1">
                          <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Formation & Diplômes</h3>
                          <div className="space-y-2.5 pt-1">
                            {cvData.educations.map((edu) => (
                              <div key={edu.id} className="text-[10px]">
                                <div className="flex justify-between items-start font-bold">
                                  <span className="text-gray-950 font-black">{edu.degree}</span>
                                  <span className="text-gray-500 font-bold text-[8px] flex-shrink-0">
                                    {edu.startDate ? `${edu.startDate} - ` : ""}
                                    {edu.current ? "En cours" : edu.endDate || ""}
                                  </span>
                                </div>
                                <div className="text-[9px] font-bold text-gray-400 mt-0.5">
                                  {edu.school} {edu.city ? `• ${edu.city}` : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills & Lang grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {cvData.skills.length > 0 && (
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Compétences</h3>
                            <ul className="grid grid-cols-1 gap-1 pt-1 text-[9px] font-semibold text-gray-700">
                              {cvData.skills.map((skill) => (
                                <li key={skill.id} className="flex justify-between">
                                  <span>{skill.name}</span>
                                  <span className="text-gray-400 font-medium">({skill.level})</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {cvData.languages.length > 0 && (
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-950 border-b border-gray-200 pb-1">Langues</h3>
                            <ul className="space-y-1 pt-1 text-[9px] text-gray-700">
                              {cvData.languages.map((lang) => (
                                <li key={lang.id} className="flex justify-between font-semibold">
                                  <span>{lang.name}</span>
                                  <span className="text-gray-400 font-medium">{lang.level}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                    <div style={{ backgroundColor: accentColor === "#10E688" ? "#0f172a" : accentColor }} className="p-6 text-white flex items-center space-x-5 flex-shrink-0">
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
                        <h1 className="text-2xl font-black tracking-tight capitalize truncate">
                          {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80 mt-1">
                          {cvData.experiences[0]?.title || "Titre professionnel"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-white/70 font-semibold mt-2">
                          {cvData.email && <span>{cvData.email}</span>}
                          {cvData.phone && <span>{cvData.phone}</span>}
                          {cvData.city && <span>{cvData.city}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Corps en colonne unique, aéré */}
                    <div className="flex-grow p-7 space-y-5 overflow-hidden">
                      {cvData.profile && (
                        <div className="space-y-1.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Synthèse</h3>
                          <p className="text-[10px] text-gray-600 leading-relaxed font-medium text-justify">{cvData.profile}</p>
                        </div>
                      )}

                      {cvData.experiences.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Expérience</h3>
                          <div className="space-y-3 pt-1">
                            {cvData.experiences.map((exp) => (
                              <div key={exp.id} className="text-[10px] flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <span className="text-gray-950 font-black block">{exp.title || "Poste / Titre"}</span>
                                  <span className="text-[9px] font-bold text-gray-500">
                                    {exp.employer || "Employeur"} {exp.city ? `• ${exp.city}` : ""}
                                  </span>
                                  {exp.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{exp.description}</p>
                                  )}
                                </div>
                                <span className="text-gray-400 font-bold text-[8px] flex-shrink-0 whitespace-nowrap">
                                  {exp.startDate ? `${exp.startDate} — ` : ""}
                                  {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {cvData.educations.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Formation</h3>
                          <div className="space-y-2 pt-1">
                            {cvData.educations.map((edu) => (
                              <div key={edu.id} className="text-[10px] flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <span className="text-gray-950 font-black block">{edu.degree || "Diplôme / Titre"}</span>
                                  <span className="text-[9px] font-bold text-gray-500">{edu.school || "École / Établissement"}</span>
                                </div>
                                <span className="text-gray-400 font-bold text-[8px] flex-shrink-0 whitespace-nowrap">
                                  {edu.startDate ? `${edu.startDate} — ` : ""}
                                  {edu.current ? "En cours" : edu.endDate || ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-5">
                        {cvData.skills.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Compétences</h3>
                            <ul className="space-y-1 pt-1 text-[9px] font-semibold text-gray-700">
                              {cvData.skills.map((skill) => (
                                <li key={skill.id} className="flex justify-between">
                                  <span>{skill.name || "Compétence"}</span>
                                  <span className="text-gray-400 font-medium">{skill.level}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {cvData.languages.length > 0 && (
                          <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-900 pb-1.5 border-b-2" style={{ borderColor: accentColor }}>Langues</h3>
                            <ul className="space-y-1 pt-1 text-[9px] font-semibold text-gray-700">
                              {cvData.languages.map((lang) => (
                                <li key={lang.id} className="flex justify-between">
                                  <span>{lang.name || "Langue"}</span>
                                  <span className="text-gray-400 font-medium">{lang.level}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                        <div className="w-24 h-24 rounded-full bg-white/95 flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-white/30 flex-shrink-0 relative select-none">
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
                        </div>

                        <h1 className="text-lg font-black tracking-tight text-center capitalize mb-0.5">
                          {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-center text-white/85 mb-5">
                          {cvData.experiences[0]?.title || "Titre professionnel"}
                        </p>

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>{cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}</h3>
                            <ul className="space-y-1.5 text-[9px] text-white/90 font-semibold">
                              {cvData.email && <li className="break-all">{cvData.email}</li>}
                              {cvData.phone && <li>{cvData.phone}</li>}
                              {cvData.city && <li>{cvData.city}</li>}
                            </ul>
                          </div>

                          {cvData.skills.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>Compétences</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {cvData.skills.map((skill) => (
                                  <span key={skill.id} className="px-2 py-1 rounded-full bg-white/20 text-[8px] font-bold whitespace-nowrap">
                                    {skill.name || "Compétence"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {cvData.languages.length > 0 && (
                            <div>
                              <h3 className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5"><i className="fa-solid fa-circle-dot text-[8px]"></i>Langues</h3>
                              <ul className="space-y-1 text-[9px] text-white/90 font-semibold">
                                {cvData.languages.map((lang) => (
                                  <li key={lang.id} className="flex justify-between">
                                    <span>{lang.name || "Langue"}</span>
                                    <span className="text-white/60">{lang.level}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-center text-[8px] text-white/60 border-t border-white/20 pt-2">
                        <span>Créé via Facilite.fr</span>
                      </div>
                    </div>

                    {/* Colonne principale (blanche) */}
                    <div className="flex-grow p-6 flex flex-col overflow-hidden bg-white">
                      <div className="space-y-5">
                        {cvData.profile && (
                          <div className="space-y-1">
                            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>À propos</h3>
                            <p className="text-[10px] text-gray-600 leading-relaxed font-medium">{cvData.profile}</p>
                          </div>
                        )}

                        {cvData.experiences.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Expérience</h3>
                            <div className="space-y-3">
                              {cvData.experiences.map((exp) => (
                                <div key={exp.id} className="text-[10px] pl-3 border-l-2" style={{ borderColor: accentColor }}>
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{exp.title || "Poste / Titre"}</span>
                                    <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                      {exp.startDate ? `${exp.startDate} - ` : ""}
                                      {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {exp.employer || "Employeur"} {exp.city ? `• ${exp.city}` : ""}
                                  </div>
                                  {exp.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{exp.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {cvData.educations.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Formation</h3>
                            <div className="space-y-2">
                              {cvData.educations.map((edu) => (
                                <div key={edu.id} className="text-[10px] pl-3 border-l-2" style={{ borderColor: accentColor }}>
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{edu.degree || "Diplôme / Titre"}</span>
                                    <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                      {edu.startDate ? `${edu.startDate} - ` : ""}
                                      {edu.current ? "En cours" : edu.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {edu.school || "École / Établissement"} {edu.city ? `• ${edu.city}` : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
                        <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4 border-2 select-none" style={{ borderColor: accentColor }}>
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
                        </div>

                        <h1 className="text-sm font-black text-center capitalize mb-0.5">
                          {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                        </h1>
                        <p style={{ color: accentColor }} className="text-[9px] font-black uppercase tracking-wider text-center mb-4">
                          {cvData.experiences[0]?.title || "Titre professionnel"}
                        </p>

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Contact"}</h3>
                            <ul className="space-y-1 text-[9px] text-slate-200 font-medium">
                              {cvData.email && <li className="break-all">{cvData.email}</li>}
                              {cvData.phone && <li>{cvData.phone}</li>}
                              {cvData.city && <li>{cvData.city}</li>}
                            </ul>
                          </div>

                          {cvData.skills.length > 0 && (
                            <div>
                              <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Compétences"}</h3>
                              <ul className="space-y-2">
                                {cvData.skills.map((skill) => {
                                  const segments =
                                    skill.level === "Expert" ? 4 :
                                    skill.level === "Avancé" ? 3 :
                                    skill.level === "Intermédiaire" ? 2 : 1;
                                  return (
                                    <li key={skill.id} className="text-[9px] text-slate-200">
                                      <div className="font-bold truncate mb-1">{skill.name || "Compétence"}</div>
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
                            </div>
                          )}

                          {cvData.languages.length > 0 && (
                            <div>
                              <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{"// Langues"}</h3>
                              <ul className="space-y-1 text-[9px] text-slate-200 font-medium">
                                {cvData.languages.map((lang) => (
                                  <li key={lang.id} className="flex justify-between">
                                    <span>{lang.name || "Langue"}</span>
                                    <span className="text-slate-400">{lang.level}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-center text-[8px] text-slate-500 border-t border-white/10 pt-2">
                        <span>Créé via Facilite.fr</span>
                      </div>
                    </div>

                    {/* Colonne principale : timeline verticale */}
                    <div className="flex-grow p-6 flex flex-col justify-between overflow-hidden bg-white">
                      <div className="space-y-5">
                        {cvData.profile && (
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Profil</h3>
                            <p className="text-[10px] text-gray-600 leading-relaxed font-medium">{cvData.profile}</p>
                          </div>
                        )}

                        {cvData.experiences.length > 0 && (
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Expérience</h3>
                            <div className="space-y-0 pt-1 relative pl-4 border-l-2 border-gray-150">
                              {cvData.experiences.map((exp) => (
                                <div key={exp.id} className="text-[10px] relative pb-3">
                                  <div
                                    style={{ backgroundColor: accentColor }}
                                    className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                                  ></div>
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{exp.title || "Poste / Titre"}</span>
                                    <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                      {exp.startDate ? `${exp.startDate} - ` : ""}
                                      {exp.current ? "Aujourd'hui" : exp.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {exp.employer || "Employeur"} {exp.city ? `• ${exp.city}` : ""}
                                  </div>
                                  {exp.description && (
                                    <p className="text-[9px] text-gray-600 mt-1 leading-relaxed font-medium">{exp.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {cvData.educations.length > 0 && (
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-900">Formation</h3>
                            <div className="space-y-0 pt-1 relative pl-4 border-l-2 border-gray-150">
                              {cvData.educations.map((edu) => (
                                <div key={edu.id} className="text-[10px] relative pb-2.5">
                                  <div
                                    style={{ backgroundColor: accentColor }}
                                    className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                                  ></div>
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-gray-950 font-black">{edu.degree || "Diplôme / Titre"}</span>
                                    <span className="text-gray-400 font-bold text-[8px] flex-shrink-0">
                                      {edu.startDate ? `${edu.startDate} - ` : ""}
                                      {edu.current ? "En cours" : edu.endDate || ""}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-bold text-gray-500 mt-0.5">
                                    {edu.school || "École / Établissement"} {edu.city ? `• ${edu.city}` : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-[8px] text-gray-400 font-medium flex justify-between border-t border-gray-100 pt-3">
                        <span>Langue du CV : {cvData.cvLang}</span>
                        <span>Dernière mise à jour : 2026</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TEMPLATE 7: PROFESSIONNEL (2 Colonnes Pro) --- */}
                {selectedTemplate === "professionnel" && (
                  <div className="flex w-full h-full text-xs flex-grow font-sans">
                    
                    {/* Left Column (Grey Background) */}
                    <div className="w-[35%] bg-[#e6e6e6] p-5 flex flex-col flex-shrink-0 relative overflow-hidden">
                      {/* Dark strip at top */}
                      <div className="absolute top-0 left-0 w-full h-[120px] bg-[#20232a]"></div>
                      
                      {/* Profile Picture */}
                      <div className="relative z-10 w-32 h-32 rounded-full border-4 border-white bg-[#20232a] flex items-center justify-center mx-auto mt-2 mb-6 shadow-md flex-shrink-0 select-none overflow-hidden">
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
                          <span className="text-white font-serif italic text-4xl">CV</span>
                        )}
                      </div>

                      {/* Contact */}
                      <h3 className="text-lg font-bold text-center mb-4 text-black border-b-2 border-slate-300 pb-1">{cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}</h3>
                      <ul className="space-y-3 mb-6 font-bold text-black border-l-2 border-[#10E688] pl-2 text-[10px]">
                        {cvData.phone && (
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-mobile-screen text-[#10E688] w-4 text-center"></i>
                            <span>{cvData.phone}</span>
                          </li>
                        )}
                        {cvData.email && (
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-envelope text-[#10E688] w-4 text-center"></i>
                            <span className="break-all">{cvData.email}</span>
                          </li>
                        )}
                        {(cvData.address || cvData.city) && (
                          <li className="flex items-center space-x-2">
                            <i className="fa-solid fa-location-dot text-[#10E688] w-4 text-center"></i>
                            <span>
                              {cvData.address && `${cvData.address}, `}
                              {cvData.city}
                            </span>
                          </li>
                        )}
                      </ul>

                      {/* Qualités */}
                      {(cvData.qualities?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold text-black uppercase mb-2 flex items-center border-b-4 border-slate-500 pb-1 w-max">
                            <i className="fa-solid fa-star text-yellow-400 mr-2"></i> QUALITÉS
                          </h3>
                          <ul className="list-disc list-inside space-y-1 font-bold text-black text-[10px] pl-2">
                            {cvData.qualities.map(q => (
                              <li key={q.id}>{q.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Informatique */}
                      {(cvData.itSkills?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold text-black uppercase mb-2 flex items-center border-b-4 border-slate-500 pb-1 w-max">
                            <i className="fa-solid fa-screwdriver-wrench text-slate-500 mr-2"></i> INFORMATIQUE
                          </h3>
                          <ul className="list-disc list-inside space-y-1 font-bold text-black text-[10px] pl-2">
                            {cvData.itSkills.map(s => (
                              <li key={s.id}>{s.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Langues */}
                      {(cvData.languages?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold text-black uppercase mb-2 flex items-center border-b-4 border-slate-500 pb-1 w-max">
                            <i className="fa-solid fa-globe text-blue-500 mr-2"></i>{cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}</h3>
                          <ul className="list-disc list-inside space-y-1 font-bold text-black text-[10px] pl-2">
                            {cvData.languages.map(l => (
                              <li key={l.id}>{l.name} : <span className="font-normal text-[9px]">{l.level}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Centres d'intérêt */}
                      {(cvData.hobbies?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold text-black uppercase mb-2 flex items-center border-b-4 border-slate-500 pb-1 w-max">
                            <i className="fa-regular fa-lightbulb text-yellow-400 mr-2"></i> CENTRES D'INTÉRÊT
                          </h3>
                          <ul className="list-disc list-inside space-y-1 font-bold text-black text-[10px] pl-2">
                            {cvData.hobbies.map(h => (
                              <li key={h.id}>{h.name}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>

                    {/* Right Column (White Background) */}
                    <div className="w-[65%] bg-white flex flex-col">
                      
                      {/* Header Title */}
                      <div className="bg-[#20232a] text-white pt-10 pb-4 px-6 mb-4 h-[120px] flex flex-col justify-end">
                        <h1 className="text-3xl font-black uppercase tracking-wide leading-none mb-1">
                          {cvData.firstName} {cvData.lastName}
                        </h1>
                        <div className="h-0.5 w-full bg-white my-1.5 opacity-80"></div>
                        <h2 className="text-[11px] font-bold uppercase tracking-widest text-white mt-1">
                          {cvData.experiences[0]?.title || "Titre Professionnel"}
                        </h2>
                      </div>

                      <div className="px-6 pb-6 flex-grow flex flex-col space-y-4">
                        
                        {/* Profil */}
                        {cvData.profile && (
                          <div>
                            <h3 className="text-sm font-bold text-[#20232a] flex items-center mb-1.5 border-b border-gray-300 pb-0.5">
                              <i className="fa-solid fa-bullseye text-red-500 mr-2"></i> {cvData.sectionTitles?.profile || "Profil Professionnel"}
                            </h3>
                            <p className="text-[10px] text-gray-900 leading-relaxed font-bold text-justify">
                              {cvData.profile}
                            </p>
                          </div>
                        )}

                        {/* Expériences */}
                        {(cvData.experiences?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-[#20232a] flex items-center mb-3 border-b border-gray-300 pb-0.5">
                              <i className="fa-solid fa-briefcase text-amber-800 mr-2"></i> {cvData.sectionTitles?.experience || "Expériences Professionnelles"}
                            </h3>
                            <div className="relative border-l border-gray-400 ml-1.5 pl-4 space-y-3 pb-2">
                              {cvData.experiences.map((exp, idx) => (
                                <div key={exp.id} className="relative">
                                  {/* Timeline dot */}
                                  <div className="absolute -left-[20.5px] top-1 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>
                                  
                                  <div className="font-bold text-gray-900 text-[11px] mb-0.5 flex items-center">
                                    <span className="mr-1 mt-0.5">➤</span>
                                    {exp.startDate ? `${exp.startDate} - ` : ""}
                                    {exp.current ? "Présent" : exp.endDate || ""} : <span className="ml-1 font-black">{exp.employer}</span>
                                  </div>
                                  <div className="font-black text-[11px] text-gray-900 mb-1 pl-4">{exp.title}</div>
                                  {exp.description && (
                                    <ul className="text-[9px] text-gray-700 leading-tight space-y-0.5 pl-4 list-disc list-inside text-justify">
                                      {exp.description.split("\n").filter(Boolean).map((line, i) => (
                                        <li key={i}>{line.replace(/^[•\-\*]\s*/, "")}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                              {/* Bottom timeline circle */}
                              <div className="absolute -left-[4.5px] bottom-0 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>
                            </div>
                          </div>
                        )}

                        {/* Formations */}
                        {(cvData.educations?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-[#20232a] flex items-center mb-3 border-b border-gray-300 pb-0.5">
                              <i className="fa-solid fa-graduation-cap text-slate-800 mr-2"></i> {cvData.sectionTitles?.education || "Formation et Diplômes"}
                            </h3>
                            <div className="relative border-l border-gray-400 ml-1.5 pl-4 space-y-3 pb-2">
                              {cvData.educations.map((edu, idx) => (
                                <div key={edu.id} className="relative">
                                  <div className="absolute -left-[20.5px] top-1 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>
                                  
                                  <div className="font-bold text-gray-900 text-[11px] mb-0.5 flex items-center">
                                    <span className="mr-1 mt-0.5">➤</span>
                                    {edu.startDate ? `${edu.startDate} - ` : ""}
                                    {edu.current ? "Présent" : edu.endDate || ""} : <span className="ml-1 font-black">{edu.degree}</span>
                                  </div>
                                  <ul className="text-[10px] text-gray-900 leading-tight pl-4 list-disc list-inside font-bold">
                                    <li>{edu.school}{edu.city ? `, ${edu.city}` : ""}</li>
                                  </ul>
                                </div>
                              ))}
                              <div className="absolute -left-[4.5px] bottom-0 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>
                            </div>
                          </div>
                        )}

                        {/* {cvData.sectionTitles?.skills || "Compétences Clés"} */}
                        {(cvData.skills?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-[#20232a] flex items-center mb-2 border-b border-gray-300 pb-0.5">
                              <i className="fa-solid fa-star text-yellow-400 mr-2"></i>{cvData.sectionTitles?.skills?.toUpperCase() || "COMPÉTENCES CLÉS"}</h3>
                            <div className="relative border-l border-gray-400 ml-1.5 pl-4 pb-2">
                              <ul className="text-[10px] text-gray-900 leading-tight space-y-1.5 list-disc list-inside">
                                {cvData.skills.map((skill, idx) => (
                                  <li key={skill.id} className="relative">
                                    {idx === 0 && <div className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>}
                                    <span className="font-bold">{skill.name}</span> : <span className="font-normal">{skill.level}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="absolute -left-[4.5px] bottom-0 w-2 h-2 rounded-full bg-white border-2 border-gray-500"></div>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                  </div>
                )}

                {/* --- TEMPLATE: ENTREPRENEUR NUMÉRIQUE (Design Officiel Facilité) --- */}
                {selectedTemplate === "entrepreneur" && (
                  <div className="flex flex-col w-full h-full text-xs flex-grow font-sans bg-white relative">
                    
                    {/* Top Right Decoration (Pastel Green Bookmark) */}
                    <div className="absolute top-0 right-8 w-14 h-24 bg-[#D1E2D7] rounded-b-3xl z-0 pointer-events-none"></div>

                    {/* Header */}
                    <div className="flex items-center px-8 pt-8 pb-4 relative z-10">
                      {/* Photo */}
                      <div className="w-28 h-28 rounded-full border-[4px] border-[#1B2B3A] bg-gray-100 flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0 relative">
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
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white font-black text-2xl">
                            {cvData.firstName?.[0] || "M"}{cvData.lastName?.[0] || "S"}
                          </div>
                        )}
                      </div>
                      
                      {/* Name & Title */}
                      <div className="ml-6 flex-grow">
                        <h1 className="text-xl md:text-2xl font-black text-[#2B6CB0] tracking-wide mb-0.5">
                          {cvData.jobTitle || cvData.experiences[0]?.title || "Entrepreneur numérique"}
                        </h1>
                        <h2 className="text-base font-bold text-gray-900 tracking-tight">
                          {cvData.firstName || "Macoumba"} {cvData.lastName || "Samake"}
                        </h2>
                      </div>
                    </div>

                    {/* Contact Bar */}
                    <div className="mx-8 border-y border-[#D1E2D7] py-2 mb-4 flex justify-between items-center text-[9px] font-bold text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-gray-500"></i>
                        <span>{cvData.city || cvData.address || "Pikine"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-envelope text-gray-500"></i>
                        <span>{cvData.email || "facilitefacile@gmail.com"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-phone text-gray-500"></i>
                        <span>{cvData.phone || "+221 77 140 08 32"}</span>
                      </div>
                    </div>

                    {/* Main Content (Profil + 2 columns) */}
                    <div className="px-8 flex-grow flex flex-col">
                      
                      {/* Profil */}
                      {cvData.profile && (
                        <div className="mb-4 pb-3.5 border-b border-[#D1E2D7]">
                          <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                            <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                            {cvData.sectionTitles?.profile?.toUpperCase() || "PROFIL"}
                          </h3>
                          <p className="text-[8.5px] text-gray-700 leading-relaxed font-normal text-justify">
                            {cvData.profile}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-6 flex-grow">
                        {/* Left Column (Experiences & Formations) */}
                        <div className="w-[68%] flex flex-col">
                          
                          {/* Expériences */}
                          {(cvData.experiences?.length > 0) && (
                            <div className="mb-4">
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-2.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                {cvData.sectionTitles?.experience?.toUpperCase() || "EXPÉRIENCE"}
                              </h3>
                              <div className="space-y-3.5">
                                {cvData.experiences.map((exp) => (
                                  <div key={exp.id}>
                                    <div className="flex justify-between items-baseline mb-0.5">
                                      <h4 className="text-[10px] font-black text-[#1B2B3A] uppercase tracking-tight">{exp.title}</h4>
                                      <span className="text-[8.5px] font-bold text-gray-600 border-b border-gray-300 pb-0.5 whitespace-nowrap">
                                        {exp.startDate ? `${exp.startDate} – ` : ""}
                                        {exp.current ? "présent" : exp.endDate || ""}
                                      </span>
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-600 italic mb-1">
                                      {exp.employer}
                                    </div>
                                    {exp.description && (
                                      <ul className="text-[8.5px] text-gray-700 leading-snug space-y-0.5 pl-3 list-disc list-outside text-justify font-medium">
                                        {exp.description.split("\n").filter(Boolean).map((line, i) => (
                                          <li key={i}>{line.replace(/^[•\-\*]\s*/, "")}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Formations */}
                          {(cvData.educations?.length > 0) && (
                            <div className="mb-4">
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-2.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                {cvData.sectionTitles?.education?.toUpperCase() || "FORMATION"}
                              </h3>
                              <div className="space-y-3">
                                {cvData.educations.map((edu) => (
                                  <div key={edu.id}>
                                    <div className="flex justify-between items-baseline mb-0.5">
                                      <h4 className="text-[10px] font-black text-[#1B2B3A] uppercase pr-2 tracking-tight">{edu.degree}</h4>
                                      <span className="text-[8.5px] font-bold text-gray-600 border-b border-gray-300 pb-0.5 whitespace-nowrap">
                                        {edu.startDate ? `${edu.startDate} – ` : ""}
                                        {edu.current ? "présent" : edu.endDate || ""}
                                      </span>
                                    </div>
                                    <div className="text-[9px] font-medium text-gray-600 italic mb-1">
                                      {edu.school}{edu.city ? `, ${edu.city}` : ""}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Right Column (Aptitudes, Logiciels, Langues, Certifications, Centres d'intérêt) */}
                        <div className="w-[32%] flex flex-col space-y-3.5">
                          
                          {/* Aptitudes */}
                          {(cvData.skills?.length > 0) && (
                            <div>
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                {cvData.sectionTitles?.skills?.toUpperCase() || "APTITUDES"}
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.skills.map((skill) => (
                                  <li key={skill.id} className="tracking-tight">{skill.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Logiciels */}
                          {(cvData.itSkills?.length > 0) && (
                            <div>
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                LOGICIELS
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.itSkills.map((skill) => (
                                  <li key={skill.id} className="tracking-tight">{skill.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Langues */}
                          {(cvData.languages?.length > 0) && (
                            <div>
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                {cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.languages.map((lang) => (
                                  <li key={lang.id} className="tracking-tight">
                                    {lang.name} <span className="text-gray-500 font-normal">({lang.level})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Certifications */}
                          {(cvData.qualities?.length > 0) && (
                            <div>
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                CERTIFICATIONS
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.qualities.map((q) => (
                                  <li key={q.id} className="tracking-tight">{q.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Centres d'intérêt */}
                          {(cvData.hobbies?.length > 0) && (
                            <div>
                              <h3 className="text-[11px] font-black text-[#1B2B3A] uppercase tracking-widest flex items-center mb-1.5">
                                <span className="text-[#1B2B3A] mr-1.5 font-black text-sm">•</span>
                                CENTRES D'INTÉRÊT
                              </h3>
                              <ul className="text-[8.5px] text-gray-800 leading-snug space-y-1 font-bold pl-1">
                                {cvData.hobbies.map((hobby) => (
                                  <li key={hobby.id} className="tracking-tight">{hobby.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}

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
                      <div className="mb-5">
                        <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                          <i className="fa-solid fa-address-card text-[#D4AF37] mr-2"></i>
                          {cvData.sectionTitles?.contact?.toUpperCase() || "CONTACT"}
                        </h3>
                        <ul className="space-y-2 text-[10px] font-semibold">
                          {cvData.phone && (
                            <li className="flex items-center space-x-2">
                              <i className="fa-solid fa-mobile-screen text-[#D4AF37] w-4 text-center"></i>
                              <span>{cvData.phone}</span>
                            </li>
                          )}
                          {cvData.email && (
                            <li className="flex items-center space-x-2">
                              <i className="fa-solid fa-envelope text-[#D4AF37] w-4 text-center"></i>
                              <span className="break-all">{cvData.email}</span>
                            </li>
                          )}
                          {(cvData.address || cvData.city) && (
                            <li className="flex items-center space-x-2">
                              <i className="fa-solid fa-location-dot text-[#D4AF37] w-4 text-center"></i>
                              <span>
                                {cvData.address && `${cvData.address}, `}
                                {cvData.city}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Qualités */}
                      {(cvData.qualities?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                            <i className="fa-solid fa-star text-[#D4AF37] mr-2"></i>
                            {cvData.sectionTitles?.qualities?.toUpperCase() || "QUALITÉS"}
                          </h3>
                          <ul className="space-y-1.5 text-[10px] font-semibold">
                            {cvData.qualities.map((q) => (
                              <li key={q.id} className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                                <span>{q.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Informatique */}
                      {(cvData.itSkills?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                            <i className="fa-solid fa-screwdriver-wrench text-[#D4AF37] mr-2"></i>
                            INFORMATIQUE
                          </h3>
                          <ul className="space-y-1.5 text-[10px] font-semibold">
                            {cvData.itSkills.map((s) => (
                              <li key={s.id} className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                                <span>{s.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Langues */}
                      {(cvData.languages?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                            <i className="fa-solid fa-globe text-[#D4AF37] mr-2"></i>
                            {cvData.sectionTitles?.languages?.toUpperCase() || "LANGUES"}
                          </h3>
                          <ul className="space-y-1.5 text-[10px] font-semibold">
                            {cvData.languages.map((l) => (
                              <li key={l.id} className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                                <span>{l.name} : <span className="font-normal opacity-80">{l.level}</span></span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Centres d'intérêt */}
                      {(cvData.hobbies?.length > 0) && (
                        <div className="mb-5">
                          <h3 className="text-sm font-bold uppercase mb-2 flex items-center border-b border-[#D4AF37]/40 pb-1.5">
                            <i className="fa-regular fa-lightbulb text-[#D4AF37] mr-2"></i>
                            CENTRES D'INTÉRÊT
                          </h3>
                          <ul className="space-y-1.5 text-[10px] font-semibold">
                            {cvData.hobbies.map((h) => (
                              <li key={h.id} className="flex items-start space-x-1.5">
                                <i className="fa-solid fa-star text-[#D4AF37] text-[7px] mt-1"></i>
                                <span>{h.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Colonne droite (blanche) */}
                    <div className="w-[65%] bg-white flex flex-col overflow-hidden">
                      {/* Bandeau noir en tête */}
                      <div className="bg-black text-white px-6 py-6 flex-shrink-0">
                        <h1 className="text-2xl font-black uppercase tracking-wide leading-tight">
                          {cvData.firstName || "Prénom"} {cvData.lastName || "Nom"}
                        </h1>
                        <p className="text-[11px] font-light text-white/80 mt-1">
                          {cvData.experiences[0]?.title || "Titre professionnel"}
                        </p>
                      </div>

                      <div className="px-6 py-5 flex-grow flex flex-col space-y-4 overflow-hidden">
                        {/* Profil Professionnel */}
                        {cvData.profile && (
                          <div>
                            <h3 className="text-sm font-bold text-black flex items-center mb-1.5">
                              <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                                <i className="fa-solid fa-bullseye text-white text-[8px]"></i>
                              </span>
                              {cvData.sectionTitles?.profile || "Profil Professionnel"}
                            </h3>
                            <p className="text-[10px] text-gray-800 leading-relaxed font-medium text-justify">
                              {cvData.profile}
                            </p>
                          </div>
                        )}

                        {/* Expériences Professionnelles */}
                        {(cvData.experiences?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-black flex items-center mb-2">
                              <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                                <i className="fa-solid fa-briefcase text-white text-[8px]"></i>
                              </span>
                              {cvData.sectionTitles?.experience || "Expériences Professionnelles"}
                            </h3>
                            <div className="space-y-2.5">
                              {cvData.experiences.map((exp) => (
                                <div key={exp.id}>
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="font-bold text-[10.5px] text-gray-900">
                                      {exp.title || "Poste"} {exp.employer ? `— ${exp.employer}` : ""}
                                    </span>
                                    <span className="text-[9px] font-semibold text-gray-500 flex-shrink-0 whitespace-nowrap">
                                      {exp.startDate || ""}{exp.startDate ? " – " : ""}{exp.current ? "Présent" : exp.endDate || ""}
                                    </span>
                                  </div>
                                  {exp.description && (
                                    <ul className="text-[9px] text-gray-700 leading-tight space-y-0.5 mt-1 list-disc list-inside text-justify">
                                      {exp.description.split("\n").filter(Boolean).map((line, i) => (
                                        <li key={i}>{line.replace(/^[•\-\*]\s*/, "")}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Formation et Diplômes */}
                        {(cvData.educations?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-black flex items-center mb-2">
                              <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                                <i className="fa-solid fa-graduation-cap text-white text-[8px]"></i>
                              </span>
                              {cvData.sectionTitles?.education || "Formation et Diplômes"}
                            </h3>
                            <div className="space-y-1.5">
                              {cvData.educations.map((edu) => (
                                <div key={edu.id} className="flex items-start justify-between gap-3">
                                  <span className="font-bold text-[10px] text-gray-900">
                                    {edu.degree || "Diplôme"}{edu.school ? ` — ${edu.school}` : ""}
                                  </span>
                                  <span className="text-[9px] font-semibold text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    {edu.startDate || ""}{edu.startDate ? " – " : ""}{edu.current ? "En cours" : edu.endDate || ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compétences Clés */}
                        {(cvData.skills?.length > 0) && (
                          <div>
                            <h3 className="text-sm font-bold text-black flex items-center mb-2">
                              <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0">
                                <i className="fa-solid fa-star text-white text-[8px]"></i>
                              </span>
                              {cvData.sectionTitles?.skills || "Compétences Clés"}
                            </h3>
                            <ul className="text-[10px] text-gray-800 leading-relaxed space-y-1">
                              {cvData.skills.map((skill) => (
                                <li key={skill.id}>
                                  <span className="font-bold text-gray-900">{skill.name}</span>
                                  {skill.level && <span className="font-normal"> : {skill.level}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="text-[8px] text-gray-400 font-medium text-center border-t border-gray-100 p-3 flex-shrink-0">
                        <span>Créé via Facilite.fr • Langue du document : {cvData.cvLang}</span>
                      </div>
                    </div>
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
    </>
  );
}
