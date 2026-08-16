/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedAvatarUrl } from "@/lib/supabase";
import RoleNavLink from "@/components/RoleNavLink";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import AdminPosterManagerModal from "@/components/AdminPosterManagerModal";

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
    heroSectionNumber: "01",
    heroSectionTitle: "Hero avec titre + bouton CTA",
    heroTitleStart: "Créez ou modifiez votre CV en ",
    heroTitleUnderline: "quelques minutes",
    heroCheck1: "Sélectionnez un modèle de CV",
    heroCheck2: "Utilisez les phrases prêtes à l'emploi",
    heroCheck3: "Téléchargez et postulez",
    heroChooseLang: "Choisissez la langue de votre CV",
    heroCreateCV: "Créer votre CV",
    heroImportCV: "Importer et modifier votre CV",
    heroSocialCountEnd: " personnes créent actuellement leur CV.",
    reassuranceText: "📣 ❤️ 95 % de nos utilisateurs recommandent Facilite après avoir créé leur CV.*",
    reassuranceFootnote: "*Basé sur une enquête de satisfaction menée en 2026.",
    modelsTitle: "Des modèles professionnels pour convaincre les recruteurs",
    modelsCTA: "Créer votre CV",
    viewTemplate: "👁 Voir le modèle",
    previewModalTitle: "Aperçu du Modèle de CV",
    previewATS: "Compatible ATS à 100%",
    previewScore: "Score Lisibilité : 99%",
    previewDownloadDemo: "Télécharger Démo (PDF)",
    previewOpenCanva: "Éditer sur Canva",
    previewClose: "Fermer l'aperçu",
    pricingPretitle: "Tarification Claire",
    pricingTitle: "Nos Tarifs de Prestations",
    pricingSubtitle: "Des offres adaptées à tous vos besoins, sans aucun frais caché.",
    badgeRecommended: "Recommandé",
    pricingOffer1Title: "CV Professionnel",
    pricingOffer1Desc: "Idéal pour valoriser votre parcours sur le marché national.",
    pricingOffer1Feature1: "Conception et rédaction complète.",
    pricingOffer1Feature2: "Mise en page moderne et attractive.",
    pricingOffer1Feature3: "Valorisation des compétences clés.",
    pricingOffer1Feature4: "Correction orthographique rigoureuse.",
    pricingOffer2Title: "Lettre de Motivation",
    pricingOffer2Desc: "Pour accompagner votre candidature avec un maximum d'impact.",
    pricingOffer2Feature1: "Rédaction sur mesure selon le poste.",
    pricingOffer2Feature2: "Structure professionnelle et accrocheuse.",
    pricingOffer2Feature3: "Argumentation solide pour convaincre.",
    pricingOffer2Feature4: "Prête à l'envoi.",
    pricingOffer3Title: "CV Version Anglaise",
    pricingOffer3Desc: "Pour ouvrir vos opportunités professionnelles à l'international.",
    pricingOffer3Feature1: "Traduction intégrale et technique.",
    pricingOffer3Feature2: "Adaptation stricte aux normes (Resume).",
    pricingOffer3Feature3: "Vocabulaire professionnel optimisé.",
    pricingOffer3Feature4: "Relecture linguistique approfondie.",
    pricingOffer4Title: "CV Canadien",
    pricingOffer4Desc: "Conçu spécifiquement pour le marché du travail canadien.",
    pricingOffer4Feature1: "Format et structure aux normes canadiennes.",
    pricingOffer4Feature2: "Retrait des données discriminatoires.",
    pricingOffer4Feature3: "Focus approfondi sur vos réalisations.",
    pricingOffer4Feature4: "Optimisation pour la compatibilité ATS.",
    chooseOffer: "Choisir cette offre",
    footerAboutTitle: "À propos de Facilite",
    footerAboutDesc: "Facilite est votre allié de confiance pour concevoir des CV percutants et professionnels. Grâce à nos outils intuitifs et nos modèles optimisés, propulsez votre carrière et décrochez l'emploi de vos rêves en quelques clics.",
    footerAboutUs: "À propos de nous",
    footerPrivacy: "Politique de confidentialité",
    footerTerms: "Conditions d'utilisation",
    footerSupportTitle: "Horaires & Support",
    footerWeekdays: "Lundi - Vendredi",
    footerWeekends: "Samedi - Dimanche",
    footerStayInTouch: "Restez en contact avec nous",
    footerFollowUs: "Suivez-nous sur nos réseaux sociaux pour ne rien rater de nos actualités.",
    footerCopyright: "© 2026 Facilite. Tous droits réservés.",
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
    toastDemoDownloaded: "Le modèle démo a été téléchargé en PDF !",
    toastOfferSelected: "Offre sélectionnée avec succès !",
    searchPlaceholder: "Rechercher...",
    searchNoResults: "Aucun modèle de CV trouvé.",
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
    heroSectionNumber: "01",
    heroSectionTitle: "Hero with title + CTA button",
    heroTitleStart: "Create or edit your CV in ",
    heroTitleUnderline: "a few minutes",
    heroCheck1: "Select a CV template",
    heroCheck2: "Use ready-to-use phrases",
    heroCheck3: "Download and apply",
    heroChooseLang: "Choose your CV language",
    heroCreateCV: "Create your CV",
    heroImportCV: "Import and edit your CV",
    heroSocialCountEnd: " people are currently creating their CV.",
    reassuranceText: "📣 ❤️ 95% of our users recommend Facilite after creating their CV.*",
    reassuranceFootnote: "*Based on a 2026 satisfaction survey.",
    modelsTitle: "Professional templates to convince recruiters",
    modelsCTA: "Create your CV",
    viewTemplate: "👁 View template",
    previewModalTitle: "CV Template Preview",
    previewATS: "100% ATS Compatible",
    previewScore: "Readability Score: 99%",
    previewDownloadDemo: "Download Demo (PDF)",
    previewOpenCanva: "Edit on Canva",
    previewClose: "Close preview",
    pricingPretitle: "Clear Pricing",
    pricingTitle: "Our Service Pricing",
    pricingSubtitle: "Offers tailored to all your needs, with no hidden fees.",
    badgeRecommended: "Recommended",
    pricingOffer1Title: "Professional CV",
    pricingOffer1Desc: "Ideal for highlighting your career path on the national market.",
    pricingOffer1Feature1: "Complete design and writing.",
    pricingOffer1Feature2: "Modern and attractive layout.",
    pricingOffer1Feature3: "Highlighting key skills.",
    pricingOffer1Feature4: "Rigorous spell-checking.",
    pricingOffer2Title: "Cover Letter",
    pricingOffer2Desc: "To accompany your application with maximum impact.",
    pricingOffer2Feature1: "Tailored writing according to the position.",
    pricingOffer2Feature2: "Professional and catchy structure.",
    pricingOffer2Feature3: "Solid arguments to convince.",
    pricingOffer2Feature4: "Ready to send.",
    pricingOffer3Title: "English CV Version",
    pricingOffer3Desc: "To open up your professional opportunities internationally.",
    pricingOffer3Feature1: "Full and technical translation.",
    pricingOffer3Feature2: "Strict adaptation to standards (Resume).",
    pricingOffer3Feature3: "Optimized professional vocabulary.",
    pricingOffer3Feature4: "Thorough linguistic proofreading.",
    pricingOffer4Title: "Canadian CV",
    pricingOffer4Desc: "Designed specifically for the Canadian job market.",
    pricingOffer4Feature1: "Format and structure to Canadian standards.",
    pricingOffer4Feature2: "Removal of discriminatory data.",
    pricingOffer4Feature3: "Thorough focus on your achievements.",
    pricingOffer4Feature4: "Optimized for ATS compatibility.",
    chooseOffer: "Choose this offer",
    footerAboutTitle: "About Facilite",
    footerAboutDesc: "Facilite is your trusted ally for designing impactful and professional CVs. Thanks to our intuitive tools and optimized templates, propel your career and land your dream job in just a few clicks.",
    footerAboutUs: "About us",
    footerPrivacy: "Privacy policy",
    footerTerms: "Terms of service",
    footerSupportTitle: "Hours & Support",
    footerWeekdays: "Monday - Friday",
    footerWeekends: "Saturday - Sunday",
    footerStayInTouch: "Stay in touch with us",
    footerFollowUs: "Follow us on our social networks to not miss any of our news.",
    footerCopyright: "© 2026 Facilite. All rights reserved.",
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
    toastLangFR: "Langue modifiée en Français",
    toastLangGB: "Language changed to English",
    toastDemoDownloaded: "Demo template downloaded as PDF!",
    toastOfferSelected: "Offer selected successfully!",
    searchPlaceholder: "Search...",
    searchNoResults: "No CV templates found.",
  }
};

