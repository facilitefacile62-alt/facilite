/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import DiagnosticModal from "@/components/DiagnosticModal";

// --- DICTIONNAIRE DE TRADUCTION COMPLET ---
const translations = {
  FR: {
    navHome: "Accueil",
    navService: "Service",
    navMessages: "Messagerie",
    navRecruitment: "Recrutement Spontané",
    navContact: "Contactez-nous",
    navLogin: "Se connecter",
    recruitmentModalTitle: "Recrutement Spontané",
    recruitmentModalSubtitle: "Envoyez-nous votre profil pour de futures opportunités.",
    recruitmentLabelCV: "Votre CV (PDF, DOCX)",
    recruitmentUploadPlaceholder: "Cliquez ou glissez-déposez votre CV ici",
    recruitmentLabelCoverLetter: "Message d'accompagnement",
    recruitmentPlaceholderCoverLetter: "Parlez-nous de vos motivations et de vos compétences...",
    recruitmentSuccessTitle: "Candidature reçue !",
    recruitmentSuccessDesc: "Nous avons bien reçu votre candidature spontanée. Notre équipe RH l'étudiera avec la plus grande attention.",
    recruitmentSubmit: "Soumettre ma candidature",
    recruitmentSending: "Envoi de la candidature...",
    searchPlaceholder: "Rechercher une offre d'emploi...",
    searchNoResults: "Aucune offre ne correspond à vos critères.",
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
    footerAboutTitle: "À propos de Facilite",
    footerAboutDesc: "Facilite est votre allié de confiance pour concevoir des CV percutants et professionnels. Grâce à nos outils intuitifs et nos modèles optimisés, propulsez votre carrière et décrochez l'emploi de vos rêves en quelques clics.",
    footerSupportTitle: "Horaires & Support",
    footerWeekdays: "Lundi - Vendredi",
    footerWeekends: "Samedi - Dimanche",
    footerStayInTouch: "Restez en contact avec nous",
    footerFollowUs: "Suivez-nous sur nos réseaux sociaux pour ne rien rater de nos actualités.",
    footerCopyright: "© 2026 Facilite. Tous droits réservés.",
    toastLangFR: "Langue modifiée en Français",
    toastLangGB: "Language changed to English",
    
    // Job Board specific
    jobBoardTitle: "Fil d'attente des offres d'emploi",
    jobBoardSubtitle: "Découvrez les dernières opportunités et postulez en quelques secondes.",
    searchJobPlaceholder: "Titre du poste, mots-clés...",
    filterLocation: "Localisation",
    filterContract: "Contrat",
    allLocations: "Toutes les villes",
    allContracts: "Tous les contrats",
    profileTitle: "Macoumba Samak",
    profileSubtitle: "Étudiant(e) à lycée de pikine",
    profileLocation: "Pikine, Région de Dakar",
    profileExperienceBtn: "+ Expérience",
    statsTitle: "Statistiques",
    statsViews: "Vues du profil",
    statsImpressions: "Impressions du post",
    premiumPromoTitle: "Boostez votre recherche d'emploi",
    premiumPromoText: "Réactivez Premium : - 50 %",
    applyNow: "Postuler rapidement",
    applySuccess: "Candidature envoyée avec succès pour le poste de ",
    createCvRequired: "Vous devez disposer d'un CV professionnel pour postuler. Souhaitez-vous concevoir un CV sur nos modèles ?",
    createCvBtn: "Créer mon CV maintenant",
    trendingJobsTitle: "Offres recommandées",
    noCvTitle: "CV requis pour postuler",
  },
  GB: {
    navHome: "Home",
    navService: "Service",
    navMessages: "Messaging",
    navRecruitment: "Spontaneous Application",
    navContact: "Contact us",
    navLogin: "Sign in",
    recruitmentModalTitle: "Spontaneous Application",
    recruitmentModalSubtitle: "Send us your profile for future opportunities.",
    recruitmentLabelCV: "Your CV (PDF, DOCX)",
    recruitmentUploadPlaceholder: "Click or drag & drop your CV here",
    recruitmentLabelCoverLetter: "Cover Message",
    recruitmentPlaceholderCoverLetter: "Tell us about your motivations and skills...",
    recruitmentSuccessTitle: "Application Received!",
    recruitmentSuccessDesc: "We have received your spontaneous application. Our HR team will review it with the utmost care.",
    recruitmentSubmit: "Submit My Application",
    recruitmentSending: "Sending Application...",
    searchPlaceholder: "Search job offers...",
    searchNoResults: "No jobs match your search criteria.",
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
    footerAboutTitle: "About Facilite",
    footerAboutDesc: "Facilite is your trusted ally for designing impactful and professional CVs. Thanks to our intuitive tools and optimized templates, propel your career and land your dream job in just a few clicks.",
    footerSupportTitle: "Hours & Support",
    footerWeekdays: "Monday - Friday",
    footerWeekends: "Saturday - Sunday",
    footerStayInTouch: "Stay in touch with us",
    footerFollowUs: "Follow us on our social networks to not miss any of our news.",
    footerCopyright: "© 2026 Facilite. All rights reserved.",
    toastLangFR: "Langue modifiée en Français",
    toastLangGB: "Language changed to English",
    
    // Job Board specific
    jobBoardTitle: "Job Opportunity Feed",
    jobBoardSubtitle: "Browse the latest job openings and apply in a few clicks.",
    searchJobPlaceholder: "Job title, keywords...",
    filterLocation: "Location",
    filterContract: "Contract",
    allLocations: "All locations",
    allContracts: "All contracts",
    profileTitle: "Macoumba Samak",
    profileSubtitle: "Student at Lycée de Pikine",
    profileLocation: "Pikine, Dakar Region",
    profileExperienceBtn: "+ Experience",
    statsTitle: "Statistics",
    statsViews: "Profile views",
    statsImpressions: "Post impressions",
    premiumPromoTitle: "Boost your job search",
    premiumPromoText: "Reactivate Premium: - 50 %",
    applyNow: "Quick Apply",
    applySuccess: "Application successfully sent for the position of ",
    createCvRequired: "You need a professional resume to apply. Would you like to create one using our templates?",
    createCvBtn: "Create My Resume Now",
    trendingJobsTitle: "Recommended Jobs",
    noCvTitle: "Resume required to apply",
  }
};

