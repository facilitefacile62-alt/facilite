/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import AIAssistantModal from "@/components/AIAssistantModal";
import RoleBadge from "@/components/RoleBadge";
import RoleNavLink from "@/components/RoleNavLink";
import BadgeDisplay from "@/components/BadgeDisplay";
import ThemeSettings from "@/components/ThemeSettings";
import DiagnosticModal from "@/components/DiagnosticModal";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import SecurityTabContent from "@/components/SecurityTabContent";

export default function ProfilPage() {
  const pathname = usePathname();
  const [selectedLang, setSelectedLang] = useState("FR");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const plusDropdownRef = useRef(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [searchQuery, setSearchQuery] = useState("");

  // Notifications System (LinkedIn Style)
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState("all");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);

  // Équipes & États Profil Éditable (Chargés dynamiquement depuis Supabase)
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("user");
  const [profileBadges, setProfileBadges] = useState([]);
  const [isNavAdmin, setIsNavAdmin] = useState(false);
  const [isNavRecruiter, setIsNavRecruiter] = useState(false);
  const [activeTab, setActiveTab] = useState("about"); // "about" | "documents" | "settings"
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef(null);
  const [sectionTitleMenuOpen, setSectionTitleMenuOpen] = useState(false);
  const sectionTitleMenuRef = useRef(null);
  const [roleQueryError, setRoleQueryError] = useState(null);
  const [adminRpcError, setAdminRpcError] = useState(null);
  const [profileSubtitle, setProfileSubtitle] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [tempBio, setTempBio] = useState("");
  const [pinnedDetails, setPinnedDetails] = useState([]);
  const [tempPinnedDetails, setTempPinnedDetails] = useState([]);
  const [phone, setPhone] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [educationLevel, setEducationLevel] = useState("Aucun");
  // Ouvre directement un onglet précis via ?tab=... (ex: lien "Sécurisez votre
  // compte" ou redirection post-connexion OTP depuis /forgot-password).
  // Initialiseur paresseux plutôt qu'un effet : window.location.search est
  // lu une seule fois, sans setState supplémentaire ni Suspense boundary.
  const [activeAboutTab, setActiveAboutTab] = useState(() => {
    if (typeof window === "undefined") return "info_perso";
    return new URLSearchParams(window.location.search).get("tab") || "info_perso";
  });

  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") return "info_perso";
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    return tabParam === "personal_info" ? "info_perso" : (tabParam || "info_perso");
  });

  const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
  const aboutDropdownRef = useRef(null);

  const [selectedSection, setSelectedSection] = useState(() => {
    if (typeof window === "undefined") return null;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    return tabParam === "personal_info" ? "info_perso" : (tabParam || null);
  });

  // Synchronisation unidirectionnelle : activeSection pilote activeAboutTab.
  // L'inverse causàit une boucle de re-render infinie (chaque effet déclenchait l'autre).
  useEffect(() => {
    const target = activeSection === "personal_info" ? "info_perso" : activeSection;
    if (activeAboutTab !== target) {
      setActiveAboutTab(target);
    }
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!userSession?.user?.id) {
      setIsNavAdmin(false);
      setIsNavRecruiter(false);
      return;
    }
    let cancelled = false;

    // Invalidation du cache session
    supabase.auth.refreshSession().catch(() => {}).then(async () => {
      if (cancelled) return;
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const checkUserId = freshSession?.user?.id || userSession.user.id;

      supabase
        .rpc("is_admin", { check_user_id: checkUserId })
        .then(({ data: isAdmin, error }) => {
          if (cancelled) return;
          if (error) {
            console.warn("[Profil Nav] Erreur RPC is_admin:", error.message);
            setAdminRpcError(error.message);
            setIsNavAdmin(false);
          } else {
            setIsNavAdmin(isAdmin === true);
            if (isAdmin === true) {
              setProfileRole("admin");
            }
          }
        })
        .catch((err) => {
          if (!cancelled) setAdminRpcError(err.message || "Catch error");
        });

      supabase
        .rpc("has_badge", {
          check_user_id: checkUserId,
          badge_name: "verified_recruiter",
        })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.warn("[Profil Nav] Erreur RPC has_badge:", error.message);
            setIsNavRecruiter(false);
          } else {
            setIsNavRecruiter(data === true);
          }
        })
        .catch(() => {
          if (!cancelled) setIsNavRecruiter(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [userSession?.user?.id]);

  // Accordéon mobile de la liste d'onglets "À propos" : replié par défaut
  // pour économiser l'espace d'écran (sans effet en desktop, où la liste
  // reste une barre latérale toujours visible via md:flex).
  const [aboutTabsOpen, setAboutTabsOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [company, setCompany] = useState("");
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
  // Publication du profil sur /in/[slug] — opt-in explicite, deux niveaux
  const [isPublic, setIsPublic] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [cvVisibleRecruteurs, setCvVisibleRecruteurs] = useState(false);
  const [savingCvVisibility, setSavingCvVisibility] = useState(false);
  const [showCvVisibilityInvite, setShowCvVisibilityInvite] = useState(false);
  const [uploadedCvFileName, setUploadedCvFileName] = useState(null);
  const [cvUrl, setCvUrl] = useState(null);
  // cvUrl contient un CHEMIN de stockage (bucket privé) ; cvDisplayUrl contient
  // l'URL signée temporaire réellement utilisable dans un href / une iframe.
  const [cvDisplayUrl, setCvDisplayUrl] = useState(null);
  const [cvFileType, setCvFileType] = useState(null); // 'pdf' | 'doc' | 'image'
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [cvPreviewModalOpen, setCvPreviewModalOpen] = useState(false);
  const cvFileInputRef = useRef(null);
  const aiCvFileInputRef = useRef(null);
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [savingScanData, setSavingScanData] = useState(false);
  const [scanModalActiveTab, setScanModalActiveTab] = useState("general");
  const [scannedData, setScannedData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    bio: "",
    city: "",
    country: "",
    birthDate: "",
    gender: "",
    maritalStatus: "",
    driverLicense: "",
    email: "",
    phone: "",
    skills: [],
    interests: [],
    experiences: [],
    educations: [],
    languages: [],
    docUrl: "",
    docName: "",
    isIdentityDoc: false,
  });
  const [userDocuments, setUserDocuments] = useState([]);
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  // Compétences dynamique (Supabase)
  const [userSkills, setUserSkills] = useState([]);
  const [newSkillInput, setNewSkillInput] = useState("");

  // Centres d'intérêt dynamique (Supabase)
  const [userInterests, setUserInterests] = useState([]);
  const [newInterestInput, setNewInterestInput] = useState("");

  // Coordonnées de contact extraites (Supabase)
  const [contactEmail, setContactEmail] = useState("");

  // Langues dynamique (Supabase + localStorage)
  const [userLanguages, setUserLanguages] = useState([]);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [newLangName, setNewLangName] = useState("");
  const [newLangLevel, setNewLangLevel] = useState("Intermédiaire");

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

  // Formations / Éducation dynamique (Supabase + localStorage)
  const [educations, setEducations] = useState([]);
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [eduSchool, setEduSchool] = useState("");
  const [eduDegree, setEduDegree] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduStartYear, setEduStartYear] = useState("2023");
  const [eduEndYear, setEduEndYear] = useState("2026");
  const [eduIsCurrent, setEduIsCurrent] = useState(false);

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "" });

  const profileData = {
    telephone: phone,
    email: contactEmail || userSession?.user?.email || "",
    centres_interet: userInterests,
  };

  // Régénère une URL signée dès que le document courant change
  useEffect(() => {
    let annule = false;
    // Résolution asynchrone dans les deux cas : évite un setState synchrone
    // dans le corps de l'effet (cascade de rendus).
    Promise.resolve(cvUrl ? getSignedCvUrl(cvUrl) : null).then((url) => {
      if (!annule) setCvDisplayUrl(url);
    });
    return () => {
      annule = true;
    };
  }, [cvUrl]);

  /**
   * Enregistre les réglages de visibilité publique.
   * Couper is_public coupe aussi show_contact : on ne conserve jamais un
   * consentement aux coordonnées sur un profil redevenu privé.
   */
  const handleSaveVisibility = async (champ, valeur) => {
    if (!userSession?.user) return;
    setSavingVisibility(true);

    const majIsPublic = champ === "is_public" ? valeur : isPublic;
    const majShowContact =
      champ === "is_public" && valeur === false
        ? false
        : champ === "show_contact"
        ? valeur
        : showContact;

    try {
      const { error } = await supabase.from("profiles").update({
        is_public: majIsPublic,
        show_contact: majShowContact,
        updated_at: new Date().toISOString(),
      }).eq("id", userSession.user.id);

      if (error) {
        triggerToast("Impossible d'enregistrer ce réglage.", "fa-triangle-exclamation");
        return;
      }

      setIsPublic(majIsPublic);
      setShowContact(majShowContact);
      triggerToast(
        majIsPublic ? "Profil public activé." : "Profil repassé en privé.",
        majIsPublic ? "fa-globe" : "fa-lock"
      );
    } catch (err) {
      console.error("Exception visibility update:", err);
      triggerToast("Erreur lors de la sauvegarde", "fa-triangle-exclamation");
    } finally {
      setSavingVisibility(false);
    }
  };

  /**
   * Consentement explicite du candidat à apparaître dans la CVthèque des
   * recruteurs vérifiés (cv_visible_recruteurs, FALSE par défaut — déposer
   * un CV n'est pas un consentement à être présenté, voir
   * docs/purge-avant-lancement.md). Distinct de is_public : un profil peut
   * être privé au grand public tout en étant visible des recruteurs
   * vérifiés, et inversement.
   */
  const handleSaveCvVisibility = async (valeur) => {
    if (!userSession?.user) return;
    setSavingCvVisibility(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_visible_recruteurs: valeur })
        .eq("id", userSession.user.id);

      if (error) {
        triggerToast("Impossible d'enregistrer ce réglage.", "fa-triangle-exclamation");
        return;
      }

      setCvVisibleRecruteurs(valeur);
      if (valeur) setShowCvVisibilityInvite(false);
      triggerToast(
        valeur ? "Votre CV est désormais visible par les recruteurs vérifiés." : "Votre CV n'est plus visible par les recruteurs.",
        valeur ? "fa-eye" : "fa-eye-slash"
      );
    } catch (err) {
      console.error("Exception cv visibility update:", err);
      triggerToast("Erreur lors de l'enregistrement", "fa-triangle-exclamation");
    } finally {
      setSavingCvVisibility(false);
    }
  };

  const triggerToast = (msg, icon = "fa-check") => {
    setToast({ show: true, message: msg, icon });
    setTimeout(() => setToast({ show: false, message: "", icon: "" }), 3000);
  };

  // Synchroniser les données depuis Supabase et protéger la route
  useEffect(() => {
    async function loadUserProfile() {
      // Invalidation du cache client de session : rafraîchissement forcé
      await supabase.auth.refreshSession().catch(() => {});
      const { data: { session } } = await supabase.auth.getSession();
      setUserSession(session);

      if (!session) {
        // Redirection stricte vers /login si le visiteur n'est pas connecté
        window.location.href = "/login";
        return;
      }

      // 1. Récupérer l'ensemble des documents de l'utilisateur depuis la table resumes
      let resumesList = [];
      try {
        const { data, error } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
        if (error) {
          console.warn("[loadUserProfile] Erreur de chargement des resumes:", error.message);
        } else {
          resumesList = data || [];
        }
      } catch (err) {
        console.error("[loadUserProfile] Exception resumes:", err);
      }

      // 2. Récupérer le profil depuis la table profiles
      let profile = null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (error) {
          console.warn("[loadUserProfile] Erreur de chargement du profil:", error.message);
        } else {
          profile = data;
        }
      } catch (err) {
        console.error("[loadUserProfile] Exception profil:", err);
      }

      // 3. Récupérer si recruteur vérifié via RPC has_badge
      let isRecruiterRpc = false;
      try {
        const { data: isRecruiter, error } = await supabase
          .rpc("has_badge", { check_user_id: session.user.id, badge_name: "verified_recruiter" });
        if (error) {
          console.warn("[loadUserProfile] Erreur RPC has_badge:", error.message);
        } else {
          isRecruiterRpc = isRecruiter === true;
        }
      } catch (err) {
        console.error("[loadUserProfile] Exception RPC has_badge:", err);
      }

      // 4. Appel direct à la fonction RPC is_admin (SECURITY DEFINER)
      let isAdminRpc = false;
      try {
        await supabase.auth.refreshSession().catch(() => {});
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        const checkUserId = freshSession?.user?.id || session.user.id;

        const { data: isAdmin, error } = await supabase
          .rpc("is_admin", { check_user_id: checkUserId });
        if (error) {
          setAdminRpcError(error.message);
          console.warn("[loadUserProfile] Erreur RPC is_admin:", error.message);
        } else {
          isAdminRpc = isAdmin === true;
        }
      } catch (err) {
        setAdminRpcError(err.message || "Exception RPC is_admin");
        console.error("[loadUserProfile] Exception RPC is_admin:", err);
      }

      // Déterminer le rôle final et les badges indépendamment du profil
      let finalRole = "user";
      if (isAdminRpc === true) {
        finalRole = "admin";
        setIsNavAdmin(true);
      } else if (isRecruiterRpc === true) {
        finalRole = "recruiter";
        setIsNavRecruiter(true);
      }
      setProfileRole(finalRole);

      let finalBadges = profile?.badges || [];
      if (isAdminRpc === true && !finalBadges.includes("administrateur")) {
        finalBadges = [...finalBadges, "administrateur"];
      }
      setProfileBadges(finalBadges);

      let profileCvUrl = profile?.cv_url || null;
      let profileCvName = profile?.cv_name || null;

      if (profile) {
        setProfileName(profile.full_name || session.user.email?.split("@")[0] || "");
        setEducationLevel(profile.education_level || "Aucun");
        setProfileSubtitle(profile.headline || "");
        setProfileLocation(profile.location || "");
        setProfileBio(profile.bio || "");
        setTempBio(profile.bio || "");
        const initialPinned = profile.pinned_details || (typeof window !== "undefined" && localStorage.getItem("user_pinned_details") ? JSON.parse(localStorage.getItem("user_pinned_details")) : []);
        setPinnedDetails(initialPinned);
        setTempPinnedDetails(initialPinned);
        setPhone(profile.phone || (typeof window !== "undefined" ? localStorage.getItem("user_phone") || "" : ""));
        setMaritalStatus(profile.marital_status || (typeof window !== "undefined" ? localStorage.getItem("user_marital_status") || "" : ""));
        setDriverLicense(profile.driver_license || (typeof window !== "undefined" ? localStorage.getItem("user_driver_license") || "" : ""));
        setWebsiteUrl(profile.website_url || (typeof window !== "undefined" ? localStorage.getItem("user_website_url") || "" : ""));
        setBirthDate(profile.birth_date || (typeof window !== "undefined" ? localStorage.getItem("user_birth_date") || "" : ""));
        setGender(profile.gender || (typeof window !== "undefined" ? localStorage.getItem("user_gender") || "" : ""));
        setCompany(profile.company || (typeof window !== "undefined" ? localStorage.getItem("user_company") || "" : ""));
        setAvatarUrl(profile.avatar_url || "/logo.jpeg");
        setCoverUrl(profile.cover_url || "/stellar-cover.png");
        setExperiences(profile.experiences || []);
        setEducations(profile.educations || []);
        setUserLanguages(profile.languages || []);
        setUserSkills(profile.skills || []);
        setUserInterests(profile.interests || []);
        setContactEmail(profile.contact_email || session.user.email || "");
        setIsPublic(profile.is_public === true);
        setShowContact(profile.show_contact === true);
        setCvVisibleRecruteurs(profile.cv_visible_recruteurs === true);

        // Incrémenter dynamiquement le compteur de vues du profil (optionnel, silencieux)
        try {
          const updatedProfileViews = (profile.profile_views || 0) + 1;
          supabase
            .from("profiles")
            .update({ profile_views: updatedProfileViews })
            .eq("id", session.user.id)
            .then();
        } catch (err) {}
      } else {
        // En cas d'erreur 500 ou d'échec de chargement, bascule sur des valeurs par défaut à partir de la session
        setProfileName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "");
        setContactEmail(session.user.email || "");
        setAvatarUrl(session.user.user_metadata?.avatar_url || "/logo.jpeg");
        setCoverUrl("/stellar-cover.png");
        setEducationLevel("Aucun");
        setProfileSubtitle("");
        setProfileLocation("");
        setProfileBio("");
        setTempBio("");
        setExperiences([]);
        setEducations([]);
        setUserLanguages([]);
        setUserSkills([]);
        setUserInterests([]);
        setPinnedDetails([]);
        setTempPinnedDetails([]);
        setPhone(typeof window !== "undefined" ? localStorage.getItem("user_phone") || "" : "");
        setMaritalStatus(typeof window !== "undefined" ? localStorage.getItem("user_marital_status") || "" : "");
        setDriverLicense(typeof window !== "undefined" ? localStorage.getItem("user_driver_license") || "" : "");
        setWebsiteUrl(typeof window !== "undefined" ? localStorage.getItem("user_website_url") || "" : "");
        setBirthDate(typeof window !== "undefined" ? localStorage.getItem("user_birth_date") || "" : "");
        setGender(typeof window !== "undefined" ? localStorage.getItem("user_gender") || "" : "");
        setCompany(typeof window !== "undefined" ? localStorage.getItem("user_company") || "" : "");
        setIsPublic(false);
        setShowContact(true);
        setCvVisibleRecruteurs(true);
      }

      if (resumesList && resumesList.length > 0) {
        setUserDocuments(resumesList);
        if (!profileCvUrl) {
          profileCvUrl = resumesList[0].file_url;
          profileCvName = resumesList[0]?.title;
        }
      } else if (profileCvUrl) {
        setUserDocuments([{
          id: "primary-profile-cv",
          title: profileCvName || "Mon_CV_Professionnel",
          file_url: profileCvUrl,
          type: "CV",
          created_at: new Date().toISOString()
        }]);
      } else if (typeof window !== "undefined") {
        const localUrl = localStorage.getItem("user_cv_url");
        const localName = localStorage.getItem("user_cv_name");
        if (localUrl) {
          profileCvUrl = localUrl;
          profileCvName = localName;
          setUserDocuments([{
            id: "local-cv-doc",
            title: localName || "Mon_CV_Professionnel",
            file_url: localUrl,
            type: "CV",
            created_at: new Date().toISOString()
          }]);
        }
      }

      if (profileCvUrl) {
        setCvUrl(profileCvUrl);
        setUploadedCvFileName(profileCvName || "Mon_CV_Professionnel");
        if (profileCvUrl.includes("pdf") || profileCvUrl.startsWith("data:application/pdf")) {
          setCvFileType("pdf");
        } else if (profileCvUrl.includes("doc") || profileCvUrl.includes("word")) {
          setCvFileType("doc");
        } else {
          setCvFileType("pdf");
        }
      }

      if (profile?.full_name) {
        const parts = profile.full_name.trim().split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      } else if (typeof window !== "undefined") {
        setFirstName(localStorage.getItem("user_first_name") || "");
        setLastName(localStorage.getItem("user_last_name") || "");
      }

      setJobTitle(profile?.headline || (typeof window !== "undefined" ? localStorage.getItem("user_job_title") || "" : ""));
      setCity(profile?.city || (profile?.location ? profile.location.split(",")[0]?.trim() : (typeof window !== "undefined" ? localStorage.getItem("user_city") || "" : "")));
      setCountry(profile?.country || (profile?.location ? profile.location.split(",")[1]?.trim() : (typeof window !== "undefined" ? localStorage.getItem("user_country") || "" : "")));
    }

    loadUserProfile();
  }, []);

  // Abonnement Realtime sur `resumes` : reflète en direct le passage
  // 'processing' -> 'completed'/'error' déclenché par /api/process-resume
  // après l'upload d'un CV, sans avoir à rafraîchir la page.
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`resumes-status-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "resumes", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updatedRow = payload.new;
          if (!updatedRow) return;
          setUserDocuments((prevDocs) =>
            prevDocs.map((doc) => (doc.id === updatedRow.id ? { ...doc, ...updatedRow } : doc))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userSession?.user?.id]);

  // Filtered Notifications helper
  const filteredNotifications = notificationsList.filter(n => {
    if (activeNotifFilter === "jobs") return n.type === "jobs";
    if (activeNotifFilter === "posts") return n.type === "posts";
    if (activeNotifFilter === "mentions") return n.type === "mentions";
    return true;
  });

  const handleCloseModal = () => {
    setContactModalOpen(false);
    setTimeout(() => {
      setFormSubmitted(false);
      setIsSubmitting(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 300);
  };


  // Close modals and dropdowns on Escape key or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseModal();
        if (plusDropdownOpen) setPlusDropdownOpen(false);
        if (plusMenuOpen) setPlusMenuOpen(false);
        if (aboutDropdownOpen) setAboutDropdownOpen(false);
        if (sectionTitleMenuOpen) setSectionTitleMenuOpen(false);
        if (notificationsModalOpen) setNotificationsModalOpen(false);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (plusDropdownRef.current && !plusDropdownRef.current.contains(e.target)) {
        setPlusDropdownOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target)) {
        setPlusMenuOpen(false);
      }
      if (aboutDropdownRef.current && !aboutDropdownRef.current.contains(e.target)) {
        setAboutDropdownOpen(false);
      }
      if (sectionTitleMenuRef.current && !sectionTitleMenuRef.current.contains(e.target)) {
        setSectionTitleMenuOpen(false);
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
  }, [contactModalOpen, plusDropdownOpen, plusMenuOpen, aboutDropdownOpen, sectionTitleMenuOpen, notificationsModalOpen, userMenuOpen]);

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
      try {
        const { error } = await supabase.from("profiles").update({
          bio: profileBio,
          updated_at: new Date().toISOString(),
        }).eq("id", userSession.user.id);

        if (error) {
          console.error("Error bio update:", error);
          triggerToast("Erreur lors de la mise à jour", "fa-triangle-exclamation");
          return;
        }
        triggerToast("Résumé du profil mis à jour !", "fa-pen-to-square");
      } catch (err) {
        console.error("Exception bio update:", err);
        triggerToast("Erreur lors de la mise à jour", "fa-triangle-exclamation");
      }
    }
    setIsEditingBio(false);
  };

  // Sauvegarder les informations personnelles dans Supabase
  const handleSaveProfileInfo = async () => {
    const fullName = `${firstName} ${lastName}`.trim();
    setProfileName(fullName);
    setProfileSubtitle(jobTitle);
    setProfileLocation(city && country ? `${city}, ${country}` : city || country);

    if (userSession?.user) {
      try {
        const { error } = await supabase.from("profiles").update({
          full_name: fullName,
          headline: jobTitle,
          location: city && country ? `${city}, ${country}` : city || country,
          updated_at: new Date().toISOString(),
        }).eq("id", userSession.user.id);

        if (error) {
          console.error("Error profile info update:", error);
          triggerToast("Erreur lors de la sauvegarde", "fa-triangle-exclamation");
        } else {
          triggerToast("Profil sauvegardé avec succès !", "fa-circle-check");
        }
      } catch (err) {
        console.error("Exception profile info update:", err);
        triggerToast("Erreur lors de la sauvegarde", "fa-triangle-exclamation");
      }
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

    // Uniquement exécuté au clic (jamais pendant le rendu) : react-hooks/purity
    // ne peut pas le déduire statiquement pour une fonction définie dans le
    // corps du composant.
    const newExp = {
      // eslint-disable-next-line react-hooks/purity
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

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      triggerToast("Message envoyé avec succès !", "fa-paper-plane");
    }, 1200);
  };

  // Compétences handlers
  const handleAddNewUserSkill = async () => {
    if (!newSkillInput.trim()) return;
    const skillName = newSkillInput.trim();
    if (userSkills.includes(skillName)) {
      setNewSkillInput("");
      return;
    }
    const updated = [...userSkills, skillName];
    setUserSkills(updated);
    setNewSkillInput("");
    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        skills: updated,
        updated_at: new Date().toISOString(),
      });
    }
    triggerToast(`Compétence "${skillName}" ajoutée !`, "fa-lightbulb");
  };

  const handleDeleteSkill = async (skillToDelete) => {
    const updated = userSkills.filter(s => s !== skillToDelete);
    setUserSkills(updated);
    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        skills: updated,
        updated_at: new Date().toISOString(),
      });
    }
    triggerToast(`Compétence "${skillToDelete}" supprimée !`, "fa-trash-can");
  };

  const handleAddNewInterest = async () => {
    if (!newInterestInput.trim()) return;
    const interestName = newInterestInput.trim();
    if (userInterests.includes(interestName)) {
      setNewInterestInput("");
      return;
    }
    const updated = [...userInterests, interestName];
    setUserInterests(updated);
    setNewInterestInput("");
    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        interests: updated,
        updated_at: new Date().toISOString(),
      });
    }
    triggerToast(`Centre d'intérêt "${interestName}" ajouté !`, "fa-heart");
  };

  const handleDeleteInterest = async (interestToDelete) => {
    const updated = userInterests.filter(i => i !== interestToDelete);
    setUserInterests(updated);
    if (userSession?.user) {
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        interests: updated,
        updated_at: new Date().toISOString(),
      });
    }
    triggerToast(`Centre d'intérêt "${interestToDelete}" supprimé !`, "fa-trash-can");
  };

  // Convertit les champs extraits par le service serveur (/api/parse-document) vers le
  // format attendu par la modale de prévisualisation. Gère toutes les variations de clés JSON (français, anglais, accents).
  const mapExtractedFieldsToScannedData = (apiFields, file, docPublicUrl) => {
    // 2. Journalisation de l'objet JSON reçu pour le débogage
    console.log("JSON reçu de l'API de parsing de documents :", apiFields);

    const getValue = (obj, possibleKeys) => {
      if (!obj) return "";
      for (const key of possibleKeys) {
        if (key in obj) return obj[key] !== undefined && obj[key] !== null ? obj[key] : "";
      }
      const lowerKeysMap = {};
      for (const k of Object.keys(obj)) {
        lowerKeysMap[k.toLowerCase()] = obj[k];
      }
      for (const key of possibleKeys) {
        const lower = key.toLowerCase();
        if (lower in lowerKeysMap) {
          const val = lowerKeysMap[lower];
          return val !== undefined && val !== null ? val : "";
        }
        const cleanedKey = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        for (const k of Object.keys(obj)) {
          const cleanedK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          if (cleanedKey === cleanedK) {
            const val = obj[k];
            return val !== undefined && val !== null ? val : "";
          }
        }
      }
      return "";
    };

    const rawExperiences = getValue(apiFields, ["experiences", "experiences_professionnelles", "experience", "parcours_professionnel", "work_experience", "workExperiences"]) || [];
    const rawEducations = getValue(apiFields, ["educations", "education", "formation", "formations", "parcours_academique", "studies"]) || [];
    const rawLanguages = getValue(apiFields, ["languages", "langues", "langue", "languages_list"]) || [];
    const rawSkills = getValue(apiFields, ["skills", "competences", "compétences", "competence", "compétence", "skills_list"]) || [];
    const rawInterests = getValue(apiFields, ["interests", "centres_interet", "centresInteret", "centres_d_interet", "hobbies", "loisirs"]) || [];

    const experiences = (Array.isArray(rawExperiences) ? rawExperiences : [rawExperiences].filter(Boolean)).map((exp, idx) => {
      const title = getValue(exp, ["title", "role", "post", "poste", "intitule", "intitulé", "job"]);
      const employer = getValue(exp, ["employer", "company", "entreprise", "employeur", "societe", "société"]);
      const expCity = getValue(exp, ["city", "location", "lieu", "ville"]);
      const current = getValue(exp, ["current", "enCours", "en_cours", "actuel", "isCurrent", "is_current"]);
      const startDate = String(getValue(exp, ["startDate", "start_date", "dateDebut", "date_debut", "debut", "début", "startYear", "start_year", "period"]));
      const endDate = String(getValue(exp, ["endDate", "end_date", "dateFin", "date_fin", "fin", "endYear", "end_year"]));
      const description = getValue(exp, ["description", "tasks", "missions", "details", "détails"]);

      return {
        id: Date.now() + idx,
        title: title || "",
        company: employer || "",
        location: expCity || "",
        locationType: "",
        employmentType: "",
        isCurrent: !!current,
        startMonth: "",
        startYear: startDate ? startDate.slice(0, 4) : "",
        endYear: endDate ? endDate.slice(0, 4) : "",
        description: description || "",
        skills: []
      };
    });

    const educations = (Array.isArray(rawEducations) ? rawEducations : [rawEducations].filter(Boolean)).map((edu, idx) => {
      const school = getValue(edu, ["school", "institution", "etablissement", "établissement", "universite", "université", "ecole", "école"]);
      const degree = getValue(edu, ["degree", "diploma", "diplome", "diplôme", "qualification"]);
      const startYear = String(getValue(edu, ["startYear", "start_year", "anneeDebut", "annee_debut", "debut", "début", "startDate", "start_date"]));
      const endYear = String(getValue(edu, ["endYear", "end_year", "year", "anneeFin", "annee_fin", "fin", "endDate", "end_date"]));

      return {
        id: Date.now() + 100 + idx,
        school: school || "",
        degree: degree || "",
        field: "",
        startYear: startYear ? startYear.slice(0, 4) : "",
        endYear: endYear ? endYear.slice(0, 4) : "",
        isCurrent: false
      };
    });

    const languages = (Array.isArray(rawLanguages) ? rawLanguages : [rawLanguages].filter(Boolean)).map((lang) => {
      if (typeof lang === "object" && lang !== null) {
        const name = getValue(lang, ["name", "language", "langue", "nom"]);
        const level = getValue(lang, ["level", "niveau", "maitrise", "maîtrise"]);
        return {
          name: name || "",
          level: level || ""
        };
      }
      return {
        name: String(lang),
        level: ""
      };
    });

    const titleVal = getValue(apiFields, ["title", "jobTitle", "job_title", "titre", "poste", "profession"]);
    const summaryVal = getValue(apiFields, ["summary", "bio", "resume", "description", "presentation", "présentation"]);

    const isIdentityDoc = !!apiFields.isIdentityDoc || 
      (titleVal || "").toLowerCase().includes("identit") || 
      (summaryVal || "").toLowerCase().includes("cni") || 
      (summaryVal || "").toLowerCase().includes("passeport");

    // Gérer l'extraction et le découpage du nom complet s'il est renvoyé en un seul bloc (fullName)
    let firstNameVal = getValue(apiFields, ["firstName", "prenom", "prénom", "first_name", "givenName", "given_name"]);
    let lastNameVal = getValue(apiFields, ["lastName", "nom", "nomDeFamille", "nom_de_famille", "last_name", "familyName", "family_name"]);
    const fullNameVal = getValue(apiFields, ["fullName", "full_name", "nomComplet", "nom_complet", "name"]);

    if (!firstNameVal && !lastNameVal && fullNameVal) {
      const parts = fullNameVal.trim().split(/\s+/);
      if (parts.length >= 2) {
        firstNameVal = parts[0];
        lastNameVal = parts.slice(1).join(" ");
      } else {
        firstNameVal = fullNameVal;
        lastNameVal = "";
      }
    }

    return {
      firstName: firstNameVal || "",
      lastName: lastNameVal || "",
      jobTitle: titleVal || "",
      bio: summaryVal || "",
      city: getValue(apiFields, ["city", "ville", "city_name", "adresse_ville", "adresseville"]),
      country: getValue(apiFields, ["country", "pays", "country_name", "pays_name"]),
      birthDate: getValue(apiFields, ["birthDate", "birth_date", "dateDeNaissance", "date_de_naissance", "datenaissance", "date_naissance", "birthday", "dob"]),
      gender: getValue(apiFields, ["gender", "sexe", "genre"]),
      maritalStatus: getValue(apiFields, ["maritalStatus", "marital_status", "statutMarital", "statut_marital", "situation_familiale", "situationfamiliale", "statut_matrimonial", "statutmatrimonial"]),
      driverLicense: getValue(apiFields, ["driverLicense", "driver_license", "permis", "permisDeConduire", "permis_de_conduire"]),
      email: getValue(apiFields, ["email", "e-mail", "mail"]),
      phone: getValue(apiFields, ["phone", "telephone", "téléphone", "tel"]),
      skills: Array.isArray(rawSkills) ? rawSkills : [rawSkills].filter(Boolean),
      interests: Array.isArray(rawInterests) ? rawInterests : [rawInterests].filter(Boolean),
      experiences,
      educations,
      languages,
      docUrl: docPublicUrl || cvUrl,
      docName: file.name,
      isIdentityDoc
    };
  };

  // Importation Universelle & Analyse IA des Documents (CV, lettres de motivation, justificatifs)
  // L'extraction s'appuie sur le contenu textuel réel du document (PDF/DOCX/Image via OCR),
  // jamais sur le nom du fichier.
  const handleImportAndParseCv = async (e) => {
    const file = e.target.files[0];
    if (!file || !userSession?.user) return;

    setIsParsingCv(true);
    triggerToast("🔍 Analyse du contenu réel du document...", "fa-expand fa-spin");

    try {
      const ext = file.name.split('.').pop().toLowerCase();
      // Uniquement exécuté au clic (jamais pendant le rendu) : react-hooks/purity
      // ne peut pas le déduire statiquement pour une fonction définie dans le
      // corps du composant.
      // eslint-disable-next-line react-hooks/purity
      const filePath = `${userSession.user.id}/documents/doc_ocr_${Date.now()}.${ext}`;

      let docPublicUrl = null;
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        // Bucket privé : on conserve le chemin, signé à la demande à l'affichage
        docPublicUrl = filePath;
      }

      // Extraction réelle du texte du document (PDF/DOCX/Image OCR) côté serveur
      const parseFormData = new FormData();
      parseFormData.append("file", file);

      const parseResponse = await fetch("/api/parse-document", {
        method: "POST",
        headers: userSession?.access_token ? { Authorization: `Bearer ${userSession.access_token}` } : undefined,
        body: parseFormData,
      });

      // Toujours lire et logger la réponse brute, même si le statut HTTP est hors de 200-299
      const rawJsonResponse = await parseResponse.json().catch(() => ({}));
      console.log("Données brutes de l'extraction reçues du backend :", rawJsonResponse);

      const apiFields = rawJsonResponse.fields || rawJsonResponse.data || {};

      triggerToast("🤖 Cartographie des données extraites vers le profil...", "fa-wand-magic-sparkles fa-spin");

      const mapped = mapExtractedFieldsToScannedData(apiFields, file, docPublicUrl);

      // Mettre à jour l'état du formulaire de prévisualisation (state) avec les données cartographiées
      setScannedData(mapped);

      // Ouvrir la modale après avoir mis à jour les états
      setIsParsingCv(false);
      setScanModalOpen(true);
      triggerToast("✓ Document analysé ! Vérifiez les données extraites avant validation.", "fa-wand-magic-sparkles");
    } catch (err) {
      console.error("Erreur dans le flux d'analyse du document :", err);
      setIsParsingCv(false);
      triggerToast("Erreur lors de l'analyse du document", "fa-triangle-exclamation");
    }
  };

  // Validation et enregistrement définitif des données de la modale dans le profil & Supabase
  const handleConfirmScanData = async () => {
    if (!scannedData || !userSession?.user || savingScanData) return;
    setSavingScanData(true);

    // 1. Écraser et remplacer directement les anciennes informations dans l'état de l'application
    setFirstName(scannedData.firstName);
    setLastName(scannedData.lastName);
    setProfileSubtitle(scannedData.jobTitle);
    setJobTitle(scannedData.jobTitle);
    setCity(scannedData.city);
    setCountry(scannedData.country);
    setBirthDate(scannedData.birthDate);
    setGender(scannedData.gender);
    setMaritalStatus(scannedData.maritalStatus);
    setDriverLicense(scannedData.driverLicense);
    setProfileBio(scannedData.bio);
    setTempBio(scannedData.bio);
    setUserSkills(scannedData.skills);
    setExperiences(scannedData.experiences);
    setEducations(scannedData.educations);
    if (scannedData.phone) setPhone(scannedData.phone);
    if (scannedData.email) setContactEmail(scannedData.email);
    if (scannedData.interests && scannedData.interests.length > 0) {
      setUserInterests(scannedData.interests);
    }

    if (scannedData.languages && scannedData.languages.length > 0) {
      setUserLanguages(scannedData.languages.map((l, i) => ({ id: `lang-scan-${i}`, name: l.name, level: l.level })));
    }

    if (scannedData.docUrl) {
      setCvUrl(scannedData.docUrl);
      setUploadedCvFileName(scannedData.docName);
      setUserDocuments(prev => [{
        id: `doc-${Date.now()}`,
        title: scannedData.docName,
        file_url: scannedData.docUrl,
        type: scannedData.isIdentityDoc ? "Identité" : "CV",
        created_at: new Date().toISOString()
      }, ...prev]);
      if (!scannedData.isIdentityDoc && !cvVisibleRecruteurs) setShowCvVisibilityInvite(true);
    }

    // 2. Persister et écraser dans Supabase (la structure visuelle UI restant 100% intacte)
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        full_name: `${scannedData.firstName} ${scannedData.lastName}`.trim(),
        headline: scannedData.jobTitle,
        bio: scannedData.bio,
        city: scannedData.city,
        country: scannedData.country,
        birth_date: scannedData.birthDate,
        gender: scannedData.gender,
        marital_status: scannedData.maritalStatus,
        driver_license: scannedData.driverLicense,
        phone: scannedData.phone || phone,
        contact_email: scannedData.email || contactEmail,
        skills: scannedData.skills,
        interests: scannedData.interests && scannedData.interests.length > 0 ? scannedData.interests : userInterests,
        experiences: scannedData.experiences,
        educations: scannedData.educations,
        languages: scannedData.languages,
        cv_url: scannedData.docUrl || cvUrl,
        cv_name: scannedData.docName,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setScanModalOpen(false);
      triggerToast("✓ Données validées ! Les informations du profil ont été écrasées et enregistrées.", "fa-circle-check");
    } catch (err) {
      console.error("Erreur enregistrement des données scannées:", err);
      triggerToast("Échec de l'enregistrement. Réessayez.", "fa-triangle-exclamation");
    } finally {
      setSavingScanData(false);
    }
  };

  // Suppression d'un document de la base de données Supabase et de l'interface
  const handleDeleteDocument = async (docId, docFileUrl, docTitle) => {
    if (!userSession?.user) return;

    triggerToast("Suppression du document...", "fa-spinner fa-spin");

    try {
      // 1. Supprimer de la table resumes dans Supabase
      if (typeof docId === "string" && docId.startsWith("primary-")) {
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          cv_url: null,
          cv_name: null,
          updated_at: new Date().toISOString(),
        });
      } else {
        // delete_own_resume() (SECURITY DEFINER) supprime la ligne et
        // renvoie le chemin Storage associé, s'il existe — la suppression du
        // fichier lui-même passe par l'API Storage (pas par un DELETE SQL
        // direct sur storage.objects, bloqué par la plateforme Supabase).
        const { data: filePath } = await supabase.rpc("delete_own_resume", { resume_id: docId });
        if (filePath) {
          const { error: removeError } = await supabase.storage.from("resumes").remove([filePath]);
          // La ligne resumes est déjà supprimée à ce stade : un échec ici
          // laisse un fichier orphelin dans le bucket, sans plus aucune
          // ligne pour le retrouver. Journalisé pour qu'un nettoyage manuel
          // reste possible (voir docs/fichiers-orphelins.md), sans bloquer
          // l'utilisateur — de son point de vue, la suppression a réussi.
          if (removeError) {
            await supabase.rpc("log_own_storage_deletion_failure", { p_bucket: "resumes", p_path: filePath });
          }
        }
      }

      // 2. Mettre à jour l'état local userDocuments
      const updatedDocs = userDocuments.filter((doc) => doc.id !== docId);
      setUserDocuments(updatedDocs);

      // 3. Mettre à jour l'aperçu principal si le document supprimé était le document actif
      if (docFileUrl === cvUrl || updatedDocs.length === 0) {
        if (updatedDocs.length > 0) {
          setCvUrl(updatedDocs[0].file_url);
          setUploadedCvFileName(updatedDocs[0].title);
          if (typeof window !== "undefined") {
            localStorage.setItem("user_cv_url", updatedDocs[0].file_url);
            localStorage.setItem("user_cv_name", updatedDocs[0].title);
          }
        } else {
          setCvUrl(null);
          setUploadedCvFileName(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("user_cv_url");
            localStorage.removeItem("user_cv_name");
          }
          await supabase.from("profiles").upsert({
            id: userSession.user.id,
            email: userSession.user.email,
            cv_url: null,
            cv_name: null,
            updated_at: new Date().toISOString(),
          });
        }
      }

      triggerToast(`Document "${docTitle || "supprimé"}" retiré avec succès !`, "fa-trash-can");
    } catch (err) {
      console.error("Erreur suppression document:", err);
      triggerToast("Erreur lors de la suppression du document", "fa-triangle-exclamation");
    }
  };

  // Téléversement & Enregistrement du fichier CV dans Supabase (Storage + Tables DB)
  const handleCvFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userSession?.user) return;

    setIsUploadingCv(true);
    triggerToast("Importation et sauvegarde du document...", "fa-spinner fa-spin");

    const ext = file.name.split('.').pop().toLowerCase();
    const type = ext === "pdf" ? "pdf" : (ext === "doc" || ext === "docx" ? "doc" : "pdf");
    const docCategory = file.name.toLowerCase().includes("lettre") || file.name.toLowerCase().includes("cover") ? "Lettre de motivation" : "CV";

    try {
      // 1. Sauvegarde dans Supabase Storage (Bucket resumes)
      let finalCvUrl = null;
      // Uniquement exécuté au clic (jamais pendant le rendu) : react-hooks/purity
      // ne peut pas le déduire statiquement pour une fonction définie dans le
      // corps du composant.
      // eslint-disable-next-line react-hooks/purity
      const filePath = `${userSession.user.id}/cvs/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        // Bucket privé : on conserve le chemin, signé à la demande à l'affichage
        finalCvUrl = filePath;
      }

      // 2. Format Base64 de secours
      const base64Content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      const urlToSave = finalCvUrl || base64Content;
      setCvUrl(urlToSave);
      setUploadedCvFileName(file.name);
      setCvFileType(type);

      // 3. Sauvegarde dans localStorage pour accès instantané
      if (typeof window !== "undefined") {
        localStorage.setItem("user_cv_url", urlToSave);
        localStorage.setItem("user_cv_name", file.name);
      }

      // 4. Sauvegarde persistante dans la table profiles de Supabase
      await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        cv_url: urlToSave,
        cv_name: file.name,
        updated_at: new Date().toISOString(),
      });

      // 5. Insérer l'entrée dans la table resumes de Supabase. Seul un vrai CV
      // déclenche l'analyse sémantique (extraction + embedding) : une lettre
      // de motivation n'a pas vocation à être matchée contre des offres.
      const isCv = docCategory === "CV";
      const { data: insertedDoc } = await supabase
        .from("resumes")
        .insert({
          user_id: userSession.user.id,
          title: file.name,
          type: docCategory,
          file_url: urlToSave,
          content: { fileName: file.name, uploadedAt: new Date().toISOString() },
          status: isCv ? "processing" : "completed",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      const newDocument = insertedDoc || {
        // Uniquement exécuté au clic (jamais pendant le rendu) : react-hooks/purity
        // ne peut pas le déduire statiquement pour une fonction définie dans
        // le corps du composant.
        // eslint-disable-next-line react-hooks/purity
        id: Date.now(),
        title: file.name,
        type: docCategory,
        file_url: urlToSave,
        status: isCv ? "processing" : "completed",
        created_at: new Date().toISOString()
      };

      setUserDocuments((prevDocs) => [newDocument, ...prevDocs]);
      // Invitation à activer la visibilité recruteurs juste après le dépôt
      // d'un CV — jamais activée automatiquement (cv_visible_recruteurs
      // reste FALSE tant que le candidat ne l'a pas décidé lui-même).
      if (isCv && !cvVisibleRecruteurs) setShowCvVisibilityInvite(true);

      setIsUploadingCv(false);
      triggerToast(
        isCv ? `CV "${file.name}" ajouté, analyse en cours...` : `Document "${file.name}" ajouté à votre profil !`,
        isCv ? "fa-wand-magic-sparkles" : "fa-file-circle-check"
      );

      // 6. Analyse asynchrone (extraction de texte + embedding sémantique) :
      // volontairement non "await"-ée pour ne pas bloquer l'UI — le statut
      // 'processing' déjà affiché passe à 'completed'/'error' via l'abonnement
      // Realtime sur `resumes` dès que cette requête se termine côté serveur.
      if (isCv && insertedDoc?.id) {
        const processFormData = new FormData();
        processFormData.append("file", file);
        processFormData.append("resumeId", insertedDoc.id);

        fetch("/api/process-resume", {
          method: "POST",
          headers: { Authorization: `Bearer ${userSession.access_token}` },
          body: processFormData,
        }).catch((err) => {
          console.error("Erreur lors du lancement de l'analyse du CV:", err);
        });
      }
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du CV:", err);
      setIsUploadingCv(false);
      triggerToast("Erreur lors de la sauvegarde du document", "fa-triangle-exclamation");
    }
  };

  // Sauvegarder les informations personnelles de manière persistante dans Supabase & localStorage
  const handleSavePersonalDetails = async (e) => {
    if (e) e.preventDefault();
    if (!userSession?.user) return;

    triggerToast("Sauvegarde des modifications...", "fa-spinner fa-spin");

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const headlineStr = jobTitle.trim();
    const locationStr = `${city.trim() ? city.trim() + ", " : ""}${country.trim() ? country.trim() : ""}`.replace(/,\s*$/, "");

    // 1. Mettre à jour immédiatement l'interface utilisateur
    setProfileName(fullName || userSession.user.email?.split("@")[0] || "");
    if (headlineStr) setProfileSubtitle(headlineStr);
    if (locationStr) setProfileLocation(locationStr);

    try {
      // 2. Mettre à jour ou insérer de manière persistante dans la table profiles de Supabase
      const { error } = await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        full_name: fullName,
        headline: headlineStr,
        location: locationStr,
        city: city.trim(),
        country: country.trim(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Erreur mise à jour profil Supabase:", error);
        triggerToast("Erreur lors de la sauvegarde dans Supabase", "fa-triangle-exclamation");
      } else {
        // 3. Sauvegarder également dans localStorage pour secours instantané
        if (typeof window !== "undefined") {
          localStorage.setItem("user_first_name", firstName.trim());
          localStorage.setItem("user_last_name", lastName.trim());
          localStorage.setItem("user_job_title", headlineStr);
          localStorage.setItem("user_city", city.trim());
          localStorage.setItem("user_country", country.trim());
        }
        triggerToast("Informations personnelles sauvegardées avec succès !", "fa-floppy-disk");
      }
    } catch (err) {
      console.error("Exception lors de la sauvegarde des informations:", err);
      triggerToast("Erreur de connexion lors de la sauvegarde", "fa-triangle-exclamation");
    }
  };

  // Ajouter une formation dans Supabase et l'état local
  const handleAddEducation = async (e) => {
    e.preventDefault();
    if (!eduSchool.trim() || !eduDegree.trim()) {
      triggerToast("Veuillez remplir l'établissement et le diplôme", "fa-triangle-exclamation");
      return;
    }

    const newEdu = {
      // Uniquement exécuté au clic (jamais pendant le rendu) : react-hooks/purity
      // ne peut pas le déduire statiquement pour une fonction définie dans le
      // corps du composant.
      // eslint-disable-next-line react-hooks/purity
      id: Date.now(),
      school: eduSchool.trim(),
      degree: eduDegree.trim(),
      field: eduField.trim(),
      startYear: eduStartYear,
      endYear: eduEndYear,
      isCurrent: eduIsCurrent,
      created_at: new Date().toISOString()
    };

    const updatedEducations = [newEdu, ...educations];
    setEducations(updatedEducations);

    if (userSession?.user) {
      try {
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          educations: updatedEducations,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Erreur lors de la sauvegarde de la formation:", err);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("user_educations", JSON.stringify(updatedEducations));
    }

    setEducationModalOpen(false);
    setEduSchool("");
    setEduDegree("");
    setEduField("");
    triggerToast("Formation ajoutée avec succès !", "fa-graduation-cap");
  };

  // Supprimer une formation de Supabase et de l'état local
  const handleDeleteEducation = async (id) => {
    const updatedEducations = educations.filter((ed) => ed.id !== id);
    setEducations(updatedEducations);

    if (userSession?.user) {
      try {
        await supabase.from("profiles").upsert({
          id: userSession.user.id,
          email: userSession.user.email,
          educations: updatedEducations,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Erreur lors de la suppression de la formation:", err);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("user_educations", JSON.stringify(updatedEducations));
    }

    triggerToast("Formation supprimée avec succès !", "fa-trash-can");
  };

  // Enregistrer la bio et les détails épinglés dans Supabase & localStorage
  const handleSaveBioAndPinnedDetails = async () => {
    if (!userSession?.user) return;

    triggerToast("Sauvegarde de la bio et des détails épinglés...", "fa-spinner fa-spin");

    setProfileBio(tempBio);
    setPinnedDetails(tempPinnedDetails);
    setIsEditingBio(false);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userSession.user.id,
        email: userSession.user.email,
        bio: tempBio,
        pinned_details: tempPinnedDetails,
        phone: phone.trim(),
        marital_status: maritalStatus,
        driver_license: driverLicense.trim(),
        website_url: websiteUrl.trim(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Erreur sauvegarde bio & détails épinglés:", error);
        triggerToast("Erreur lors de la sauvegarde dans Supabase", "fa-triangle-exclamation");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem("user_bio", tempBio);
          localStorage.setItem("user_pinned_details", JSON.stringify(tempPinnedDetails));
          localStorage.setItem("user_driver_license", driverLicense.trim());
          localStorage.setItem("user_website_url", websiteUrl.trim());
        }
        triggerToast("Bio et détails épinglés mis à jour avec succès !", "fa-circle-check");
      }
    } catch (err) {
      console.error("Exception lors de la sauvegarde bio:", err);
      triggerToast("Erreur lors de la sauvegarde", "fa-triangle-exclamation");
    }
  };

  // Enregistrer dynamiquement une information de l'onglet À propos dans Supabase
  const handleSaveAboutField = async (fieldKey, fieldValue) => {
    if (!userSession?.user) return;

    triggerToast("Sauvegarde de la modification...", "fa-spinner fa-spin");

    try {
      const payload = {
        [fieldKey]: fieldValue,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userSession.user.id);

      if (error) {
        console.error(`Erreur lors de la mise à jour de ${fieldKey}:`, error);
        triggerToast("Erreur lors de la sauvegarde dans Supabase", "fa-triangle-exclamation");
      } else {
        if (typeof window !== "undefined") {
          localStorage.setItem(`user_${fieldKey}`, fieldValue);
        }
        triggerToast("Information mise à jour avec succès !", "fa-circle-check");
      }
    } catch (err) {
      console.error("Exception sauvegarde champ:", err);
      triggerToast("Erreur lors de la sauvegarde", "fa-triangle-exclamation");
    }
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
      <nav className="bg-[#FAF6F1] px-4 md:px-6 shadow-sm fixed top-0 left-0 w-full z-50 h-16">
        <div className="max-w-[1180px] mx-auto w-full h-full flex items-center justify-between">
          {/* Groupe Gauche : Logo + Recherche */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>

            <div className="hidden md:block relative w-60 lg:w-72">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                 <input
                  id="profil-navbar-search"
                  name="profil-navbar-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-full text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                  placeholder="Rechercher sur Facilite..."
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
              <span className="text-[11px] font-bold tracking-tight">Accueil</span>
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
                <span className="text-[11px] font-bold tracking-tight">Messagerie</span>
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

            {/* Rendu dynamique des liens Admin et Recruteur via le composant RoleNavLink */}
            <RoleNavLink session={userSession} />

            {/* L'Extracteur 1-Click pour Candidat */}
            <Link
              href="/candidat/extracteur"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/candidat/extracteur" ? "text-emerald-600 font-extrabold" : "text-emerald-700 hover:text-emerald-800"
              }`}
              title="Postuler en 1 clic grâce à l'OCR"
            >
              <i className="fa-solid fa-bolt text-xl text-amber-500"></i>
              <span className="text-[11px] font-extrabold tracking-tight text-emerald-700 truncate max-w-[76px]">Extracteur</span>
            </Link>

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
                  <Link
                    href="/recrutement-spontane"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-user-tie text-lg text-gray-600 w-5 text-center"></i>
                    <span>Recrutement spontané</span>
                  </Link>
                  <Link
                    href="/recrutement-journalier"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition border-t border-gray-100"
                  >
                    <i className="fa-solid fa-person-digging text-lg text-gray-600 w-5 text-center"></i>
                    <span>{selectedLang === "FR" ? "Travail journalier (Dépôt)" : "Daily Worker Jobs (In-person)"}</span>
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

          {/* Groupe Droit : Mon Profil (Actif avec Menu Déroulant / Popup de déconnexion) */}
          <div className="hidden md:flex items-center relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                pathname === "/profil" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {avatarUrl && avatarUrl !== "/logo.jpeg" ? (
                <img src={avatarUrl} alt="Profil" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
              ) : (
                <i className="fa-solid fa-circle-user text-xl"></i>
              )}
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
                      setActiveTab("about");
                      setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }, 50);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition flex items-center space-x-2.5 cursor-pointer"
                  >
                    <i className="fa-regular fa-user text-gray-400 text-sm"></i>
                    <span>Voir mon profil & CV</span>
                  </button>

                  {isNavAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition flex items-center space-x-2.5"
                    >
                      <i className="fa-solid fa-shield-halved text-amber-600 text-sm"></i>
                      <span>Espace Administration</span>
                    </Link>
                  )}

                  {isNavRecruiter && (
                    <Link
                      href="/recruteur"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition flex items-center space-x-2.5"
                    >
                      <i className="fa-solid fa-briefcase text-emerald-600 text-sm"></i>
                      <span>Espace Recruteur</span>
                    </Link>
                  )}

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
          <Link
            href="/"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Accueil</span>
          </Link>

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
            <UnreadBadge count={unreadMessagesCount} />
          </Link>

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
                <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg animate-pulse">
                  {profileName ? profileName.charAt(0).toUpperCase() : "👤"}
                </div>
                <div className="flex-grow text-left">
                  <h3 className="text-sm font-extrabold text-gray-900">{profileName || "Mon Profil"}</h3>
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
              {/* Recrutement Spontané (même modale que la barre d'onglets et le dropdown "Plus" desktop) */}
              <Link
                href="/recrutement-spontane"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-solid fa-user-tie text-gray-400 text-lg"></i>
                <span>Recrutement spontané</span>
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
      <main className="min-h-screen bg-[#F4F2EE] pt-16 pb-16 px-4 md:px-6">
        <div className="max-w-[1180px] mx-auto flex flex-col lg:flex-row gap-6 items-start justify-center">
          
          {/* COLONNE GAUCHE & CENTRALE COMBINÉE : Carte Profil Principale & Sections */}
          <div className="w-full lg:w-[830px] flex flex-col space-y-4">
            
            {/* BANNIÈRE DE SÉCURITÉ */}
            {userSession?.user && (
              (!userSession.user.email_confirmed_at && userSession.user.email) ||
              (!userSession.user.phone_confirmed_at && userSession.user.phone)
            ) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 shadow-sm animate-fade-in-up">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-shield-halved text-amber-600 text-lg"></i>
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-900">Sécurisez votre compte</h4>
                    <p className="text-xs font-medium text-amber-700 mt-0.5">
                      Un ou plusieurs de vos identifiants (E-mail ou Téléphone) ne sont pas encore vérifiés.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("about");
                    setActiveAboutTab("securite");
                    setSelectedSection("securite");
                    setTimeout(() => {
                      const el = document.getElementById("section-about-profile");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }, 50);
                  }}
                  className="px-4 py-2 w-full sm:w-auto text-center bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  Vérifier maintenant
                </button>
              </div>
            )}

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
                      <RoleBadge role={profileRole} />
                      <BadgeDisplay badges={profileBadges} clickable={true} />
                      <span className="bg-emerald-100 text-[#047857] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                        Profil Vérifié
                      </span>
                    </div>

                    <p className="text-xs md:text-sm font-semibold text-gray-700 leading-snug">
                      {profileSubtitle || profileBio}
                    </p>

                    {/* Ligne des Détails Épinglés affichés en haut de profil sur une ligne horizontale continue */}
                    {pinnedDetails.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[11px] font-extrabold text-gray-900">
                        {pinnedDetails.map((itemId) => {
                          const itemMap = {
                            creation_digitale: { label: jobTitle.trim() || "Création digitale", icon: "fa-regular fa-folder" },
                            pikine: { label: city.trim() || "Pikine", icon: "fa-solid fa-location-dot" },
                            etudes_sports: { label: educations[0]?.degree || "Etudes Sports", icon: "fa-solid fa-graduation-cap" },
                            association_jeunes: { label: "Association des jeunes", icon: "fa-solid fa-users" },
                            cem_thiolom_fall: { label: educations[0]?.school || "CEM Thiolom Fall", icon: "fa-solid fa-building" },
                            celibataire: { label: maritalStatus || "Célibataire", icon: "fa-solid fa-heart" },
                            permis_conduire: { label: driverLicense || "Permis B", icon: "fa-solid fa-id-card" },
                            telephone: { label: phone || "+221 77 000 00 00", icon: "fa-solid fa-phone" },
                            site_web: { label: websiteUrl || "facilite.sn", icon: "fa-solid fa-globe" }
                          };
                          const itm = itemMap[itemId];
                          if (!itm) return null;
                          return (
                            <span key={itemId} className="flex items-center space-x-1 text-gray-900 bg-gray-100/90 px-2 py-0.5 rounded-md border border-gray-200/80 whitespace-nowrap">
                              <i className={`${itm.icon} text-gray-600 text-xs`}></i>
                              <span>{itm.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* BARRE D'ONGLETS HORIZONTALE STYLE FACEBOOK/LINKEDIN */}
              <div className="border-t border-gray-150 px-6 md:px-8 bg-gray-50/70 flex items-center justify-between">
                <div className="flex space-x-6 overflow-x-auto scrollbar-none py-3 w-full">
                  <button
                    onClick={() => setActiveTab("about")}
                    className={`text-sm font-extrabold pb-2.5 pt-1 transition-all relative whitespace-nowrap cursor-pointer ${
                      activeTab === "about" ? "text-blue-600 font-black border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <span>À propos</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("documents")}
                    className={`text-sm font-extrabold pb-2.5 pt-1 transition-all relative whitespace-nowrap cursor-pointer ${
                      activeTab === "documents" ? "text-blue-600 font-black border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <span>Mes documents</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`text-sm font-extrabold pb-2.5 pt-1 transition-all relative whitespace-nowrap cursor-pointer ${
                      activeTab === "settings" ? "text-blue-600 font-black border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <span>Paramètres</span>
                  </button>

                  {/* Dropdown "Plus" */}
                  <div className="relative inline-block text-left" ref={plusMenuRef}>
                    <button
                      onClick={() => setPlusMenuOpen(!plusMenuOpen)}
                      className="text-sm font-extrabold pb-2.5 pt-1 text-gray-500 hover:text-gray-800 transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Plus</span>
                      <i className={`fa-solid fa-caret-down text-[10px] transition-transform duration-200 ${plusMenuOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {plusMenuOpen && (
                      <div className="absolute right-0 md:left-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-normal text-sm">
                        <button
                          onClick={() => {
                            setActiveTab("about");
                            setPlusMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-user text-gray-400"></i>
                          <span>À propos</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("documents");
                            setPlusMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-file-lines text-gray-400"></i>
                          <span>Mes documents</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("settings");
                            setPlusMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-solid fa-gear text-gray-400"></i>
                          <span>Paramètres</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* NOUVELLE SECTION PARAMÈTRES (THEME) */}
            {activeTab === "settings" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6 animate-fade-in">
                <div>
                  <div className="relative inline-block text-left" ref={sectionTitleMenuRef}>
                    <button
                      type="button"
                      onClick={() => setSectionTitleMenuOpen(!sectionTitleMenuOpen)}
                      className="flex items-center space-x-2 text-xl md:text-2xl font-black text-gray-900 tracking-tight cursor-pointer hover:text-blue-600 transition"
                    >
                      <span>Paramètres</span>
                      <i className={`fa-solid fa-chevron-down text-sm text-gray-400 transition-transform duration-200 ${sectionTitleMenuOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {sectionTitleMenuOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-normal text-sm">
                        <button
                          onClick={() => {
                            setActiveTab("about");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-user text-gray-400"></i>
                          <span>À propos</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("documents");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-file-lines text-gray-400"></i>
                          <span>Mes documents</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("settings");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-solid fa-gear text-gray-400"></i>
                          <span>Paramètres</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Personnalisez votre expérience visuelle et vos préférences.</p>
                </div>
                <ThemeSettings />
              </div>
            )}

            {/* SECTION À PROPOS MULTI-ONGLETS (CENTRALISÉE & UNIFIÉE) */}
            {activeTab === "about" && (
              <div id="section-about-profile" className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 animate-fade-in">
                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight pb-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative inline-block text-left" ref={sectionTitleMenuRef}>
                    <button
                      type="button"
                      onClick={() => setSectionTitleMenuOpen(!sectionTitleMenuOpen)}
                      className="flex items-center space-x-2 cursor-pointer text-gray-900 hover:text-blue-600 transition"
                    >
                      <span>À propos</span>
                      <i className={`fa-solid fa-chevron-down text-sm text-gray-400 transition-transform duration-200 ${sectionTitleMenuOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {sectionTitleMenuOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-normal text-sm">
                        <button
                          onClick={() => {
                            setActiveTab("about");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-user text-gray-400"></i>
                          <span>À propos</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("documents");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-file-lines text-gray-400"></i>
                          <span>Mes documents</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("settings");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-solid fa-gear text-gray-400"></i>
                          <span>Paramètres</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Rubriques d'informations sur mobile */}
                    <div className="relative inline-block text-left md:hidden" ref={aboutDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setAboutDropdownOpen(!aboutDropdownOpen)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <span>Rubriques</span>
                        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${aboutDropdownOpen ? "rotate-180" : ""}`}></i>
                      </button>
                      {aboutDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-normal text-sm max-h-80 overflow-y-auto">
                          {[
                            { id: "intro", label: "Intro", icon: "fa-solid fa-hand" },
                            { id: "info_perso", label: "Informations personnelles", icon: "fa-regular fa-id-card" },
                            { id: "langues", label: "Langues", icon: "fa-solid fa-language" },
                            { id: "experiences", label: "Expériences professionnelles", icon: "fa-solid fa-user-tie" },
                            { id: "formation", label: "Formation", icon: "fa-solid fa-graduation-cap" },
                            { id: "competences", label: "Compétences", icon: "fa-solid fa-lightbulb" },
                            { id: "interets", label: "Centres d'intérêt", icon: "fa-solid fa-heart" },
                            { id: "coordonnees", label: "Coordonnées", icon: "fa-solid fa-address-book" },
                            { id: "confidentialite", label: "Confidentialité et informations juridiques", icon: "fa-solid fa-shield-halved" },
                            { id: "securite", label: "Sécurité & Connexion", icon: "fa-solid fa-lock" },
                            { id: "noms", label: "Noms", icon: "fa-regular fa-user" },
                          ].map((section) => {
                            const isSectionActive = activeSection === section.id;
                            return (
                              <button
                                key={section.id}
                                onClick={() => {
                                  setActiveSection(section.id);
                                  setAboutDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-xs transition cursor-pointer flex items-center space-x-2.5 ${
                                  isSectionActive
                                    ? "bg-[#E8F0FE] text-[#1D4ED8] font-extrabold"
                                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-bold"
                                }`}
                              >
                                <i className={`${section.icon} text-xs w-4 text-center ${isSectionActive ? "text-[#1D4ED8]" : "text-gray-400"}`}></i>
                                <span className="truncate">{section.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  <input
                    type="file"
                    ref={aiCvFileInputRef}
                    onChange={handleImportAndParseCv}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.avif,.webp"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => aiCvFileInputRef.current?.click()}
                    disabled={isParsingCv}
                    className="bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                    title="Scanner ou importer n'importe quel document (CNI, Passeport, CV, Attestation) pour remplissage automatique du profil"
                  >
                    <i className={`fa-solid ${isParsingCv ? "fa-spinner fa-spin text-gray-950" : "fa-expand text-gray-950"} text-xs`}></i>
                    <span>{isParsingCv ? "Analyse & OCR IA en cours..." : "Scanner Document (CV, CNI, Passeport)"}</span>
                  </button>
                  <span className="text-xs font-bold text-gray-400 hidden sm:inline">Profil & Coordonnées</span>
                </div>
              </h2>

              <div className="flex flex-col md:flex-row items-start gap-6 pt-1">
                
                {/* DESKTOP SIDEBAR : BARRE LATÉRALE GAUCHE (ONGLETS À PROPOS) */}
                <div className="hidden md:flex md:flex-col w-64 flex-shrink-0 border-r border-gray-200 pr-4 space-y-1">
                  {[
                    { id: "intro", label: "Intro", icon: "fa-solid fa-hand" },
                    { id: "info_perso", label: "Informations personnelles", icon: "fa-regular fa-id-card" },
                    { id: "langues", label: "Langues", icon: "fa-solid fa-language" },
                    { id: "experiences", label: "Expériences professionnelles", icon: "fa-solid fa-user-tie" },
                    { id: "formation", label: "Formation", icon: "fa-solid fa-graduation-cap" },
                    { id: "competences", label: "Compétences", icon: "fa-solid fa-lightbulb" },
                    { id: "interets", label: "Centres d'intérêt", icon: "fa-solid fa-heart" },
                    { id: "coordonnees", label: "Coordonnées", icon: "fa-solid fa-address-book" },
                    { id: "confidentialite", label: "Confidentialité et informations juridiques", icon: "fa-solid fa-shield-halved" },
                    { id: "securite", label: "Sécurité & Connexion", icon: "fa-solid fa-lock" },
                    { id: "noms", label: "Noms", icon: "fa-regular fa-user" },
                  ].map((tab) => {
                    const isActive = activeSection === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(tab.id);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center space-x-2.5 ${
                          isActive
                            ? "bg-[#E8F0FE] text-[#1D4ED8] font-extrabold shadow-xs"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold"
                        }`}
                      >
                        <i className={`${tab.icon} text-xs w-4 text-center ${isActive ? "text-[#1D4ED8]" : "text-gray-400"}`}></i>
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* MOBILE VIEW LEVEL 1 : LIST OF SECTIONS (TikTok style) */}
                {selectedSection === null && (
                  <div className="flex flex-col md:hidden w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                    {[
                      { id: "intro", label: "Intro", icon: "fa-solid fa-hand" },
                      { id: "info_perso", label: "Informations personnelles", icon: "fa-regular fa-id-card" },
                      { id: "langues", label: "Langues", icon: "fa-solid fa-language" },
                      { id: "experiences", label: "Expériences professionnelles", icon: "fa-solid fa-user-tie" },
                      { id: "formation", label: "Formation", icon: "fa-solid fa-graduation-cap" },
                      { id: "competences", label: "Compétences", icon: "fa-solid fa-lightbulb" },
                      { id: "interets", label: "Centres d'intérêt", icon: "fa-solid fa-heart" },
                      { id: "coordonnees", label: "Coordonnées", icon: "fa-solid fa-address-book" },
                      { id: "confidentialite", label: "Confidentialité et informations juridiques", icon: "fa-solid fa-shield-halved" },
                      { id: "securite", label: "Sécurité & Connexion", icon: "fa-solid fa-lock" },
                      { id: "noms", label: "Noms", icon: "fa-regular fa-user" },
                    ].map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                          setSelectedSection(section.id);
                          setActiveSection(section.id);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0">
                            <i className={`${section.icon} text-sm`}></i>
                          </div>
                          <span className="text-xs font-bold text-gray-800 truncate">{section.label}</span>
                        </div>
                        <i className="fa-solid fa-chevron-right text-gray-400 text-[10px]"></i>
                      </button>
                    ))}
                  </div>
                )}

                {/* ZONE DE CONTENU DÉTAILLÉE À DROITE / MOBILE LEVEL 2 */}
                <div className={`flex-1 w-full min-w-0 pl-0 md:pl-2 space-y-6 ${selectedSection === null ? "hidden md:block" : "block"}`}>
                  
                  {/* Fixed en-tête de retour sur mobile uniquement */}
                  {selectedSection !== null && (
                    <div className="flex items-center space-x-3.5 pb-4 border-b border-gray-150 md:hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedSection(null)}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center cursor-pointer transition"
                      >
                        <i className="fa-solid fa-arrow-left text-sm"></i>
                      </button>
                      <span className="text-sm font-black text-gray-900">
                        {[
                          { id: "intro", label: "Intro" },
                          { id: "info_perso", label: "Informations personnelles" },
                          { id: "langues", label: "Langues" },
                          { id: "experiences", label: "Expériences professionnelles" },
                          { id: "formation", label: "Formation" },
                          { id: "competences", label: "Compétences" },
                          { id: "interets", label: "Centres d'intérêt" },
                          { id: "coordonnees", label: "Coordonnées" },
                          { id: "confidentialite", label: "Confidentialité et informations juridiques" },
                          { id: "securite", label: "Sécurité & Connexion" },
                          { id: "noms", label: "Noms" },
                        ].find((s) => s.id === selectedSection)?.label || "Retour"}
                      </span>
                    </div>
                  )}
                  
                  {/* ONGLET: INFORMATIONS PERSONNELLES */}
                  {activeAboutTab === "info_perso" && (
                    <div className="space-y-4">
                      {/* Lieu Actuel */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-location-dot"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Lieu</h4>
                            <p className="text-sm font-extrabold text-[#1D4ED8] mt-0.5">{city || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Ville actuelle</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newCity = prompt("Modifier votre ville actuelle :", city || "");
                              if (newCity !== null) {
                                setCity(newCity.trim());
                                handleSaveAboutField("city", newCity.trim());
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Ville d'origine */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-location-arrow"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Ville d'origine</h4>
                            <p className="text-sm font-extrabold text-[#1D4ED8] mt-0.5">{country || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Ville d'origine</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newCountry = prompt("Modifier votre pays/ville d'origine :", country || "");
                              if (newCountry !== null) {
                                setCountry(newCountry.trim());
                                handleSaveAboutField("country", newCountry.trim());
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Date de naissance */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-cake-candles"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Date de naissance</h4>
                            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{birthDate || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Année de naissance</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newBirth = prompt("Modifier votre date de naissance :", birthDate || "");
                              if (newBirth !== null) {
                                setBirthDate(newBirth.trim());
                                handleSaveAboutField("birth_date", newBirth.trim());
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Statut Marital */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-heart"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Statut</h4>
                            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{maritalStatus || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Situation maritale</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newStatus = prompt("Modifier votre statut (Célibataire, Marié(e), Divorcé(e)) :", maritalStatus || "");
                              if (newStatus !== null) {
                                setMaritalStatus(newStatus.trim());
                                handleSaveAboutField("marital_status", newStatus.trim());
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Membre de */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-building"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Membre de</h4>
                            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{company || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Organisation certifiée</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-emerald-100 text-[#047857] font-bold px-2 py-0.5 rounded-md border border-emerald-200">Certifié</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newCompany = prompt("Modifier votre organisation/société :", company || "");
                              if (newCompany !== null) {
                                const trimmed = newCompany.trim();
                                setCompany(trimmed);
                                // Pas de colonne "company" dans profiles (audit
                                // sécurité 2026-08, section 7) : handleSaveAboutField
                                // upsertait vers une colonne inexistante, échec
                                // silencieux à chaque sauvegarde. localStorage est
                                // déjà le repli lu au chargement (ligne ~302) — en
                                // faire aussi la cible d'écriture rend le champ
                                // réellement persistant, plutôt que de simplement
                                // supprimer l'appel cassé et laisser la fonctionnalité
                                // perdre sa valeur au moindre rafraîchissement.
                                if (typeof window !== "undefined") {
                                  localStorage.setItem("user_company", trimmed);
                                }
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Niveau d'études : utilisé pour le filtre d'éligibilité aux offres d'emploi */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-graduation-cap"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Niveau d'études</h4>
                            <select
                              id="profil-education-level"
                              name="profil-education-level"
                              value={educationLevel}
                              onChange={(e) => {
                                const newLevel = e.target.value;
                                setEducationLevel(newLevel);
                                handleSaveAboutField("education_level", newLevel);
                              }}
                              className="mt-1 text-sm font-extrabold text-gray-900 bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="Aucun">Aucun</option>
                              <option value="CM2">CM2</option>
                              <option value="Brevet">Brevet</option>
                              <option value="BAC">BAC</option>
                              <option value="Licence">Licence</option>
                              <option value="Master">Master</option>
                              <option value="Doctorat">Doctorat</option>
                            </select>
                            <p className="text-[11px] text-gray-500 font-medium mt-1">Utilisé pour vérifier votre éligibilité aux offres d'emploi</p>
                          </div>
                        </div>
                      </div>

                      {/* Genre */}
                      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
                            <i className="fa-solid fa-[#D946EF] fa-mars-stroke"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Genre</h4>
                            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{gender || "Non renseigné"}</p>
                            <p className="text-[11px] text-gray-500 font-medium">Genre du profil</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newGender = prompt("Modifier votre genre (Homme, Femme, Autre) :", gender);
                              if (newGender !== null && newGender.trim()) {
                                setGender(newGender.trim());
                                handleSaveAboutField("gender", newGender.trim());
                              }
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                            title="Modifier"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ONGLET: INTRO (CENTRALISÉ: BIO, INFOS PERSONNELLES & COORDONNÉES) */}
                  {activeAboutTab === "intro" && (
                    <div className="space-y-4">
                      {/* Bio / Phrase d'accroche */}
                      <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 rounded-2xl border border-blue-100/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider">Phrase d'accroche Bio</h4>
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">🌐 Public</span>
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 leading-relaxed">
                          👋 {profileBio || "Non renseigné"}
                        </p>
                      </div>

                      {/* Identité & Données Personnelles (Prénom, Nom, Titre, Ville, Pays) */}
                      <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-3">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Informations Personnelles & CV</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">Nom complet</span>
                            <span className="font-extrabold text-gray-900 text-sm">{profileName}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">Titre professionnel</span>
                            <span className="font-extrabold text-gray-900 text-sm">{profileSubtitle || "Non renseigné"}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">Ville actuelle</span>
                            <span className="font-extrabold text-[#1D4ED8] text-sm">{city || "Non renseigné"}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">Pays / Origine</span>
                            <span className="font-extrabold text-[#1D4ED8] text-sm">{country || "Non renseigné"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Coordonnées & Admin */}
                      <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-3">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Coordonnées de Contact</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">Téléphone</span>
                            <span className="font-extrabold text-gray-900">{phone || "Non renseigné"}</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-400 block text-[10px] uppercase">E-mail</span>
                            <span className="font-extrabold text-gray-900">{userSession?.user?.email || "contact@facilite.sn"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Formulaire Interactif Centralisé d'édition */}
                      {isEditingBio ? (
                        <div className="space-y-4 bg-white p-5 rounded-2xl border-2 border-blue-500 shadow-xl transition">
                          <h4 className="text-sm font-extrabold text-blue-700 flex items-center space-x-2">
                            <i className="fa-solid fa-pen-to-square"></i>
                            <span>Modifier les détails de votre profil Intro</span>
                          </h4>

                          <div className="space-y-3 text-xs">
                            <div>
                              <label className="block font-bold text-gray-700 mb-1">Phrase d'accroche Bio</label>
                              <textarea
                                id="profil-bio"
                                name="profil-bio"
                                rows={2}
                                value={tempBio}
                                onChange={(e) => setTempBio(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-blue-600 text-gray-900"
                                placeholder="Ex. Youtubeur | Influenceur | Créateur | Inventeur | businessman..."
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Prénom</label>
                                <input
                                  id="profil-first-name"
                                  name="profil-first-name"
                                  type="text"
                                  value={firstName}
                                  onChange={(e) => setFirstName(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Nom</label>
                                <input
                                  id="profil-last-name"
                                  name="profil-last-name"
                                  type="text"
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Titre professionnel</label>
                                <input
                                  id="profil-job-title"
                                  name="profil-job-title"
                                  type="text"
                                  value={jobTitle}
                                  onChange={(e) => setJobTitle(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Ville</label>
                                <input
                                  id="profil-city"
                                  name="profil-city"
                                  type="text"
                                  value={city}
                                  onChange={(e) => setCity(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Pays</label>
                                <input
                                  id="profil-country"
                                  name="profil-country"
                                  type="text"
                                  value={country}
                                  onChange={(e) => setCountry(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Téléphone</label>
                                <input
                                  id="profil-phone"
                                  name="profil-phone"
                                  type="text"
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value)}
                                  className="w-full p-2 bg-gray-50 border border-gray-300 rounded-xl font-medium text-gray-900"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setIsEditingBio(false)}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold rounded-xl text-xs transition cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleSavePersonalDetails();
                                await handleSaveBioAndPinnedDetails();
                                setIsEditingBio(false);
                              }}
                              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition shadow-md cursor-pointer"
                            >
                              Enregistrer tout
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTempBio(profileBio);
                              setIsEditingBio(true);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition shadow-md cursor-pointer flex items-center space-x-2"
                          >
                            <i className="fa-solid fa-pen text-xs"></i>
                            <span>Modifier mon profil Intro</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAboutTab === "categorie" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-1">
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider">Catégorie Principale</h4>
                        <p className="text-sm font-extrabold text-gray-900">{jobTitle || "Création digitale"}</p>
                      </div>
                    </div>
                  )}

                  {activeAboutTab === "liens" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Site Web Officiel</h4>
                        <p className="text-sm font-extrabold text-blue-600 hover:underline cursor-pointer">{websiteUrl || "https://facilite.sn"}</p>
                      </div>
                    </div>
                  )}

                  {activeAboutTab === "coordonnees" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Téléphone</h4>
                          <p className="text-sm font-extrabold text-gray-900 mt-1">{profileData.telephone || 'Non renseigné'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newPhone = prompt("Modifier votre numéro de téléphone :", phone || "");
                            if (newPhone !== null) {
                              setPhone(newPhone.trim());
                              handleSaveAboutField("phone", newPhone.trim());
                            }
                          }}
                          className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                          title="Modifier"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">E-mail de contact</h4>
                          <p className="text-sm font-extrabold text-gray-900 mt-1">{profileData.email || 'Non renseigné'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newEmail = prompt("Modifier votre email de contact :", contactEmail || userSession?.user?.email || "");
                            if (newEmail !== null) {
                              setContactEmail(newEmail.trim());
                              handleSaveAboutField("contact_email", newEmail.trim());
                            }
                          }}
                          className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
                          title="Modifier"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAboutTab === "langues" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <i className="fa-solid fa-language text-emerald-600 text-base"></i>
                          <h3 className="text-sm md:text-base font-extrabold text-gray-900">Langues du profil</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewLangName("");
                            setNewLangLevel("Intermédiaire");
                            setLangModalOpen(true);
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer border border-emerald-200"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter une langue</span>
                        </button>
                      </div>

                      {userLanguages.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {userLanguages.map((lang, idx) => (
                            <div
                              key={lang.id || idx}
                              className="p-4 bg-gray-50/80 hover:bg-gray-100/80 rounded-2xl border border-gray-200/80 transition flex items-center justify-between group"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-black text-xs">
                                  <i className="fa-solid fa-globe"></i>
                                </div>
                                <div>
                                  <h4 className="text-xs font-extrabold text-gray-900 flex items-center space-x-1.5">
                                    <span>{lang.name}</span>
                                    {idx === 0 && (
                                      <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-md border border-emerald-200">
                                        Principal
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-[11px] text-gray-500 font-semibold">{lang.level}</p>
                                </div>
                              </div>

                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const updated = userLanguages.filter((_, i) => i !== idx);
                                    setUserLanguages(updated);
                                    if (userSession?.user) {
                                      await supabase.from("profiles").upsert({
                                        id: userSession.user.id,
                                        email: userSession.user.email,
                                        languages: updated,
                                        updated_at: new Date().toISOString(),
                                      });
                                    }
                                    triggerToast(`Langue ${lang.name} supprimée !`, "fa-trash-can");
                                  }}
                                  className="text-gray-300 hover:text-red-500 transition p-1.5 cursor-pointer"
                                  title="Supprimer cette langue"
                                >
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto text-sm">
                            <i className="fa-solid fa-language"></i>
                          </div>
                          <p className="text-xs font-semibold text-gray-700">Aucune langue renseignée pour le moment.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAboutTab === "experiences" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <i className="fa-solid fa-briefcase text-blue-600 text-base"></i>
                          <h3 className="text-sm md:text-base font-extrabold text-gray-900">Expérience professionnelle</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExperienceModalOpen(true)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter une expérience</span>
                        </button>
                      </div>

                      {experiences.length > 0 ? (
                        <div className="space-y-4 divide-y divide-gray-100">
                          {experiences.map((exp) => (
                            <div key={exp.id} className="pt-4 first:pt-0 flex items-start space-x-4 relative group">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center uppercase shadow-sm flex-shrink-0">
                                {exp.company ? exp.company.slice(0, 2) : "EX"}
                              </div>

                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                  <h4 className="text-xs md:text-sm font-extrabold text-gray-900">{exp.title}</h4>
                                  <button
                                    type="button"
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

                                {exp.skills && exp.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                                    {exp.skills.map((sk, idx) => (
                                      <span key={idx} className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded-full border border-blue-100">
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
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto text-sm">
                            <i className="fa-solid fa-briefcase"></i>
                          </div>
                          <p className="text-xs font-semibold text-gray-700">Aucune expérience enregistrée pour le moment.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAboutTab === "formation" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <i className="fa-solid fa-graduation-cap text-purple-600 text-base"></i>
                          <h3 className="text-sm md:text-base font-extrabold text-gray-900">Formation & Diplômes</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEducationModalOpen(true)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter une formation</span>
                        </button>
                      </div>

                      {educations.length > 0 ? (
                        <div className="space-y-4 divide-y divide-gray-100">
                          {educations.map((edu) => (
                            <div key={edu.id} className="pt-4 first:pt-0 flex items-start space-x-4 relative group">
                              <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center uppercase shadow-xs flex-shrink-0">
                                {edu.school ? edu.school.slice(0, 2) : "FD"}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                  <h4 className="text-xs md:text-sm font-extrabold text-gray-900">{edu.school}</h4>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEducation(edu.id)}
                                    className="text-gray-300 hover:text-red-500 transition p-1 cursor-pointer"
                                    title="Supprimer cette formation"
                                  >
                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                  </button>
                                </div>
                                <p className="text-xs font-bold text-gray-700">
                                  {edu.degree} {edu.field ? `• ${edu.field}` : ""}
                                </p>
                                <p className="text-[11px] text-gray-400 font-medium">
                                  {edu.startYear} — {edu.isCurrent ? "Présent" : edu.endYear}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mx-auto text-sm">
                            <i className="fa-solid fa-graduation-cap"></i>
                          </div>
                          <p className="text-xs font-semibold text-gray-700">Aucune formation ou diplôme enregistré pour le moment.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ONGLET: COMPÉTENCES */}
                  {activeAboutTab === "competences" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <i className="fa-solid fa-lightbulb text-amber-500 text-base"></i>
                          <h3 className="text-sm md:text-base font-extrabold text-gray-900">Compétences & Mots-clés</h3>
                        </div>
                      </div>

                      {/* Formulaire d'ajout de compétence */}
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          id="profil-new-skill"
                          name="profil-new-skill"
                          type="text"
                          value={newSkillInput}
                          onChange={(e) => setNewSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddNewUserSkill();
                            }
                          }}
                          placeholder="Ajouter une compétence (ex. React.js, Python, Leadership...)"
                          className="flex-1 p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewUserSkill}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter</span>
                        </button>
                      </div>

                      {/* Badges de compétences */}
                      {userSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {userSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-2xs group"
                            >
                              <span>{skill}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSkill(skill)}
                                className="text-amber-400 hover:text-red-600 transition cursor-pointer"
                                title="Supprimer cette compétence"
                              >
                                <i className="fa-solid fa-xmark text-xs"></i>
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 space-y-2">
                          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-sm">
                            <i className="fa-solid fa-lightbulb"></i>
                          </div>
                          <p className="text-xs font-semibold text-gray-700">Aucune compétence enregistrée pour le moment.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ONGLET: CENTRES D'INTÉRÊT */}
                  {activeAboutTab === "interets" && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <i className="fa-solid fa-heart text-rose-500 text-base"></i>
                          <h3 className="text-sm md:text-base font-extrabold text-gray-900">Centres d'intérêt</h3>
                        </div>
                      </div>

                      {/* Formulaire d'ajout de centre d'intérêt */}
                      <div className="flex items-center space-x-2 pt-1">
                        <input
                          id="interest-input-focus"
                          type="text"
                          value={newInterestInput}
                          onChange={(e) => setNewInterestInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddNewInterest();
                            }
                          }}
                          placeholder="Ajouter un centre d'intérêt (ex. Voyages, Lecture, Sport...)"
                          className="flex-1 p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500 text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewInterest}
                          className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Ajouter</span>
                        </button>
                      </div>

                      {/* Badges de centres d'intérêt */}
                      {profileData.centres_interet.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {profileData.centres_interet.map((interest, idx) => (
                            <span
                              key={idx}
                              className="bg-rose-50 text-rose-900 border border-rose-200 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center space-x-2 shadow-2xs group"
                            >
                              <span>{interest}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteInterest(interest)}
                                className="text-rose-400 hover:text-red-600 transition cursor-pointer"
                                title="Supprimer ce centre d'intérêt"
                              >
                                <i className="fa-solid fa-xmark text-xs"></i>
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400 space-y-3">
                          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-sm">
                            <i className="fa-solid fa-heart"></i>
                          </div>
                          <p className="text-xs font-semibold text-gray-700">Aucun centre d'intérêt renseigné.</p>
                          <button
                            type="button"
                            onClick={() => document.getElementById("interest-input-focus")?.focus()}
                            className="inline-flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer border border-rose-200"
                          >
                            <i className="fa-solid fa-plus text-xs"></i>
                            <span>Ajouter un centre d'intérêt</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ONGLET CONFIDENTIALITÉ : visibilité du profil public */}
                  {activeAboutTab === "confidentialite" && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-2xl border border-gray-200">
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                            <i className="fa-solid fa-globe text-xs text-blue-600"></i>
                            Rendre mon profil public
                          </h4>
                          <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                            Votre profil devient consultable par toute personne disposant du lien,
                            sans connexion. Sont affich&eacute;s : nom, titre, biographie, photo,
                            localisation, expériences et formations.
                            <br />
                            <span className="font-bold text-gray-700">
                              Ne sont jamais publiés : votre e-mail de connexion, date de naissance,
                              genre, situation familiale, permis et CV.
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPublic}
                          disabled={savingVisibility}
                          onClick={() => handleSaveVisibility("is_public", !isPublic)}
                          className={`relative shrink-0 w-12 h-6 rounded-full transition cursor-pointer disabled:opacity-50 ${
                            isPublic ? "bg-[#10E688]" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              isPublic ? "translate-x-6" : "translate-x-0"
                            }`}
                          ></span>
                        </button>
                      </div>

                      <div
                        className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition ${
                          isPublic
                            ? "bg-white border-gray-200"
                            : "bg-gray-50 border-gray-100 opacity-60"
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                            <i className="fa-solid fa-address-card text-xs text-indigo-600"></i>
                            Afficher mes coordonnées
                          </h4>
                          <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                            Publie votre e-mail de contact, votre téléphone et votre site web sur
                            votre profil public. Désactivé, ces champs restent masqués même si le
                            profil est public.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showContact}
                          disabled={savingVisibility || !isPublic}
                          onClick={() => handleSaveVisibility("show_contact", !showContact)}
                          className={`relative shrink-0 w-12 h-6 rounded-full transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                            showContact && isPublic ? "bg-[#10E688] " : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              showContact && isPublic ? "translate-x-6" : "translate-x-0"
                            }`}
                          ></span>
                        </button>
                      </div>

                      {isPublic && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                          <p className="text-[11px] font-bold text-blue-900">
                            <i className="fa-solid fa-link text-[10px] mr-1.5"></i>
                            Votre profil est en ligne &agrave; l&apos;adresse{" "}
                            <span className="font-mono break-all">
                              /in/{userSession?.user?.id}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4 p-4 bg-white rounded-2xl border border-gray-200">
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                            <i className="fa-solid fa-file-shield text-xs text-emerald-600"></i>
                            Rendre mon CV visible aux recruteurs vérifiés
                          </h4>
                          <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
                            Seuls les recruteurs ayant validé leur vérification
                            (badge Recruteur vérifié) pourront trouver votre profil
                            dans leur répertoire de recherche de candidats.
                            <br />
                            <span className="font-bold text-gray-700">
                              Déposer un CV n&apos;active pas cette visibilité automatiquement
                              — c&apos;est désactivé par défaut, à vous de l&apos;activer.
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cvVisibleRecruteurs}
                          disabled={savingCvVisibility}
                          onClick={() => handleSaveCvVisibility(!cvVisibleRecruteurs)}
                          className={`relative shrink-0 w-12 h-6 rounded-full transition cursor-pointer disabled:opacity-50 ${
                            cvVisibleRecruteurs ? "bg-[#10E688]" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              cvVisibleRecruteurs ? "translate-x-6" : "translate-x-0"
                            }`}
                          ></span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ONGLET SÉCURITÉ : Mot de passe et identifiants */}
                  {activeAboutTab === "securite" && (
                    <SecurityTabContent userSession={userSession} />
                  )}

                  {!["intro", "info_perso", "langues", "experiences", "formation", "competences", "interets", "coordonnees", "confidentialite", "securite", "noms"].includes(activeAboutTab) && (
                    <div className="p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-2">
                      <p className="text-xs font-bold text-gray-700">Aucune donnée spécifique enregistrée pour cet onglet.</p>
                      <p className="text-[11px] text-gray-500">Cliquez sur l'icône de crayon pour ajouter des informations.</p>
                    </div>
                  )}

                </div>

              </div>
            </div>
            )}

            {/* SECTION MES DOCUMENTS */}
            {activeTab === "documents" && (
              <div id="section-mon-profil-cv" className="space-y-3 pt-2 scroll-mt-24 animate-fade-in">
                <div>
                  <div className="relative inline-block text-left" ref={sectionTitleMenuRef}>
                    <button
                      type="button"
                      onClick={() => setSectionTitleMenuOpen(!sectionTitleMenuOpen)}
                      className="flex items-center space-x-2 text-xl md:text-2xl font-black text-gray-900 tracking-tight cursor-pointer hover:text-blue-600 transition"
                    >
                      <span>Mes documents</span>
                      <i className={`fa-solid fa-chevron-down text-sm text-gray-400 transition-transform duration-200 ${sectionTitleMenuOpen ? "rotate-180" : ""}`}></i>
                    </button>
                    {sectionTitleMenuOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in-up font-normal text-sm font-sans">
                        <button
                          onClick={() => {
                            setActiveTab("about");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-user text-gray-400"></i>
                          <span>À propos</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("documents");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-regular fa-file-lines text-gray-400"></i>
                          <span>Mes documents</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("settings");
                            setSectionTitleMenuOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer flex items-center space-x-2"
                        >
                          <i className="fa-solid fa-gear text-gray-400"></i>
                          <span>Paramètres</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 font-medium mt-1">Gérez vos fichiers réutilisables, CVs et lettres de motivation.</p>
                </div>

              {/* Carte Principale Formulaire */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
                
                {/* Section Gestionnaire Multi-Documents (CVs & Lettres de Motivation) */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#047857]">
                        <i className="fa-regular fa-file-lines text-xl font-bold"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-gray-900 flex items-center space-x-2">
                          <span>Curriculum vitae & Lettres de motivation</span>
                          <span className="bg-emerald-100 text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            {userDocuments.length} document{userDocuments.length > 1 ? "s" : ""}
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 font-medium">Ajoutez ou supprimez vos fichiers réutilisables pour vos candidatures.</p>
                      </div>
                    </div>

                    <input
                      id="profil-cv-file-upload"
                      name="profil-cv-file-upload"
                      type="file"
                      ref={cvFileInputRef}
                      onChange={handleCvFileChange}
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <Link
                        href="/importer-cv"
                        className="bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition shadow-xs cursor-pointer justify-center flex-1 sm:flex-none"
                      >
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                        <span>Rédaction</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => cvFileInputRef.current?.click()}
                        className="bg-[#047857] hover:bg-[#036448] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition shadow-xs cursor-pointer justify-center flex-1 sm:flex-none"
                      >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Ajouter un document</span>
                      </button>
                    </div>
                  </div>

                  {/* Invitation à activer la visibilité recruteurs, affichée juste
                      après le dépôt d'un CV — jamais d'activation automatique. */}
                  {showCvVisibilityInvite && !cvVisibleRecruteurs && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="min-w-0 flex items-start gap-2.5">
                        <i className="fa-solid fa-circle-info text-emerald-600 text-sm mt-0.5"></i>
                        <p className="text-xs font-semibold text-emerald-900 leading-relaxed">
                          CV ajouté ! Voulez-vous le rendre visible aux recruteurs vérifiés
                          pour qu&apos;ils puissent vous contacter directement ? Vous pouvez
                          changer d&apos;avis à tout moment dans l&apos;onglet Confidentialité.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={savingCvVisibility}
                          onClick={() => handleSaveCvVisibility(true)}
                          className="bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-extrabold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                        >
                          Rendre visible
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCvVisibilityInvite(false)}
                          className="text-emerald-700 hover:text-emerald-900 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          Plus tard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Liste des Documents Utilisateur */}
                  {userDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {userDocuments.map((doc, idx) => (
                        <div
                          key={doc.id || idx}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-gray-50/80 hover:bg-gray-100/80 border border-gray-200/80 rounded-2xl transition gap-3"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            {doc.status === "processing" ? (
                              <span
                                className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin flex-shrink-0"
                                title="Analyse en cours"
                              ></span>
                            ) : doc.status === "error" ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" title="Échec de l'analyse"></span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" title="Analyse terminée"></span>
                            )}
                            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-[#047857] flex items-center justify-center flex-shrink-0 font-bold">
                              <i className="fa-solid fa-file-pdf text-sm"></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {doc.title || "Document_Professionnel"}
                              </p>
                              <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-semibold mt-0.5">
                                <span className="bg-white text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                                  {doc.type || (doc.title?.toLowerCase().includes("lettre") ? "Lettre de motivation" : "CV")}
                                </span>
                                {doc.status === "processing" && (
                                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    Analyse en cours...
                                  </span>
                                )}
                                {doc.status === "error" && (
                                  <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                                    Échec de l'analyse
                                  </span>
                                )}
                                {doc.created_at && (
                                  <span>
                                    • {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Groupe de boutons d'action : Voir & Supprimer */}
                          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setCvUrl(doc.file_url);
                                setUploadedCvFileName(doc.title);
                                setCvPreviewModalOpen(true);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-[#047857] border border-[#A7F3D0] font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                              title="Voir ce document"
                            >
                              <i className="fa-solid fa-eye text-xs"></i>
                              <span>Voir</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id, doc.file_url, doc.title)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                              title="Supprimer ce document"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl space-y-2">
                      <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center mx-auto text-sm">
                        <i className="fa-solid fa-file-circle-xmark"></i>
                      </div>
                      <p className="text-xs font-bold text-gray-700">Aucun document enregistré pour le moment</p>
                      <p className="text-[11px] text-gray-500">Ajoutez vos CVs ou lettres de motivation au format PDF ou DOCX.</p>
                      <button
                        type="button"
                        onClick={() => cvFileInputRef.current?.click()}
                        className="mt-2 inline-flex items-center space-x-1.5 bg-[#047857] text-white font-extrabold text-xs px-4 py-2 rounded-xl hover:bg-[#036448] transition cursor-pointer"
                      >
                        <i className="fa-solid fa-upload text-xs"></i>
                        <span>Téléverser mon premier document</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

          </div>

          {/* COLONNE DROITE : Paramètres de confidentialité & Action rapides (Fixe / Sticky au Scroll) */}
          <div className="w-full lg:w-[326px] flex flex-col space-y-4 sticky top-[76px] self-start transition-all z-10">

            {/* Carte URL du profil public (Génération Dynamique & Interactive) */}
            {(() => {
              const rawName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (profileName || (userSession?.user?.email ? userSession.user.email.split("@")[0] : "facilite-user"));
              const profileSlug = rawName
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "facilite-user";
              const displayUrl = `facilite.sn/in/${profileSlug}`;
              const relativeUrl = `/in/${profileSlug}`;
              const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${relativeUrl}` : `https://${displayUrl}`;

              return (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Profil public et URL</h3>
                  <a
                    href={relativeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-gray-600 hover:text-blue-600 font-extrabold truncate block hover:underline flex items-center space-x-1"
                    title="Cliquer pour voir votre profil public"
                  >
                    <span className="truncate">{displayUrl}</span>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-blue-500"></i>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(fullUrl);
                      }
                      setIsCopiedLink(true);
                      triggerToast(`Lien copié dans le presse-papier !`, "fa-check");
                      setTimeout(() => setIsCopiedLink(false), 2500);
                    }}
                    className={`w-full font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 ${
                      isCopiedLink
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-blue-50 hover:bg-blue-100 text-blue-700"
                    }`}
                  >
                    <i className={`fa-solid ${isCopiedLink ? "fa-check" : "fa-copy"} text-xs`}></i>
                    <span>{isCopiedLink ? "Copié !" : "Copier le lien du profil"}</span>
                  </button>
                </div>
              );
            })()}

            {/* Carte Mes documents (Mint Green style conforme à la capture) */}
            <div
              className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer flex items-center space-x-3 group"
              onClick={() => {
                const el = document.getElementById("section-mon-profil-cv");
                if (el) el.scrollIntoView({ behavior: "smooth" });
                triggerToast("Section Mes documents affichée !", "fa-circle-check");
              }}
            >
              <i className="fa-regular fa-file-lines text-lg text-[#047857] font-bold group-hover:scale-110 transition transform"></i>
              <span className="text-sm font-extrabold text-[#047857] tracking-tight">
                Mes documents (Actif)
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
                    id="exp-title"
                    name="exp-title"
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
                    id="exp-company"
                    name="exp-company"
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
                    id="exp-location"
                    name="exp-location"
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
                    id="exp-location-type"
                    name="exp-location-type"
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
                    id="exp-employment-type"
                    name="exp-employment-type"
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
                    id="exp-start-month"
                    name="exp-start-month"
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
                    id="exp-start-year"
                    name="exp-start-year"
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
                    id="exp-skill-input"
                    name="exp-skill-input"
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
      {/* MODAL 5: AJOUTER UNE FORMATION */}
      {educationModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target.id === "edu-modal-wrapper") setEducationModalOpen(false);
          }}
          id="edu-modal-wrapper"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative border border-gray-100 transform transition-all scale-100 my-8">
            <button
              onClick={() => setEducationModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>

            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-lg font-extrabold text-gray-900">Ajouter une formation</h3>
              <p className="text-xs text-gray-500 font-medium">Ajoutez vos diplômes, études ou certifications.</p>
            </div>

            <form onSubmit={handleAddEducation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Établissement / École / Université *</label>
                <input
                  id="edu-school"
                  name="edu-school"
                  type="text"
                  value={eduSchool}
                  onChange={(e) => setEduSchool(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 transition font-medium text-gray-900"
                  placeholder="Ex. Université Cheikh Anta Diop, Lycée..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Diplôme / Certificat *</label>
                <input
                  id="edu-degree"
                  name="edu-degree"
                  type="text"
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 transition font-medium text-gray-900"
                  placeholder="Ex. Licence, Baccalauréat Scientifique..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Domaine d'études</label>
                <input
                  id="edu-field"
                  name="edu-field"
                  type="text"
                  value={eduField}
                  onChange={(e) => setEduField(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 transition font-medium text-gray-900"
                  placeholder="Ex. Informatique, Gestion des RH..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Année de début</label>
                  <select
                    id="edu-start-year"
                    name="edu-start-year"
                    value={eduStartYear}
                    onChange={(e) => setEduStartYear(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 transition font-bold text-gray-700 cursor-pointer"
                  >
                    {Array.from({ length: 30 }, (_, i) => 2026 - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Année de fin</label>
                  <select
                    id="edu-end-year"
                    name="edu-end-year"
                    value={eduEndYear}
                    onChange={(e) => setEduEndYear(e.target.value)}
                    disabled={eduIsCurrent}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 transition font-bold text-gray-700 cursor-pointer disabled:opacity-50"
                  >
                    {Array.from({ length: 30 }, (_, i) => 2028 - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="eduIsCurrent"
                  checked={eduIsCurrent}
                  onChange={(e) => setEduIsCurrent(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="eduIsCurrent" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Formation actuellement en cours
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEducationModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition shadow-md cursor-pointer"
                >
                  Enregistrer la formation
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

              {cvDisplayUrl && (
                <a
                  href={cvDisplayUrl}
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
              {cvDisplayUrl ? (
                cvFileType === "pdf" || cvDisplayUrl.startsWith("data:application/pdf") ? (
                  <iframe
                    src={cvDisplayUrl}
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
                      href={cvDisplayUrl}
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
                  id="crop-zoom-slider"
                  name="crop-zoom-slider"
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
      {/* MODALE D'AJOUT DE LANGUE */}
      {langModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
                <i className="fa-solid fa-language text-emerald-600"></i>
                <span>Ajouter une langue à votre profil</span>
              </h3>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nom de la langue</label>
                <input
                  id="lang-name"
                  name="lang-name"
                  type="text"
                  value={newLangName}
                  onChange={(e) => setNewLangName(e.target.value)}
                  placeholder="Ex. Anglais, Wolof, Espagnol, Allemand..."
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Niveau de maîtrise</label>
                <select
                  id="lang-level"
                  name="lang-level"
                  value={newLangLevel}
                  onChange={(e) => setNewLangLevel(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                >
                  <option value="Langue maternelle">Langue maternelle</option>
                  <option value="Courant / Bilingue">Courant / Bilingue</option>
                  <option value="Avancé">Avancé</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Débutant">Débutant</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold rounded-xl text-xs transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newLangName.trim()) return;
                  const newLang = {
                    id: `lang-${Date.now()}`,
                    name: newLangName.trim(),
                    level: newLangLevel
                  };
                  const updated = [...userLanguages, newLang];
                  setUserLanguages(updated);
                  if (userSession?.user) {
                    await supabase.from("profiles").upsert({
                      id: userSession.user.id,
                      email: userSession.user.email,
                      languages: updated,
                      updated_at: new Date().toISOString(),
                    });
                  }
                  setLangModalOpen(false);
                  triggerToast(`Langue ${newLangName.trim()} ajoutée !`, "fa-language");
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                Enregistrer la langue
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODALE INTERACTIVE DE PRÉVISUALISATION ET D'ÉDITION DES DONNÉES DU SCAN */}
      {scanModalOpen && scannedData && (
        <div className="fixed inset-0 z-[700] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-gray-100 my-8 space-y-5 relative max-h-[90vh] flex flex-col">
            
            {/* Header Modale */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shadow-xs">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 flex items-center space-x-2">
                    <span>Données extraites du document — Vérification & Édition</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Vérifiez ou éditez directement les informations ci-dessous avant qu'elles ne remplacent les anciennes données de votre profil.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScanModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Onglets de navigation dans la modale */}
            <div className="flex items-center space-x-1 border-b border-gray-200 overflow-x-auto pb-1 flex-shrink-0 text-xs">
              {[
                { id: "general", label: "Identité & Contact", icon: "fa-solid fa-user" },
                { id: "bio", label: "Bio & Titre", icon: "fa-solid fa-align-left" },
                { id: "skills", label: "Compétences", icon: "fa-solid fa-lightbulb" },
                { id: "experiences", label: "Expériences", icon: "fa-solid fa-briefcase" },
                { id: "education", label: "Formation", icon: "fa-solid fa-graduation-cap" },
                { id: "languages", label: "Langues", icon: "fa-solid fa-language" },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScanModalActiveTab(t.id)}
                  className={`px-3 py-2 rounded-xl font-extrabold transition cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
                    scanModalActiveTab === t.id ? "bg-emerald-100 text-emerald-800" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <i className={`${t.icon} text-xs`}></i>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Corps défilant de la modale */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4 text-xs">
              
              {/* TAB: IDENTITÉ & CONTACT */}
              {scanModalActiveTab === "general" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Prénom</label>
                      <input
                        id="scan-first-name"
                        name="scan-first-name"
                        type="text"
                        value={scannedData.firstName}
                        onChange={(e) => setScannedData({ ...scannedData, firstName: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Nom de famille</label>
                      <input
                        id="scan-last-name"
                        name="scan-last-name"
                        type="text"
                        value={scannedData.lastName}
                        onChange={(e) => setScannedData({ ...scannedData, lastName: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Ville</label>
                      <input
                        id="scan-city"
                        name="scan-city"
                        type="text"
                        value={scannedData.city}
                        onChange={(e) => setScannedData({ ...scannedData, city: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Pays</label>
                      <input
                        id="scan-country"
                        name="scan-country"
                        type="text"
                        value={scannedData.country}
                        onChange={(e) => setScannedData({ ...scannedData, country: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Date de naissance</label>
                      <input
                        type="text"
                        value={scannedData.birthDate}
                        onChange={(e) => setScannedData({ ...scannedData, birthDate: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Sexe</label>
                      <select
                        value={scannedData.gender}
                        onChange={(e) => setScannedData({ ...scannedData, gender: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      >
                        <option value="Homme">Homme</option>
                        <option value="Femme">Femme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Statut marital</label>
                      <input
                        type="text"
                        value={scannedData.maritalStatus}
                        onChange={(e) => setScannedData({ ...scannedData, maritalStatus: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Permis de conduire</label>
                      <input
                        type="text"
                        value={scannedData.driverLicense}
                        onChange={(e) => setScannedData({ ...scannedData, driverLicense: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: BIO & TITRE */}
              {scanModalActiveTab === "bio" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Titre / Intitulé professionnel</label>
                    <input
                      type="text"
                      value={scannedData.jobTitle}
                      onChange={(e) => setScannedData({ ...scannedData, jobTitle: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Bio & Présentation récapitulative</label>
                    <textarea
                      rows={5}
                      value={scannedData.bio}
                      onChange={(e) => setScannedData({ ...scannedData, bio: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* TAB: COMPÉTENCES */}
              {scanModalActiveTab === "skills" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Compétences extraites (séparées par une virgule)</label>
                    <input
                      type="text"
                      value={scannedData.skills.join(", ")}
                      onChange={(e) => setScannedData({ ...scannedData, skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-medium focus:outline-none focus:border-emerald-600 text-gray-900"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {scannedData.skills.map((sk, i) => (
                      <span key={i} className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: EXPÉRIENCES */}
              {scanModalActiveTab === "experiences" && (
                <div className="space-y-4 animate-fade-in">
                  {scannedData.experiences.map((exp, i) => (
                    <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                      <div>
                        <label className="block font-bold text-gray-700 mb-0.5">Poste / Intitulé</label>
                        <input
                          type="text"
                          value={exp.title}
                          onChange={(e) => {
                            const updated = [...scannedData.experiences];
                            updated[i].title = e.target.value;
                            setScannedData({ ...scannedData, experiences: updated });
                          }}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-0.5">Entreprise</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const updated = [...scannedData.experiences];
                            updated[i].company = e.target.value;
                            setScannedData({ ...scannedData, experiences: updated });
                          }}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: FORMATION */}
              {scanModalActiveTab === "education" && (
                <div className="space-y-4 animate-fade-in">
                  {scannedData.educations.map((edu, i) => (
                    <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                      <div>
                        <label className="block font-bold text-gray-700 mb-0.5">Établissement / École</label>
                        <input
                          type="text"
                          value={edu.school}
                          onChange={(e) => {
                            const updated = [...scannedData.educations];
                            updated[i].school = e.target.value;
                            setScannedData({ ...scannedData, educations: updated });
                          }}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-0.5">Diplôme / Domaine</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = [...scannedData.educations];
                            updated[i].degree = e.target.value;
                            setScannedData({ ...scannedData, educations: updated });
                          }}
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB: LANGUES */}
              {scanModalActiveTab === "languages" && (
                <div className="space-y-4 animate-fade-in">
                  {scannedData.languages.map((lang, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={lang.name}
                        onChange={(e) => {
                          const updated = [...scannedData.languages];
                          updated[i].name = e.target.value;
                          setScannedData({ ...scannedData, languages: updated });
                        }}
                        className="flex-1 p-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium"
                      />
                      <input
                        type="text"
                        value={lang.level}
                        onChange={(e) => {
                          const updated = [...scannedData.languages];
                          updated[i].level = e.target.value;
                          setScannedData({ ...scannedData, languages: updated });
                        }}
                        className="w-36 p-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 flex-shrink-0">
              <span className="text-[11px] text-gray-400 font-medium truncate max-w-[200px]">
                Fichier : <span className="font-bold text-gray-700">{scannedData.docName}</span>
              </span>
              <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setScanModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-extrabold rounded-xl text-xs transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScanData}
                  disabled={savingScanData}
                  className="px-5 py-2.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black rounded-xl text-xs transition shadow-md cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
                >
                  <i className={`fa-solid ${savingScanData ? "fa-spinner fa-spin" : "fa-check"} text-xs`}></i>
                  <span>{savingScanData ? "Enregistrement..." : "Valider et Enregistrer dans mon profil"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
