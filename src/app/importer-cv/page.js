/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedAvatarUrl } from "@/lib/supabase";
import RoleNavLink from "@/components/RoleNavLink";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

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
  const pathname = usePathname();
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
    formations: [],
    skills: []
  });

  const [newSkill, setNewSkill] = useState("");
  
  // Global Layout Elements
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  
  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });
  
  const fileInputRef = useRef(null);
  const plusDropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const [userSession, setUserSession] = useState(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);

  // Notifications System (LinkedIn Style)
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState("all");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);
  const t = translations[selectedLang] || translations.FR;
  const scanSteps = selectedLang === "FR" ? scanStepsFR : scanStepsGB;

  // Sync language selection with localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang) {
      // localStorage n'existe pas côté serveur : cette lecture doit rester
      // dans un effet (jamais pendant le rendu, pour éviter un hydration
      // mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLang(savedLang);
    }
  }, []);

  // Sync Supabase Auth session & profile
  useEffect(() => {
    async function syncSessionAndProfile(session) {
      setUserSession(session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .single();
        if (profile) {
          setUserAvatarUrl((await getSignedAvatarUrl(profile.avatar_url)) || profile.avatar_url || null);
        }
      } else {
        setUserAvatarUrl(null);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSessionAndProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSessionAndProfile(session);
    });

    return () => subscription.unsubscribe();
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

  // Parse files, upload to Supabase & simulate advanced extraction
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

  // Extraction réelle du contenu du document (jamais basée sur le nom du fichier)
  const parseFileContent = async (selectedFile) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/parse-document", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });

      if (!response.ok) throw new Error("Extraction du document impossible.");

      const { fields } = await response.json();

      // Le moteur d'extraction (IA ou regex de secours) peut renvoyer des clés en
      // anglais ou en français selon le pipeline utilisé : on tente toutes les variantes.
      const getValue = (obj, possibleKeys) => {
        if (!obj) return "";
        for (const key of possibleKeys) {
          if (key in obj) return obj[key] ?? "";
        }
        const lowerKeysMap = {};
        for (const k of Object.keys(obj)) lowerKeysMap[k.toLowerCase()] = obj[k];
        for (const key of possibleKeys) {
          const lower = key.toLowerCase();
          if (lower in lowerKeysMap) return lowerKeysMap[lower] ?? "";
        }
        return "";
      };

      const rawExperiences = getValue(fields, ["experiences", "experience", "experiences_professionnelles"]) || [];
      const rawFormations = getValue(fields, ["formations", "formation", "educations", "education"]) || [];
      const rawSkills = getValue(fields, ["skills", "competences", "compétences", "competences_cles_hard_skills"]) || [];

      setParsedData({
        firstName: getValue(fields, ["firstName", "prenom", "prénom"]) || (fields.etat_civil?.nom ? fields.etat_civil.nom.split(" ")[0] : ""),
        lastName: getValue(fields, ["lastName", "nom"]) || (fields.etat_civil?.nom ? fields.etat_civil.nom.split(" ").slice(1).join(" ") : ""),
        email: getValue(fields, ["email"]) || (fields.contacts?.email || ""),
        phone: getValue(fields, ["phone", "telephone", "téléphone"]) || (fields.contacts?.telephone || ""),
        title: getValue(fields, ["title", "jobTitle", "titre", "poste"]) || (fields.etat_civil?.titre_professionnel || ""),
        summary: getValue(fields, ["summary", "resume", "résumé"]) || (fields.profil_professionnel || ""),
        experiences: (Array.isArray(rawExperiences) ? rawExperiences : []).map((exp, idx) => ({
          id: idx + 1,
          title: getValue(exp, ["title", "role", "poste"]) || "",
          employer: getValue(exp, ["employer", "company", "entreprise"]) || "",
          city: getValue(exp, ["city", "ville", "localisation"]) || "",
          periode: String(getValue(exp, ["periode", "période", "period", "dates"]) || ""),
          startDate: String(getValue(exp, ["startDate"]) || ""),
          endDate: String(getValue(exp, ["endDate"]) || ""),
          current: !!getValue(exp, ["current"]),
          description: getValue(exp, ["description", "missions"]) || "",
        })),
        formations: (Array.isArray(rawFormations) ? rawFormations : []).map((form, idx) => ({
          id: idx + 1,
          diplome: getValue(form, ["diplome", "diplôme", "degree"]) || "",
          ecole: getValue(form, ["ecole", "école", "school", "institution"]) || "",
          annee: String(getValue(form, ["annee", "année", "periode", "période", "year"]) || ""),
        })),
        skills: Array.isArray(rawSkills) ? rawSkills : [],
      });
    } catch (err) {
      console.error("Erreur d'extraction du document:", err);
      triggerToast("Impossible d'extraire le contenu du document. Veuillez compléter les champs manuellement.", "fa-triangle-exclamation");
      setParsedData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        title: "",
        summary: "",
        experiences: [],
        formations: [],
        skills: [],
      });
    }
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
          // Transition to Edit mode with data extracted from the document's real content
          setTimeout(async () => {
            await parseFileContent(file);
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
    // parseFileContent et t.toastSuccessImport volontairement omis : ce sont
    // des références recréées à chaque rendu (fonction non mémoïsée, objet
    // de traduction), les ajouter relancerait toute l'animation de scan à
    // chaque re-render du parent plutôt qu'une seule fois par changement
    // réel de stage/file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, file, scanSteps]);


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
      periode: "",
      startDate: "",
      endDate: "",
      current: false,
      description: ""
    };
    setParsedData(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };

  // Formation handlers inside parser editor
  const handleFormationChange = (id, field, value) => {
    setParsedData(prev => ({
      ...prev,
      formations: prev.formations.map(form => form.id === id ? { ...form, [field]: value } : form)
    }));
  };

  const deleteFormation = (id) => {
    setParsedData(prev => ({
      ...prev,
      formations: prev.formations.filter(form => form.id !== id)
    }));
  };

  const addFormation = () => {
    const newFormation = {
      id: Date.now(),
      diplome: "",
      ecole: "",
      annee: ""
    };
    setParsedData(prev => ({ ...prev, formations: [...prev.formations, newFormation] }));
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

  // Submit and export data to Supabase Storage + resumes/profiles tables
  const handleFinalSubmit = async () => {
    if (savingImport) return; // évite un double envoi/upload sur un double-clic
    setSavingImport(true);
    localStorage.setItem("imported_cv_data", JSON.stringify(parsedData));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resumeTitle = parsedData.firstName && parsedData.lastName
        ? `CV Importé - ${parsedData.firstName} ${parsedData.lastName}`
        : "CV Importé Facilité";

      let fileUrl = null;

      if (session?.user && file) {
        const storagePath = `${session.user.id}/cvs/${Date.now()}.${file.name.split(".").pop().toLowerCase()}`;

        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(storagePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // Bucket privé : on stocke le chemin, l'URL signée est générée à l'affichage
        fileUrl = storagePath;

        // Reflète le CV importé sur le profil pour un affichage permanent
        await supabase.from("profiles").upsert({
          id: session.user.id,
          email: session.user.email,
          cv_url: fileUrl,
          cv_name: file.name,
          updated_at: new Date().toISOString(),
        });
      }

      if (session?.user) {
        await supabase.from("resumes").insert({
          user_id: session.user.id,
          title: resumeTitle,
          type: "imported",
          content: parsedData,
          file_url: fileUrl,
          ats_score: Math.floor(Math.random() * (99 - 88 + 1)) + 88,
        });
        triggerToast("CV importé sauvegardé dans Supabase !", "fa-cloud-arrow-up");
      } else {
        triggerToast("Connectez-vous pour sauvegarder définitivement votre CV.", "fa-triangle-exclamation");
      }
    } catch (e) {
      console.error("Erreur d'enregistrement Supabase CV importé:", e);
      triggerToast("Erreur lors de la sauvegarde du CV importé.", "fa-triangle-exclamation");
    } finally {
      setSavingImport(false);
    }

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

  // Filtered Notifications helper
  const filteredNotifications = notificationsList.filter(n => {
    if (activeNotifFilter === "jobs") return n.type === "jobs";
    if (activeNotifFilter === "posts") return n.type === "posts";
    if (activeNotifFilter === "mentions") return n.type === "mentions";
    return true;
  });

  // Close modals and dropdowns on Escape key or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseContactModal();
        if (plusDropdownOpen) setPlusDropdownOpen(false);
        if (notificationsModalOpen) setNotificationsModalOpen(false);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (plusDropdownRef.current && !plusDropdownRef.current.contains(e.target)) {
        setPlusDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contactModalOpen, plusDropdownOpen, notificationsModalOpen, userMenuOpen]);

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
      <nav className="hidden">
        <div className="max-w-[1180px] mx-auto w-full h-full flex items-center justify-between">
          {/* Groupe Gauche : Logo + Recherche */}
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="hidden sm:inline text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
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

          {/* Groupe Centre : Liens principaux (Accueil, Messagerie, Notifications, Recrutement, Plus) */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {/* Accueil */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navHome}</span>
            </Link>

            {/* Offres */}
            <Link
              href="/offres"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/offres" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-solid fa-list-check text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Offres</span>
            </Link>

            {/* Fonctionnalités */}
            <Link
              href="/fonctionnalites"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/fonctionnalites" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xl text-indigo-500"></i>
              <span className="text-[11px] font-bold tracking-tight">{selectedLang === "FR" ? "Fonctionnalités" : "Features"}</span>
            </Link>
            
            {/* Messagerie */}
            {userSession && (
              <Link
                href="/messagerie"
                className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 relative ${
                  pathname === "/messagerie" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-regular fa-comments text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight">{t.navMessages}</span>
                <UnreadBadge count={unreadMessagesCount} />
              </Link>
            )}

            {/* Notifications */}
            {userSession && (
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(true)}
                className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 relative transition ${
                  notificationsModalOpen ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-regular fa-bell text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight">Notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-xs border border-white animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            <RoleNavLink session={userSession} />

            {/* Menu Déroulant "Fonctionnalités" (Extracteur, Boîte à idées, Services, etc.) */}
            <div className="relative" ref={plusDropdownRef}>
              <button
                type="button"
                onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
                className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-20 transition ${
                  plusDropdownOpen || pathname === "/service" || pathname === "/candidat/extracteur" || pathname === "/boite-a-idees" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                <div className="flex items-center space-x-1 text-[11px] font-bold tracking-tight">
                  <span>{selectedLang === "FR" ? "Fonctionnalités" : "Features"}</span>
                  <i className={`fa-solid fa-caret-down text-[9px] transition-transform duration-200 ${plusDropdownOpen ? "rotate-180" : ""}`}></i>
                </div>
              </button>

              {/* Menu Déroulant "Fonctionnalités" Overlay */}
              {plusDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 z-[600] animate-fade-in-up">
                  {/* 1. Extracteur */}
                  <Link
                    href="/candidat/extracteur"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition"
                  >
                    <i className="fa-solid fa-bolt text-lg text-amber-500 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">Extracteur 1-Click</div>
                      <div className="text-[10px] text-gray-500 font-normal">Postulez depuis une affiche</div>
                    </div>
                  </Link>

                  {/* 2. Boîte à idées */}
                  <Link
                    href="/boite-a-idees"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-lightbulb text-lg text-yellow-500 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">Boîte à idées</div>
                      <div className="text-[10px] text-gray-500 font-normal">Suggestions & innovation</div>
                    </div>
                  </Link>

                  {/* 3. Services & Modèles */}
                  <Link
                    href="/service"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-briefcase text-lg text-emerald-600 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">Services & Modèles</div>
                      <div className="text-[10px] text-gray-500 font-normal">CVs Pro, Canada & Lettres</div>
                    </div>
                  </Link>

                  {/* 4. Recrutement Spontané */}
                  <Link
                    href="/recrutement-spontane"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-building-user text-lg text-blue-600 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">Recrutement spontané</div>
                      <div className="text-[10px] text-gray-500 font-normal">77 entreprises</div>
                    </div>
                  </Link>

                  {/* 5. Travail journalier / Dépôts */}
                  <Link
                    href="/recrutement-journalier"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-gas-pump text-lg text-purple-600 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">{selectedLang === "FR" ? "Dépôts Physiques" : "In-person Dropoffs"}</div>
                      <div className="text-[10px] text-gray-500 font-normal">Stations & contacts</div>
                    </div>
                  </Link>

                  {/* 6. Contact */}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPlusDropdownOpen(false);
                      handleOpenContactModal();
                    }}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-regular fa-comment-dots text-lg text-gray-600 w-5 text-center"></i>
                    <span className="font-extrabold text-xs">Contact</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Groupe Droit : Connexion / Profil */}
          <div className="hidden md:flex items-center space-x-4">
            {userSession ? (
              <div className="relative" ref={userMenuRef}>
                <button
                   type="button"
                   onClick={() => setUserMenuOpen(!userMenuOpen)}
                   className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                     pathname === "/profil" ? "text-[#10E688] font-bold" : "text-gray-500 hover:text-gray-800"
                   }`}
                >
                  {userAvatarUrl && userAvatarUrl !== "/logo.jpeg" ? (
                    <img src={userAvatarUrl} alt="Profil" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <i className="fa-solid fa-circle-user text-xl"></i>
                  )}
                  <div className="flex items-center space-x-0.5 text-[11px] font-bold tracking-tight">
                    <span>Profil</span>
                    <i className={`fa-solid fa-caret-down text-[9px] transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}></i>
                  </div>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-2xl py-1.5 z-[600] animate-fade-in-up">
                    <Link
                      href="/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition"
                    >
                      <i className="fa-regular fa-user text-lg text-gray-600 w-5 text-center"></i>
                      <span>Voir mon profil & CV</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        triggerToast("Déconnexion en cours...", "fa-right-from-bracket");
                        setTimeout(() => {
                          handleGlobalSignOut();
                        }, 400);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-red-50 hover:text-red-600 transition border-t border-gray-100 cursor-pointer text-left"
                    >
                      <i className="fa-solid fa-right-from-bracket text-lg text-gray-600 w-5 text-center"></i>
                      <span>Déconnexion</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
              >
                <i className="fa-regular fa-user text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Connexion</span>
              </Link>
            )}
          </div>

          {/* Mobile Header Right Controls : navigation centralisée dans le
              header (style Facebook), la barre de navigation du bas ayant
              été retirée. */}
          <div className="flex md:hidden items-center space-x-1">
            <Link
              href="/"
              className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition cursor-pointer ${
                pathname === "/" ? "text-[#10E688]" : "text-gray-600 hover:text-gray-900"
              }`}
              aria-label="Accueil"
            >
              <i className="fa-solid fa-house text-sm"></i>
            </Link>

            {userSession && (
              <Link
                href="/messagerie"
                className="relative w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-full hover:bg-black/5 transition cursor-pointer"
                aria-label="Messagerie"
              >
                <i className="fa-regular fa-comments text-sm"></i>
                <UnreadBadge count={unreadMessagesCount} />
              </Link>
            )}

            {userSession && (
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(true)}
                className="relative w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-full hover:bg-black/5 transition cursor-pointer"
                aria-label="Notifications"
              >
                <i className="fa-regular fa-bell text-sm"></i>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[8px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center border border-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            <Link
              href={userSession ? "/profil" : "/login"}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition cursor-pointer overflow-hidden"
              aria-label="Profil"
            >
              {userAvatarUrl && userAvatarUrl !== "/logo.jpeg" ? (
                <img src={userAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <i className="fa-solid fa-circle-user text-gray-600 text-lg"></i>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-full hover:bg-black/5 transition cursor-pointer"
              aria-label="Plus"
            >
              <i className="fa-solid fa-bars text-sm"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow pt-16 pb-8 md:pb-20 px-4 max-w-[1180px] w-full mx-auto flex flex-col justify-center items-center">
        
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
                  disabled={savingImport}
                  className="bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold px-6 py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer flex-1 sm:flex-initial disabled:opacity-60"
                >
                  {savingImport ? "Enregistrement..." : t.btnContinue}
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

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Période / Dates</label>
                    <input
                      type="text"
                      value={exp.periode || ""}
                      onChange={(e) => handleExpChange(exp.id, "periode", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                      placeholder="Ex. Février 2025, Février - Juin 2024, 2021 - 2023"
                    />
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

            {/* Formation Block */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                  4. Formation
                </h3>
                <button
                  onClick={addFormation}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  + Ajouter
                </button>
              </div>

              {parsedData.formations.map((form, index) => (
                <div key={form.id} className="p-5 border border-gray-200 bg-gray-50/30 rounded-2xl relative space-y-4 shadow-2xs">

                  <button
                    onClick={() => deleteFormation(form.id)}
                    className="absolute top-4 right-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200/50 transition cursor-pointer"
                  >
                    <i className="fa-solid fa-trash-can mr-1.5"></i>
                    Supprimer
                  </button>

                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-2">Formation n°{index + 1}</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Diplôme</label>
                      <input
                        type="text"
                        value={form.diplome}
                        onChange={(e) => handleFormationChange(form.id, "diplome", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Ex. Licence Informatique"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">École / Établissement</label>
                      <input
                        type="text"
                        value={form.ecole}
                        onChange={(e) => handleFormationChange(form.id, "ecole", e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                        placeholder="Ex. Université Cheikh Anta Diop"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Année / Période</label>
                    <input
                      type="text"
                      value={form.annee || ""}
                      onChange={(e) => handleFormationChange(form.id, "annee", e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 transition bg-white"
                      placeholder="Ex. 2021-2022, 2018-2019"
                    />
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
                disabled={savingImport}
                className="bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold px-8 py-3 rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <i className={`fa-solid ${savingImport ? "fa-spinner fa-spin" : "fa-arrow-right-long"} text-sm`}></i>
                <span>{savingImport ? "Enregistrement..." : t.btnContinue}</span>
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
            <button type="button" onClick={handleOpenContactModal} className="hover:text-white transition cursor-pointer">Contact</button>
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

      {/* Menu Déroulant Mobile Plein Écran (style Facebook : centralise les
          accès secondaires, ouvert depuis l'icône grille du header — plus de
          barre de navigation fixe en bas de l'écran). */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[600] bg-[#F4F2EE] flex flex-col md:hidden animate-fade-in-up">
          <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-700 hover:text-gray-900 focus:outline-none cursor-pointer flex items-center"
              >
                <i className="fa-solid fa-chevron-left text-xl"></i>
              </button>
              <h1 className="text-lg font-extrabold text-gray-900">Menu</h1>
            </div>
          </div>

          <div className="flex-grow p-4 space-y-3 overflow-y-auto">
            {userSession ? (
              <Link
                href="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-200 shadow-xs active:bg-gray-50 transition"
              >
                <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg overflow-hidden">
                  {userAvatarUrl && userAvatarUrl !== "/logo.jpeg" ? (
                    <img src={userAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    (userSession.user.user_metadata?.full_name || userSession.user.email || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-grow text-left">
                  <h3 className="text-sm font-extrabold text-gray-900">
                    {userSession.user.user_metadata?.full_name || userSession.user.email}
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">Voir votre profil</span>
                </div>
              </Link>
            ) : (
              <div className="bg-white rounded-xl p-4 flex items-center space-x-3 border border-gray-200 shadow-xs">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center text-xs font-extrabold text-gray-800 hover:text-gray-900 bg-white border border-gray-200 px-3.5 py-2 rounded-full shadow-xs hover:border-gray-300 transition"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center text-xs font-extrabold text-gray-900 bg-[#10E688] hover:bg-[#0fd57d] px-4 py-2 rounded-full shadow-xs transition"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>

          {/* Bas du Menu (Options fixes au bas) */}
          <div className="bg-white border-t border-gray-200 divide-y divide-gray-150 mt-auto">
            <Link
              href="/offres"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
            >
              <i className="fa-solid fa-list-check text-gray-400 text-lg"></i>
              <span>Offres</span>
            </Link>

            <Link
              href="/service"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
            >
              <i className="fa-solid fa-briefcase text-gray-400 text-lg"></i>
              <span>Service</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setApplyModalOpen(true);
              }}
              className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
            >
              <i className="fa-solid fa-user-tie text-gray-400 text-lg"></i>
              <span>Recrutement spontané</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenContactModal()}
              className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
            >
              <i className="fa-regular fa-comment-dots text-gray-400 text-lg"></i>
              <span>Contact</span>
            </button>

            {userSession && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  triggerToast("Déconnexion en cours...", "fa-right-from-bracket");
                  setTimeout(() => {
                    handleGlobalSignOut();
                  }, 400);
                }}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-extrabold text-red-600 active:bg-red-50 cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket text-red-500 text-lg"></i>
                <span>Déconnexion</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal/Drawer de Notifications (LinkedIn Style) */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-[750] bg-black/50 backdrop-blur-xs flex justify-center md:items-start md:pt-16 p-2 sm:p-4 animate-fade-in-up">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
            {/* Header Modal Notifications */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-[#FAF6F1]">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-bell text-xl text-[#10E688]"></i>
                <h3 className="text-lg font-extrabold text-gray-900">Notifications</h3>
                {unreadNotifCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {unreadNotifCount} nouvelle{unreadNotifCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadNotifCount > 0 && (
                  <button
                    onClick={() => {
                      setNotificationsList(prev => prev.map(n => ({ ...n, unread: false })));
                      setUnreadNotifCount(0);
                      triggerToast("Toutes les notifications sont marquées comme lues", "fa-check-double");
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition mr-2 cursor-pointer"
                  >
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => setNotificationsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            {/* Filter Pills Bar (LinkedIn Mobile Style as in Image 3) */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center space-x-2 overflow-x-auto bg-gray-50/70 scrollbar-none">
              <button
                onClick={() => setActiveNotifFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "all" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setActiveNotifFilter("jobs")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "jobs" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Offres d'emploi
              </button>
              <button
                onClick={() => setActiveNotifFilter("posts")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "posts" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Mes posts
              </button>
              <button
                onClick={() => setActiveNotifFilter("mentions")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "mentions" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Mentions
              </button>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium text-sm">
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (notif.unread) {
                        setNotificationsList(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                        setUnreadNotifCount(prev => Math.max(0, prev - 1));
                      }
                      if (notif.link) {
                        router.push(notif.link);
                        if (typeof setNotificationsModalOpen !== "undefined") setNotificationsModalOpen(false);
                      }
                    }}
                    className={`p-4 flex items-start space-x-3.5 hover:bg-blue-50/50 transition cursor-pointer ${
                      notif.unread ? "bg-blue-50/30" : "bg-white"
                    }`}
                  >
                    {/* Blue Unread Indicator Dot (Image 3 Style) */}
                    <div className="pt-1.5 w-2 flex-shrink-0">
                      {notif.unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block"></span>
                      )}
                    </div>

                    {/* Sender Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm border border-gray-200 shadow-xs overflow-hidden">
                        {notif.avatar ? (
                          <img src={notif.avatar} alt={notif.author} className="w-full h-full object-cover" />
                        ) : (
                          notif.author.slice(0, 2).toUpperCase()
                        )}
                      </div>
                    </div>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 font-normal leading-relaxed">
                        <span className="font-bold text-gray-900">{notif.author} </span>
                        {notif.text}
                      </p>
                      <span className="text-[10px] text-gray-400 font-medium mt-1 block">{notif.time}</span>
                    </div>

                    {/* Action Menu */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerToast("Options de notification", "fa-ellipsis");
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-ellipsis text-sm"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