const initialJobs = [
  {
    id: 1,
    titleFR: "Conseiller Clientèle Télécom",
    titleEN: "Telecom Customer Advisor",
    company: "Orange Sénégal",
    logoColor: "bg-orange-500",
    initials: "OS",
    location: "Dakar",
    timeFR: "Il y a 2 heures",
    timeEN: "2 hours ago",
    contract: "CDI",
    descFR: "Gérer le portefeuille client, répondre aux requêtes téléphoniques et par chat, et promouvoir les nouveaux forfaits mobiles et offres internet en français et wolof.",
    descEN: "Manage customer portfolio, answer calls and chats, and promote new mobile plans and internet packages in French and Wolof.",
    tags: ["Dakar", "CDI", "Full-time"],
    salary: "320 000 FCFA / mois"
  },
  {
    id: 2,
    titleFR: "Développeur Front-End React / Next.js",
    titleEN: "React / Next.js Front-End Developer",
    company: "Facilite Corporation",
    logoColor: "bg-emerald-500",
    initials: "FC",
    location: "Pikine",
    timeFR: "Il y a 5 heures",
    timeEN: "5 hours ago",
    contract: "Stage",
    descFR: "Participer à la conception et à l'optimisation de nos interfaces de CV interactifs. Collaboration étroite avec l'équipe design pour un rendu Pixel-Perfect.",
    descEN: "Participate in designing and optimizing our interactive CV interfaces. Work closely with the design team for a Pixel-Perfect rendering.",
    tags: ["Pikine", "Stage", "Hybride"],
    salary: "150 000 FCFA / mois"
  },
  {
    id: 3,
    titleFR: "Comptable & Gestionnaire de Paie",
    titleEN: "Accountant & Payroll Administrator",
    company: "Senelec",
    logoColor: "bg-blue-600",
    initials: "SL",
    location: "Dakar",
    timeFR: "Hier",
    timeEN: "Yesterday",
    contract: "CDI",
    descFR: "Supervision des écritures comptables mensuelles, traitement de la paie du personnel sénégalais, établissement des déclarations fiscales et sociales.",
    descEN: "Supervision of monthly accounting entries, payroll processing for Senegalese staff, preparation of tax and social security declarations.",
    tags: ["Dakar", "CDI", "On-site"],
    salary: "450 000 FCFA / mois"
  },
  {
    id: 4,
    titleFR: "Chargé de Clientèle & Support Utilisateurs",
    titleEN: "Customer Support Associate",
    company: "Wave Mobile Money",
    logoColor: "bg-sky-400",
    initials: "W",
    location: "Thies",
    timeFR: "Il y a 2 jours",
    timeEN: "2 days ago",
    contract: "CDD",
    descFR: "Fournir une assistance téléphonique rapide et claire aux agents et utilisateurs de l'application Wave. Résolution d'incidents techniques de niveau 1.",
    descEN: "Provide quick and clear phone assistance to agents and users of the Wave app. Resolution of level 1 technical incidents.",
    tags: ["Thies", "CDD", "Plein temps"],
    salary: "280 000 FCFA / mois"
  },
  {
    id: 5,
    titleFR: "Assistant Administratif H/F",
    titleEN: "Administrative Assistant M/F",
    company: "Bred Sénégal",
    logoColor: "bg-indigo-600",
    initials: "BS",
    location: "Dakar",
    timeFR: "Il y a 3 jours",
    timeEN: "3 days ago",
    contract: "CDD",
    descFR: "Secrétariat classique, accueil des partenaires, gestion de l'agenda de la direction générale et organisation logistique des déplacements d'affaires.",
    descEN: "Classic secretarial duties, welcoming partners, managing executive schedule, and logistical organization of business travel.",
    tags: ["Dakar", "CDD", "Office"],
    salary: "250 000 FCFA / mois"
  }
];