export default function Home() {
  const pathname = usePathname();
  // --- ÉTATS GÉNÉRAUX ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userCount, setUserCount] = useState(248);
  const [selectedLang, setSelectedLang] = useState("FR");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Sync Supabase Auth session
  const [userSession, setUserSession] = useState(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);

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

  // Aperçu Modèle Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePreviewSlide, setActivePreviewSlide] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });

  // Search System
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Admin Poster Manager
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPosterModalOpen, setAdminPosterModalOpen] = useState(false);
  const [posterRefreshKey, setPosterRefreshKey] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (session.user.email === "facilitefacile62@gmail.com") {
          setIsAdmin(true);
        } else {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.role === "admin") setIsAdmin(true);
            });
        }
      }
    });
  }, []);

  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => {
      setToast({ show: false, message: "", icon: "fa-circle-info" });
    }, 3500);
  };

  // Formulaire de contact
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  // Spontaneous Recruitment Modal
  const [recruitmentModalOpen, setRecruitmentModalOpen] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
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

  // Obtenir le dictionnaire actif
  const t = translations[selectedLang] || translations.FR;

  // --- COMPTEUR UTILISATEURS FLUCTUANT ---
  useEffect(() => {
    const interval = setInterval(() => {
      setUserCount(prev => {
        const change = Math.floor(Math.random() * 10) - 3;
        const newCount = prev + change;
        return newCount < 200 ? 200 + Math.floor(Math.random() * 50) : newCount;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- CARROUSEL 360° ---
  // Contenu statique (jamais dépendant de props/state) : mémoïsé pour une
  // référence stable entre rendus, sans quoi l'effet de recherche plus bas
  // (qui filtre ce tableau) se relancerait à chaque re-render.
  const slides = useMemo(() => [
    {
      id: "s1",
      img: "/affiche_cv_pro.jpg", 
      titleFR: "Modèle 1 — CV Professionnel Moderne", 
      titleEN: "Template 1 — Modern Professional CV",
      descFR: "Design percutant et élégant pour maximiser vos chances auprès des recruteurs.",
      descEN: "Impactful and elegant layout to maximize recruiter attention.",
      preview: "https://canva.link/g1nh60hb6ddtx96" 
    },
    { 
      id: "s2", 
      img: "/affiche_boostez_carriere.jpg", 
      titleFR: "Modèle 2 — Lettre de Motivation Ciblée", 
      titleEN: "Template 2 — Targeted Cover Letter",
      descFR: "Structure claire et percutante adaptée à tous types de postes et secteurs.",
      descEN: "Clean and persuasive structure suited for all job positions.",
      preview: "https://canva.link/g1nh60hb6ddtx96" 
    },
    { 
      id: "s3", 
      img: "/affiche_cv_pro.jpg", 
      titleFR: "Modèle 3 — Pack Complet (CV + Lettre)", 
      titleEN: "Template 3 — Complete Pack (CV + Letter)",
      descFR: "Harmonie visuelle totale entre votre CV et votre lettre pour une candidature d'élite.",
      descEN: "Total visual consistency between your CV and cover letter for elite applications.",
      preview: "https://canva.link/g1nh60hb6ddtx96" 
    },
    { 
      id: "s4", 
      img: "/affiche_cv_pro.jpg", 
      titleFR: "Modèle 4 — CV Exécutif & International", 
      titleEN: "Template 4 — Executive & International CV",
      descFR: "Format optimisé pour les candidatures globales, normes anglo-saxonnes et compatibilité ATS.",
      descEN: "Optimized format for global applications, international standards and ATS compatibility.",
      preview: "https://canva.link/g1nh60hb6ddtx96"
    },
  ], []);

  // --- RECHERCHE EN TEMPS RÉEL --- entièrement dérivée de searchQuery/
  // selectedLang/slides : calculée directement au rendu plutôt que
  // synchronisée via un effet séparé, qui ajoutait un aller-retour de rendu
  // superflu à chaque frappe.
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return slides.filter(slide => {
      const title = (selectedLang === "FR" ? slide.titleFR : slide.titleEN).toLowerCase();
      const desc = (selectedLang === "FR" ? slide.descFR : slide.descEN).toLowerCase();
      return title.includes(query) || desc.includes(query);
    });
  }, [searchQuery, selectedLang, slides]);

  const handleSearchResultClick = (slide) => {
    handleOpenPreview(slide);
    const origIdx = slides.findIndex(s => s.id === slide.id);
    if (origIdx !== -1) {
      setCurrentIndex(origIdx + 2);
    }
    setSearchQuery("");
  };


  // Étendre les slides pour l'effet infini (clonage)
  const extendedSlides = [
    ...slides.slice(-2).map((s, idx) => ({ ...s, uniqueId: `prepended-${idx}` })),
    ...slides.map((s, idx) => ({ ...s, uniqueId: `original-${idx}` })),
    ...slides.slice(0, 2).map((s, idx) => ({ ...s, uniqueId: `appended-${idx}` }))
  ];

  const [currentIndex, setCurrentIndex] = useState(2);
  const sliderTrackRef = useRef(null);
  const isTransitioningRef = useRef(false);
  const skipAnimationRef = useRef(false);
  const totalOriginals = slides.length;

  // Calcul dynamique de la largeur de la carte + gap
  const getCardWidth = useCallback(() => {
    const track = sliderTrackRef.current;
    if (!track) return 340;
    const firstSlide = track.querySelector(".slide-item");
    if (!firstSlide) return 340;
    return firstSlide.getBoundingClientRect().width + 20; // 20px gap
  }, []);

  const scrollToCurrent = useCallback((animate = true) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const width = getCardWidth();
    track.style.scrollBehavior = animate ? "smooth" : "auto";
    const targetScroll = currentIndex * width - (track.clientWidth - width) / 2;
    track.scrollLeft = targetScroll;
  }, [currentIndex, getCardWidth]);

  // Ajustement initial et lors du changement de taille de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      scrollToCurrent(false);
    };
    window.addEventListener("resize", handleResize);

    const timer = setTimeout(() => {
      scrollToCurrent(false);
    }, 150);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [scrollToCurrent]);

  // Défilement lors du changement d'index
  useEffect(() => {
    const animate = !skipAnimationRef.current;
    scrollToCurrent(animate);
    skipAnimationRef.current = false;
  }, [currentIndex, scrollToCurrent]);

  // Détection de dépassement et boucle instantanée
  useEffect(() => {
    if (isTransitioningRef.current) {
      const timer = setTimeout(() => {
        isTransitioningRef.current = false;
        if (currentIndex >= totalOriginals + 2) {
          skipAnimationRef.current = true;
          setCurrentIndex(2);
        } else if (currentIndex < 2) {
          skipAnimationRef.current = true;
          setCurrentIndex(totalOriginals + 1);
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, totalOriginals]);

  const handleNext = () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setCurrentIndex(prev => prev - 1);
  };

  // Drag-to-Scroll (souris)
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    setIsDown(true);
    track.style.scrollBehavior = "auto";
    track.style.cursor = "grabbing";
    setStartX(e.pageX - track.offsetLeft);
    setScrollLeftState(track.scrollLeft);
  };

  const handleMouseLeave = () => {
    if (!isDown) return;
    setIsDown(false);
    const track = sliderTrackRef.current;
    if (track) track.style.cursor = "grab";
  };

  const handleMouseUp = () => {
    if (!isDown) return;
    setIsDown(false);
    const track = sliderTrackRef.current;
    if (!track) return;
    track.style.cursor = "grab";

    const width = getCardWidth();
    const rawIndex = Math.round((track.scrollLeft + (track.clientWidth - width) / 2) / width);
    const validatedIndex = Math.max(2, Math.min(rawIndex, totalOriginals + 1));
    
    isTransitioningRef.current = true;
    setCurrentIndex(validatedIndex);
  };

  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const track = sliderTrackRef.current;
    if (!track) return;
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.5;
    track.scrollLeft = scrollLeftState - walk;
  };

  // Drag-to-Scroll (tactile mobile)
  const handleTouchStart = (e) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    setIsDown(true);
    track.style.scrollBehavior = "auto";
    setStartX(e.touches[0].pageX - track.offsetLeft);
    setScrollLeftState(track.scrollLeft);
  };

  const handleTouchMove = (e) => {
    if (!isDown) return;
    const track = sliderTrackRef.current;
    if (!track) return;
    const x = e.touches[0].pageX - track.offsetLeft;
    const walk = (x - startX) * 1.5;
    track.scrollLeft = scrollLeftState - walk;
  };

  const handleTouchEnd = () => {
    if (!isDown) return;
    setIsDown(false);
    const track = sliderTrackRef.current;
    if (!track) return;

    const width = getCardWidth();
    const rawIndex = Math.round((track.scrollLeft + (track.clientWidth - width) / 2) / width);
    const validatedIndex = Math.max(2, Math.min(rawIndex, totalOriginals + 1));
    
    isTransitioningRef.current = true;
    setCurrentIndex(validatedIndex);
  };

  // --- GESTION DE LA SÉLECTION DE LANGUE ---
  const changeLanguage = (lang) => {
    setSelectedLang(lang);
    triggerToast(lang === "FR" ? translations.FR.toastLangFR : translations.GB.toastLangGB, "fa-globe");
  };

  // --- MODAL D'APERÇU MODÈLE ---
  const handleOpenPreview = (slide) => {
    setActivePreviewSlide(slide);
    setZoomLevel(1);
    setPreviewModalOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    setActivePreviewSlide(null);
  };

  const handleDownloadDemo = () => {
    triggerToast(t.toastDemoDownloaded, "fa-file-pdf");
  };

  // --- INTERACTION TILT 3D POUR LES TARIFS ---
  const handleCardMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
  };

  const handleCardMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
  };

  // --- MODAL DE CONTACT ---
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
    // Simulation en temps réel avec indicateur de chargement
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

  // Écouter la touche Échap et les clics extérieurs pour fermer les modals/dropdowns
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (previewModalOpen) handleClosePreview();
        if (contactModalOpen) handleCloseModal();
        if (recruitmentModalOpen) handleCloseRecruitmentModal();
        if (plusDropdownOpen) setPlusDropdownOpen(false);
        if (notificationsModalOpen) setNotificationsModalOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (plusDropdownRef.current && !plusDropdownRef.current.contains(e.target)) {
        setPlusDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contactModalOpen, previewModalOpen, recruitmentModalOpen, plusDropdownOpen, notificationsModalOpen]);

  return (
    <>
      {/* Toast Notification Top Floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <i className={`fa-solid ${toast.icon} text-primary text-xl`}></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) */}
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

            {/* Barre de recherche Desktop */}
            <div className="hidden md:block relative w-60 lg:w-72">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                  placeholder={t.searchPlaceholder}
                />
              </div>
              {/* Résultats de recherche flottants */}
              {searchFocused && searchQuery && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-[100]">
                  <div className="py-2 max-h-60 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((slide) => (
                        <button
                          key={slide.id}
                          onMouseDown={() => handleSearchResultClick(slide)}
                          className="w-full px-4 py-2 hover:bg-gray-50 flex items-center space-x-3 text-left transition cursor-pointer"
                        >
                          <img
                            src={`/${slide.img}`}
                            alt={selectedLang === "FR" ? slide.titleFR : slide.titleEN}
                            className="w-8 h-10 object-cover rounded bg-gray-100 border border-gray-200"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {selectedLang === "FR" ? slide.titleFR : slide.titleEN}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {selectedLang === "FR" ? slide.descFR : slide.descEN}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-gray-500 text-center font-medium">
                        {t.searchNoResults}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              href="/service"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/service" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xl text-indigo-500"></i>
              <span className="text-[11px] font-bold tracking-tight">{selectedLang === "FR" ? "Fonctionnalités" : "Features"}</span>
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
                <UnreadBadge count={unreadMessagesCount} />
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
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPlusDropdownOpen(false);
                      const section = document.getElementById("section-models");
                      if (section) section.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-[#10E688] hover:bg-gray-50 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-briefcase text-lg text-emerald-600 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">Services & Modèles</div>
                      <div className="text-[10px] text-gray-500 font-normal">CVs Pro, Canada & Lettres</div>
                    </div>
                  </a>

                  {/* 4. Recrutement Spontané */}
                  <Link
                    href="/recrutement-spontane"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-emerald-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-building-user text-lg text-blue-600 w-5 text-center"></i>
                    <div>
                      <div className="font-extrabold text-xs">{t.navRecruitment}</div>
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
                      handleOpenModal();
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

          {/* Groupe Droit : Rendu conditionnel selon la session Supabase */}
          <div className="hidden md:flex items-center space-x-3">
            {userSession ? (
              <Link
                href="/profil"
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
                  <i className="fa-solid fa-chevron-down text-gray-400 text-[10px]"></i>
                </div>
              </Link>
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
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-full hover:bg-black/5 transition cursor-pointer"
              aria-label="Profil"
            >
              <i className="fa-solid fa-circle-user text-lg"></i>
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
                  <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg">
                    {(userSession.user.user_metadata?.full_name || userSession.user.email || "?").charAt(0).toUpperCase()}
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
              {/* Offres d'emploi publiées par les recruteurs */}
              <Link
                href="/offres"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-solid fa-list-check text-gray-400 text-lg"></i>
                <span>Offres</span>
              </Link>

              {/* Fonctionnalités */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  const section = document.getElementById("section-models");
                  if (section) section.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-gray-400 text-lg"></i>
                <span>{selectedLang === "FR" ? "Fonctionnalités" : "Features"}</span>
              </button>

              {/* Recrutement Spontané (même modale que le dropdown "Plus" desktop) */}
              <Link
                href="/recrutement-spontane"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer border-t border-gray-100"
              >
                <i className="fa-solid fa-user-tie text-gray-400 text-lg"></i>
                <span>{t.navRecruitment}</span>
              </Link>

              {/* Recrutement Journalier Mobile */}
              <Link
                href="/recrutement-journalier"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer border-t border-gray-100"
              >
                <i className="fa-solid fa-person-digging text-gray-400 text-lg"></i>
                <span>{selectedLang === "FR" ? "Travail journalier" : "Daily Worker Jobs"}</span>
              </Link>

              {/* Contact (même modale que le dropdown "Plus" desktop) */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenModal();
                }}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-regular fa-comment-dots text-gray-400 text-lg"></i>
                <span>Contact</span>
              </button>

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

              {/* Compte : Déconnexion, clairement accessible en bas du menu */}
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
      </nav>

      {/* Contenu Principal avec Marge = hauteur exacte du nav fixe (h-16) */}
      <main className="flex-grow flex flex-col pt-16 pb-8 md:pb-0">
        
        {/* Section Hero */}
        <section className="flex-grow flex flex-col md:flex-row items-center justify-center px-4 py-12 md:py-16 max-w-[1128px] mx-auto gap-12 lg:gap-20 w-full overflow-x-hidden">
          {/* Contenu Texte */}
          <div className="w-full md:w-1/2 flex flex-col space-y-8 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.15] text-gray-900">
              {t.heroTitleStart}
              <span className="text-[#10E688] inline-block relative whitespace-nowrap drop-shadow-sm">
                {t.heroTitleUnderline}
                <svg className="absolute w-full h-3.5 -bottom-1.5 left-0 text-[#E4B8F9] opacity-70" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="6" fill="transparent" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <ul className="space-y-5 text-lg text-gray-700 font-medium">
              <li className="flex items-center space-x-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#10E688]/20 flex items-center justify-center text-[#10E688] shadow-sm">
                  <i className="fa-solid fa-check text-sm font-bold"></i>
                </span>
                <span>{t.heroCheck1}</span>
              </li>
              <li className="flex items-center space-x-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E4B8F9]/30 flex items-center justify-center text-purple-700 shadow-sm">
                  <i className="fa-solid fa-check text-sm font-bold"></i>
                </span>
                <span>{t.heroCheck2}</span>
              </li>
              <li className="flex items-center space-x-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#10E688]/20 flex items-center justify-center text-[#10E688] shadow-sm">
                  <i className="fa-solid fa-check text-sm font-bold"></i>
                </span>
                <span>{t.heroCheck3}</span>
              </li>
            </ul>



            {/* Boutons d'action Principaux */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link
                href="/creer-cv"
                className="bg-[#10E688] text-gray-900 font-extrabold py-4 px-8 rounded-full text-lg shadow-[0_10px_20px_rgba(16,230,136,0.3)] hover:shadow-[0_15px_25px_rgba(16,230,136,0.45)] hover:-translate-y-1 transition-all transform duration-300 w-full sm:w-auto cursor-pointer flex items-center justify-center text-center"
              >
                {t.heroCreateCV}
              </Link>
              <Link
                href="/importer-cv"
                className="bg-[#E4B8F9] text-gray-900 font-extrabold py-4 px-8 rounded-full text-lg shadow-[0_10px_20px_rgba(228,184,249,0.4)] hover:shadow-[0_15px_25px_rgba(228,184,249,0.6)] hover:-translate-y-1 transition-all transform duration-300 w-full sm:w-auto cursor-pointer flex items-center justify-center text-center"
              >
                {t.heroImportCV}
              </Link>
            </div>

            {/* Preuve sociale */}
            <div className="flex items-center space-x-3 text-sm text-gray-600 font-medium bg-gray-50/90 p-3.5 rounded-2xl w-fit border border-gray-200/80 shadow-xs">
              <span className="w-3.5 h-3.5 bg-[#10E688] rounded-full animate-blink inline-block shadow-[0_0_10px_rgba(16,230,136,0.9)]"></span>
              <p>
                <span className="font-extrabold text-gray-900 text-base">
                  {userCount}
                </span>{" "}
                {t.heroSocialCountEnd}
              </p>
            </div>
          </div>

          {/* Contenu Image */}
          <div className="w-full md:w-1/2 flex justify-center">
            <div className="relative w-full max-w-[500px] aspect-[4/5] sm:aspect-auto sm:h-[600px] group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#10E688]/30 to-[#E4B8F9]/30 rounded-[2.5rem] transform rotate-3 scale-105 -z-10 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110"></div>
              <div className="absolute inset-0 bg-gradient-to-bl from-[#E4B8F9]/20 to-[#10E688]/20 rounded-[2.5rem] transform -rotate-2 scale-105 -z-20"></div>
              <img
                src="/affiche_cv_pro.jpg"
                alt="Affiche Tarifs et Services"
                className="w-full h-full object-cover rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-[6px] border-white transition-transform duration-500 group-hover:-translate-y-2"
              />
            </div>
          </div>
        </section>

        {/* Bandeau de Réassurance (#E3DBCC) */}
        <div className="w-full bg-[#E3DBCC] py-4 px-4 text-center shadow-inner mt-4 md:mt-6">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <h2 className="text-sm md:text-base font-bold text-gray-900 mb-1 tracking-tight">
              {t.reassuranceText}
            </h2>
            <p className="text-[10px] md:text-xs text-gray-600 font-medium">
              {t.reassuranceFootnote}
            </p>
          </div>
        </div>

        {/* Section 2: Nos Modèles de CV Professionnels (Carrousel 360°) */}
        <section id="section-models" className="w-full bg-[#050B20] py-16 md:py-24 px-4 md:px-12 z-10 relative overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
            
            {/* Colonne Gauche */}
            <div className="w-full md:w-1/3 text-left flex flex-col items-start gap-8">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.15]">
                {t.modelsTitle}
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
                <button
                  onClick={() => {
                    const pricingSection = document.getElementById("section-pricing");
                    if (pricingSection) pricingSection.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-[#10E688] text-gray-900 font-extrabold py-4 px-10 rounded-full text-lg shadow-[0_10px_20px_rgba(16,230,136,0.3)] hover:shadow-[0_15px_25px_rgba(16,230,136,0.5)] hover:-translate-y-1 transition-all transform duration-300 cursor-pointer"
                >
                  {t.modelsCTA}
                </button>
                <Link
                  href="/modeles"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-3.5 px-8 rounded-full text-base transition-all transform hover:-translate-y-1 cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-file-lines"></i>
                  Voir tous les modèles CV
                </Link>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAdminPosterModalOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-black py-3.5 px-6 rounded-full text-sm transition-all transform hover:-translate-y-1 cursor-pointer flex items-center gap-2 shadow-lg animate-pulse"
                  >
                    <i className="fa-solid fa-camera"></i>
                    <span>Changer les images (Admin)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Colonne Droite : Slider 360° */}
            <div className="w-full md:w-2/3 relative flex items-center">
              <button
                onClick={handlePrev}
                className="absolute -left-4 md:-left-6 z-20 w-12 h-12 bg-[#10E688] rounded-full flex items-center justify-center text-gray-900 hover:scale-110 transition shadow-[0_0_15px_rgba(16,230,136,0.5)] cursor-pointer"
                aria-label="Previous Slide"
              >
                <i className="fa-solid fa-arrow-left text-lg font-bold"></i>
              </button>

              <div className="slider-container w-full" id="slider-container">
                <div
                  ref={sliderTrackRef}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="slider-track flex gap-6 px-8 py-6"
                  style={{ cursor: "grab" }}
                >
                  {extendedSlides.map((slide, i) => {
                    const isCurrent = i === currentIndex;
                    return (
                      <div
                        key={slide.uniqueId}
                        onClick={() => handleOpenPreview(slide)}
                        style={{
                          opacity: isCurrent ? 1 : 0.75,
                          transform: isCurrent ? "scale(1.04)" : "scale(0.98)",
                          transition: "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease",
                        }}
                        className="slide-item w-[280px] md:w-[320px] flex-shrink-0 relative group cursor-pointer shadow-xl rounded-2xl border-2 border-transparent hover:border-[#10E688] transition-all"
                      >
                        <div className="bg-white rounded-xl overflow-hidden relative h-[450px]">
                          <img
                            src={`${slide.img.startsWith('/') ? slide.img : `/${slide.img}`}?v=${posterRefreshKey}`}
                            alt={selectedLang === "FR" ? slide.titleFR : slide.titleEN}
                            className="w-full h-full object-cover object-top pointer-events-none transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center backdrop-blur-xs">
                            <span className="text-white font-extrabold text-lg bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/40 shadow-lg transform group-hover:scale-105 transition-transform">
                              {t.viewTemplate}
                            </span>
                            <span className="mt-4 text-xs text-gray-200 font-medium">
                              {selectedLang === "FR" ? slide.titleFR : slide.titleEN}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="absolute -right-4 md:-right-6 z-20 w-12 h-12 bg-[#10E688] rounded-full flex items-center justify-center text-gray-900 hover:scale-110 transition shadow-[0_0_15px_rgba(16,230,136,0.5)] cursor-pointer"
                aria-label="Next Slide"
              >
                <i className="fa-solid fa-arrow-right text-lg font-bold"></i>
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Nos Tarifs de Prestations (Effet Suivi 3D & Accent Bleu Royal #2563EB) */}
        <section id="section-pricing" className="w-full bg-[#FAF6F1] py-16 md:py-24 px-4 md:px-12 z-10 relative border-t border-gray-200/60">
          <div className="max-w-7xl mx-auto flex flex-col items-center">
            
            {/* En-tête Section */}
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="text-blue-600 font-black tracking-widest uppercase text-xs mb-2 block">
                {t.pricingPretitle}
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
                {t.pricingTitle}
              </h2>
              <p className="text-gray-600 text-base md:text-lg font-medium">
                {t.pricingSubtitle}
              </p>
            </div>

            {/* Grille 4 Cartes de Tarifs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch perspective-1000">
              
              {/* Carte 1 : CV Professionnel (Avec Badge Recommandé) */}
              <div
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className="tilt-card group bg-white rounded-[1.8rem] p-7 shadow-md border-2 border-gray-200/80 hover:border-blue-600 hover:shadow-2xl transition-all duration-300 relative flex flex-col justify-between"
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 animated-gradient-badge bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 text-white text-[11px] font-extrabold py-1.5 px-5 rounded-full uppercase tracking-wider whitespace-nowrap shadow-md border border-white/40">
                  {t.badgeRecommended}
                </div>
                <div>
                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-1">{t.pricingOffer1Title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed min-h-[36px] px-1">{t.pricingOffer1Desc}</p>
                    <div className="flex items-baseline justify-center mt-4">
                      <span className="text-4xl font-black text-gray-900">1500</span>
                      <span className="text-sm font-extrabold text-blue-600 ml-1.5">FCFA</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5 mb-6">
                    <ul className="space-y-3.5 text-xs text-gray-700 text-left font-medium">
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer1Feature1}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer1Feature2}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer1Feature3}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer1Feature4}</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => triggerToast(t.toastOfferSelected, "fa-circle-check")}
                  className="w-full border-2 border-blue-600 text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0)] group-hover:shadow-[0_8px_20px_rgba(37,99,235,0.35)] cursor-pointer"
                >
                  {t.chooseOffer}
                </button>
              </div>

              {/* Carte 2 : Lettre de Motivation */}
              <div
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className="tilt-card group bg-white rounded-[1.8rem] p-7 shadow-md border-2 border-gray-200/80 hover:border-blue-600 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-1">{t.pricingOffer2Title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed min-h-[36px] px-1">{t.pricingOffer2Desc}</p>
                    <div className="flex items-baseline justify-center mt-4">
                      <span className="text-4xl font-black text-gray-900">1000</span>
                      <span className="text-sm font-extrabold text-blue-600 ml-1.5">FCFA</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5 mb-6">
                    <ul className="space-y-3.5 text-xs text-gray-700 text-left font-medium">
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer2Feature1}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer2Feature2}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer2Feature3}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer2Feature4}</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => triggerToast(t.toastOfferSelected, "fa-circle-check")}
                  className="w-full border-2 border-blue-600 text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0)] group-hover:shadow-[0_8px_20px_rgba(37,99,235,0.35)] cursor-pointer"
                >
                  {t.chooseOffer}
                </button>
              </div>

              {/* Carte 3 : CV Version Anglaise */}
              <div
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className="tilt-card group bg-white rounded-[1.8rem] p-7 shadow-md border-2 border-gray-200/80 hover:border-blue-600 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-1">{t.pricingOffer3Title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed min-h-[36px] px-1">{t.pricingOffer3Desc}</p>
                    <div className="flex items-baseline justify-center mt-4">
                      <span className="text-4xl font-black text-gray-900">2000</span>
                      <span className="text-sm font-extrabold text-blue-600 ml-1.5">FCFA</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5 mb-6">
                    <ul className="space-y-3.5 text-xs text-gray-700 text-left font-medium">
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer3Feature1}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer3Feature2}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer3Feature3}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer3Feature4}</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => triggerToast(t.toastOfferSelected, "fa-circle-check")}
                  className="w-full border-2 border-blue-600 text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0)] group-hover:shadow-[0_8px_20px_rgba(37,99,235,0.35)] cursor-pointer"
                >
                  {t.chooseOffer}
                </button>
              </div>

              {/* Carte 4 : CV Canadien */}
              <div
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                className="tilt-card group bg-white rounded-[1.8rem] p-7 shadow-md border-2 border-gray-200/80 hover:border-blue-600 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="text-center mb-6 pt-2">
                    <h3 className="text-2xl font-extrabold text-gray-800 mb-1">{t.pricingOffer4Title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed min-h-[36px] px-1">{t.pricingOffer4Desc}</p>
                    <div className="flex items-baseline justify-center mt-4">
                      <span className="text-4xl font-black text-gray-900">2000</span>
                      <span className="text-sm font-extrabold text-blue-600 ml-1.5">FCFA</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-5 mb-6">
                    <ul className="space-y-3.5 text-xs text-gray-700 text-left font-medium">
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer4Feature1}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer4Feature2}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer4Feature3}</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <i className="fa-solid fa-circle-check text-blue-600 text-base flex-shrink-0 mt-0.5"></i>
                        <span>{t.pricingOffer4Feature4}</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => triggerToast(t.toastOfferSelected, "fa-circle-check")}
                  className="w-full border-2 border-blue-600 text-blue-600 bg-white group-hover:bg-blue-600 group-hover:text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all duration-300 shadow-[0_4px_12px_rgba(37,99,235,0)] group-hover:shadow-[0_8px_20px_rgba(37,99,235,0.35)] cursor-pointer"
                >
                  {t.chooseOffer}
                </button>
              </div>

            </div>
          </div>
        </section>
        {/* Modal Admin Gestionnaire d'Affiches */}
      <AdminPosterManagerModal
        isOpen={adminPosterModalOpen}
        onClose={() => setAdminPosterModalOpen(false)}
        onPosterUpdated={() => setPosterRefreshKey(Date.now())}
      />
    </main>

      {/* Footer Éléments Sombre & Inforamations */}
      <footer className="bg-[#080E1E] text-gray-400 py-16 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Colonne 1 : À Propos */}
          <div className="flex flex-col">
            <Link href="/" className="flex items-center space-x-2.5 mb-4 group cursor-pointer" title="Aller à l'accueil Facilite">
              <img src="/logo.jpeg" alt="Logo" className="w-7 h-7 rounded-full object-cover group-hover:opacity-80 transition" />
              <h3 className="text-white text-xl font-extrabold group-hover:text-[#10E688] transition">{t.footerAboutTitle}</h3>
            </Link>
            <p className="text-sm leading-relaxed mb-6 text-gray-400 font-medium">
              {t.footerAboutDesc}
            </p>
            <h4 className="text-white text-base font-bold mb-3">Liens utiles</h4>
            <div className="flex flex-col space-y-2.5 text-sm font-semibold">
              <button
                type="button"
                onClick={handleOpenModal}
                className="text-left hover:text-[#10E688] transition-colors cursor-pointer"
              >
                Contact
              </button>
              <Link
                href="/boite-a-idees"
                className="hover:text-[#10E688] transition-colors"
              >
                Boîte à idées
              </Link>
              <Link
                href="/faq"
                className="hover:text-[#10E688] transition-colors"
              >
                Foire Aux Questions (FAQ)
              </Link>
            </div>
          </div>

          {/* Colonne 2 : Horaires & Support */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-white text-lg font-bold mb-2">{t.footerSupportTitle}</h3>
            
            {/* Téléphone */}
            <div className="flex items-center space-x-3">
              <span className="p-2.5 bg-gray-900 rounded-xl text-[#10E688] border border-gray-800 w-11 h-11 flex items-center justify-center">
                <i className="fa-solid fa-phone text-lg"></i>
              </span>
              <a href="tel:+221771400832" className="text-white text-xl font-black hover:text-[#10E688] transition-colors">
                +221 77 140 08 32
              </a>
            </div>

            {/* WhatsApp */}
            <div className="flex items-center space-x-3">
              <a
                href="https://wa.me/221771400832"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 bg-gray-900 rounded-xl border border-gray-800 w-11 h-11 flex items-center justify-center hover:border-green-500 transition-colors"
              >
                <img src="/whtsapp.jpeg" alt="WhatsApp" className="w-full h-full object-cover rounded-lg" />
              </a>
              <a
                href="https://wa.me/221771400832"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-base font-bold hover:text-green-500 transition-colors"
              >
                WhatsApp Direct
              </a>
            </div>

            {/* Email */}
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

            <div className="space-y-3 text-sm font-medium pt-2">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-300">{t.footerWeekdays}</span>
                <span className="text-[#10E688] font-bold">8h - 22h</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-300">{t.footerWeekends}</span>
                <span className="text-[#10E688] font-bold">9h - 21h</span>
              </div>
            </div>
          </div>

          {/* Colonne 3 : Réseaux & Newsletter */}
          <div className="flex flex-col">
            <h3 className="text-white text-lg font-bold mb-4">{t.footerStayInTouch}</h3>
            <p className="text-sm mb-6 text-gray-400 font-medium leading-relaxed">{t.footerFollowUs}</p>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/facilitenumerique"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="Facebook Facilité"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M9 8H7v3h2v9h4v-9h3.61L17 8h-3V6.23c0-.85.34-1.23 1.08-1.23H17V1H14.12C11.53 1 10 2.5 10 5v3z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/facilite-digital"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="LinkedIn Facilité"
              >
                <i className="fa-brands fa-linkedin-in text-lg"></i>
              </a>
              <a
                href="https://wa.me/221771400832"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="WhatsApp Facilité"
              >
                <i className="fa-brands fa-whatsapp text-xl text-[#25D366]"></i>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800/80 text-center text-xs text-gray-500 font-medium">
          <p>{t.footerCopyright}</p>
        </div>
      </footer>

      {/* Modal 1: Aperçu Modèle CV Interactif avec Zoom & Actions */}
      {previewModalOpen && activePreviewSlide && (
        <div
          className="fixed inset-0 z-[650] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in-up"
          onClick={(e) => {
            if (e.target.id === "preview-modal-wrapper") handleClosePreview();
          }}
          id="preview-modal-wrapper"
        >
          <div className="bg-gray-900 border border-gray-800 text-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Header Modal Aperçu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/90">
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 bg-[#10E688] rounded-full animate-pulse"></span>
                <h3 className="text-lg font-extrabold text-white">
                  {selectedLang === "FR" ? activePreviewSlide.titleFR : activePreviewSlide.titleEN}
                </h3>
              </div>

              {/* Contrôles Zoom & Fermeture */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
                  className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-200 transition cursor-pointer"
                  title="Zoom In"
                >
                  <i className="fa-solid fa-magnifying-glass-plus text-sm"></i>
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.6))}
                  className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-200 transition cursor-pointer"
                  title="Zoom Out"
                >
                  <i className="fa-solid fa-magnifying-glass-minus text-sm"></i>
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-300 transition cursor-pointer"
                  title="Reset Zoom"
                >
                  100%
                </button>
                <button
                  onClick={handleClosePreview}
                  className="w-9 h-9 bg-gray-800 hover:bg-red-600/80 rounded-full flex items-center justify-center text-gray-200 transition cursor-pointer ml-2"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>

            {/* Corps Modal Aperçu */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 bg-[#040814]">
              {/* Zone d'Image Zoomable */}
              <div className="w-full md:w-2/3 bg-gray-950 rounded-2xl p-4 flex items-center justify-center min-h-[420px] overflow-hidden relative border border-gray-800">
                <img
                  src={`/${activePreviewSlide.img}`}
                  alt="Aperçu du modèle"
                  style={{ transform: `scale(${zoomLevel})`, transition: "transform 0.2s ease" }}
                  className="max-h-[550px] object-contain rounded-lg shadow-2xl origin-top"
                />
              </div>

              {/* Panneau latéral d'informations & CTA */}
              <div className="w-full md:w-1/3 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center space-x-2 bg-[#10E688]/10 text-[#10E688] px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-[#10E688]/30">
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>{t.previewATS}</span>
                  </div>
                  
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    {selectedLang === "FR" ? activePreviewSlide.descFR : activePreviewSlide.descEN}
                  </p>

                  <div className="bg-gray-800/70 p-4 rounded-xl space-y-2.5 border border-gray-700/60">
                    <div className="flex justify-between text-xs text-gray-300 font-semibold">
                      <span>{t.previewScore}</span>
                      <span className="text-[#10E688]">99%</span>
                    </div>
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#10E688] h-full w-[99%]"></div>
                    </div>
                  </div>
                </div>

                {/* Boutons d'action Modal */}
                <div className="space-y-3 pt-4">
                  <button
                    onClick={handleDownloadDemo}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition flex items-center justify-center space-x-2 border border-gray-700 shadow-md cursor-pointer"
                  >
                    <i className="fa-solid fa-file-pdf text-red-400 text-base"></i>
                    <span>{t.previewDownloadDemo}</span>
                  </button>

                  <Link
                    href={`/creer-cv?template=${activePreviewSlide.id}`}
                    className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-[0_6px_20px_rgba(16,230,136,0.3)] cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square text-sm"></i>
                    <span>{selectedLang === "FR" ? "Personnaliser ce modèle" : "Customize this template"}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Contactez-nous avec Validation & Traitement en Temps Réel */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fade-in-up"
          onClick={(e) => {
            if (e.target.id === "contact-modal-wrapper") handleCloseModal();
          }}
          id="contact-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] p-5 sm:p-7 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 overflow-y-auto">
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
                      href="https://wa.me/221771400832"
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
                        <i className="fa-solid fa-[#10E688] fa-spinner fa-spin text-lg"></i>
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
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in-up"
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
    </>
  );
}
