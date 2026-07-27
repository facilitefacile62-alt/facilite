"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";

export default function ProfilPage() {
  const [selectedLang, setSelectedLang] = useState("FR");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [searchQuery, setSearchQuery] = useState("");

  // Équipes & États Profil Éditable (Chargés dynamiquement depuis Supabase)
  const [userSession, setUserSession] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileSubtitle, setProfileSubtitle] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("/logo.jpeg");
  const [coverUrl, setCoverUrl] = useState("/stellar-cover.png");
  const [isEditingBio, setIsEditingBio] = useState(false);
  // Dropdowns & Menu Actions pour Couverture et Avatar
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const coverMenuRef = useRef(null);
  const avatarMenuRef = useRef(null);

  // Modale de Recadrage & Zoom (Crop/Resize)
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropType, setCropType] = useState("avatar"); // 'avatar' | 'cover'
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDescription, setImageDescription] = useState("");
  const [isProvisional, setIsProvisional] = useState(false);
  const [viewImageModal, setViewImageModal] = useState({ open: false, url: "", title: "" });

  // File Inputs Refs pour Avatar et Couverture
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Formulaire "Mon profil et mon CV"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [uploadedCvFileName, setUploadedCvFileName] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  const [cvFileType, setCvFileType] = useState(null); // 'pdf' | 'doc' | 'image'
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [cvPreviewModalOpen, setCvPreviewModalOpen] = useState(false);
  const cvFileInputRef = useRef(null);

  // Expériences dynamique (localStorage)
  const [experiences, setExperiences] = useState([]);
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
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

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "" });

  const triggerToast = (msg, icon = "fa-check") => {
    setToast({ show: true, message: msg, icon });
    setTimeout(() => setToast({ show: false, message: "", icon: "" }), 3000);
  };

  // Synchroniser les données depuis Supabase et protéger la route
  useEffect(() => {
    async function loadUserProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      setUserSession(session);

      if (!session) {
        // Redirection stricte vers /login si le visiteur n'est pas connecté
        window.location.href = "/login";
        return;
      }

      // Récupérer le profil réel depuis la table Supabase
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setProfileName(profile.full_name || session.user.email?.split("@")[0] || "");
        setProfileSubtitle(profile.headline || "");
        setProfileLocation(profile.location || "");
        setProfileBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || "/logo.jpeg");
        setCoverUrl(profile.cover_url || "/stellar-cover.png");
        setExperiences(profile.experiences || []);

        if (profile.cv_url) {
          setCvUrl(profile.cv_url);
          setUploadedCvFileName(profile.cv_name || "Mon_CV_Professionnel");
          if (profile.cv_url.includes("pdf") || profile.cv_url.startsWith("data:application/pdf")) {
            setCvFileType("pdf");
          } else if (profile.cv_url.includes("doc") || profile.cv_url.includes("word")) {
            setCvFileType("doc");
          } else {
            setCvFileType("pdf");
          }
        }

        if (profile.full_name) {
          const parts = profile.full_name.split(" ");
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }
      } else {
        setProfileName(session.user.email?.split("@")[0] || "");
      }
    }

    loadUserProfile();
  }, []);

  // Sélection d'une image pour ouverture de la modale de recadrage/zoom
  const handleSelectImageForCrop = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setCropType(type);
      setZoomScale(1);
      setImagePos({ x: 0, y: 0 });
      setImageDescription("");
      setIsProvisional(false);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Traitement du Canvas et Enregistrement final sur Supabase
  const handleSaveCroppedImage = async () => {
    if (!rawImageSrc || !userSession?.user) return;

    triggerToast("Enregistrement de l'image...", "fa-spinner fa-spin");

    // Génération du rendu final avec Canvas
    const img = new Image();
    img.src = rawImageSrc;
    await new Promise((resolve) => { img.onload = resolve; });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (cropType === "avatar") {
      canvas.width = 400;
      canvas.height = 400;
    } else {
      canvas.width = 1200;
      canvas.height = 400;
    }

    // Dessin de l'image avec zoom et décalage
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const aspect = img.width / img.height;
    let drawWidth = canvas.width * zoomScale;
    let drawHeight = (canvas.width / aspect) * zoomScale;

    if (drawHeight < canvas.height * zoomScale) {
      drawHeight = canvas.height * zoomScale;
      drawWidth = (canvas.height * aspect) * zoomScale;
    }

    const drawX = (canvas.width - drawWidth) / 2 + imagePos.x;
    const drawY = (canvas.height - drawHeight) / 2 + imagePos.y;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    const finalBase64 = canvas.toDataURL("image/jpeg", 0.9);

    try {
      if (cropType === "avatar") {
        setAvatarUrl(finalBase64);
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          avatar_url: finalBase64,
          updated_at: new Date().toISOString(),
        });
        triggerToast("Photo de profil mise à jour avec succès !", "fa-camera");
      } else {
        setCoverUrl(finalBase64);
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          cover_url: finalBase64,
          updated_at: new Date().toISOString(),
        });
        triggerToast("Photo de couverture mise à jour avec succès !", "fa-image");
      }
      setCropModalOpen(false);
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de l'enregistrement", "fa-triangle-exclamation");
    }
  };

  // Sauvegarder la biographie dans Supabase
  const handleSaveBio = async () => {
    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        bio: profileBio,
        updated_at: new Date().toISOString(),
      });
    }
    setIsEditingBio(false);
    triggerToast("Résumé du profil mis à jour !", "fa-pen-to-square");
  };

  // Sauvegarder les informations personnelles dans Supabase
  const handleSaveProfileInfo = async () => {
    const fullName = `${firstName} ${lastName}`.trim();
    setProfileName(fullName);
    setProfileSubtitle(jobTitle);
    setProfileLocation(city && country ? `${city}, ${country}` : city || country);

    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        full_name: fullName,
        headline: jobTitle,
        location: city && country ? `${city}, ${country}` : city || country,
        updated_at: new Date().toISOString(),
      });
      triggerToast("Profil sauvegardé avec succès dans Supabase !", "fa-circle-check");
    }
  };

  const handleAddSkill = () => {
    if (expSkillInput.trim()) {
      if (!expSkills.includes(expSkillInput.trim())) {
        setExpSkills([...expSkills, expSkillInput.trim()]);
      }
      setExpSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setExpSkills(expSkills.filter((s) => s !== skillToRemove));
  };

  const handleAddExperience = (e) => {
    e.preventDefault();
    if (!expTitle.trim() || !expCompany.trim()) return;

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

    if (userSession?.user) {
      supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        experiences: updatedExps,
        updated_at: new Date().toISOString(),
      });
    }

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
    triggerToast("Expérience ajoutée au profil !", "fa-briefcase");
  };

  const handleDeleteExperience = (id) => {
    const updatedExps = experiences.filter((exp) => exp.id !== id);
    setExperiences(updatedExps);
    localStorage.setItem("user_experiences", JSON.stringify(updatedExps));
    triggerToast("Expérience supprimée.", "fa-trash-can");
  };

  const handleOpenModal = (e) => {
    if (e) e.preventDefault();
    setContactModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleOpenRecruitmentModal = (e) => {
    if (e) e.preventDefault();
    triggerToast("Redirection vers l'accueil pour le recrutement...", "fa-user-tie");
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
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
      triggerToast("Message envoyé avec succès !", "fa-paper-plane");
    }, 1200);
  };

  // Téléversement & Enregistrement du fichier CV dans Supabase
  const handleCvFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userSession?.user) return;

    setIsUploadingCv(true);
    triggerToast("Importation du CV en cours...", "fa-spinner fa-spin");

    const ext = file.name.split('.').pop().toLowerCase();
    const type = ext === "pdf" ? "pdf" : (ext === "doc" || ext === "docx" ? "doc" : "pdf");
    setCvFileType(type);
    setUploadedCvFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = reader.result;
      setCvUrl(base64Content);

      try {
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          cv_url: base64Content,
          cv_name: file.name,
          updated_at: new Date().toISOString(),
        });
        setIsUploadingCv(false);
        triggerToast(`CV "${file.name}" importé et sauvegardé !`, "fa-file-circle-check");
      } catch (err) {
        console.error(err);
        setIsUploadingCv(false);
        triggerToast("Erreur lors de la sauvegarde du CV", "fa-triangle-exclamation");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePersonalDetails = (e) => {
    if (e) e.preventDefault();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setProfileName(fullName || "Macoumba Samak");
    if (jobTitle.trim()) {
      setProfileSubtitle(jobTitle);
    }
    const locationStr = `${city.trim() ? city.trim() + ", " : ""}${country.trim() ? country.trim() : ""}`;
    if (locationStr) {
      setProfileLocation(locationStr);
    }
    triggerToast("Informations personnelles sauvegardées !", "fa-floppy-disk");
  };

  return (
    <>
      {/* Toast Notification Floating */}
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
            <a href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </a>

            <div className="hidden md:block relative w-60 lg:w-72">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                  placeholder="Rechercher sur Facilite..."
                />
              </div>
            </div>
          </div>

          {/* Groupe Centre : Liens principaux */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            <a
              href="/"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Accueil</span>
            </a>

            <Link
              href="/service"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-briefcase text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Service</span>
            </Link>

            {/* Messagerie */}
            <Link
              href="/messagerie"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16 relative"
            >
              <i className="fa-regular fa-comments text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Messagerie</span>
              <span className="absolute top-0.5 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </Link>

            <a
              href="#"
              onClick={handleOpenModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-comment-dots text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Contact</span>
            </a>
          </div>

          {/* Groupe Droit : Mon Profil (Actif avec Menu Déroulant / Popup de déconnexion) */}
          <div className="hidden md:flex items-center relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                userMenuOpen ? "text-[#10E688] font-black scale-105" : "text-[#10E688] font-bold hover:opacity-85"
              }`}
            >
              <i className="fa-solid fa-circle-user text-xl"></i>
              <div className="flex items-center space-x-0.5 text-[11px] font-bold tracking-tight">
                <span>Profil</span>
                <i className={`fa-solid fa-caret-down text-[9px] transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}></i>
              </div>
            </button>

            {/* Menu Popover au clic sur Profil */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-gray-200 shadow-2xl p-3 z-[600] animate-fade-in-up">
                <div className="flex items-center space-x-3 pb-3 border-b border-gray-100 px-1">
                  <div className="w-10 h-10 rounded-full bg-[#10E688]/20 text-[#047857] font-extrabold flex items-center justify-center text-sm border border-[#10E688]/40">
                    {profileName ? profileName.charAt(0) : "U"}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-xs font-black text-gray-900 truncate">{profileName}</h4>
                    <p className="text-[11px] text-gray-500 truncate">{profileSubtitle}</p>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      const el = document.getElementById("section-mon-profil-cv");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition flex items-center space-x-2.5 cursor-pointer"
                  >
                    <i className="fa-regular fa-user text-gray-400 text-sm"></i>
                    <span>Voir mon profil & CV</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      triggerToast("Déconnexion...", "fa-right-from-bracket");
                      setTimeout(() => {
                        handleGlobalSignOut();
                      }, 400);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition flex items-center space-x-2.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-right-from-bracket text-red-500 text-sm"></i>
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Right Controls: Search & Hamburger (LinkedIn style icons in circles) */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => {
                triggerToast("Recherche...", "fa-magnifying-glass");
              }}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Search"
            >
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-blue-600 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
            </button>
          </div>
        </div>

        {/* Horizontal Tab Bar on Mobile (LinkedIn-style tabs right under the top header) */}
        <div className="flex md:hidden items-center justify-around w-full border-t border-gray-200/60 pt-2 mt-2 bg-[#FAF6F1]">
          {/* Accueil */}
          <a
            href="/"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Accueil</span>
          </a>

          {/* Service */}
          <Link
            href="/service"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-briefcase text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Service</span>
          </Link>

          {/* Messagerie */}
          <Link
            href="/messagerie"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800 relative"
          >
            <i className="fa-regular fa-comments text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Messagerie</span>
            <span className="absolute top-0.5 right-2 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
          </Link>

          {/* Recrutement */}
          <a
            href="#"
            onClick={handleOpenRecruitmentModal}
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-16 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-user-tie text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight truncate max-w-[64px]">Recrutement</span>
          </a>

          {/* Contact */}
          <a
            href="#"
            onClick={handleOpenModal}
            className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 space-y-0.5 cursor-pointer w-14"
          >
            <i className="fa-regular fa-comment-dots text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Contact</span>
          </a>
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
              {/* Card 1 : Profil */}
              <Link
                href="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-200 shadow-xs active:bg-gray-50 transition"
              >
                {/* Cercle Avatar Violet */}
                <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg">
                  M
                </div>
                <div className="flex-grow text-left">
                  <h3 className="text-sm font-extrabold text-gray-900">Macoumba Samak</h3>
                  <span className="text-xs text-gray-500 font-medium">Voir votre profil</span>
                </div>
              </Link>

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
                <span className="text-sm font-extrabold text-gray-955">Inviter des ami(e)s</span>
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
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer border-b border-gray-100"
              >
                <i className="fa-solid fa-user-plus text-gray-400 text-lg"></i>
                <span>Ajouter un compte</span>
              </button>

              {/* Option 4: Déconnexion */}
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  triggerToast("Déconnexion réussie !", "fa-right-from-bracket");
                  setTimeout(() => {
                    window.location.href = "/login";
                  }, 800);
                }}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-red-600 active:bg-red-50 cursor-pointer"
              >
                <i className="fa-solid fa-right-from-bracket text-red-500 text-lg"></i>
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Profile Page Container */}
      <main className="min-h-screen bg-[#F4F2EE] pt-[124px] md:pt-[76px] pb-16 px-4 md:px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col lg:flex-row gap-6 items-start justify-center">
          
          {/* COLONNE GAUCHE & CENTRALE COMBINÉE : Carte Profil Principale & Sections */}
          <div className="w-full lg:w-[830px] flex flex-col space-y-4">

            {/* CARTE HERO PROFIL STYLE LINKEDIN */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs relative">
              {/* Inputs de fichiers masqués pour Avatar & Couverture */}
              <input
                type="file"
                ref={avatarInputRef}
                onChange={(e) => handleSelectImageForCrop(e, "avatar")}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={coverInputRef}
                onChange={(e) => handleSelectImageForCrop(e, "cover")}
                accept="image/*"
                className="hidden"
              />

              {/* Image de couverture spatiale stellaire / personnalisée */}
              <div
                className="h-44 md:h-56 bg-cover bg-center bg-no-repeat relative group"
                style={{ backgroundImage: `url('${coverUrl}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-indigo-950/50"></div>
                
                {/* Bouton Changer la photo de couverture avec menu déroulant */}
                <div className="absolute top-4 right-4 z-30" ref={coverMenuRef}>
                  <button
                    type="button"
                    onClick={() => setCoverMenuOpen(!coverMenuOpen)}
                    className="bg-white/95 hover:bg-white text-gray-800 p-2.5 px-4 rounded-full shadow-lg text-xs font-extrabold transition flex items-center space-x-2 cursor-pointer backdrop-blur-md active:scale-95 border border-gray-200"
                  >
                    <i className="fa-solid fa-camera text-gray-800 text-sm"></i>
                    <span className="hidden sm:inline">Changer la photo de couverture</span>
                  </button>

                  {/* Menu Déroulant Couverture */}
                  {coverMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 z-50 animate-fade-in-up">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverMenuOpen(false);
                          coverInputRef.current?.click();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 transition cursor-pointer text-left"
                      >
                        <i className="fa-regular fa-image text-gray-600 text-sm w-5 text-center"></i>
                        <span>Choisir une photo de couverture</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverMenuOpen(false);
                          coverInputRef.current?.click();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 transition cursor-pointer text-left"
                      >
                        <i className="fa-solid fa-upload text-gray-600 text-sm w-5 text-center"></i>
                        <span>Importer une photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverMenuOpen(false);
                          if (coverUrl !== "/stellar-cover.png") {
                            setRawImageSrc(coverUrl);
                            setCropType("cover");
                            setZoomScale(1);
                            setImagePos({ x: 0, y: 0 });
                            setCropModalOpen(true);
                          } else {
                            triggerToast("Veuillez d'abord choisir une photo", "fa-info-circle");
                          }
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 transition cursor-pointer text-left border-b border-gray-100"
                      >
                        <i className="fa-solid fa-arrows-up-down-left-right text-gray-600 text-sm w-5 text-center"></i>
                        <span>Repositionner</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setCoverMenuOpen(false);
                          setCoverUrl("/stellar-cover.png");
                          if (userSession?.user) {
                            await supabase.from("profiles").upsert({
                              id: userSession.user.id,
                              cover_url: "/stellar-cover.png",
                              updated_at: new Date().toISOString()
                            });
                          }
                          triggerToast("Couverture réinitialisée", "fa-trash-can");
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer text-left"
                      >
                        <i className="fa-regular fa-trash-can text-red-500 text-sm w-5 text-center"></i>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Contenu Profil Hero */}
              <div className="px-6 md:px-8 pb-6 pt-0 relative">
                {/* Photo de profil (Grand cercle avec menu interactif au clic) */}
                <div className="-mt-16 md:-mt-20 mb-4 relative z-20 w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white shadow-xl bg-white flex-shrink-0" ref={avatarMenuRef}>
                  <div className="w-full h-full rounded-full overflow-hidden relative group">
                    <img
                      src={avatarUrl}
                      alt="Logo Profil Facilite"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div
                      onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white cursor-pointer"
                    >
                      <i className="fa-solid fa-camera text-2xl mb-1"></i>
                      <span className="text-[10px] font-bold tracking-tight">Modifier</span>
                    </div>
                  </div>

                  {/* Menu Déroulant Avatar */}
                  {avatarMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 z-50 animate-fade-in-up">
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          setViewImageModal({ open: true, url: avatarUrl, title: "Photo de profil" });
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 transition cursor-pointer text-left border-b border-gray-100"
                      >
                        <i className="fa-regular fa-circle-user text-gray-600 text-base w-5 text-center"></i>
                        <span>Voir la photo de profil</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          avatarInputRef.current?.click();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 transition cursor-pointer text-left"
                      >
                        <i className="fa-regular fa-image text-gray-600 text-base w-5 text-center"></i>
                        <span>Choisir une photo de profil</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                        {profileName}
                      </h1>
                      <span className="bg-emerald-100 text-[#047857] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                        Profil Vérifié
                      </span>
                    </div>

                    <p className="text-sm md:text-base font-semibold text-gray-700">
                      {profileSubtitle}
                    </p>

                    <p className="text-xs text-gray-500 font-medium flex items-center space-x-1.5">
                      <i className="fa-solid fa-location-dot text-red-500"></i>
                      <span>{profileLocation}</span>
                      <span className="text-gray-300">•</span>
                      <button
                        onClick={handleOpenModal}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        Coordonnées
                      </button>
                    </p>

                    {/* Badge Entreprise */}
                    <div className="flex items-center space-x-2 pt-1">
                      <img src="/logo.jpeg" alt="facilite" className="w-4 h-4 rounded-xs object-cover" />
                      <span className="text-xs font-bold text-gray-800">Facilite Corporation</span>
                    </div>
                  </div>

                  {/* Boutons d'action principaux */}
                  <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                    <button
                      onClick={() => setExperienceModalOpen(true)}
                      className="bg-[#10E688] hover:bg-[#0ed67e] text-gray-950 font-extrabold py-2 px-5 rounded-full text-xs transition shadow-xs cursor-pointer flex items-center space-x-2"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                      <span>Ajouter une expérience</span>
                    </button>

                    <Link
                      href="/service"
                      className="bg-[#E4B8F9] hover:bg-[#db9ff7] text-purple-950 font-extrabold py-2 px-5 rounded-full text-xs transition shadow-xs cursor-pointer flex items-center space-x-2"
                    >
                      <i className="fa-solid fa-file-pdf text-xs"></i>
                      <span>Exporter mon CV</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION À PROPOS / RÉSUMÉ */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs relative">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-extrabold text-gray-900">À propos</h3>
                <button
                  onClick={() => setIsEditingBio(!isEditingBio)}
                  className="text-gray-400 hover:text-blue-600 transition p-1 cursor-pointer rounded-full hover:bg-gray-100"
                  title="Éditer le résumé"
                >
                  <i className="fa-solid fa-pen text-sm"></i>
                </button>
              </div>

              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsEditingBio(false)}
                      className="px-4 py-1.5 border border-gray-300 text-xs font-bold rounded-full text-gray-600 hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveBio}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-medium">
                  {profileBio}
                </p>
              )}
            </div>

            {/* SECTION EXPÉRIENCES DYNAMIQUE */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-briefcase text-blue-600 text-lg"></i>
                  <h3 className="text-base font-extrabold text-gray-900">Expérience professionnelle</h3>
                </div>
                <button
                  onClick={() => setExperienceModalOpen(true)}
                  className="text-blue-600 hover:bg-blue-50 font-bold p-2 rounded-full text-xs transition cursor-pointer flex items-center space-x-1"
                >
                  <i className="fa-solid fa-plus text-sm"></i>
                  <span>Ajouter</span>
                </button>
              </div>

              {experiences.length > 0 ? (
                <div className="space-y-6 divide-y divide-gray-100">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="pt-4 first:pt-0 flex items-start space-x-4 relative group">
                      {/* Logo Entreprise Initiales */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center uppercase shadow-sm flex-shrink-0">
                        {exp.company ? exp.company.slice(0, 2) : "EX"}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-extrabold text-gray-900">{exp.title}</h4>
                          <button
                            onClick={() => handleDeleteExperience(exp.id)}
                            className="text-gray-300 hover:text-red-500 transition p-1 cursor-pointer"
                            title="Supprimer cette expérience"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                        <p className="text-xs font-bold text-gray-700">{exp.company} • <span className="font-semibold text-gray-500">{exp.employmentType}</span></p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {exp.startMonth} {exp.startYear} — {exp.isCurrent ? "Présent" : "Terminé"} • {exp.location} ({exp.locationType})
                        </p>

                        {/* Compétences associées */}
                        {exp.skills && exp.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {exp.skills.map((sk, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-blue-100">
                                • {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <i className="fa-solid fa-briefcase text-3xl text-gray-300"></i>
                  <p className="text-xs font-semibold">Aucune expérience enregistrée pour le moment.</p>
                </div>
              )}
            </div>

            {/* SECTION FORMATION / ÉDUCATION */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <i className="fa-solid fa-graduation-cap text-purple-600 text-lg"></i>
                  <h3 className="text-base font-extrabold text-gray-900">Formation & Diplômes</h3>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center uppercase shadow-xs flex-shrink-0">
                  LP
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-gray-900">Lycée de Pikine</h4>
                  <p className="text-xs font-bold text-gray-700">Baccalauréat Scientifique / Général</p>
                  <p className="text-[11px] text-gray-400 font-medium">2023 — 2026</p>
                </div>
              </div>
            </div>

            {/* SECTION MON PROFIL ET MON CV (CONFORME À LA CAPTURE D'ÉCRAN) */}
            <div id="section-mon-profil-cv" className="space-y-3 pt-2 scroll-mt-24">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Mon profil et mon CV</h2>
                <p className="text-xs md:text-sm text-gray-500 font-medium">Gérez votre identité professionnelle.</p>
              </div>

              {/* Carte Principale Formulaire */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
                
                {/* Bloc Curriculum Vitae + Icône Œil pour Voir le CV + Bouton Importateur */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#047857] flex-shrink-0">
                      <i className="fa-regular fa-file-lines text-2xl font-bold"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-gray-900">Curriculum vitae</h3>
                      <p className="text-xs font-bold flex items-center space-x-2 mt-0.5">
                        {uploadedCvFileName ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0"></span>
                            <span className="text-emerald-600 truncate max-w-[180px] sm:max-w-xs">{uploadedCvFileName}</span>
                            <button
                              type="button"
                              onClick={() => setCvPreviewModalOpen(true)}
                              className="text-[#047857] hover:text-emerald-900 bg-emerald-100/90 hover:bg-emerald-200 p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center"
                              title="Voir le CV (Icône Œil)"
                            >
                              <i className="fa-solid fa-eye text-xs"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block flex-shrink-0"></span>
                            <span className="text-pink-500 font-semibold">Aucun fichier</span>
                            <button
                              type="button"
                              onClick={() => setCvPreviewModalOpen(true)}
                              className="text-gray-700 hover:text-gray-950 bg-gray-100 hover:bg-gray-200 p-1 rounded-md transition cursor-pointer flex items-center justify-center"
                              title="Voir l'aperçu du CV"
                            >
                              <i className="fa-solid fa-eye text-xs"></i>
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={cvFileInputRef}
                    onChange={handleCvFileChange}
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                  />

                  {/* Groupe de boutons d'action : Voir le CV (Icône Œil) & Importateur */}
                  <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setCvPreviewModalOpen(true)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-[#047857] border border-[#A7F3D0] font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer justify-center flex-1 sm:flex-initial"
                      title="Voir le CV (Icône Œil)"
                    >
                      <i className="fa-solid fa-eye text-sm"></i>
                      <span>Voir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cvFileInputRef.current?.click()}
                      className="bg-[#047857] hover:bg-[#036448] text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition shadow-xs cursor-pointer justify-center flex-1 sm:flex-initial"
                    >
                      <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                      <span>Importateur</span>
                    </button>
                  </div>
                </div>

                <div className="border-b border-gray-100"></div>

                {/* Section Informations Personnelles */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">Informations Personnelles</h3>

                  <form onSubmit={handleSavePersonalDetails} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PRÉNOM */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                          PRÉNOM
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-[#10E688] focus:bg-white transition"
                          placeholder="faciliter"
                        />
                      </div>

                      {/* NOM */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                          NOM
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-900 font-bold focus:outline-none focus:border-[#10E688] focus:bg-white transition"
                          placeholder="facile"
                        />
                      </div>

                      {/* TITRE PROFESSIONNEL */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                          TITRE PROFESSIONNEL (EX : INGÉNIEUR DEVOPS)
                        </label>
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#10E688] focus:bg-white transition"
                          placeholder="Développeur Web / Étudiant(e) à lycée de pikine"
                        />
                      </div>

                      {/* VILLE */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                          VILLE
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#10E688] focus:bg-white transition"
                          placeholder="Pikine"
                        />
                      </div>

                      {/* PAYS */}
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                          PAYS
                        </label>
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#10E688] focus:bg-white transition"
                          placeholder="Sénégal"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="bg-[#047857] hover:bg-[#036448] text-white font-extrabold px-6 py-3 rounded-xl text-xs transition shadow-md cursor-pointer flex items-center space-x-2"
                      >
                        <i className="fa-solid fa-check text-xs"></i>
                        <span>Sauvegarder les modifications</span>
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>

          </div>

          {/* COLONNE DROITE : Paramètres de confidentialité & Action rapides */}
          <div className="w-full lg:w-[326px] flex flex-col space-y-4">

            {/* Carte Langue du profil */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Langue du profil</h3>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-bold text-gray-700">Français (Principal)</span>
                <i className="fa-solid fa-check text-emerald-500 text-sm"></i>
              </div>
              <button
                onClick={() => triggerToast("Langue secondaire ajoutée !", "fa-globe")}
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                + Ajouter une langue
              </button>
            </div>

            {/* Carte URL du profil public */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Profil public et URL</h3>
              <p className="text-[11px] text-gray-500 font-medium">facilite.sn/in/faciliter-facile</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("https://facilite.sn/in/faciliter-facile");
                  triggerToast("Lien du profil copié !", "fa-copy");
                }}
                className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Copier le lien du profil
              </button>
            </div>

            {/* Carte Mon profil et mon CV (Mint Green style conforme à la capture) */}
            <div
              className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer flex items-center space-x-3 group"
              onClick={() => {
                const el = document.getElementById("section-mon-profil-cv");
                if (el) el.scrollIntoView({ behavior: "smooth" });
                triggerToast("Section Mon profil et mon CV affichée !", "fa-circle-check");
              }}
            >
              <i className="fa-regular fa-user text-lg text-[#047857] font-bold group-hover:scale-110 transition transform"></i>
              <span className="text-sm font-extrabold text-[#047857] tracking-tight">
                Mon profil et mon CV (Actif)
              </span>
            </div>

            {/* Boutons d'Action Profil & Déconnexion */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  triggerToast("Déconnexion réussie !", "fa-right-from-bracket");
                  setTimeout(() => {
                    window.location.href = "/login";
                  }, 800);
                }}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-extrabold py-3 rounded-2xl text-xs text-center transition border border-red-200 cursor-pointer flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-right-from-bracket text-sm"></i>
                <span>Déconnexion</span>
              </button>

              <Link
                href="/"
                className="w-full bg-gray-900 hover:bg-black text-white font-extrabold py-3 rounded-2xl text-xs text-center transition shadow-md cursor-pointer block"
              >
                ← Retour à l'accueil des offres
              </Link>
            </div>

          </div>

        </div>
      </main>

      {/* MODAL 4: AJOUTER UNE EXPÉRIENCE */}
      {experienceModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target.id === "exp-modal-wrapper") setExperienceModalOpen(false);
          }}
          id="exp-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-xl p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100 animate-fade-in-up">
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
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Intitulé du poste*</label>
                  <input
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-medium text-gray-900"
                    placeholder="Ex: Développeur Full-Stack"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Nom de l'entreprise*</label>
                  <input
                    type="text"
                    required
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-medium text-gray-900"
                    placeholder="Ex: Facilite Inc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Lieu</label>
                  <input
                    type="text"
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-medium text-gray-900"
                    placeholder="Ville ou région"
                  />
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Type de lieu</label>
                  <select
                    value={expLocationType}
                    onChange={(e) => setExpLocationType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-bold text-gray-700 cursor-pointer"
                  >
                    <option value="Sur site">Sur site</option>
                    <option value="Hybride">Hybride</option>
                    <option value="À distance">À distance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Type d'emploi</label>
                  <select
                    value={expEmploymentType}
                    onChange={(e) => setExpEmploymentType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-bold text-gray-700 cursor-pointer"
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
                </div>
              </div>

              <div className="flex items-center space-x-2 py-1">
                <input
                  type="checkbox"
                  id="expIsCurrent"
                  checked={expIsCurrent}
                  onChange={(e) => setExpIsCurrent(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-400 cursor-pointer"
                />
                <label htmlFor="expIsCurrent" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Ceci est mon poste actuel
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Mois de début*</label>
                  <select
                    value={expStartMonth}
                    onChange={(e) => setExpStartMonth(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-bold text-gray-700 cursor-pointer"
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
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Année de début*</label>
                  <select
                    value={expStartYear}
                    onChange={(e) => setExpStartYear(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 transition font-bold text-gray-700 cursor-pointer"
                  >
                    {Array.from({ length: 15 }, (_, i) => 2026 - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
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

                {expSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {expSkills.map((sk, idx) => (
                      <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs px-3 py-1 rounded-full flex items-center space-x-1.5">
                        <span>{sk}</span>
                        <button type="button" onClick={() => handleRemoveSkill(sk)} className="hover:text-red-600">
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded-full text-xs shadow-md transition cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL APERÇU / VISIONNEUSE NATIVE DU CV (DÉCLENCHÉE PAR L'ICÔNE ŒIL) */}
      {cvPreviewModalOpen && (
        <div
          className="fixed inset-0 z-[750] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setCvPreviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl space-y-5 relative border border-gray-100 transform transition-all scale-100 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton Fermer */}
            <button
              onClick={() => setCvPreviewModalOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer z-20"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            {/* En-tête Visionneuse */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 pr-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#047857] flex items-center justify-center font-bold">
                  <i className="fa-solid fa-file-pdf text-lg"></i>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">Visionneuse de CV</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {uploadedCvFileName ? `Document : ${uploadedCvFileName}` : "Aucun fichier de CV téléversé"}
                  </p>
                </div>
              </div>

              {cvUrl && (
                <a
                  href={cvUrl}
                  download={uploadedCvFileName || "Mon_CV.pdf"}
                  className="hidden sm:flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-[#047857] border border-[#A7F3D0] px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer"
                >
                  <i className="fa-solid fa-download text-xs"></i>
                  <span>Télécharger</span>
                </a>
              )}
            </div>

            {/* Corps de la Visionneuse */}
            <div className="flex-1 bg-gray-100 border border-gray-200 rounded-2xl overflow-hidden min-h-[450px] flex items-center justify-center relative shadow-inner">
              {cvUrl ? (
                cvFileType === "pdf" || cvUrl.startsWith("data:application/pdf") ? (
                  <iframe
                    src={cvUrl}
                    title="Visionneuse PDF CV"
                    className="w-full h-full min-h-[500px] border-none rounded-2xl"
                  />
                ) : (
                  <div className="p-8 text-center space-y-4 max-w-md bg-white rounded-2xl shadow-lg border border-gray-200">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
                      <i className="fa-regular fa-file-word"></i>
                    </div>
                    <h4 className="text-base font-extrabold text-gray-900">{uploadedCvFileName}</h4>
                    <p className="text-xs text-gray-500 font-medium">
                      Ce document Word (.docx) est enregistré dans votre profil Supabase. Vous pouvez le consulter ou le télécharger ci-dessous.
                    </p>
                    <a
                      href={cvUrl}
                      download={uploadedCvFileName || "Mon_CV.docx"}
                      className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                    >
                      <i className="fa-solid fa-download text-xs"></i>
                      <span>Télécharger le fichier Word</span>
                    </a>
                  </div>
                )
              ) : (
                <div className="p-8 text-center space-y-4 max-w-md">
                  <div className="w-20 h-20 bg-pink-50 text-pink-500 rounded-3xl flex items-center justify-center mx-auto text-3xl font-bold shadow-xs">
                    <i className="fa-regular fa-file-excel"></i>
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-gray-900">Aucun CV importé</h4>
                    <p className="text-xs text-gray-500 font-medium mt-1">
                      Vous n'avez pas encore téléversé de document. Cliquez sur "Importateur" pour ajouter votre CV au format PDF ou Word.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCvPreviewModalOpen(false);
                      cvFileInputRef.current?.click();
                    }}
                    className="bg-[#047857] hover:bg-[#036448] text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-md transition cursor-pointer inline-flex items-center space-x-2"
                  >
                    <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                    <span>Importer un CV maintenant</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer Modale Visionneuse */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-gray-400">Document Certifié Facilite HD</span>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setCvPreviewModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- MODALE DE RECADRAGE & ZOOM INTERACTIVE (STYLE LINKEDIN 1:1) --- */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] animate-scale-up">
            
            {/* Header Modale */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-gray-900">
                {cropType === "avatar" ? "Choisir une photo de profil" : "Ajuster la photo de couverture"}
              </h3>
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            {/* Corps Modale */}
            <div className="p-6 overflow-y-auto space-y-5">
              
              {/* Champ Description */}
              <div>
                <textarea
                  rows={2}
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                  placeholder="Description..."
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl text-xs font-medium focus:outline-none focus:border-blue-600 transition placeholder-gray-400"
                />
              </div>

              {/* Zone de recadrage interactive avec cadre (circulaire pour avatar, rectangulaire pour couverture) */}
              <div
                className="relative w-full h-72 sm:h-80 bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => {
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - imagePos.x, y: e.clientY - imagePos.y });
                }}
                onMouseMove={(e) => {
                  if (!isDragging) return;
                  setImagePos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {/* Image brute avec transformation de zoom et position */}
                <img
                  src={rawImageSrc}
                  alt="Aperçu recadrage"
                  draggable={false}
                  className="max-w-none transition-transform duration-75 pointer-events-none"
                  style={{
                    transform: `translate(${imagePos.x}px, ${imagePos.y}px) scale(${zoomScale})`,
                    maxHeight: cropType === "avatar" ? "80%" : "90%",
                  }}
                />

                {/* Masque de cadrage visuel */}
                {cropType === "avatar" ? (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Fond d'assombrissement hors du cercle */}
                    <div className="w-full h-full bg-black/50 mask-radial flex items-center justify-center">
                      <div className="w-56 h-56 rounded-full border-2 border-white/80 shadow-2xl relative">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-xs flex items-center space-x-1.5 whitespace-nowrap shadow-md">
                          <i className="fa-solid fa-arrows-up-down-left-right text-xs"></i>
                          <span>Faites glisser pour repositionner l'image</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    <div className="w-full h-48 border-2 border-dashed border-white/90 rounded-2xl shadow-2xl relative">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-xs flex items-center space-x-1.5 whitespace-nowrap shadow-md">
                        <i className="fa-solid fa-arrows-up-down-left-right text-xs"></i>
                        <span>Faites glisser pour ajuster la couverture</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Slider de Zoom (+ / -) */}
              <div className="flex items-center space-x-4 px-4 pt-2">
                <span className="text-xs font-bold text-gray-500">-</span>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={zoomScale}
                  onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-xs font-bold text-gray-500">+</span>
              </div>

              {/* Boutons d'action secondaires (Recadrer / Rendre provisoire) */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setImagePos({ x: 0, y: 0 });
                    triggerToast("Cadre réinitialisé", "fa-arrows-rotate");
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-crop text-gray-600"></i>
                  <span>Recadrer la photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProvisional(!isProvisional);
                    triggerToast(isProvisional ? "Mode normal" : "Marqué comme provisoire", "fa-clock");
                  }}
                  className={`text-xs font-extrabold px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                    isProvisional ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                  }`}
                >
                  <i className="fa-regular fa-clock text-gray-600"></i>
                  <span>Rendre provisoire</span>
                </button>
              </div>

              {/* Notice Visibilité */}
              <div className="flex items-center space-x-2 text-gray-500 text-xs font-semibold pt-1">
                <i className="fa-solid fa-earth-americas text-gray-400"></i>
                <span>Votre photo de profil est publique.</span>
              </div>

            </div>

            {/* Footer Modale (Annuler / Enregistrer) */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="px-5 py-2.5 text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleSaveCroppedImage}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-full shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-95 flex items-center space-x-2"
              >
                <span>Enregistrer</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODALE DE VISUALISATION PLEIN ÉCRAN --- */}
      {viewImageModal.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 p-6 flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4">
              <h3 className="text-base font-extrabold text-gray-900">{viewImageModal.title}</h3>
              <button
                type="button"
                onClick={() => setViewImageModal({ open: false, url: "", title: "" })}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>
            <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4 bg-gray-100">
              <img src={viewImageModal.url} alt="Aperçu grand format" className="w-full h-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => setViewImageModal({ open: false, url: "", title: "" })}
              className="px-6 py-2 bg-gray-900 text-white font-bold text-xs rounded-full cursor-pointer hover:bg-gray-800 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