export default function Home() {
  const pathname = usePathname();
  // --- ÉTATS GÉNÉRAUX ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("FR");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // --- ÉTATS EXPÉRIENCE (LINKEDIN STYLE) ---
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [experiences, setExperiences] = useState([]);
  // Accordéon de la carte Expérience : replié/déplié + affichage partiel (2 plus récentes)
  const [experienceExpanded, setExperienceExpanded] = useState(true);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expCompany, setExpCompany] = useState("");
  const [expLocation, setExpLocation] = useState("");
  const [expLocationType, setExpLocationType] = useState("Sur site");
  const [expEmploymentType, setExpEmploymentType] = useState("Temps plein");
  const [expIsCurrent, setExpIsCurrent] = useState(true);
  const [expStartMonth, setExpStartMonth] = useState("juillet");
  const [expStartYear, setExpStartYear] = useState("2026");
  const [expSkills, setExpSkills] = useState([]);
  const [expSkillInput, setExpSkillInput] = useState("");

  // Spontaneous Recruitment Modal
  const [recruitmentModalOpen, setRecruitmentModalOpen] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [isRecruitmentSubmitting, setIsRecruitmentSubmitting] = useState(false);
  const [recruitmentFormSubmitted, setRecruitmentFormSubmitted] = useState(false);
  const [recruitmentFile, setRecruitmentFile] = useState(null);
  const [recruitmentFormData, setRecruitmentFormData] = useState({
    name: "",
    email: "",
    message: ""
  });
  const fileInputRef = useRef(null);
  const plusDropdownRef = useRef(null);

  // Notifications System (LinkedIn Style)
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState("all");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });

  // CV Required Apply Modal
  const [noCvModalOpen, setNoCvModalOpen] = useState(false);
  const [selectedJobToApply, setSelectedJobToApply] = useState(null);

  // Diagnostic CV Modal State
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);

  // Search and Filter States for Job Board
  const [jobs, setJobs] = useState(initialJobs);
  const [keyword, setKeyword] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [displayLimit, setDisplayLimit] = useState(30);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const t = translations[selectedLang] || translations.FR;

  // Sync session and profile with Supabase
  const [userSession, setUserSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    async function loadSessionAndProfile(session) {
      setUserSession(session);

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
          setExperiences(profile.experiences || []);
        } else {
          setUserProfile({
            full_name: session.user.email?.split("@")[0],
            headline: "",
            location: "",
            profile_views: 0,
            post_impressions: 0
          });
        }
      } else {
        setUserProfile(null);
        setExperiences([]);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadSessionAndProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionAndProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddExperience = (e) => {
    e.preventDefault();
    if (!expTitle || !expCompany) {
      triggerToast("Veuillez remplir les champs obligatoires (*)", "fa-triangle-exclamation");
      return;
    }
    
    const newExp = {
      id: Date.now(),
      title: expTitle,
      company: expCompany,
      location: expLocation,
      locationType: expLocationType,
      employmentType: expEmploymentType,
      isCurrent: expIsCurrent,
      startMonth: expStartMonth,
      startYear: expStartYear,
      skills: expSkills
    };

    const updatedExps = [newExp, ...experiences];
    setExperiences(updatedExps);
    localStorage.setItem("user_experiences", JSON.stringify(updatedExps));
    
    // Clear form
    setExpTitle("");
    setExpCompany("");
    setExpLocation("");
    setExpLocationType("Sur site");
    setExpEmploymentType("Temps plein");
    setExpIsCurrent(true);
    setExpStartMonth("juillet");
    setExpStartYear("2026");
    setExpSkills([]);
    setExpSkillInput("");
    
    setExperienceModalOpen(false);
    triggerToast("Expérience ajoutée avec succès !", "fa-briefcase");
  };

  const handleDeleteExperience = (id) => {
    const updatedExps = experiences.filter(exp => exp.id !== id);
    setExperiences(updatedExps);
    localStorage.setItem("user_experiences", JSON.stringify(updatedExps));
    triggerToast("Expérience supprimée.", "fa-trash-can");
  };

  const handleAddSkill = () => {
    if (expSkillInput.trim() && !expSkills.includes(expSkillInput.trim())) {
      setExpSkills([...expSkills, expSkillInput.trim()]);
      setExpSkillInput("");
    }
  };

  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => {
      setToast({ show: false, message: "", icon: "fa-circle-info" });
    }, 3500);
  };

  // --- FILTRAGE DES OFFRES D'EMPLOI ---
  useEffect(() => {
    let filtered = initialJobs;

    // Filtre mot-clé (titre ou entreprise ou description)
    if (keyword.trim()) {
      const key = keyword.toLowerCase();
      filtered = filtered.filter(job => {
        const title = (selectedLang === "FR" ? job.titleFR : job.titleEN).toLowerCase();
        const desc = (selectedLang === "FR" ? job.descFR : job.descEN).toLowerCase();
        return title.includes(key) || job.company.toLowerCase().includes(key) || desc.includes(key);
      });
    }

    // Filtre Localisation
    if (locationFilter) {
      filtered = filtered.filter(job => job.location.toLowerCase() === locationFilter.toLowerCase());
    }

    // Filtre Contrat
    if (contractFilter) {
      filtered = filtered.filter(job => job.contract.toLowerCase() === contractFilter.toLowerCase());
    }

    setJobs(filtered);
  }, [keyword, locationFilter, contractFilter, selectedLang]);

  // Infinite Scroll / Looping Feed listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000) {
        setDisplayLimit((prev) => prev + 15);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getLoopedJobs = () => {
    if (jobs.length === 0) return [];
    const looped = [];
    for (let i = 0; i < displayLimit; i++) {
      const originalJob = jobs[i % jobs.length];
      looped.push({
        ...originalJob,
        loopId: `${originalJob.id}-${i}`
      });
    }
    return looped;
  };

  const [authRequiredModalOpen, setAuthRequiredModalOpen] = useState(false);

  const handleApplyClick = (job) => {
    setSelectedJobToApply(job);
    if (!userSession) {
      // Si déconnecté, bloquer la candidature et afficher le modal de création de compte
      setAuthRequiredModalOpen(true);
    } else {
      setNoCvModalOpen(true);
    }
  };

  const handleConfirmApply = () => {
    setNoCvModalOpen(false);
    // Redirect to creator page where they can build their CV
    window.location.href = "/creer-cv";
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setRecruitmentFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setRecruitmentFile(e.dataTransfer.files[0]);
    }
  };

  const handleOpenRecruitmentModal = (e) => {
    if (e) e.preventDefault();
    setRecruitmentModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCloseRecruitmentModal = () => {
    setRecruitmentModalOpen(false);
    setTimeout(() => {
      setRecruitmentFormSubmitted(false);
      setIsRecruitmentSubmitting(false);
      setRecruitmentFile(null);
      setRecruitmentFormData({ name: "", email: "", message: "" });
    }, 300);
  };

  const handleRecruitmentSubmit = (e) => {
    e.preventDefault();
    setIsRecruitmentSubmitting(true);
    setTimeout(() => {
      setIsRecruitmentSubmitting(false);
      setRecruitmentFormSubmitted(true);
      triggerToast(t.recruitmentSuccessTitle, "fa-paper-plane");
    }, 1200);
  };

  const handleOpenModal = (e) => {
    if (e) e.preventDefault();
    setContactModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCloseModal = () => {
    setContactModalOpen(false);
    setTimeout(() => {
      setFormSubmitted(false);
      setIsSubmitting(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 300);
  };

  const handleFormSubmit = (e) => {
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseModal();
        if (recruitmentModalOpen) handleCloseRecruitmentModal();
        if (noCvModalOpen) setNoCvModalOpen(false);
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
  }, [contactModalOpen, recruitmentModalOpen, noCvModalOpen, plusDropdownOpen, notificationsModalOpen, userMenuOpen]);

  return (
    <>
      {/* Toast Notification Top Floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <i className={`fa-solid ${toast.icon} text-[#10E688] text-xl`}></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) */}
      <nav className="bg-[#FAF6F1] px-4 md:px-6 py-2.5 shadow-sm fixed top-0 left-0 w-full z-50">
        <div className="max-w-[1180px] mx-auto w-full flex items-center justify-between">
          {/* Groupe Gauche : Logo + Recherche */}
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <div
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
              onClick={() => {
                if (window.location.pathname === "/") {
                  window.location.reload();
                } else {
                  window.location.href = "/";
                }
              }}
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </div>

            {/* Barre de recherche de la Navbar */}
            <div className="hidden md:block relative w-60 lg:w-72">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                  placeholder={t.searchPlaceholder}
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

            {/* Messagerie (Visible uniquement pour les utilisateurs connectés) */}
            {userSession && (
              <Link
                href="/messagerie"
                className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 relative ${
                  pathname === "/messagerie" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-regular fa-comments text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight">{t.navMessages}</span>
                <span className="absolute top-0.5 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </Link>
            )}

            {/* Notifications (Visibles uniquement pour les utilisateurs connectés) */}
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

            {/* Recrutement Spontané */}
            <a
              href="#"
              onClick={handleOpenRecruitmentModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-user-tie text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Recrutement</span>
            </a>

            {/* Plus Dropdown Menu (Service & Contact) */}
            <div className="relative" ref={plusDropdownRef}>
              <button
                type="button"
                onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
                className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                  plusDropdownOpen || pathname === "/service" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-solid fa-bars text-xl"></i>
                <div className="flex items-center space-x-1 text-[11px] font-bold tracking-tight">
                  <span>Plus</span>
                  <i className={`fa-solid fa-caret-down text-[9px] transition-transform duration-200 ${plusDropdownOpen ? "rotate-180" : ""}`}></i>
                </div>
              </button>

              {/* Menu Déroulant "Plus" Overlay */}
              {plusDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-gray-200 shadow-2xl py-1.5 z-[600] animate-fade-in-up">
                  <Link
                    href="/service"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition"
                  >
                    <i className="fa-solid fa-briefcase text-lg text-gray-600 w-5 text-center"></i>
                    <span>Service</span>
                  </Link>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPlusDropdownOpen(false);
                      handleOpenModal();
                    }}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition border-t border-gray-100"
                  >
                    <i className="fa-regular fa-comment-dots text-lg text-gray-600 w-5 text-center"></i>
                    <span>Contact</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Groupe Droit : Rendu conditionnel selon la session Supabase */}
          <div className="hidden md:flex items-center space-x-3">
            {userSession ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                    pathname === "/profil" ? "text-[#10E688] font-bold" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <i className="fa-solid fa-circle-user text-xl"></i>
                  <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Mon Profil</span>
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
                      <i className="fa-solid fa-right-from-bracket text-red-500 text-sm w-5 text-center"></i>
                      <span>Déconnexion</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-xs font-extrabold text-gray-800 hover:text-gray-900 bg-white border border-gray-200 px-3.5 py-2 rounded-full shadow-xs hover:border-gray-300 transition cursor-pointer"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-extrabold text-gray-900 bg-[#10E688] hover:bg-[#0fd57d] px-4 py-2 rounded-full shadow-xs transition cursor-pointer"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Header Right Controls (Image 2 style: Bell & Messagerie icons) */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Notification Bell Icon (Visible uniquement pour les utilisateurs connectés) */}
            {userSession && (
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(true)}
                className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs relative cursor-pointer"
                aria-label="Notifications"
              >
                <i className="fa-regular fa-bell text-sm"></i>
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            {/* Messagerie Icon (Visible uniquement pour les utilisateurs connectés) */}
            {userSession && (
              <Link
                href="/messagerie"
                className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs relative cursor-pointer"
                aria-label="Messagerie"
              >
                <i className="fa-regular fa-comments text-sm"></i>
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </Link>
            )}

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-blue-600 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Mobile Navigation Bar (LinkedIn Mobile Style as shown in Image 2) */}
        <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-[500] bg-[#FAF6F1] border-t border-gray-200 shadow-xl py-2 px-3 items-center justify-around">
          {/* Accueil */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 ${
              pathname === "/" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navHome}</span>
          </Link>

          {/* Service */}
          <Link
            href="/service"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 ${
              pathname === "/service" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <i className="fa-solid fa-briefcase text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navService}</span>
          </Link>

          {/* Messagerie (Visible uniquement pour les utilisateurs connectés) */}
          {userSession && (
            <Link
              href="/messagerie"
              className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 relative ${
                pathname === "/messagerie" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-regular fa-comments text-lg"></i>
              <span className="text-[9px] font-bold tracking-tight">{t.navMessages}</span>
              <span className="absolute top-0.5 right-2 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
            </Link>
          )}

          {/* Notifications (Visibles uniquement pour les utilisateurs connectés) */}
          {userSession && (
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800 relative"
            >
              <i className="fa-regular fa-bell text-lg"></i>
              <span className="text-[9px] font-bold tracking-tight">Notifs</span>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 right-1.5 bg-red-600 text-white text-[8px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center border border-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          )}

          {/* Plus */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-bars text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Plus</span>
          </button>
        </div>

        {/* Menu Déroulant Mobile Plein Écran */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[600] bg-[#F4F2EE] flex flex-col md:hidden animate-fade-in-up">
            {/* Entête du Menu */}
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
              
              <div className="flex items-center space-x-4 text-blue-600">
                <button
                  onClick={() => triggerToast("Tri...", "fa-arrow-up-down")}
                  className="hover:opacity-85 focus:outline-none cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-up-down text-lg"></i>
                </button>
                <button
                  onClick={() => triggerToast("Recherche...", "fa-magnifying-glass")}
                  className="hover:opacity-85 focus:outline-none cursor-pointer"
                >
                  <i className="fa-solid fa-magnifying-glass text-lg"></i>
                </button>
              </div>
            </div>

            {/* Corps du Menu */}
            <div className="flex-grow p-4 space-y-3 overflow-y-auto">
              {/* Card 1 : Profil (Rendu conditionnel selon la session) */}
              {userSession ? (
                <Link
                  href="/profil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-200 shadow-xs active:bg-gray-50 transition"
                >
                  {/* Cercle Avatar Violet */}
                  <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg">
                    {(userProfile?.full_name || userSession.user.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-grow text-left">
                    <h3 className="text-sm font-extrabold text-gray-900">
                      {userProfile?.full_name || userSession.user.email}
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

              {/* Card 2 : Inviter des amis */}
              <button
                type="button"
                onClick={() => {
                  triggerToast("Lien d'invitation copié !", "fa-heart");
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.origin);
                  }
                }}
                className="w-full bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-205 shadow-xs active:bg-gray-50 transition text-left cursor-pointer"
              >
                <span className="text-2xl flex-shrink-0">❤️</span>
                <span className="text-sm font-extrabold text-gray-950">Inviter des ami(e)s</span>
              </button>
            </div>

            {/* Bas du Menu (Options fixes au bas) */}
            <div className="bg-white border-t border-gray-200 divide-y divide-gray-150 mt-auto">
              {/* Option 1: Paramètres */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => triggerToast("Paramètres", "fa-gear")}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <i className="fa-solid fa-gear text-gray-400 text-lg"></i>
                    <span>Paramètres et confidentialité</span>
                  </div>
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </button>
              </div>

              {/* Option 2: Aide */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => triggerToast("Aide & Assistance", "fa-circle-question")}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <i className="fa-regular fa-circle-question text-gray-400 text-lg"></i>
                    <span>Aide et assistance</span>
                  </div>
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </button>
              </div>

              {/* Option 3: Ajouter un compte */}
              <button
                type="button"
                onClick={() => triggerToast("Ajouter un compte...", "fa-user-plus")}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-solid fa-user-plus text-gray-400 text-lg"></i>
                <span>Ajouter un compte</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Job Board Feed (LinkedIn Style) */}
      <main className="min-h-screen bg-[#F4F2EE] pt-[124px] md:pt-[76px] pb-16 px-4 md:px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col lg:flex-row gap-6 items-start justify-center">
          
          {/* --- COLONNE DE GAUCHE : Profil & Stats --- */}
          <aside className="hidden lg:flex lg:w-[215px] flex-shrink-0 flex-col gap-2 sticky top-[92px] lg:max-h-[calc(100vh-115px)] lg:pr-0.5">

            {/* Carte Profil (toujours visible, ne défile pas) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs flex-shrink-0">
              {/* Image de couverture en hauteur */}
              <Link
                href={userSession ? "/profil" : "/login"}
                className="h-16 bg-cover bg-center bg-no-repeat relative block cursor-pointer group"
                style={{ backgroundImage: `url('${userProfile?.cover_url || '/stellar-cover.png'}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-indigo-950/60 group-hover:opacity-75 transition"></div>
              </Link>
              
              <div className="px-3 pb-3.5 pt-0 relative flex flex-col items-center text-center">
                {/* Photo de profil (Logo ou Avatar personnalisé) */}
                <Link
                  href={userSession ? "/profil" : "/login"}
                  className="-mt-7 mb-2 relative z-10 w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-white block cursor-pointer group"
                >
                  <img
                    src={userProfile?.avatar_url || "/logo.jpeg"}
                    alt="Facilite Logo Profile"
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                </Link>
                
                <Link href={userSession ? "/profil" : "/login"} className="group">
                  <h2 className="text-sm font-extrabold text-gray-900 leading-tight group-hover:text-blue-600 transition">
                    {userProfile?.full_name || (userSession ? userSession.user.email : "Se connecter pour voir votre profil")}
                  </h2>
                </Link>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                  {userProfile?.headline || (userSession ? "Complétez votre profil" : "Créez votre CV en ligne")}
                </p>
                {(userProfile?.location || userSession) && (
                  <p className="text-[9px] text-gray-400 font-normal mt-0.5 mb-1.5">
                    {userProfile?.location || "Localisation non renseignée"}
                  </p>
                )}

                {/* Bouton Ajouter Expérience (visible uniquement si connecté) */}
                {userSession && (
                  <button
                    onClick={() => setExperienceModalOpen(true)}
                    className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-1 px-2.5 rounded-full text-[10px] transition flex items-center justify-center space-x-1 cursor-pointer bg-white"
                  >
                    <i className="fa-solid fa-plus text-[8px] text-gray-500"></i>
                    <span>{t.profileExperienceBtn}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Zone défilante : tout le reste de la barre latérale */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col space-y-2 pr-0.5">

            {/* Carte Expériences (Dynamique) */}
            {experiences.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex flex-col space-y-2.5">
                <button
                  type="button"
                  onClick={() => setExperienceExpanded((v) => !v)}
                  aria-expanded={experienceExpanded}
                  className="w-full flex justify-between items-center pb-1.5 border-b border-gray-100 cursor-pointer bg-transparent border-x-0 border-t-0 p-0 text-left group"
                >
                  <h3 className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider group-hover:text-blue-600 transition">
                    Expérience
                    <span className="ml-1 text-gray-400 font-bold normal-case tracking-normal">({experiences.length})</span>
                  </h3>
                  <i
                    className={`fa-solid fa-chevron-down text-gray-400 text-[10px] transition-transform duration-200 ${
                      experienceExpanded ? "rotate-180" : ""
                    }`}
                  ></i>
                </button>
                {experienceExpanded && (
                <div className="space-y-3">
                  {(showAllExperiences ? experiences : experiences.slice(0, 2)).map((exp) => (
                    <div key={exp.id} className="relative flex items-start space-x-2 text-left">
                      <div className="w-7 h-7 rounded bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-gray-200">
                        {exp.company.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-grow min-w-0 pr-4">
                        <h4 className="text-[10px] font-extrabold text-gray-900 truncate">{exp.title}</h4>
                        <p className="text-[9px] text-gray-700 font-bold truncate">{exp.company}</p>
                        <p className="text-[8px] text-gray-400 font-semibold mt-0.5">
                          {exp.startMonth} {exp.startYear} — {exp.isCurrent ? "Présent" : "Terminé"}
                        </p>
                        {exp.location && (
                          <p className="text-[8px] text-gray-400 font-semibold mt-0.5">
                            {exp.location} ({exp.locationType})
                          </p>
                        )}
                        {exp.skills && exp.skills.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {exp.skills.slice(0, 2).map((skill, sIdx) => (
                              <span key={sIdx} className="text-[7px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Bouton de suppression */}
                      <button
                        onClick={() => handleDeleteExperience(exp.id)}
                        className="text-gray-300 hover:text-red-500 transition p-0.5 cursor-pointer absolute top-0 right-0"
                        title="Supprimer cette expérience"
                      >
                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                      </button>
                    </div>
                  ))}

                  {/* Bouton "Voir plus" / "Voir moins" si plus de 2 expériences */}
                  {experiences.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowAllExperiences((v) => !v)}
                      className="w-full pt-1.5 border-t border-gray-100 text-[9px] font-extrabold text-blue-600 hover:text-blue-800 transition cursor-pointer bg-transparent border-x-0 border-b-0 flex items-center justify-center space-x-1"
                    >
                      <span>
                        {showAllExperiences
                          ? "Voir moins"
                          : `Voir plus (+${experiences.length - 2})`}
                      </span>
                      <i
                        className={`fa-solid fa-chevron-down text-[7px] transition-transform duration-200 ${
                          showAllExperiences ? "rotate-180" : ""
                        }`}
                      ></i>
                    </button>
                  )}
                </div>
                )}
              </div>
            )}

            {/* Conditionnel : Statistiques & Déconnexion uniquement si connecté, sinon Bloc Call-to-Action */}
            {userSession ? (
              <>
                {/* Carte Statistiques */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider">{t.statsTitle}</h3>
                    <i className="fa-solid fa-chevron-right text-gray-400 text-[10px] cursor-pointer"></i>
                  </div>
                  <div className="space-y-2 font-bold text-[11px]">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-gray-500">{t.statsViews}</span>
                      <span className="text-blue-600 font-extrabold text-xs">{userProfile?.profile_views ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-t border-gray-100">
                      <span className="text-gray-500">{t.statsImpressions}</span>
                      <span className="text-blue-600 font-extrabold text-xs">{userProfile?.post_impressions ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Carte Mon profil et mon CV */}
                <Link
                  href="/profil"
                  className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-2.5 px-3 shadow-xs hover:shadow-md transition cursor-pointer flex items-center space-x-2.5 group block"
                >
                  <i className="fa-regular fa-user text-base text-[#047857] font-bold group-hover:scale-110 transition transform"></i>
                  <span className="text-xs font-bold text-[#047857] tracking-tight">
                    Mon profil et mon CV
                  </span>
                </Link>

                {/* Bouton Déconnexion */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs flex items-center justify-start">
                  <button
                    onClick={() => {
                      triggerToast("Déconnexion en cours...", "fa-right-from-bracket");
                      setTimeout(() => {
                        handleGlobalSignOut();
                      }, 500);
                    }}
                    className="flex items-center space-x-2 text-[#4A5D78] hover:text-red-600 font-bold text-xs transition cursor-pointer bg-transparent border-none p-0 outline-none w-full text-left"
                  >
                    <i className="fa-solid fa-right-from-bracket text-sm"></i>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </>
            ) : (
              /* Bloc Call-to-Action pour visiteurs non connectés */
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-4 shadow-md space-y-3 border border-gray-700 text-left">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-[#10E688]/20 text-[#10E688] rounded-lg text-lg">🚀</span>
                  <h3 className="text-xs font-black text-white leading-tight">Créez un compte</h3>
                </div>
                <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                  Rejoignez Facilité pour enregistrer vos CVs, postuler en 1 clic et suivre l'impact de vos candidatures auprès des recruteurs.
                </p>
                <Link
                  href="/register"
                  className="block w-full py-2.5 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold text-xs text-center rounded-xl transition shadow-sm"
                >
                  S'inscrire gratuitement
                </Link>
              </div>
            )}

            </div>
          </aside>

          {/* --- COLONNE CENTRALE : Filtres & Fil d'attente d'offres --- */}
          <section className="w-full lg:w-[555px] flex-shrink-0 flex flex-col space-y-4">
            
            {/* Message d'accueil personnalisé si connecté */}
            {userSession && (
              <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-700 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center space-x-2">
                    <span>Salut, {userProfile?.full_name || userSession.user.user_metadata?.full_name || userSession.user.email?.split("@")[0]} !</span>
                    <span className="text-xl animate-bounce">👋</span>
                  </h2>
                  <p className="text-xs text-gray-300 font-medium">
                    Ravi de vous revoir. Découvrez les nouvelles offres et gérez vos CVs en toute simplicité.
                  </p>
                </div>
                <Link
                  href="/profil"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold text-xs rounded-xl transition shadow-xs flex-shrink-0"
                >
                  <span>Mon Profil</span>
                  <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </Link>
              </div>
            )}

            {/* Barre de Recherche Intégrée au Flux */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col space-y-3.5">
              <h3 className="text-sm font-extrabold text-gray-900">{t.jobBoardTitle}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Mot-clé */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <i className="fa-solid fa-magnifying-glass text-gray-400 text-xs"></i>
                  </span>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={t.searchJobPlaceholder}
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-600 transition"
                  />
                </div>
                
                {/* Localisation */}
                <div className="relative">
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-600 transition appearance-none cursor-pointer"
                  >
                    <option value="">{t.allLocations}</option>
                    <option value="dakar">Dakar</option>
                    <option value="pikine">Pikine</option>
                    <option value="thies">Thies</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-[10px]">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>

                {/* Contrat */}
                <div className="relative">
                  <select
                    value={contractFilter}
                    onChange={(e) => setContractFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-600 transition appearance-none cursor-pointer"
                  >
                    <option value="">{t.allContracts}</option>
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="stage">Stage</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500 text-[10px]">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des Offres d'emploi */}
            <div className="space-y-4">
              {getLoopedJobs().length > 0 ? (
                getLoopedJobs().map((job) => (
                  <div
                    key={job.loopId}
                    className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition duration-300 flex flex-col space-y-4"
                  >
                    {/* Header Offre */}
                    <div className="flex items-start space-x-3.5">
                      {/* Logo Entreprise (Initiale dans un carré de couleur) */}
                      <div className={`w-11 h-11 rounded-lg ${job.logoColor} flex items-center justify-center text-white font-extrabold text-sm shadow-xs flex-shrink-0`}>
                        {job.initials}
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <h4 className="text-sm font-extrabold text-gray-900 leading-snug">
                          {selectedLang === "FR" ? job.titleFR : job.titleEN}
                        </h4>
                        <p className="text-xs text-gray-700 font-bold mt-0.5">{job.company}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center space-x-1.5">
                          <span>{job.location}</span>
                          <span>•</span>
                          <span>{selectedLang === "FR" ? job.timeFR : job.timeEN}</span>
                        </p>
                      </div>

                      {/* Badge Contrat */}
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
                        {job.contract}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                      {selectedLang === "FR" ? job.descFR : job.descEN}
                    </p>

                    {/* Footer Offre */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                      <span className="text-xs font-black text-gray-800 bg-gray-50 border border-gray-150 px-3 py-1.5 rounded-lg">
                        💰 {job.salary}
                      </span>
                      
                      <button
                        onClick={() => handleApplyClick(job)}
                        className="bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-2 px-4 rounded-lg text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
                      >
                        <i className="fa-regular fa-paper-plane text-xs"></i>
                        <span>{t.applyNow}</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-500 font-bold shadow-xs">
                  <i className="fa-solid fa-folder-open text-3xl text-gray-300 mb-2"></i>
                  <p>{t.searchNoResults}</p>
                </div>
              )}
            </div>

          </section>

          {/* --- COLONNE DE DROITE : Offres recommandées & Publicité --- */}
          <aside className="w-full lg:w-[260px] flex-shrink-0 flex flex-col space-y-3 lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-115px)] lg:overflow-y-auto no-scrollbar lg:pr-0.5">
            
            {/* Offres Recommandées */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
              <h3 className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider mb-2.5">{t.trendingJobsTitle}</h3>
              
              <div className="space-y-2.5 font-bold text-[11px]">
                {initialJobs.slice(0, 3).map((job) => (
                  <div
                    key={`trend-${job.id}`}
                    onClick={() => handleApplyClick(job)}
                    className="group cursor-pointer flex flex-col space-y-0.5 hover:bg-gray-50 p-1.5 rounded-lg transition"
                  >
                    <span className="text-gray-955 font-extrabold group-hover:text-blue-600 transition truncate">
                      {selectedLang === "FR" ? job.titleFR : job.titleEN}
                    </span>
                    <span className="text-gray-500 text-[9px]">{job.company} — {job.location}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Aide et raccourcis rapides */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs text-center flex flex-col items-center space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                <i className="fa-regular fa-lightbulb text-base"></i>
              </div>
              <h4 className="text-[10px] font-extrabold text-gray-800">Prêt pour votre candidature ?</h4>
              <p className="text-[9px] text-gray-500 leading-relaxed font-semibold">
                Utilisez nos services de création pour générer des CV percutants optimisés pour les recruteurs.
              </p>
              <Link
                href="/service"
                className="w-full bg-[#E4B8F9] hover:bg-[#db9ff7] text-purple-950 font-extrabold py-1.5 px-3 rounded-lg text-[9px] transition text-center shadow-xs cursor-pointer block"
              >
                Concevoir mon CV
              </Link>
            </div>

            {/* Diagnostic CV Gratuit Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl border border-indigo-950 p-4.5 shadow-md text-center flex flex-col items-center space-y-3 relative overflow-hidden">
              {/* Badge GRATUIT */}
              <div className="absolute top-2.5 right-2.5 bg-emerald-400 text-emerald-950 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                GRATUIT
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <i className="fa-solid fa-stethoscope text-sm"></i>
              </div>
              <h4 className="text-xs font-black text-white">Diagnostic CV Gratuit</h4>
              <p className="text-[9px] text-indigo-250 leading-relaxed font-semibold">
                Importez ou prenez une photo de votre CV pour obtenir une analyse IA complète de votre design, vos mots-clés et votre score ATS.
              </p>
              <button
                type="button"
                onClick={() => setDiagnosticModalOpen(true)}
                className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold py-2 px-3 rounded-lg text-[10px] transition text-center shadow-md cursor-pointer block border-none focus:outline-none"
              >
                Diagnostiquer mon CV
              </button>
            </div>

          </aside>

        </div>
      </main>

      {/* Footer Éléments Sombre & Informations */}
      <footer className="bg-[#080E1E] text-gray-400 py-16 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Colonne 1 : À Propos */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2.5 mb-4">
              <img src="/logo.jpeg" alt="Logo" className="w-7 h-7 rounded-full object-cover" />
              <h3 className="text-white text-xl font-extrabold">{t.footerAboutTitle}</h3>
            </div>
            <p className="text-sm leading-relaxed mb-6 text-gray-400 font-medium">
              {t.footerAboutDesc}
            </p>
            <h4 className="text-white text-base font-bold mb-3">Liens utiles</h4>
            <div className="flex flex-col space-y-2.5 text-sm font-semibold">
              <a
                href="#"
                onClick={handleOpenModal}
                className="hover:text-[#10E688] transition-colors"
              >
                Contact
              </a>
              <Link
                href="/boite-a-idees"
                className="hover:text-[#10E688] transition-colors"
              >
                Boîte à idées
              </Link>
            </div>
          </div>

          {/* Colonne 2 : Horaires & Support */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-white text-lg font-bold mb-2">{t.footerSupportTitle}</h3>
            <div className="flex items-center space-x-3">
              <span className="p-2.5 bg-gray-900 rounded-xl text-[#10E688] border border-gray-800 w-11 h-11 flex items-center justify-center">
                <i className="fa-solid fa-phone text-lg"></i>
              </span>
              <a href="tel:+221771400832" className="text-white text-xl font-black hover:text-[#10E688] transition-colors">
                +221 77 140 08 32
              </a>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="https://wa.me/message/KQERLEMIO7LKL1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 bg-gray-900 rounded-xl border border-gray-800 w-11 h-11 flex items-center justify-center hover:border-green-500 transition-colors"
              >
                <img src="/whtsapp.jpeg" alt="WhatsApp" className="w-full h-full object-cover rounded-lg" />
              </a>
              <a
                href="https://wa.me/message/KQERLEMIO7LKL1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-base font-bold hover:text-green-500 transition-colors"
              >
                WhatsApp Direct
              </a>
            </div>
            <div className="flex items-center space-x-3 mb-2">
              <a
                href="mailto:facilitefacile@gmail.com"
                className="p-1 bg-gray-900 rounded-xl border border-gray-800 w-11 h-11 flex items-center justify-center hover:border-blue-500 transition-colors"
              >
                <img src="/email.png" alt="Email" className="w-full h-full object-contain" />
              </a>
              <a
                href="mailto:facilitefacile@gmail.com"
                className="text-white text-sm font-bold hover:text-blue-500 transition-colors truncate max-w-[200px]"
              >
                facilitefacile@gmail.com
              </a>
            </div>
          </div>

          {/* Colonne 3 : Réseaux & Newsletter */}
          <div className="flex flex-col">
            <h3 className="text-white text-lg font-bold mb-4">{t.footerStayInTouch}</h3>
            <p className="text-sm mb-6 text-gray-400 font-medium leading-relaxed">{t.footerFollowUs}</p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M9 8H7v3h2v9h4v-9h3.61L17 8h-3V6.23c0-.85.34-1.23 1.08-1.23H17V1H14.12C11.53 1 10 2.5 10 5v3z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="YouTube"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.388.555a3.002 3.002 0 0 0-2.11 2.108C0 8.03 0 12 0 12s0 3.97.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.48 20.5 12 20.5 12 20.5s7.52 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.97 24 12 24 12s0-3.97-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800/80 text-center text-xs text-gray-500 font-medium">
          <p>{t.footerCopyright}</p>
        </div>
      </footer>

      {/* Modal 1: CV Requis pour postuler */}
      {noCvModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target.id === "nocv-modal-wrapper") setNoCvModalOpen(false);
          }}
          id="nocv-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-md p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 animate-fade-in-up text-center space-y-6">
            <button
              onClick={() => setNoCvModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border border-amber-100 shadow-xs mx-auto">
              <i className="fa-solid fa-circle-exclamation text-3xl"></i>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-gray-900">{t.noCvTitle}</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                {t.createCvRequired}
              </p>
            </div>

            {selectedJobToApply && (
              <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl text-left">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Poste sélectionné</span>
                <span className="text-xs font-extrabold text-gray-800 block">
                  {selectedLang === "FR" ? selectedJobToApply.titleFR : selectedJobToApply.titleEN}
                </span>
                <span className="text-[10px] font-bold text-gray-500 block">{selectedJobToApply.company}</span>
              </div>
            )}

            <button
              onClick={handleConfirmApply}
              className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(16,230,136,0.3)] hover:shadow-[0_8px_20px_rgba(16,230,136,0.4)] cursor-pointer"
            >
              {t.createCvBtn}
            </button>
          </div>
        </div>
      )}

      {/* Modal 2: Contactez-nous */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target.id === "contact-modal-wrapper") handleCloseModal();
          }}
          id="contact-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] p-5 sm:p-7 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 animate-fade-in-up overflow-y-auto">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer z-10"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            {!formSubmitted ? (
              <>
                <div className="mb-6">
                  <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.modalTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium mb-4">
                    {t.modalSubtitle}
                  </p>
                  
                  {/* Liens de contact direct avec images personnalisées */}
                  <div className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 border border-gray-150 rounded-2xl">
                    <a
                      href="https://wa.me/message/KQERLEMIO7LKL1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center space-x-2.5 bg-white border border-gray-200 hover:border-green-500 hover:shadow-xs p-2.5 rounded-xl transition cursor-pointer"
                    >
                      <img src="/whtsapp.jpeg" alt="WhatsApp" className="w-6 h-6 object-cover rounded-md" />
                      <span className="text-xs font-bold text-gray-700 hover:text-green-600">WhatsApp</span>
                    </a>
                    <a
                      href="mailto:facilitefacile@gmail.com"
                      className="flex-1 flex items-center justify-center space-x-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:shadow-xs p-2.5 rounded-xl transition cursor-pointer"
                    >
                      <img src="/email.png" alt="Email" className="w-6 h-6 object-contain" />
                      <span className="text-xs font-bold text-gray-700 hover:text-blue-600">Email</span>
                    </a>
                  </div>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelName}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition font-medium"
                      placeholder={t.modalPlaceholderName}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelEmail}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition font-medium"
                      placeholder={t.modalPlaceholderEmail}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelSubject}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition font-medium"
                      placeholder={t.modalPlaceholderSubject}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelMessage}
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition resize-none font-medium"
                      placeholder={t.modalPlaceholderMessage}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_20px_rgba(37,99,235,0.4)] mt-2 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                        <span>{t.modalSending}</span>
                      </>
                    ) : (
                      <span>{t.modalSubmit}</span>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-8 animate-fade-in-up">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce shadow-md">
                  <i className="fa-solid fa-check text-3xl font-bold"></i>
                </div>
                <h4 className="text-2xl font-extrabold text-gray-900 mb-2">{t.modalSuccessTitle}</h4>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed font-medium">
                  {t.modalSuccessDesc}
                </p>
                <button
                  onClick={handleCloseModal}
                  className="mt-6 border-2 border-gray-200 text-gray-700 font-extrabold py-2.5 px-8 rounded-xl text-xs hover:bg-gray-50 transition cursor-pointer shadow-xs"
                >
                  {t.modalClose}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 3: Recrutement Spontané */}
      {recruitmentModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target.id === "recruitment-modal-wrapper") handleCloseRecruitmentModal();
          }}
          id="recruitment-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 animate-fade-in-up">
            <button
              onClick={handleCloseRecruitmentModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            {!recruitmentFormSubmitted ? (
              <>
                <div className="mb-6">
                  <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.recruitmentModalTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {t.recruitmentModalSubtitle}
                  </p>
                </div>

                <form onSubmit={handleRecruitmentSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelName}
                    </label>
                    <input
                      type="text"
                      required
                      value={recruitmentFormData.name}
                      onChange={(e) => setRecruitmentFormData({ ...recruitmentFormData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition font-medium"
                      placeholder={t.modalPlaceholderName}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.modalLabelEmail}
                    </label>
                    <input
                      type="email"
                      required
                      value={recruitmentFormData.email}
                      onChange={(e) => setRecruitmentFormData({ ...recruitmentFormData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition font-medium"
                      placeholder={t.modalPlaceholderEmail}
                    />
                  </div>

                  {/* Zone de téléversement Drag & Drop */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.recruitmentLabelCV}
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className="border-2 border-dashed border-gray-300 hover:border-[#10E688] rounded-2xl p-6 text-center cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition duration-300"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        required={!recruitmentFile}
                      />
                      {!recruitmentFile ? (
                        <div className="flex flex-col items-center space-y-2">
                          <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400"></i>
                          <span className="text-xs text-gray-600 font-semibold">{t.recruitmentUploadPlaceholder}</span>
                          <span className="text-[10px] text-gray-400">PDF, DOCX jusqu'à 10 Mo</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-xs">
                          <div className="flex items-center space-x-3 text-left">
                            <i className="fa-regular fa-file-pdf text-red-500 text-2xl"></i>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate max-w-[200px]">{recruitmentFile.name}</p>
                              <p className="text-[10px] text-gray-400">{(recruitmentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecruitmentFile(null);
                            }}
                            className="text-gray-400 hover:text-red-500 transition p-1 hover:bg-gray-100 rounded-lg"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t.recruitmentLabelCoverLetter}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={recruitmentFormData.message}
                      onChange={(e) => setRecruitmentFormData({ ...recruitmentFormData, message: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition resize-none font-medium"
                      placeholder={t.recruitmentPlaceholderCoverLetter}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isRecruitmentSubmitting}
                    className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(16,230,136,0.3)] hover:shadow-[0_8px_20px_rgba(16,230,136,0.4)] mt-2 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    {isRecruitmentSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                        <span>{t.recruitmentSending}</span>
                      </>
                    ) : (
                      <span>{t.recruitmentSubmit}</span>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-8 animate-fade-in-up">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce shadow-md">
                  <i className="fa-solid fa-check text-3xl font-bold"></i>
                </div>
                <h4 className="text-2xl font-extrabold text-gray-900 mb-2">{t.recruitmentSuccessTitle}</h4>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed font-medium">
                  {t.recruitmentSuccessDesc}
                </p>
                <button
                  onClick={handleCloseRecruitmentModal}
                  className="mt-6 border-2 border-gray-200 text-gray-700 font-extrabold py-2.5 px-8 rounded-xl text-xs hover:bg-gray-50 transition cursor-pointer shadow-xs"
                >
                  {t.modalClose}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 4: Ajoutez un poste à votre profil (Style LinkedIn) */}
      {experienceModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target.id === "exp-modal-wrapper") setExperienceModalOpen(false);
          }}
          id="exp-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-xl p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 animate-fade-in-up">
            {/* Bouton de fermeture */}
            <button
              onClick={() => setExperienceModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-bold text-gray-900">Ajoutez un poste à votre profil</h3>
            </div>

            <form onSubmit={handleAddExperience} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Intitulé du poste */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Intitulé du poste*
                  </label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-medium text-gray-900"
                    placeholder="Exemple : Chef de produit senior"
                  />
                </div>

                {/* Organisation */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Organisation*
                  </label>
                  <input
                    type="text"
                    required
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-medium text-gray-900"
                    placeholder="Exemple : Microsoft"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lieu */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Lieu
                  </label>
                  <input
                    type="text"
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-medium text-gray-900"
                    placeholder="Ville ou région"
                  />
                </div>

                {/* Type de lieu */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Type de lieu
                  </label>
                  <select
                    value={expLocationType}
                    onChange={(e) => setExpLocationType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-bold text-gray-700 cursor-pointer appearance-none"
                  >
                    <option value="Sur site">Sur site</option>
                    <option value="Hybride">Hybride</option>
                    <option value="À distance">À distance</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 pt-6 flex items-center pointer-events-none text-gray-500 text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Type d'emploi */}
                <div className="relative col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Type d'emploi
                  </label>
                  <select
                    value={expEmploymentType}
                    onChange={(e) => setExpEmploymentType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-bold text-gray-700 cursor-pointer appearance-none"
                  >
                    <option value="">Veuillez sélectionner</option>
                    <option value="Temps plein">Temps plein</option>
                    <option value="Temps partiel">Temps partiel</option>
                    <option value="Indépendant">Indépendant</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Contrat">Contrat</option>
                    <option value="Stage / Alternance">Stage / Alternance</option>
                    <option value="Apprentissage">Apprentissage</option>
                    <option value="Saisonnier">Saisonnier</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 pt-6 flex items-center pointer-events-none text-gray-500 text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              {/* Case à cocher Poste Actuel */}
              <div className="flex items-center space-x-2 py-1">
                <label className="relative flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expIsCurrent}
                    onChange={(e) => setExpIsCurrent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 bg-white border border-gray-300 rounded peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition flex items-center justify-center">
                    <i className="fa-solid fa-check text-white text-xs scale-0 peer-checked:scale-100 transition duration-150"></i>
                  </div>
                  <span className="ml-2.5 text-xs font-bold text-gray-700">Ceci est mon poste actuel</span>
                </label>
              </div>

              {/* Date de début */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Mois de début*
                  </label>
                  <select
                    value={expStartMonth}
                    onChange={(e) => setExpStartMonth(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-bold text-gray-700 cursor-pointer appearance-none"
                  >
                    <option value="janvier">janvier</option>
                    <option value="février">février</option>
                    <option value="mars">mars</option>
                    <option value="avril">avril</option>
                    <option value="mai">mai</option>
                    <option value="juin">juin</option>
                    <option value="juillet">juillet</option>
                    <option value="août">août</option>
                    <option value="septembre">septembre</option>
                    <option value="octobre">octobre</option>
                    <option value="novembre">novembre</option>
                    <option value="décembre">décembre</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 pt-6 flex items-center pointer-events-none text-gray-500 text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Année de début*
                  </label>
                  <select
                    value={expStartYear}
                    onChange={(e) => setExpStartYear(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition font-bold text-gray-700 cursor-pointer appearance-none"
                  >
                    {Array.from({ length: 15 }, (_, i) => 2026 - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 pt-6 flex items-center pointer-events-none text-gray-500 text-xs">
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              {/* Section Compétences */}
              <div className="pt-2 border-t border-gray-150">
                <h4 className="text-xs font-extrabold text-gray-800">Compétences</h4>
                <p className="text-[10px] text-gray-500 mb-2 font-medium">Ajoutez des compétences pour afficher vos points forts.</p>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={expSkillInput}
                    onChange={(e) => setExpSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-full text-xs focus:outline-none focus:border-blue-600 transition font-medium text-gray-900"
                    placeholder="Ex. Communication, Management, React..."
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="border border-blue-600 hover:bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-full text-xs transition cursor-pointer"
                  >
                    Ajouter une compétence
                  </button>
                </div>

                {/* Tags des compétences ajoutées */}
                {expSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {expSkills.map((skill, sIdx) => (
                      <span key={sIdx} className="flex items-center space-x-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => setExpSkills(expSkills.filter((_, idx) => idx !== sIdx))}
                          className="hover:text-red-500 transition text-[9px]"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bouton de sauvegarde */}
              <div className="pt-4 border-t border-gray-100 flex">
                <button
                  type="submit"
                  className="bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold py-2 px-6 rounded-full text-xs transition ml-auto cursor-pointer shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL : VISITEUR NON CONNECTÉ / CRÉATION DE COMPTE REQUISE */}
      {authRequiredModalOpen && (
        <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 text-center space-y-5 animate-scale-up relative">
            <button
              onClick={() => setAuthRequiredModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

            <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-800 rounded-full flex items-center justify-center mx-auto text-3xl">
              💼
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-900 leading-tight">
                Créez un compte pour postuler
              </h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Vous devez être connecté(e) pour postuler à l'offre <span className="font-bold text-gray-900">"{selectedJobToApply?.titleFR || selectedJobToApply?.titleEN}"</span> et transmettre votre CV aux recruteurs.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                href="/register"
                className="block w-full py-3.5 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer"
              >
                S'inscrire gratuitement
              </Link>
              <Link
                href="/login"
                className="block w-full py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                Déjà un compte ? Se connecter
              </Link>
            </div>
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
      <DiagnosticModal isOpen={diagnosticModalOpen} onClose={() => setDiagnosticModalOpen(false)} />
    </>
  );
}
