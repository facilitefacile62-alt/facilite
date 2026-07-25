"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function ProfilPage() {
  const [selectedLang, setSelectedLang] = useState("FR");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [searchQuery, setSearchQuery] = useState("");

  // Équipes & États Profil Éditable
  const [profileName, setProfileName] = useState("faciliter facile");
  const [profileSubtitle, setProfileSubtitle] = useState("Étudiant(e) à lycée de pikine");
  const [profileLocation, setProfileLocation] = useState("Pikine, Région de Dakar, Sénégal");
  const [profileBio, setProfileBio] = useState("Étudiant passionné par le développement web, l'ingénierie digitale et la création de CV modernes et percutants. En recherche d'opportunités d'apprentissage et de stages en technologie.");
  const [isEditingBio, setIsEditingBio] = useState(false);

  // Formulaire "Mon profil et mon CV"
  const [firstName, setFirstName] = useState("faciliter");
  const [lastName, setLastName] = useState("facile");
  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("Pikine");
  const [country, setCountry] = useState("Sénégal");
  const [uploadedCvFileName, setUploadedCvFileName] = useState(null);
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

  // Charger les données sauvegardées au montage
  useEffect(() => {
    const savedExps = localStorage.getItem("user_experiences");
    if (savedExps) {
      try {
        setExperiences(JSON.parse(savedExps));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Expérience par défaut si vide
      const defaultExp = [
        {
          id: 1,
          title: "chef",
          company: "facilite",
          location: "pikine",
          locationType: "Hybride",
          employmentType: "Temps plein",
          isCurrent: true,
          startMonth: "juillet",
          startYear: "2026",
          skills: ["Management", "Gestion de projet", "Communication"]
        }
      ];
      setExperiences(defaultExp);
      localStorage.setItem("user_experiences", JSON.stringify(defaultExp));
    }

    const savedBio = localStorage.getItem("user_profile_bio");
    if (savedBio) setProfileBio(savedBio);
  }, []);

  const handleSaveBio = () => {
    localStorage.setItem("user_profile_bio", profileBio);
    setIsEditingBio(false);
    triggerToast("Résumé du profil mis à jour !", "fa-pen-to-square");
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

  const handleCvFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedCvFileName(file.name);
      triggerToast(`Fichier "${file.name}" importé avec succès !`, "fa-file-circle-check");
    }
  };

  const handleSavePersonalDetails = (e) => {
    if (e) e.preventDefault();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setProfileName(fullName || "faciliter facile");
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

            <a
              href="#"
              onClick={handleOpenModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-comment-dots text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Contact</span>
            </a>
          </div>

          {/* Groupe Droit : Mon Profil (Actif) */}
          <div className="hidden md:flex items-center">
            <Link
              href="/profil"
              className="flex flex-col items-center justify-center text-center text-[#10E688] font-bold space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-circle-user text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Profil</span>
            </Link>
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

        {/* Menu Déroulant Mobile (3 traits) */}
        <div
          className={`absolute top-full left-0 w-full bg-[#FAF6F1] shadow-xl flex-col py-4 px-4 space-y-3 md:hidden border-t border-gray-200/80 transition-all ${
            mobileMenuOpen ? "flex" : "hidden"
          }`}
        >
          {/* Barre de recherche Mobile */}
          <div className="relative w-full px-1 mb-1">
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

          <a
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-house text-lg w-6 text-gray-500"></i>
            <span>Accueil</span>
          </a>

          <Link
            href="/service"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-briefcase text-lg w-6 text-gray-500"></i>
            <span>Service</span>
          </Link>

          <a
            href="#"
            onClick={handleOpenModal}
            className="flex items-center space-x-3 text-gray-800 hover:text-blue-600 transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-regular fa-comment-dots text-lg w-6 text-gray-500"></i>
            <span>Contactez-nous</span>
          </a>

          <a
            href="#section-mon-profil-cv"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              const el = document.getElementById("section-mon-profil-cv");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center space-x-3 text-[#10E688] font-extrabold p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200"
          >
            <i className="fa-solid fa-circle-user text-lg w-6 text-[#10E688]"></i>
            <span>Mon profil & CV</span>
          </a>

          {/* Sélecteur de langue dans le menu 3 traits */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200/80 px-2 mt-1">
            <span className="text-xs font-bold text-gray-600 flex items-center space-x-1.5">
              <i className="fa-solid fa-globe text-gray-400"></i>
              <span>Langue</span>
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedLang("FR")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                  selectedLang === "FR" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                <img src="/francais.avif" alt="FR" className="w-4 h-4 rounded-full object-cover" />
                <span>FR</span>
              </button>
              <button
                onClick={() => setSelectedLang("GB")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                  selectedLang === "GB" ? "bg-[#E4B8F9] text-purple-950 shadow-xs" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                <img src="/anglais.jpeg" alt="GB" className="w-4 h-4 rounded-full object-cover" />
                <span>EN</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Profile Page Container */}
      <main className="min-h-screen bg-[#F4F2EE] pt-[76px] pb-16 px-4 md:px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col lg:flex-row gap-6 items-start justify-center">
          
          {/* COLONNE GAUCHE & CENTRALE COMBINÉE : Carte Profil Principale & Sections */}
          <div className="w-full lg:w-[830px] flex flex-col space-y-4">

            {/* CARTE HERO PROFIL STYLE LINKEDIN */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs relative">
              {/* Image de couverture spatiale stellaire */}
              <div
                className="h-44 md:h-56 bg-cover bg-center bg-no-repeat relative"
                style={{ backgroundImage: "url('/stellar-cover.png')" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-indigo-950/60"></div>
                <button
                  onClick={() => triggerToast("Bannière mise à jour !", "fa-image")}
                  className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-800 p-2 rounded-full shadow-md text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer backdrop-blur-xs"
                >
                  <i className="fa-solid fa-camera text-gray-600"></i>
                  <span className="hidden sm:inline">Changer la couverture</span>
                </button>
              </div>

              {/* Contenu Profil Hero */}
              <div className="px-6 md:px-8 pb-6 pt-0 relative">
                {/* Photo de profil (Grand cercle clé Facilite avec bordure blanche) */}
                <div className="-mt-16 md:-mt-20 mb-4 relative z-10 w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white group flex-shrink-0">
                  <img
                    src="/logo.jpeg"
                    alt="Logo Profil Facilite"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div
                    onClick={() => triggerToast("Photo de profil mise à jour !", "fa-camera")}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                  >
                    <i className="fa-solid fa-camera text-xl"></i>
                  </div>
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

            {/* Bouton Retour à l'accueil */}
            <Link
              href="/"
              className="w-full bg-gray-900 hover:bg-black text-white font-extrabold py-3 rounded-2xl text-xs text-center transition shadow-md cursor-pointer block"
            >
              ← Retour à l'accueil des offres
            </Link>

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
      {/* MODAL APERÇU DU CV (DECLENCHÉ PAR L'ICÔNE OEIL) */}
      {cvPreviewModalOpen && (
        <div
          className="fixed inset-0 z-[750] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setCvPreviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 relative border border-gray-100 transform transition-all scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bouton Fermer */}
            <button
              onClick={() => setCvPreviewModalOpen(false)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            {/* En-tête Aperçu */}
            <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#047857] flex items-center justify-center font-bold">
                <i className="fa-solid fa-eye text-lg"></i>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Aperçu du CV</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {uploadedCvFileName ? `Fichier chargé : ${uploadedCvFileName}` : "Aperçu de votre identité professionnelle Facilite"}
                </p>
              </div>
            </div>

            {/* Document Aperçu CV Simulation */}
            <div className="bg-[#FAF9F6] border border-gray-200 rounded-2xl p-6 md:p-8 shadow-inner space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{profileName}</h1>
                  <p className="text-sm font-bold text-[#047857]">{profileSubtitle}</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">{profileLocation}</p>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-white shadow-md overflow-hidden bg-white">
                  <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Bio / Résumé */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Profil Personnel</h4>
                <p className="text-xs text-gray-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-gray-200/80">
                  {profileBio}
                </p>
              </div>

              {/* Expériences */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Expériences Professionnelles</h4>
                {experiences.length > 0 ? (
                  experiences.map((exp) => (
                    <div key={exp.id} className="bg-white p-3.5 rounded-xl border border-gray-200/80 space-y-1">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-extrabold text-gray-900">{exp.title} — <span className="text-gray-600 font-bold">{exp.company}</span></h5>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{exp.startMonth} {exp.startYear}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 font-medium">{exp.location} ({exp.locationType}) • {exp.employmentType}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">Aucune expérience enregistrée.</p>
                )}
              </div>
            </div>

            {/* Actions Modal */}
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-gray-400">Modèle Facilite HD • Format A4</span>
              <div className="flex space-x-3">
                <button
                  onClick={() => setCvPreviewModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    triggerToast("Téléchargement du CV lancé !", "fa-download");
                    setCvPreviewModalOpen(false);
                  }}
                  className="px-5 py-2 bg-[#10E688] hover:bg-[#0ed67e] text-gray-950 font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center space-x-1.5"
                >
                  <i className="fa-solid fa-download text-xs"></i>
                  <span>Télécharger PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
