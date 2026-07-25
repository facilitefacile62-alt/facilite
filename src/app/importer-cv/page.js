/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const translations = {
  FR: {
    navHome: "Accueil",
    navService: "Service",
    navMessages: "Messagerie",
    navRecruitment: "Recrutement Spontané",
    navContact: "Contactez-nous",
    navLogin: "Se connecter",
    title: "Analyseur de CV Intelligent",
    subtitle: "Déposez votre CV existant pour extraire automatiquement vos données et les adapter à nos modèles professionnels compatibles ATS.",
    dragDropText: "Glissez-déposez votre CV ici ou cliquez pour parcourir",
    supportedFormats: "Formats acceptés : PDF, DOC, DOCX (Max 5 Mo)",
    scanningTitle: "Analyse en cours...",
    scanningSubtitle: "Notre intelligence artificielle décode la structure sémantique de votre document.",
    verificationTitle: "Vérification des données extraites",
    verificationSubtitle: "Ajustez les informations extraites par notre parseur avant de finaliser votre CV.",
    btnContinue: "Continuer vers l'éditeur",
    btnCancel: "Importer un autre fichier",
    labelFirstName: "Prénom",
    labelLastName: "Nom",
    labelEmail: "Adresse email",
    labelPhone: "Téléphone",
    labelTitle: "Titre du profil",
    labelSummary: "Résumé professionnel",
    labelExperiences: "Expériences professionnelles",
    labelSkills: "Compétences clés",
    placeholderFirstName: "Ex. Mamadou",
    placeholderLastName: "Ex. Sarr",
    placeholderEmail: "Ex. mamadou.sarr@example.com",
    placeholderPhone: "Ex. +221 77 123 45 67",
    placeholderTitle: "Ex. Développeur Web",
    placeholderSummary: "Parlez-nous de vos motivations...",
    toastSuccessImport: "Document analysé avec succès !",
    toastErrorImport: "Type de fichier non supporté. Veuillez utiliser un PDF ou un document Word.",
    modalTitle: "Contactez-nous",
    modalSubtitle: "Une question ou une suggestion ? Notre équipe vous répond sous 24h.",
    modalLabelName: "Nom complet",
    modalLabelEmail: "Adresse email",
    modalLabelSubject: "Objet du message",
    modalLabelMessage: "Votre message",
    modalPlaceholderName: "Ex. Mamadou Sarr",
    modalPlaceholderEmail: "Ex. mamadou@example.com",
    modalPlaceholderSubject: "Ex. Demande de renseignement",
    modalPlaceholderMessage: "Comment pouvons-nous vous aider ?",
    modalSending: "Envoi en cours...",
    modalSubmit: "Envoyer le message",
    modalSuccessTitle: "Message envoyé avec succès !",
    modalSuccessDesc: "Merci pour votre message. Notre équipe d'assistance vous contactera très rapidement.",
    modalClose: "Fermer",
    toastLangFR: "Langue modifiée en Français",
    toastLangGB: "Language changed to English",
  },
  GB: {
    navHome: "Home",
    navService: "Service",
    navMessages: "Messaging",
    navRecruitment: "Spontaneous Application",
    navContact: "Contact us",
    navLogin: "Sign in",
    title: "Intelligent Resume Parser",
    subtitle: "Drop your existing resume to automatically extract your details and fit them into our professional, 100% ATS-friendly templates.",
    dragDropText: "Drag and drop your resume here or click to browse",
    supportedFormats: "Accepted formats: PDF, DOC, DOCX (Max 5 MB)",
    scanningTitle: "Parsing Document...",
    scanningSubtitle: "Our artificial intelligence is decoding the semantic structure of your file.",
    verificationTitle: "Verify Extracted Information",
    verificationSubtitle: "Adjust the information extracted by our parser before entering the designer.",
    btnContinue: "Continue to Editor",
    btnCancel: "Upload another file",
    labelFirstName: "First Name",
    labelLastName: "Last Name",
    labelEmail: "Email Address",
    labelPhone: "Phone Number",
    labelTitle: "Profile Title",
    labelSummary: "Professional Summary",
    labelExperiences: "Work Experience",
    labelSkills: "Key Skills",
    placeholderFirstName: "e.g., Mamadou",
    placeholderLastName: "e.g., Sarr",
    placeholderEmail: "e.g., mamadou.sarr@example.com",
    placeholderPhone: "e.g., +221 77 123 45 67",
    placeholderTitle: "e.g., Web Developer",
    placeholderSummary: "Tell us about your motivations...",
    toastSuccessImport: "Document parsed successfully!",
    toastErrorImport: "Unsupported file type. Please upload a PDF or a Word document.",
    modalTitle: "Contact us",
    modalSubtitle: "A question or suggestion? Our team will reply within 24 hours.",
    modalLabelName: "Full name",
    modalLabelEmail: "Email address",
    modalLabelSubject: "Subject",
    modalLabelMessage: "Your message",
    modalPlaceholderName: "e.g., Mamadou Sarr",
    modalPlaceholderEmail: "e.g., mamadou@example.com",
    modalPlaceholderSubject: "e.g., Request for information",
    modalPlaceholderMessage: "How can we help you?",
    modalSending: "Sending...",
    modalSubmit: "Send message",
    modalSuccessTitle: "Message sent successfully!",
    modalSuccessDesc: "Thank you for your message. Our support team will get in touch with you very shortly.",
    modalClose: "Close",
    toastLangFR: "Language changed to French",
    toastLangGB: "Language changed to English",
  }
};

