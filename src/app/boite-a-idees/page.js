/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// --- DICTIONNAIRE DE TRADUCTION COMPLET ---
const translations = {
  FR: {
    navHome: "Accueil",
    navService: "Service",
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
    searchPlaceholder: "Rechercher...",
    searchNoResults: "Aucun modèle de CV trouvé.",
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
    toastOfferSelected: "Offre sélectionnée avec succès !",
  },
  GB: {
    navHome: "Home",
    navService: "Service",
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
    searchPlaceholder: "Search...",
    searchNoResults: "No CV templates found.",
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
    toastOfferSelected: "Offer selected successfully!",
  }
};

const slides = [
  { id: "s1", img: "model1.png", titleFR: "Modèle 1 — Moderne et photographique", titleEN: "Template 1 — Modern and photographic", descFR: "Parfait pour les profils créatifs et exécutifs exigeant une mise en avant visuelle élégante.", descEN: "Perfect for creative and executive profiles seeking elegant visual presentation." },
  { id: "s2", img: "model2.png", titleFR: "Modèle 2 — Épuré et institutionnel", titleEN: "Template 2 — Clean and professional", descFR: "Design minimaliste axé sur l'impact des réalisations et la clarté de lecture pour recruteurs.", descEN: "Minimalist design focused on achievement impact and recruiter readability." },
  { id: "s3", img: "model3.png", titleFR: "Modèle 3 — Classique et structuré", titleEN: "Template 3 — Classic and structured", descFR: "Structure équilibrée idéale pour l'ingénierie, la finance et le management stratégique.", descEN: "Balanced layout ideal for engineering, finance, and strategic management." },
  { id: "s4", img: "model4.png", titleFR: "Modèle 4 — Nouveau design international", titleEN: "Template 4 — New international design", descFR: "Format optimisé pour les candidatures globales, normes anglo-saxonnes et compatibilité ATS.", descEN: "Optimized format for global applications, western standards and ATS compatibility." },
];