const scanStepsFR = [
  "Lecture et décompression du document...",
  "Analyse de la structure sémantique...",
  "Extraction des coordonnées et réseaux...",
  "Identification des blocs d'expériences...",
  "Extraction du parcours académique...",
  "Classification des compétences clés...",
  "Vérification des métadonnées du profil..."
];

const scanStepsGB = [
  "Reading and decompressing document...",
  "Analyzing semantic layout...",
  "Extracting contact information...",
  "Identifying work history blocks...",
  "Extracting educational background...",
  "Classifying core competencies...",
  "Verifying profile metadata..."
];

export default function ImporterCvPage() {
  const [selectedLang, setSelectedLang] = useState("FR");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  
  // Scanning stages: "upload" -> "scanning" -> "edit"
  const [stage, setStage] = useState("upload");
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  
  // Parsed Form Data
  const [parsedData, setParsedData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    summary: "",
    experiences: [],
    skills: []
  });

  const [newSkill, setNewSkill] = useState("");
  
  // Global Layout Elements
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  
  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });
  
  const fileInputRef = useRef(null);
  const t = translations[selectedLang] || translations.FR;
  const scanSteps = selectedLang === "FR" ? scanStepsFR : scanStepsGB;

  // Sync language selection with localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang) {
      setSelectedLang(savedLang);
    }
  }, []);

  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => {
      setToast({ show: false, message: "", icon: "fa-circle-info" });
    }, 3500);
  };

  const changeLanguage = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem("lang", lang);
    triggerToast(lang === "FR" ? translations.FR.toastLangFR : translations.GB.toastLangGB, "fa-globe");
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Parse files and simulate advanced extraction
  const processFile = (selectedFile) => {
    const validExtensions = ["pdf", "doc", "docx"];
    const extension = selectedFile.name.split(".").pop().toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      triggerToast(t.toastErrorImport, "fa-circle-exclamation");
      return;
    }

    setFile(selectedFile);
    setStage("scanning");
    setScanStepIndex(0);
    setScanProgress(0);
  };

  // Simulation timeline for scanning CV
  useEffect(() => {
    if (stage !== "scanning") return;

    // Fast-updating scanning lines and logs
    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 40);

    const stepInterval = setInterval(() => {
      setScanStepIndex((prev) => {
        if (prev >= scanSteps.length - 1) {
          clearInterval(stepInterval);
          // Transition to Edit mode with mock-parsed data
          setTimeout(() => {
            generateMockData(file.name);
            setStage("edit");
            triggerToast(t.toastSuccessImport, "fa-circle-check");
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 550);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [stage, file, scanSteps]);

  // Generate realistic parsed templates depending on file keywords
  const generateMockData = (filename) => {
    const lowerName = filename.toLowerCase();
    
    let mock = {
      firstName: "Mamadou",
      lastName: "Sarr",
      email: "mamadou.sarr@example.com",
      phone: "+221 77 568 23 45",
      title: "Conseiller Clientèle Télécom",
      summary: "Conseiller client dynamique et orienté résultats, possédant 2 ans d'expérience dans le secteur des télécommunications. Excellente communication orale et écrite en français et wolof.",
      experiences: [
        {
          id: 1,
          title: "Conseiller Clientèle",
          employer: "Orange Sénégal",
          city: "Dakar",
          startDate: "2024-03",
          endDate: "",
          current: true,
          description: "Gestion des appels entrants, résolution d'incidents techniques de niveau 1, vente de forfaits mobiles et internet."
        }
      ],
      skills: ["Relation client", "Téléphonie", "Gestion des réclamations", "Vente directe", "Wolof"]
    };

    if (lowerName.includes("dev") || lowerName.includes("web") || lowerName.includes("react") || lowerName.includes("next")) {
      mock = {
        firstName: "Macoumba",
        lastName: "Samak",
        email: "macoumba.samak@nextdev.sn",
        phone: "+221 70 812 34 56",
        title: "Développeur Front-End React",
        summary: "Passionné par l'écosystème JavaScript et le Pixel-Perfect. Expérience confirmée dans l'optimisation des performances et la mise en page d'applications web réactives avec React et Tailwind CSS.",
        experiences: [
          {
            id: 1,
            title: "Développeur Front-End (Stage)",
            employer: "Facilite Corporation",
            city: "Pikine",
            startDate: "2025-06",
            endDate: "2025-12",
            current: false,
            description: "Refonte de la landing page avec Next.js 16 et Tailwind v4. Amélioration du score SEO et de la vitesse de chargement de 40%."
          }
        ],
        skills: ["React.js", "Next.js", "Tailwind CSS", "TypeScript", "Git", "SEO"]
      };
    } else if (lowerName.includes("compta") || lowerName.includes("finance") || lowerName.includes("gestion")) {
      mock = {
        firstName: "Aminata",
        lastName: "Diallo",
        email: "aminata.diallo@comptable.sn",
        phone: "+221 76 432 10 98",
        title: "Comptable & Gestionnaire de Paie",
        summary: "Professionnelle de la finance dotée d'une solide expertise dans le traitement des écritures comptables, les déclarations fiscales et la paie.",
        experiences: [
          {
            id: 1,
            title: "Assistant Comptable",
            employer: "Senelec",
            city: "Dakar",
            startDate: "2023-01",
            endDate: "2024-08",
            current: false,
            description: "Saisie comptable mensuelle, pointage bancaire, préparation des déclarations sociales (IPRES, CSS)."
          }
        ],
        skills: ["Comptabilité générale", "SAGE", "Traitement de la paie", "Excel avancé", "Fiscalité"]
      };
    } else if (lowerName.includes("marie") || lowerName.includes("bernard")) {
      mock = {
        firstName: "Marie",
        lastName: "Bernard",
        email: "marie.bernard@example.com",
        phone: "+33 6 12 34 56 78",
        title: "Chargée de Clientèle B2B",
        summary: "Forte d'une expérience de 3 ans dans le support aux partenaires commerciaux. Dynamique, organisée et centrée sur la satisfaction clients.",
        experiences: [
          {
            id: 1,
            title: "Chargée de Relations Clients",
            employer: "Wave Mobile Money",
            city: "Thies",
            startDate: "2023-11",
            endDate: "",
            current: true,
            description: "Accompagnement quotidien des marchands Wave, identification des anomalies de transaction, animation de formations utilisateurs."
          }
        ],
        skills: ["Support commercial", "Gestion des incidents", "CRM Salesforce", "Négociation", "Reporting"]
      };
    }

    setParsedData(mock);
  };

  const handleFieldChange = (field, value) => {
    setParsedData(prev => ({ ...prev, [field]: value }));
  };

  // Experience handlers inside parser editor
  const handleExpChange = (id, field, value) => {
    setParsedData(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp => exp.id === id ? { ...exp, [field]: value } : exp)
    }));
  };

  const deleteExperience = (id) => {
    setParsedData(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id)
    }));
  };

  const addExperience = () => {
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
    setParsedData(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };

  // Skills handlers inside parser editor
  const addSkill = () => {
    if (newSkill.trim() && !parsedData.skills.includes(newSkill.trim())) {
      setParsedData(prev => ({ ...prev, skills: [...parsedData.skills, newSkill.trim()] }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove) => {
    setParsedData(prev => ({
      ...prev,
      skills: prev.skills.filter(sk => sk !== skillToRemove)
    }));
  };

  // Submit and export data to localStorage
  const handleFinalSubmit = () => {
    localStorage.setItem("imported_cv_data", JSON.stringify(parsedData));
    triggerToast(selectedLang === "FR" ? "Données transmises au Builder !" : "Data sent to Builder!", "fa-circle-check");
    setTimeout(() => {
      window.location.href = "/creer-cv";
    }, 1000);
  };

  // Contact Modal
  const handleOpenContactModal = (e) => {
    if (e) e.preventDefault();
    setContactModalOpen(true);
    setMobileMenuOpen(false);
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

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && contactModalOpen) {
        handleCloseContactModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactModalOpen]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans antialiased text-gray-800">
      
      {/* Toast Notification Top Floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <i className={`fa-solid ${toast.icon} text-[#10E688] text-xl`}></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) Identique au site principal */}
      <nav className="bg-[#FAF6F1] px-4 md:px-6 py-2.5 shadow-sm fixed top-0 left-0 w-full z-50">
        <div className="max-w-[1180px] mx-auto w-full flex items-center justify-between">
          {/* Groupe Gauche : Logo + Recherche */}
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>

            {/* Barre de recherche de la Navbar */}
            <div className="hidden md:block relative w-60 lg:w-72">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                  placeholder={t.searchPlaceholder || "Rechercher une offre d'emploi..."}
                />
              </div>
            </div>
          </div>

          {/* Groupe Centre : Liens principaux (Accueil, Service, Messagerie, Recrutement, Contact) */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {/* Accueil */}
            <Link
              href="/"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navHome}</span>
            </Link>
            
            {/* Service */}
            <Link
              href="/service"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-briefcase text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navService}</span>
            </Link>

            {/* Messagerie */}
            <Link
              href="/messagerie"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16 relative"
            >
              <i className="fa-regular fa-comments text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navMessages}</span>
              <span className="absolute top-0.5 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </Link>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => triggerToast("3 nouvelles notifications", "fa-bell")}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16 relative"
            >
              <i className="fa-regular fa-bell text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Notifications</span>
              <span className="absolute -top-1 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-xs border border-white">
                3
              </span>
            </button>

            {/* Recrutement Spontané */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); triggerToast("Recrutement Spontané", "fa-user-tie"); }}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-user-tie text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Recrutement</span>
            </a>

            {/* Contactez-nous */}
            <a
              href="#"
              onClick={handleOpenContactModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-comment-dots text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Contact</span>
            </a>
          </div>

          {/* Groupe Droit : Connexion & Sélecteur de langue */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 p-1 bg-white border border-gray-200 rounded-full shadow-xs">
              <button
                onClick={() => changeLanguage("FR")}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                  selectedLang === "FR" ? "bg-[#10E688] text-gray-900 shadow-xs" : "opacity-60 hover:opacity-100"
                }`}
                title="Français"
              >
                <img src="/francais.avif" alt="FR" className="w-5 h-5 rounded-full object-cover" />
              </button>
              <button
                onClick={() => changeLanguage("GB")}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                  selectedLang === "GB" ? "bg-[#E4B8F9] text-gray-900 shadow-xs" : "opacity-60 hover:opacity-100"
                }`}
                title="English"
              >
                <img src="/anglais.jpeg" alt="GB" className="w-5 h-5 rounded-full object-cover" />
              </button>
            </div>

            <a
              href="#"
              onClick={(e) => { e.preventDefault(); triggerToast("Connexion", "fa-user"); }}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-user text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Connexion</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow pt-24 pb-20 px-4 max-w-[1180px] w-full mx-auto flex flex-col justify-center items-center">
        
        {/* STAGE 1: UPLOAD ZONE (Exact design matching Image 2) */}
        {stage === "upload" && (
          <div className="w-full max-w-2xl text-center space-y-6 animate-fade-in-up mt-4">
            {/* Title & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Importez votre CV
              </h1>
              <p className="text-xs md:text-sm text-gray-600 font-normal max-w-lg mx-auto leading-relaxed">
                Nous transférerons votre contenu vers le modèle choisi que vous pourrez mettre à jour lors de l'étape suivante.
              </p>
            </div>

            {/* Dashed Drop Box Element */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`border-2 border-dashed rounded-lg p-8 md:p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative overflow-hidden group select-none max-w-xl mx-auto w-full ${
                dragActive
                  ? "border-blue-600 bg-blue-50/50 scale-[1.01]"
                  : "border-gray-300 bg-white hover:border-blue-500 hover:bg-gray-50/80"
              }`}
            >
              {/* Center Upload Box Icon */}
              <div className="w-12 h-12 bg-gray-200/80 rounded-md flex items-center justify-center mb-4 text-gray-700">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
                </svg>
              </div>

              <h3 className="text-xs md:text-sm font-bold text-gray-900 mb-4">
                Glissez-déposez votre fichier ici
              </h3>

              {/* Parcourir Pill Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current.click();
                }}
                className="bg-[#0066FF] hover:bg-blue-700 text-white font-extrabold text-xs tracking-wider uppercase py-2.5 px-8 rounded-full shadow-sm transition transform active:scale-95 mb-4"
              >
                PARCOURIR
              </button>

              <p className="text-[11px] text-gray-400 font-normal">
                Types de fichiers pris en charge: DOC, DOCX, PDF, HTM, RTF, TXT
              </p>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.htm,.html,.rtf,.txt"
                className="hidden"
              />
            </div>

            {/* Créer un nouveau CV option */}
            <div className="pt-2 space-y-2">
              <Link
                href="/creer-cv"
                className="inline-block border border-gray-900 text-gray-900 font-bold text-xs md:text-sm py-2.5 px-10 rounded-full hover:bg-gray-100 transition shadow-xs"
              >
                Créer un nouveau CV
              </Link>
              <p className="text-[11px] text-gray-500 font-normal">
                Nous vous accompagnerons dans la rédaction de votre CV à l'aide de nos conseils d'expert
              </p>
            </div>

            {/* Bottom Navigation Controls (Retour & Continuer) */}
            <div className="pt-8 flex items-center justify-between w-full max-w-xl mx-auto border-t border-gray-200 mt-8">
              <Link
                href="/service"
                className="border border-gray-900 text-gray-900 font-bold text-xs md:text-sm py-2 px-7 rounded-full hover:bg-gray-100 transition"
              >
                Retour
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (file) {
                    setStage("scanning");
                  } else {
                    fileInputRef.current.click();
                  }
                }}
                className="bg-[#10E688] text-gray-900 font-extrabold text-xs md:text-sm uppercase tracking-wider py-2.5 px-8 rounded-full shadow hover:brightness-105 transition transform active:scale-95"
              >
                CONTINUER
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: SCANNING PROGRESS SCANNER WINDOW */}
        {stage === "scanning" && (
          <div className="w-full max-w-xl bg-white rounded-3xl border border-gray-200 shadow-2xl p-8 space-y-8 animate-fade-in-up mt-12 relative overflow-hidden">
            {/* The Cyber Scanner Laser Overlay */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#10E688] to-transparent shadow-[0_0_15px_#10E688] animate-pulse z-10"
              style={{
                top: `${scanProgress}%`,
                transition: "top 0.1s linear"
              }}
            />

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-gray-900">{t.scanningTitle}</h2>
              <p className="text-xs text-gray-500 font-semibold">{t.scanningSubtitle}</p>
            </div>

            {/* Glowing circular scanner or document simulation */}
            <div className="relative h-44 w-full bg-slate-950 rounded-2xl flex flex-col justify-center px-6 overflow-hidden border border-slate-900 shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,230,136,0.12),transparent)]"></div>
              
              {/* Scan simulation logs */}
              <div className="font-mono text-[11px] text-emerald-400/90 space-y-2 select-none">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-emerald-500 font-bold">[SYSTEM]</span>
                  <span>CV parser init... SUCCESS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-400 font-bold">[FILE]</span>
                  <span className="truncate max-w-[340px] text-gray-300 font-semibold">{file?.name}</span>
                </div>
                <div className="pt-2 text-emerald-300 font-medium">
                  {scanSteps[scanStepIndex]}
                </div>
              </div>
            </div>

            {/* Progress status indicators */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                <span>Extraction Progress</span>
                <span className="text-[#10E688]">{scanProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden border border-gray-150 shadow-inner">
                <div
                  className="bg-gradient-to-r from-[#10E688] to-[#E4B8F9] h-full rounded-full transition-all duration-100"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: VERIFICATION SIDE BY SIDE FORM EDITOR */}
        {stage === "edit" && (
          <div className="w-full space-y-6 animate-fade-in-up mt-4">
            
            {/* Heading header banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
                  {t.verificationTitle}
                </h1>
                <p className="text-xs text-gray-500 font-semibold">
                  {t.verificationSubtitle}
                </p>
              </div>

              <div className="flex gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => setStage("upload")}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex-1 sm:flex-initial"
                >
                  {t.btnCancel}
                </button>
                <button
                  onClick={handleFinalSubmit}
                  className="bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold px-6 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer flex-1 sm:flex-initial"
                >
                  {t.btnContinue}
                </button>
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Form: Personal details */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-5 lg:col-span-2">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-gray-100 pb-2">
                  1. Informations Personnelles
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      {t.labelFirstName}
                    </label>
                    <input
                      type="text"
                      value={parsedData.firstName}
                      onChange={(e) => handleFieldChange("firstName", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder={t.placeholderFirstName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      {t.labelLastName}
                    </label>
                    <input
                      type="text"
                      value={parsedData.lastName}
                      onChange={(e) => handleFieldChange("lastName", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder={t.placeholderLastName}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      {t.labelEmail}
                    </label>
                    <input
                      type="email"
                      value={parsedData.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder={t.placeholderEmail}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      {t.labelPhone}
                    </label>
                    <input
                      type="text"
                      value={parsedData.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                      placeholder={t.placeholderPhone}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                    {t.labelTitle}
                  </label>
                  <input
                    type="text"
                    value={parsedData.title}
                    onChange={(e) => handleFieldChange("title", e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder={t.placeholderTitle}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                    {t.labelSummary}
                  </label>
                  <textarea
                    rows="3"
                    value={parsedData.summary}
                    onChange={(e) => handleFieldChange("summary", e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition resize-none"
                    placeholder={t.placeholderSummary}
                  />
                </div>
              </div>

              {/* Right Form: Skills extraction */}
              <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-5">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-gray-100 pb-2">
                  2. {t.labelSkills}
                </h3>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    className="flex-grow p-2.5 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600"
                    placeholder="Ex. React.js"
                  />
                  <button
                    onClick={addSkill}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs cursor-pointer transition active:scale-95"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  {parsedData.skills.map((sk, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 text-blue-700 font-extrabold text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-blue-100 flex items-center space-x-1.5 shadow-2xs hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition duration-200 group cursor-pointer"
                      onClick={() => removeSkill(sk)}
                      title="Cliquez pour supprimer"
                    >
                      <span>{sk}</span>
                      <i className="fa-solid fa-xmark text-[9px] text-blue-400 group-hover:text-red-500 transition"></i>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Form: Experiences Block */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                  3. {t.labelExperiences}
                </h3>
                <button
                  onClick={addExperience}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  + Ajouter
                </button>
              </div>

              {parsedData.experiences.map((exp, index) => (
                <div key={exp.id} className="p-5 border border-gray-200 bg-gray-50/30 rounded-2xl relative space-y-4 shadow-2xs">
                  
                  {/* Delete buttons */}
                  <button
                    onClick={() => deleteExperience(exp.id)}
                    className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can mr-1.5"></i>
                    Supprimer
                  </button>

                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Expérience n°{index + 1}</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Poste / Rôle</label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => handleExpChange(exp.id, "title", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Ex. Conseiller Client"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Employeur / Entreprise</label>
                      <input
                        type="text"
                        value={exp.employer}
                        onChange={(e) => handleExpChange(exp.id, "employer", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Ex. Orange Sénégal"
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
                        placeholder="Ex. Dakar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mois/Année début</label>
                      <input
                        type="month"
                        value={exp.startDate}
                        onChange={(e) => handleExpChange(exp.id, "startDate", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mois/Année fin</label>
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
                      className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor={`curr-${exp.id}`} className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                      Poste actuel
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Description des tâches réalisées</label>
                    <textarea
                      rows="3"
                      value={exp.description}
                      onChange={(e) => handleExpChange(exp.id, "description", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white resize-none"
                      placeholder="Résumez vos réalisations..."
                    ></textarea>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Continuer footer buttons */}
            <div className="flex justify-end gap-3.5 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
              <button
                onClick={() => setStage("upload")}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-5 py-3 rounded-xl text-xs transition cursor-pointer"
              >
                {t.btnCancel}
              </button>
              <button
                onClick={handleFinalSubmit}
                className="bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold px-8 py-3 rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-arrow-right-long text-sm"></i>
                <span>{t.btnContinue}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer layout */}
      <footer className="bg-gray-900 text-white mt-auto border-t border-gray-800">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-semibold text-gray-400">
          <div>© 2026 Facilite. Tous droits réservés.</div>
          <div className="flex space-x-4">
            <Link href="/" className="hover:text-white transition">Accueil</Link>
            <span>•</span>
            <Link href="/service" className="hover:text-white transition">Service</Link>
            <span>•</span>
            <a href="#" onClick={handleOpenContactModal} className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>

      {/* Modal de Contact (#FAF6F1 Navbar button target) */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-200 max-w-lg w-full p-6 shadow-2xl relative animate-fade-in-up">
            
            <button
              onClick={handleCloseContactModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition flex items-center justify-center cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

            {formSubmitted ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-[#10E688]/10 rounded-full flex items-center justify-center mx-auto text-[#10E688] text-3xl">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <h3 className="text-xl font-black text-gray-900">{t.modalSuccessTitle}</h3>
                <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto">{t.modalSuccessDesc}</p>
                <button
                  onClick={handleCloseContactModal}
                  className="bg-gray-900 hover:bg-gray-800 text-white font-extrabold py-2 px-6 rounded-full text-xs transition active:scale-95"
                >
                  {t.modalClose}
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900">{t.modalTitle}</h3>
                  <p className="text-[11px] text-gray-500 font-semibold mt-1">{t.modalSubtitle}</p>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      {t.modalLabelName}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 transition"
                      placeholder={t.modalPlaceholderName}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      {t.modalLabelEmail}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 transition"
                      placeholder={t.modalPlaceholderEmail}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      {t.modalLabelSubject}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 transition"
                      placeholder={t.modalPlaceholderSubject}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      {t.modalLabelMessage}
                    </label>
                    <textarea
                      rows="4"
                      required
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 transition resize-none"
                      placeholder={t.modalPlaceholderMessage}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#10E688] hover:bg-[#0fd57d] disabled:opacity-50 text-gray-950 font-extrabold py-3.5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer mt-2 flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                      <span>{t.modalSending}</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>{t.modalSubmit}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