export default function BoiteAIdees() {
  // --- ÉTATS GÉNÉRAUX ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("FR");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Spontaneous Recruitment Modal
  const [recruitmentModalOpen, setRecruitmentModalOpen] = useState(false);
  const [isRecruitmentSubmitting, setIsRecruitmentSubmitting] = useState(false);
  const [recruitmentFormSubmitted, setRecruitmentFormSubmitted] = useState(false);
  const [recruitmentFile, setRecruitmentFile] = useState(null);
  const [recruitmentFormData, setRecruitmentFormData] = useState({
    name: "",
    email: "",
    message: ""
  });
  const fileInputRef = useRef(null);

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-info" });

  // Search System
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Suggestion page states
  const [suggestion, setSuggestion] = useState("");
  const [category, setCategory] = useState("");
  const [suggestionEmail, setSuggestionEmail] = useState("");
  const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
  const [isSuggestionSubmitting, setIsSuggestionSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const t = translations[selectedLang] || translations.FR;

  // Sync language with localStorage
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

  // --- RECHERCHE EN TEMPS RÉEL ---
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = slides.filter(slide => {
      const title = (selectedLang === "FR" ? slide.titleFR : slide.titleEN).toLowerCase();
      const desc = (selectedLang === "FR" ? slide.descFR : slide.descEN).toLowerCase();
      return title.includes(query) || desc.includes(query);
    });
    setSearchResults(filtered);
  }, [searchQuery, selectedLang]);

  const handleSearchResultClick = (slide) => {
    // Redirect to home page with models section visible
    window.location.href = "/#section-models";
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

  const handleSuggestionSubmit = (e) => {
    e.preventDefault();
    if (!suggestion || !category) {
      triggerToast("Veuillez remplir les champs obligatoires.", "fa-circle-xmark");
      return;
    }
    setIsSuggestionSubmitting(true);
    setTimeout(() => {
      setIsSuggestionSubmitting(false);
      setSuggestionSubmitted(true);
      triggerToast("Votre contribution a été enregistrée avec succès !", "fa-paper-plane");
    }, 1200);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseModal();
        if (recruitmentModalOpen) handleCloseRecruitmentModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactModalOpen, recruitmentModalOpen]);

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
      <nav className="bg-[#FAF6F1] px-4 py-2.5 shadow-sm fixed top-0 left-0 w-full z-50">
        <div className="max-w-[1128px] mx-auto w-full flex items-center justify-between">
          {/* Logo et Recherche alignés à gauche */}
          <div className="flex items-center space-x-3 flex-1 md:flex-initial">
            {/* Logo */}
            <a href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </a>

            {/* Barre de recherche Desktop */}
            <div className="hidden md:block relative w-64 lg:w-72">
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

          {/* Liens Desktop (Style LinkedIn : Icône au-dessus du texte) */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {/* Accueil */}
            <a
              href="/"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-20"
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navHome}</span>
            </a>
            
            {/* Service */}
            <Link
              href="/service"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-20"
            >
              <i className="fa-solid fa-briefcase text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navService}</span>
            </Link>

            {/* Recrutement Spontané */}
            <a
              href="#"
              onClick={handleOpenRecruitmentModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-20"
            >
              <i className="fa-solid fa-user-tie text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Recrutement</span>
            </a>

            {/* Contactez-nous */}
            <a
              href="#"
              onClick={handleOpenModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-20"
            >
              <i className="fa-regular fa-comment-dots text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Contact</span>
            </a>

            {/* Se connecter */}
            <a
              href="#"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-20"
            >
              <i className="fa-regular fa-user text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Connexion</span>
            </a>
          </div>

          {/* Bouton Menu Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-gray-700 focus:outline-none hover:text-blue-600 transition"
            aria-label="Toggle Navigation"
          >
            <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-2xl`}></i>
          </button>
        </div>

        {/* Menu Déroulant Mobile */}
        <div
          className={`absolute top-full left-0 w-full bg-[#FAF6F1] shadow-xl flex-col py-4 px-4 space-y-4 md:hidden border-t border-gray-200/80 transition-all ${
            mobileMenuOpen ? "flex" : "hidden"
          }`}
        >
          {/* Barre de recherche Mobile */}
          <div className="relative w-full px-1">
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
            {/* Résultats de recherche flottants Mobile */}
            {searchFocused && searchQuery && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-[100]">
                <div className="py-2 max-h-48 overflow-y-auto">
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
          <a
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-blue-600 transition font-bold p-3 rounded-xl hover:bg-white/60"
          >
            <img src="/accueil.png" alt="Accueil" className="w-6 h-6 object-contain" />
            <span>{t.navHome}</span>
          </a>
          <Link
            href="/service"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] transition font-semibold p-3 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-briefcase text-xl w-6 text-[#10E688]"></i>
            <span>{t.navService}</span>
          </Link>
          <a
            href="#"
            onClick={handleOpenRecruitmentModal}
            className="flex items-center space-x-3 text-gray-800 hover:text-purple-600 transition font-semibold p-3 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-user-tie text-xl w-6 text-purple-600"></i>
            <span>{t.navRecruitment}</span>
          </a>
          <a
            href="#"
            onClick={handleOpenModal}
            className="flex items-center space-x-3 text-gray-800 hover:text-blue-600 transition font-semibold p-3 rounded-xl hover:bg-white/60"
          >
            <i className="fa-regular fa-comment-dots text-xl w-6 text-blue-600"></i>
            <span>{t.navContact}</span>
          </a>
          <a
            href="#"
            className="flex items-center space-x-3 text-gray-800 hover:text-purple-600 transition font-semibold p-3 rounded-xl hover:bg-white/60"
          >
            <i className="fa-regular fa-user text-xl w-6 text-purple-600"></i>
            <span>{t.navLogin}</span>
          </a>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-grow pt-[52px] bg-white">
        
        {/* Banner Section */}
        <section className="w-full bg-[#E2ECE9]/70 py-12 px-4 border-b border-gray-200/50 relative overflow-hidden">
          <div className="max-w-[1128px] mx-auto flex justify-between items-center relative z-10">
            <div className="flex flex-col space-y-2">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Boîte à idées</h1>
              <div className="flex items-center space-x-2 text-xs md:text-sm text-gray-500 font-semibold">
                <Link href="/" className="hover:text-gray-800 transition">🏠</Link>
                <span>&gt;</span>
                <span className="text-gray-800 font-bold">Boîte à idées</span>
              </div>
            </div>
            
            {/* Question Marks Icon Decoration */}
            <div className="hidden md:flex items-center justify-center opacity-85 translate-x-8">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <i className="fa-solid fa-question text-6xl text-[#10E688]/30 font-black absolute transform -rotate-12 -translate-x-6 -translate-y-4"></i>
                <i className="fa-solid fa-question text-7xl text-purple-300/40 font-black absolute transform rotate-12 translate-x-6 translate-y-4"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Content Area */}
        <section className="max-w-[1128px] mx-auto px-4 py-16 md:py-24 flex flex-col lg:flex-row gap-12 lg:gap-20 items-stretch">
          
          {/* Left Column */}
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-8">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shadow-sm border border-amber-200">
              <i className="fa-regular fa-lightbulb text-3xl font-bold"></i>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-snug">
                Améliorations ensemble nos services publics
              </h2>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed font-medium">
                Votre avis compte ! Partagez vos idées et suggestions pour améliorer la qualité des services publics sénégalais.
              </p>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed font-medium">
                L&apos;objectif de cette boîte à idées est de recueillir vos suggestions constructives pour :
              </p>
            </div>

            <ul className="space-y-4 text-xs md:text-sm text-gray-700 font-bold">
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Simplifier les démarches administratives</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Améliorer l&apos;accueil dans les services</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Moderniser les processus</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Réduire les délais de traitement</span>
              </li>
            </ul>
          </div>

          {/* Right Column (Form Card) */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-3xl p-6 md:p-10 border border-gray-200 shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
              
              {!suggestionSubmitted ? (
                <form onSubmit={handleSuggestionSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold text-gray-900">Faire une contribution</h3>
                    <p className="text-xs text-gray-500 font-semibold">
                      Partagez votre idée pour améliorer nos services
                    </p>
                  </div>

                  {/* Suggestion Textarea */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Votre suggestion <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={suggestion}
                      onChange={(e) => setSuggestion(e.target.value)}
                      placeholder="Décrivez votre idée ou suggestion pour améliorer nos services..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none font-medium text-gray-900"
                    />
                  </div>

                  {/* Category Select Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Catégorie du service <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500/20 focus:ring-2 focus:ring-emerald-500/20 transition font-semibold text-gray-800 appearance-none cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Sélectionnez une catégorie
                        </option>
                        <option value="simplification">Simplification des démarches</option>
                        <option value="accueil">Qualité de l&apos;accueil</option>
                        <option value="modernisation">Modernisation des processus</option>
                        <option value="delais">Réduction des délais</option>
                        <option value="autre">Autre</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                        <i className="fa-solid fa-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Adresse e-mail <span className="text-gray-400 font-medium text-[10px]">(facultatif)</span>
                    </label>
                    <input
                      type="email"
                      value={suggestionEmail}
                      onChange={(e) => setSuggestionEmail(e.target.value)}
                      placeholder="exemple@email.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition font-semibold text-gray-900"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSuggestionSubmitting}
                    className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(16,230,136,0.2)] hover:shadow-[0_8px_20px_rgba(16,230,136,0.35)] mt-2 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    {isSuggestionSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                        <span>Envoi de la suggestion...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-regular fa-paper-plane"></i>
                        <span>Suggestion d&apos;envoi</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-6 animate-fade-in-up h-full">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 shadow-md border border-emerald-200 animate-bounce">
                    <i className="fa-solid fa-check text-4xl font-bold"></i>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-extrabold text-gray-900">Merci pour votre contribution !</h4>
                    <p className="text-sm text-gray-500 max-w-sm leading-relaxed font-semibold">
                      Votre idée a bien été enregistrée et sera étudiée avec intérêt pour continuer d&apos;améliorer nos services.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSuggestionSubmitted(false);
                      setSuggestion("");
                      setCategory("");
                      setSuggestionEmail("");
                    }}
                    className="border-2 border-gray-200 text-gray-700 font-extrabold py-3 px-8 rounded-xl text-xs hover:bg-gray-50 transition cursor-pointer shadow-xs"
                  >
                    Faire une nouvelle suggestion
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Éléments Sombre & Informations */}
      <footer className="bg-[#080E1E] text-gray-400 py-16 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Colonne 1 : À Propos */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2.5 mb-4">
              <img src="/logo.jpeg" alt="Logo" className="w-7 h-7 rounded-full object-cover" />
              <h3 className="text-white text-xl font-extrabold">À propos de Facilite</h3>
            </div>
            <p className="text-sm leading-relaxed mb-6 text-gray-400 font-medium">
              Facilite est votre allié de confiance pour concevoir des CV percutants et professionnels. Grâce à nos outils intuitifs et nos modèles optimisés, propulsez votre carrière.
            </p>
            <h4 className="text-white text-base font-bold mb-3">Liens utiles</h4>
            <div className="flex flex-col space-y-2.5 text-sm font-semibold">
              <Link href="/" className="hover:text-[#10E688] transition-colors">
                Contact
              </Link>
              <Link href="/boite-a-idees" className="hover:text-[#10E688] transition-colors">
                Boîte à idées
              </Link>
            </div>
          </div>

          {/* Colonne 2 : Horaires & Support */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-white text-lg font-bold mb-2">Horaires & Support</h3>
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
            <h3 className="text-white text-lg font-bold mb-4">Restez en contact</h3>
            <p className="text-sm mb-6 text-gray-400 font-medium leading-relaxed">Suivez-nous sur nos réseaux sociaux pour ne rien rater de nos actualités.</p>
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
          <p>© 2026 Facilite. Tous droits réservés.</p>
        </div>
      </footer>

      {/* Modal 2: Contactez-nous */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target.id === "contact-modal-wrapper") handleCloseModal();
          }}
          id="contact-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
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
    </>
  );
}
