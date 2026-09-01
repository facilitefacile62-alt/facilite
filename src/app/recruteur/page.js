"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import { sendMessage } from "@/lib/messages";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import VideoInterviewModal from "@/components/VideoInterviewModal";
import SocialShareButtons from "@/components/SocialShareButtons";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import OfferMediaGallery from "@/components/OfferMediaGallery";
import { parseOfferImages, serializeOfferImages } from "@/lib/offerMedia";
import { detectWhatsAppNumber, buildWhatsAppLink } from "@/lib/offerContact";
import { LISTING_TYPE_LABELS } from "@/lib/listingTypes";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

const EMPTY_OFFER = {
  title: "",
  company: "",
  location: "Sénégal",
  contract_type: "CDI",
  listing_type: "offre_emploi",
  salary_range: "",
  min_education_level: "Aucun",
  description: "",
  image_url: "",
  deadline: "",
  contact_email: "",
  contact_phone: "",
  external_link: "",
  application_url: "",
  application_email: "",
  additional_info: "",
  requires_cover_letter: false,
};

const EMPTY_RECRUITER_PROFILE = {
  company_name: "",
  sector: "",
  location: "Dakar, Sénégal",
  logo_url: "",
  banner_url: "",
  description: "",
  website: "",
};

const OFFER_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_OFFER_IMAGE_BYTES = 5 * 1024 * 1024;

// Extrait hors du composant (react-hooks/purity) : Date.now() ne doit pas
// être appelé pendant le rendu, uniquement depuis un gestionnaire d'événement.
function buildStoragePath(userId, ext, { folder = "", prefix = "" } = {}) {
  const folderPart = folder ? `${folder}/` : "";
  const prefixPart = prefix ? `${prefix}-` : "";
  return `${userId}/${folderPart}${prefixPart}${Date.now()}.${ext}`;
}

// Delta période précédente → période courante, en pourcentage. "prev=0"
// n'a pas de variation relative sensée (division par zéro) : on affiche
// "Nouveau" plutôt qu'un pourcentage fabriqué.
function formatPeriodDelta(current, prev) {
  if (!prev || prev === 0) return current > 0 ? { text: "Nouveau", positive: true } : { text: "—", positive: null };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
}

function formatHours(hours) {
  if (hours === null || hours === undefined) return "—";
  const h = Number(hours);
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} j`;
}

const APPLICATION_STATUSES = [
  { value: "pending", label: "Envoyée" },
  { value: "reviewed", label: "Présélection" },
  { value: "contacted", label: "Contacté" },
  { value: "interview_scheduled", label: "Entretien programmé" },
  { value: "accepted", label: "Retenu" },
  { value: "rejected", label: "Écarté" },
];

const STATUS_BADGE_COLORS = {
  pending: "bg-gray-100 text-gray-600",
  reviewed: "bg-blue-50 text-blue-700",
  contacted: "bg-indigo-50 text-indigo-700",
  interview_scheduled: "bg-purple-50 text-purple-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

function StatusBadgeMini({ status }) {
  const label = APPLICATION_STATUSES.find((s) => s.value === status)?.label || status;
  const colorClass = STATUS_BADGE_COLORS[status] || "bg-gray-100 text-gray-600";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap ${colorClass}`}>{label}</span>;
}

export default function RecruteurDashboardPage() {
  const router = useRouter();
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [activeTab, setActiveTab] = useState("vue-ensemble"); // 'vue-ensemble' | 'offres' | 'candidatures' | 'cvtheque' | 'profil'
  const [overviewStats, setOverviewStats] = useState(null);
  const [dailySeries, setDailySeries] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const offerFormRef = useRef(null);

  // --- Onglet Profil Entreprise (vitrine publique /recruteurs/[id]) ---
  const [recruiterProfileId, setRecruiterProfileId] = useState(null);
  const [recruiterProfileForm, setRecruiterProfileForm] = useState(EMPTY_RECRUITER_PROFILE);
  const [savingRecruiterProfile, setSavingRecruiterProfile] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // --- Onglet Offres / Publieur IA & Multi-Photos ---
  const [myOffers, setMyOffers] = useState([]);
  const [offerSearchQuery, setOfferSearchQuery] = useState("");
  const [publishMode, setPublishMode] = useState("ai_scanner"); // "ai_scanner" | "manual"
  const [imageTab, setImageTab] = useState("upload"); // "upload" | "ai_generate"
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAiPoster, setIsGeneratingAiPoster] = useState(false);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [examenPasse, setExamenPasse] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [offerImageFiles, setOfferImageFiles] = useState([]);
  const [offerImagePreviews, setOfferImagePreviews] = useState([]);
  const [accompanyingText, setAccompanyingText] = useState("");
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [togglingOfferId, setTogglingOfferId] = useState(null);
  const [viewImageModal, setViewImageModal] = useState({ isOpen: false, url: null });
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileDropInputRef = useRef(null);
  const additionalFileInputRef = useRef(null);

  // --- Onglet Candidatures reçues ---
  const [applications, setApplications] = useState([]);
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [downloadingCvId, setDownloadingCvId] = useState(null);
  const [startingInterviewId, setStartingInterviewId] = useState(null);
  const [activeInterviewId, setActiveInterviewId] = useState(null);

  const handleStartInterview = async (application) => {
    setStartingInterviewId(application.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        triggerToast("Session expirée, reconnectez-vous.");
        return;
      }

      const res = await fetch("/api/interviews/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.interviewId) {
        triggerToast(data?.error || "Échec de la création de l'entretien.");
        return;
      }

      setActiveInterviewId(data.interviewId);
    } catch (err) {
      console.error("Erreur démarrage entretien:", err);
      triggerToast("Échec de la création de l'entretien.");
    } finally {
      setStartingInterviewId(null);
    }
  };
  const [sortByScore, setSortByScore] = useState(false);

  // --- Onglet CVthèque ---
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  // Quota quotidien de consultations (20260806150000_cv_consultations_quota.sql)
  // — décidé et compté côté serveur dans /api/recruteur/candidats-recherche,
  // ceci n'est qu'un affichage du dernier statut renvoyé.
  const [cvQuota, setCvQuota] = useState(null);
  const [recruiterVerified, setRecruiterVerified] = useState(true);
  const [pendingBadgeRequest, setPendingBadgeRequest] = useState(null);
  const [badgeRequestForm, setBadgeRequestForm] = useState({ company_name: "", ninea_number: "", rccm_number: "" });
  const [badgeDocumentFile, setBadgeDocumentFile] = useState(null);
  const [submittingBadgeRequest, setSubmittingBadgeRequest] = useState(false);
  const [badgeRequestError, setBadgeRequestError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [signedCvUrl, setSignedCvUrl] = useState(null);
  const [loadingCvUrl, setLoadingCvUrl] = useState(false);
  const [contactingId, setContactingId] = useState(null);

  // Recherche sémantique (embedding de la requête + RPC match_resumes) : un
  // Map user_id -> similarité quand active, null quand on est revenu à la
  // recherche texte classique.
  const [semanticResults, setSemanticResults] = useState(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState("");

  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // --- Onglet Matching IA (RAG) ---
  const [selectedOfferForRag, setSelectedOfferForRag] = useState("");
  const [customQueryRag, setCustomQueryRag] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResults, setRagResults] = useState(null);
  const [ragError, setRagError] = useState("");
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);

  const handleRunRagMatching = async (targetOfferId = null, targetQuery = null) => {
    const offerToUse = targetOfferId !== null ? targetOfferId : selectedOfferForRag;
    const queryToUse = targetQuery !== null ? targetQuery : customQueryRag;

    if (!offerToUse && (!queryToUse || !queryToUse.trim())) {
      setRagError("Veuillez sélectionner une offre d'emploi ou saisir vos critères.");
      return;
    }

    setRagLoading(true);
    setRagError("");
    setRagResults(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        triggerToast("Session expirée, reconnectez-vous.");
        return;
      }

      const payload = {};
      if (offerToUse && offerToUse !== "custom") {
        payload.offerId = offerToUse;
      } else {
        payload.customQuery = queryToUse;
      }

      const res = await fetch("/api/recruteur/rag-matching", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'analyse RAG.");
      }

      setRagResults(data);
      if (data.candidates && data.candidates.length > 0) {
        setExpandedCandidateId(data.candidates[0].id);
      }
      triggerToast("Analyse RAG générée avec succès ! ✨");
    } catch (err) {
      console.error("Erreur RAG Matching:", err);
      setRagError(err.message || "Une erreur est survenue lors de l'analyse RAG.");
    } finally {
      setRagLoading(false);
    }
  };

  // Dépôt d'une demande d'accréditation "Recruteur vérifié" (section 4 du
  // chantier RBAC) : NINEA/RCCM obligatoires, imposé par la contrainte SQL
  // verified_recruiter_requires_company_docs, pas seulement ce formulaire.
  const handleSubmitBadgeRequest = async (e) => {
    e.preventDefault();
    if (!userSession?.user) return;
    setBadgeRequestError("");

    if (!badgeRequestForm.company_name.trim() || !badgeRequestForm.ninea_number.trim() || !badgeRequestForm.rccm_number.trim()) {
      setBadgeRequestError("Nom de l'entreprise, NINEA et RCCM sont obligatoires.");
      return;
    }

    setSubmittingBadgeRequest(true);
    try {
      const documentPaths = [];
      if (badgeDocumentFile) {
        const ext = badgeDocumentFile.name.split(".").pop().toLowerCase();
        const storagePath = buildStoragePath(userSession.user.id, ext);
        const { error: uploadError } = await supabase.storage
          .from("badge-documents")
          .upload(storagePath, badgeDocumentFile, { contentType: badgeDocumentFile.type });
        if (uploadError) throw new Error("Échec du téléversement du document : " + uploadError.message);
        documentPaths.push(storagePath);
      }

      const { data: created, error } = await supabase
        .from("badge_requests")
        .insert({
          user_id: userSession.user.id,
          requested_badge: "verified_recruiter",
          company_name: badgeRequestForm.company_name.trim(),
          ninea_number: badgeRequestForm.ninea_number.trim(),
          rccm_number: badgeRequestForm.rccm_number.trim(),
          document_urls: documentPaths,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      setPendingBadgeRequest(created);
      triggerToast("Demande envoyée — notre équipe la traite sous peu.");
    } catch (err) {
      setBadgeRequestError(err.message || "Une erreur est survenue.");
    } finally {
      setSubmittingBadgeRequest(false);
    }
  };

  // Pagine /api/recruteur/candidats-recherche jusqu'à épuisement (ou une
  // borne haute raisonnable) pour reconstituer la liste complète attendue
  // par la recherche texte/sémantique existante, sans revenir à un .select("*")
  // direct et non borné sur la vue (la faille corrigée par cette route).
  async function loadAllCandidates(accessToken) {
    const PAGE_SIZE = 30;
    const MAX_PAGES = 20; // ~600 candidats — largement au-delà du volume actuel
    let page = 0;
    let all = [];
    setCandidatesLoading(true);
    try {
      while (page < MAX_PAGES) {
        const res = await fetch(`/api/recruteur/candidats-recherche?page=${page}&pageSize=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("Erreur chargement candidats:", data.error);
          break;
        }
        all = all.concat(data.candidates || []);
        if (data.quota) setCvQuota(data.quota);
        if (!data.hasMore) break;
        page += 1;
      }
    } catch (err) {
      console.error("Exception chargement candidats:", err);
    } finally {
      setCandidates(all);
      setCandidatesLoading(false);
    }
  }

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }

        // Contrôle d'accès : réservé aux comptes 'user' (candidat et
        // recruteur ont fusionné, chantier RBAC) et aux admins, qui
        // peuvent tout superviser. 'publisher' (personnel interne) en est
        // exclu, son périmètre reste /admin.
        const [{ data: userRoleRow }, { data: hasVerifiedBadge }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", session.user.id).single(),
          supabase.rpc("has_badge", { check_user_id: session.user.id, badge_name: "verified_recruiter" }),
        ]);

        if (!userRoleRow || (userRoleRow.role !== "user" && userRoleRow.role !== "admin")) {
          window.location.replace("/");
          return;
        }

        // Un admin n'a pas besoin du badge verified_recruiter — seul un
        // compte 'user' sans ce badge voit la bannière d'attente et un
        // répertoire candidats vide (imposé côté vue candidats_recherche,
        // pas seulement ici).
        const isVerified = userRoleRow.role === "admin" ? true : hasVerifiedBadge === true;
        setRecruiterVerified(isVerified);

        if (!isVerified) {
          const { data: latestRequest } = await supabase
            .from("badge_requests")
            .select("id, status, rejection_reason, created_at")
            .eq("user_id", session.user.id)
            .eq("requested_badge", "verified_recruiter")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestRequest?.status === "pending") setPendingBadgeRequest(latestRequest);
          else if (latestRequest?.status === "rejected") setPendingBadgeRequest(latestRequest);
        }

        setUserSession(session);
        // Fire-and-forget : ne bloque pas le reste du dashboard (offres,
        // candidatures, profil vitrine) le temps de paginer le répertoire
        // candidats, potentiellement plusieurs allers-retours réseau.
        loadAllCandidates(session.access_token);

        const [
          { data: offers, error: offersErr },
          { data: applicationsData, error: applicationsErr },
          { data: recruiterProfileData, error: recruiterProfileErr },
        ] = await Promise.all([
          supabase.from("job_offers").select("*").eq("recruiter_id", session.user.id).order("created_at", { ascending: false }),
          // get_recruiter_candidatures() (SECURITY DEFINER) masque email/cv_url
          // tant que le candidat n'a pas explicitement consenti à les révéler
          // (reveal_contact_to_recruiter) — la table candidatures elle-même
          // n'accorde plus aucun SELECT direct au recruteur (voir
          // 20260803080000_close_candidatures_direct_read_bypass.sql), un
          // .from("candidatures").select() ne renverrait plus rien.
          supabase.rpc("get_recruiter_candidatures"),
          supabase.from("recruiter_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        ]);

        if (isVerified) {
          const [
            { data: statsData, error: statsErr },
            { data: seriesData, error: seriesErr },
            { data: funnelRows, error: funnelErr },
          ] = await Promise.all([
            supabase.rpc("get_recruiter_overview_stats").single(),
            supabase.rpc("get_recruiter_daily_candidatures", { p_days: 30 }),
            supabase.rpc("get_recruiter_funnel"),
          ]);
          if (statsErr) console.error("Erreur chargement statistiques:", statsErr);
          else setOverviewStats(statsData);
          if (seriesErr) console.error("Erreur chargement historique:", seriesErr);
          else setDailySeries(seriesData || []);
          if (funnelErr) console.error("Erreur chargement entonnoir:", funnelErr);
          else setFunnelData(funnelRows || []);
        }
        setStatsLoading(false);

        if (offersErr) console.error("Erreur chargement offres:", offersErr);
        else setMyOffers(offers || []);

        if (applicationsErr) console.error("Erreur chargement candidatures:", applicationsErr);
        else setApplications(applicationsData || []);

        if (recruiterProfileErr) console.error("Erreur chargement profil vitrine:", recruiterProfileErr);
        else if (recruiterProfileData) {
          setRecruiterProfileId(recruiterProfileData.id);
          setRecruiterProfileForm({
            company_name: recruiterProfileData.company_name || "",
            sector: recruiterProfileData.sector || "",
            location: recruiterProfileData.location || "Dakar, Sénégal",
            logo_url: recruiterProfileData.logo_url || "",
            banner_url: recruiterProfileData.banner_url || "",
            description: recruiterProfileData.description || "",
            website: recruiterProfileData.website || "",
          });
          setLogoPreview(recruiterProfileData.logo_url || null);
          setBannerPreview(recruiterProfileData.banner_url || null);
        }
      } catch (err) {
        console.error("Exception chargement dashboard recruteur:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecruiterData();

    // Sans ça, une session qui expire/est révoquée pendant que l'utilisateur
    // est déjà sur ce dashboard ne se remarque qu'à un appel Supabase qui
    // échoue silencieusement (RLS refusée, erreur juste consignée en
    // console) — l'utilisateur reste sur des données figées sans comprendre
    // pourquoi. Même convention que MessagerieClient.js.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!currentSession) {
        window.location.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Recharge la liste masquée depuis get_recruiter_candidatures() — utilisé
  // après chaque action qui change son contenu (changement de statut,
  // révélation de contact côté candidat détectée au retour d'onglet).
  const reloadApplications = async () => {
    const { data, error } = await supabase.rpc("get_recruiter_candidatures");
    if (error) {
      console.error("Erreur rechargement candidatures:", error);
      return;
    }
    setApplications(data || []);
  };

  // Pas de Realtime sur `candidatures` ici : depuis que le recruteur n'a
  // plus aucune policy SELECT directe sur la table (email/cv_url masqués via
  // la RPC uniquement, 20260803080000), postgres_changes n'a plus de ligne à
  // lui transmettre — Realtime respecte la même RLS que les requêtes
  // classiques. Une nouvelle candidature apparaît au prochain chargement de
  // l'onglet plutôt qu'en direct ; compromis assumé pour ne pas rouvrir le
  // contournement du masquage.
  useEffect(() => {
    if (activeTab !== "candidatures" || !userSession?.user?.id) return;
    async function load() {
      await reloadApplications();
    }
    load();
  }, [activeTab, userSession?.user?.id]);

  // Synchronisation Realtime sur les offres du recruteur
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`recruiter-job-offers-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_offers", filter: `recruiter_id=eq.${userId}` },
        async () => {
          const { data: offers } = await supabase
            .from("job_offers")
            .select("*")
            .eq("recruiter_id", userId)
            .order("created_at", { ascending: false });
          if (offers) setMyOffers(offers);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userSession?.user?.id]);

  // --- Gestion des offres ---
  const handleOfferFieldChange = (field, value) => {
    setOfferForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFilesSelect = (files) => {
    const fileList = Array.from(files || []).filter(
      (f) => f && (f.type?.startsWith("image/") || f.name?.endsWith(".pdf"))
    );
    if (fileList.length === 0) return;

    const newPreviews = fileList.map((f) => URL.createObjectURL(f));
    setOfferImageFiles((prev) => [...prev, ...fileList]);
    setOfferImagePreviews((prev) => [...prev, ...newPreviews]);
    setExamenPasse(false);
    setScanSuccess(false);
    setScanMessage("");

    triggerToast(
      fileList.length > 1
        ? `📸 ${fileList.length} photos ajoutées à l'offre !`
        : "📸 1 photo ajoutée à l'offre !",
      "fa-images"
    );

    if (publishMode === "ai_scanner") {
      runAIScanner(fileList[0], accompanyingText);
    }
  };

  const handleRemoveSingleImage = (index) => {
    const updatedFiles = offerImageFiles.filter((_, i) => i !== index);
    const updatedPreviews = offerImagePreviews.filter((_, i) => i !== index);
    setOfferImageFiles(updatedFiles);
    setOfferImagePreviews(updatedPreviews);

    if (updatedPreviews.length === 0) {
      setOfferForm((prev) => ({ ...prev, image_url: "" }));
      setScanSuccess(false);
      setScanMessage("");
    }
  };

  const handleSetCoverImage = (index) => {
    if (index === 0) return;
    setOfferImageFiles((prev) => {
      const selected = prev[index];
      const others = prev.filter((_, i) => i !== index);
      return [selected, ...others];
    });
    setOfferImagePreviews((prev) => {
      const selected = prev[index];
      const others = prev.filter((_, i) => i !== index);
      return [selected, ...others];
    });
    triggerToast("Photo de couverture mise à jour !");
  };

  const handleRemoveAllOfferImages = () => {
    setOfferImageFiles([]);
    setOfferImagePreviews([]);
    setOfferForm((prev) => ({ ...prev, image_url: "" }));
    setScanSuccess(false);
    setScanMessage("");
  };

  // --- Onglet Profil Entreprise ---
  const handleRecruiterProfileFieldChange = (field, value) => {
    setRecruiterProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!OFFER_IMAGE_TYPES.includes(file.type)) {
      triggerToast("Format d'image non supporté (PNG, JPG ou WEBP uniquement).");
      return;
    }
    if (file.size > MAX_OFFER_IMAGE_BYTES) {
      triggerToast("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!OFFER_IMAGE_TYPES.includes(file.type)) {
      triggerToast("Format d'image non supporté (PNG, JPG ou WEBP uniquement).");
      return;
    }
    if (file.size > MAX_OFFER_IMAGE_BYTES) {
      triggerToast("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveRecruiterProfile = async (e) => {
    e.preventDefault();
    if (!userSession?.user?.id) return;

    if (!recruiterProfileForm.company_name.trim()) {
      triggerToast("Le nom de l'entreprise est obligatoire.");
      return;
    }

    setSavingRecruiterProfile(true);

    try {
      let logoUrl = recruiterProfileForm.logo_url || "";
      let bannerUrl = recruiterProfileForm.banner_url || "";

      // Réutilise le bucket "job-offers" (déjà scopé par dossier utilisateur
      // via ses policies RLS existantes) plutôt que d'en créer un nouveau
      // rien que pour le logo/la bannière.
      if (logoFile) {
        const ext = logoFile.name.split(".").pop().toLowerCase();
        const path = buildStoragePath(userSession.user.id, ext, { folder: "branding", prefix: "logo" });
        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from("job-offers").getPublicUrl(path).data?.publicUrl || "";
      }

      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop().toLowerCase();
        const path = buildStoragePath(userSession.user.id, ext, { folder: "branding", prefix: "banner" });
        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(path, bannerFile, { upsert: true, contentType: bannerFile.type });
        if (uploadError) throw uploadError;
        bannerUrl = supabase.storage.from("job-offers").getPublicUrl(path).data?.publicUrl || "";
      }

      const payload = {
        user_id: userSession.user.id,
        ...recruiterProfileForm,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      };

      const { data, error } = await supabase
        .from("recruiter_profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;

      setRecruiterProfileId(data.id);
      setRecruiterProfileForm({
        company_name: data.company_name || "",
        sector: data.sector || "",
        location: data.location || "Dakar, Sénégal",
        logo_url: data.logo_url || "",
        banner_url: data.banner_url || "",
        description: data.description || "",
        website: data.website || "",
      });
      setLogoFile(null);
      setBannerFile(null);
      triggerToast("Profil vitrine mis à jour !");
    } catch (err) {
      console.error("Erreur sauvegarde profil vitrine:", err);
      triggerToast("Erreur lors de la sauvegarde du profil.");
    } finally {
      setSavingRecruiterProfile(false);
    }
  };

  const handleOpenPublishOffer = () => {
    setActiveTab("offres");
    handleCancelEditOffer();
    setTimeout(() => offerFormRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const generateOfferEmbedding = async (offerId, title, description) => {
    try {
      const text = `${title || ""}\n\n${description || ""}`.trim();
      if (!text) return;

      const res = await fetch(`/api/recruteur/offres/${offerId}/embedding`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userSession?.access_token || ""}` },
        body: JSON.stringify({ title, description }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Erreur génération embedding offre:", body.error);
      }
    } catch (err) {
      console.error("Erreur génération embedding offre:", err);
    }
  };

  const runAIScanner = async (fileToScan = offerImageFiles[0], textToInclude = accompanyingText) => {
    const hasFile = !!fileToScan;
    const hasText = typeof textToInclude === "string" && textToInclude.trim().length > 0;

    if (!hasFile && !hasText) {
      triggerToast("Veuillez déposer une photo/affiche ou coller une description.");
      return;
    }

    setIsScanningAI(true);
    setScanSuccess(false);
    setScanMessage(
      hasFile && hasText
        ? "✨ Fusion et organisation intelligente de l'affiche et du texte par l'IA..."
        : hasFile
        ? "🔍 Analyse et extraction automatique de l'affiche par l'IA..."
        : "📝 Analyse et structuration intelligente de la description par l'IA..."
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      if (hasFile) formData.append("file", fileToScan);
      if (hasText) formData.append("accompanying_text", textToInclude.trim());

      const res = await fetch("/api/admin/extract-job-poster", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.offer) {
        const extracted = data.offer;
        setOfferForm((prev) => ({
          ...prev,
          title: extracted.title || prev.title || "",
          company: extracted.company || recruiterProfileForm.company_name || prev.company || "",
          location: extracted.location || prev.location || "Sénégal",
          contract_type: extracted.contract_type || prev.contract_type || "CDI",
          salary_range: extracted.salary_range || prev.salary_range || "",
          min_education_level: extracted.min_education_level || prev.min_education_level || "Aucun",
          description: extracted.description || prev.description || "",
          image_url: extracted.image_url || prev.image_url || "",
          deadline: extracted.deadline || prev.deadline || "",
          contact_email: extracted.contact_email || prev.contact_email || "",
          contact_phone: extracted.contact_phone || prev.contact_phone || "",
          external_link: extracted.external_link || prev.external_link || "",
          application_url: extracted.application_url || prev.application_url || "",
          application_email: extracted.application_email || prev.application_email || "",
          additional_info: extracted.additional_info || prev.additional_info || "",
          listing_type: extracted.listing_type || prev.listing_type || "offre_emploi",
        }));

        setScanSuccess(true);
        setExamenPasse(true);
        setScanMessage(
          hasFile && hasText
            ? "✨ Affiche et description fusionnées avec succès ! Tous les champs ont été organisés."
            : hasFile
            ? "✨ Affiche scannée et formulaire pré-rempli avec succès par l'IA !"
            : "✨ Texte structuré et formulaire pré-rempli avec succès par l'IA !"
        );
        triggerToast("Informations organisées par l'IA !");
      } else {
        setScanMessage(data.error || "L'IA n'a pas pu extraire toutes les informations.");
        triggerToast(data.error || "Extraction partielle.");
      }
    } catch (err) {
      console.error("Erreur Scanner IA:", err);
      setScanMessage("Erreur réseau lors de l'analyse.");
      triggerToast("Erreur lors de l'analyse IA.");
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleGenerateAiPoster = async (customPrompt = aiPrompt) => {
    const promptToUse = (customPrompt || aiPrompt || "").trim();
    if (!promptToUse && !offerForm.title.trim()) {
      triggerToast("Veuillez saisir un prompt ou renseigner le titre du poste.");
      return;
    }

    setIsGeneratingAiPoster(true);
    triggerToast("🎨 Génération de l'affiche 1:1 en cours par l'IA...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/generate-job-poster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        },
        body: JSON.stringify({
          prompt: promptToUse,
          title: offerForm.title,
          company: offerForm.company || recruiterProfileForm.company_name,
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        setOfferImagePreviews((prev) => [data.imageUrl, ...prev]);
        setOfferForm((prev) => ({ ...prev, image_url: data.imageUrl }));
        setScanSuccess(true);
        setScanMessage("✨ Affiche format carré 1:1 générée avec succès et attachée à l'offre !");
        triggerToast("🎉 Affiche 1:1 générée avec succès !");
      } else {
        triggerToast(data.error || "Erreur lors de la génération de l'image.");
      }
    } catch (err) {
      console.error("Erreur génération image IA:", err);
      triggerToast("Erreur de connexion avec le générateur d'image.");
    } finally {
      setIsGeneratingAiPoster(false);
    }
  };

  const handleSuggestPrompt = () => {
    const title = offerForm.title || "Offre d'emploi";
    const company = offerForm.company || recruiterProfileForm.company_name || "Entreprise";
    const location = offerForm.location || "Dakar, Sénégal";
    const suggested = `Affiche de recrutement professionnelle et percutante pour le poste de ${title} chez ${company} à ${location}. Style corporate moderne, design soigné, mise en valeur du métier, format carré 1:1`;
    setAiPrompt(suggested);
    triggerToast("Prompt suggéré généré avec succès !");
  };

  const uploadAllOfferPhotos = async () => {
    const uploadedUrls = [];
    if (offerImageFiles.length > 0) {
      for (let i = 0; i < offerImageFiles.length; i++) {
        const file = offerImageFiles[i];
        const ext = (file.name || "poster.jpg").split(".").pop().toLowerCase();
        const storagePath = `${userSession.user.id}/offers-${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(storagePath, file, { contentType: file.type || "image/jpeg" });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("job-offers").getPublicUrl(storagePath);
          if (publicUrlData?.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
        }
      }
    }
    const existingRemoteUrls = offerImagePreviews.filter((p) => p && p.startsWith("http"));
    const combined = [...uploadedUrls, ...existingRemoteUrls.filter((url) => !uploadedUrls.includes(url))];
    if (combined.length > 0) return serializeOfferImages(combined);
    return offerForm.image_url || "";
  };

  const handleInstantAiPublish = async () => {
    if (!userSession?.user?.id) {
      triggerToast("Veuillez vous connecter en tant que recruteur.");
      return;
    }
    const hasFiles = offerImageFiles.length > 0 || offerImagePreviews.length > 0;
    const hasText = typeof accompanyingText === "string" && accompanyingText.trim().length > 0;
    const hasFormFilled = offerForm.title?.trim() && (offerForm.company?.trim() || recruiterProfileForm.company_name?.trim());

    if (!hasFiles && !hasText && !hasFormFilled) {
      triggerToast("Veuillez déposer une ou plusieurs photos ou saisir une description.");
      return;
    }

    if (!examenPasse) {
      triggerToast("Lancez l'Examinateur et vérifiez les informations avant de publier.");
      return;
    }

    setSavingOffer(true);
    triggerToast("⚡ Analyse IA et publication en direct...");

    try {
      let currentOfferData = { ...offerForm };
      if (!currentOfferData.company?.trim() && recruiterProfileForm.company_name?.trim()) {
        currentOfferData.company = recruiterProfileForm.company_name.trim();
      }

      if (!hasFormFilled || hasFiles || hasText) {
        const formData = new FormData();
        if (offerImageFiles.length > 0) formData.append("file", offerImageFiles[0]);
        if (hasText) formData.append("accompanying_text", accompanyingText.trim());

        const extRes = await fetch("/api/admin/extract-job-poster", {
          method: "POST",
          headers: userSession?.access_token ? { Authorization: `Bearer ${userSession.access_token}` } : undefined,
          body: formData,
        });
        const extJson = await extRes.json();

        if (extJson.success && extJson.offer) {
          currentOfferData = {
            ...currentOfferData,
            ...extJson.offer,
            company: extJson.offer.company || currentOfferData.company || recruiterProfileForm.company_name || "Entreprise",
            image_url: extJson.offer.image_url || offerForm.image_url || "",
          };
          setOfferForm(currentOfferData);
        }
      }

      const finalImageUrl = await uploadAllOfferPhotos();

      let externalLink = currentOfferData.external_link || "";
      const phoneDigits = detectWhatsAppNumber({
        contact_phone: currentOfferData.contact_phone,
        description: currentOfferData.description,
        title: currentOfferData.title,
        company: currentOfferData.company,
      });

      if (phoneDigits && (!externalLink || externalLink.includes("wa.me"))) {
        externalLink = buildWhatsAppLink(phoneDigits, {
          title: currentOfferData.title,
          company: currentOfferData.company,
        });
      }

      const finalEmail = (currentOfferData.contact_email || currentOfferData.application_email || "").trim();

      const payload = {
        title: (currentOfferData.title || "Opportunité de recrutement").trim(),
        company: (currentOfferData.company || recruiterProfileForm.company_name || "Entreprise").trim(),
        location: (currentOfferData.location || "Sénégal").trim(),
        contract_type: currentOfferData.contract_type || "CDI",
        salary_range: currentOfferData.salary_range || null,
        min_education_level: currentOfferData.min_education_level || "Aucun",
        description: currentOfferData.description || "",
        image_url: finalImageUrl || null,
        deadline: currentOfferData.deadline || null,
        contact_email: finalEmail || null,
        application_email: (currentOfferData.application_email || finalEmail || "").trim() || null,
        application_url: currentOfferData.application_url ? currentOfferData.application_url.trim() : null,
        additional_info: currentOfferData.additional_info ? currentOfferData.additional_info.trim() : null,
        contact_phone: currentOfferData.contact_phone ? currentOfferData.contact_phone.trim() : (phoneDigits ? `+${phoneDigits}` : null),
        external_link: externalLink || null,
        listing_type: LISTING_TYPE_LABELS[currentOfferData.listing_type] ? currentOfferData.listing_type : "offre_emploi",
        requires_cover_letter: !!currentOfferData.requires_cover_letter,
        is_active: true,
        recruiter_id: userSession.user.id,
      };

      const { data: insertedOffer, error: insertError } = await supabase
        .from("job_offers")
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        triggerToast("Erreur lors de la publication de l'offre.");
      } else {
        setMyOffers((prev) => [insertedOffer, ...prev]);
        generateOfferEmbedding(insertedOffer.id, payload.title, payload.description);
        triggerToast("🎉 Offre publiée avec succès sur le fil d'actualité !");
        setOfferForm(EMPTY_OFFER);
        setOfferImageFiles([]);
        setOfferImagePreviews([]);
        setAccompanyingText("");
        setScanSuccess(false);
        setScanMessage("");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la publication automatique.");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!userSession?.user?.id) return;
    setSavingOffer(true);

    try {
      const finalImageUrl = await uploadAllOfferPhotos();

      let externalLink = offerForm.external_link || "";
      const phoneDigits = detectWhatsAppNumber({
        contact_phone: offerForm.contact_phone,
        description: offerForm.description,
        title: offerForm.title,
        company: offerForm.company,
      });

      if (phoneDigits && (!externalLink || externalLink.includes("wa.me"))) {
        externalLink = buildWhatsAppLink(phoneDigits, {
          title: offerForm.title,
          company: offerForm.company,
        });
      }

      const finalEmail = (offerForm.contact_email || offerForm.application_email || "").trim();

      const payload = {
        title: (offerForm.title || "Opportunité de recrutement").trim(),
        company: (offerForm.company || recruiterProfileForm.company_name || "Entreprise").trim(),
        location: (offerForm.location || "Sénégal").trim(),
        contract_type: offerForm.contract_type || "CDI",
        salary_range: offerForm.salary_range || null,
        min_education_level: offerForm.min_education_level || "Aucun",
        description: offerForm.description || "",
        image_url: finalImageUrl || null,
        deadline: offerForm.deadline || null,
        contact_email: finalEmail || null,
        application_email: (offerForm.application_email || finalEmail || "").trim() || null,
        application_url: offerForm.application_url ? offerForm.application_url.trim() : null,
        additional_info: offerForm.additional_info ? offerForm.additional_info.trim() : null,
        contact_phone: offerForm.contact_phone ? offerForm.contact_phone.trim() : (phoneDigits ? `+${phoneDigits}` : null),
        external_link: externalLink || null,
        listing_type: LISTING_TYPE_LABELS[offerForm.listing_type] ? offerForm.listing_type : "offre_emploi",
        requires_cover_letter: !!offerForm.requires_cover_letter,
        recruiter_id: userSession.user.id,
      };

      if (editingOfferId) {
        const { error } = await supabase
          .from("job_offers")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingOfferId)
          .eq("recruiter_id", userSession.user.id);

        if (error) {
          triggerToast("Erreur lors de la modification de l'offre.");
        } else {
          setMyOffers((prev) => prev.map((o) => (o.id === editingOfferId ? { ...o, ...payload } : o)));
          triggerToast("Offre mise à jour.");
          generateOfferEmbedding(editingOfferId, payload.title, payload.description);
          handleCancelEditOffer();
        }
      } else {
        const { data, error } = await supabase
          .from("job_offers")
          .insert({ ...payload, is_active: true })
          .select()
          .single();

        if (error) {
          triggerToast("Erreur lors de la publication de l'offre.");
        } else {
          setMyOffers((prev) => [data, ...prev]);
          triggerToast("Offre publiée !");
          generateOfferEmbedding(data.id, payload.title, payload.description);
          handleCancelEditOffer();
        }
      }
    } catch (err) {
      console.error("Erreur sauvegarde offre:", err);
      triggerToast("Une erreur est survenue.");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleEditOffer = (offer) => {
    setEditingOfferId(offer.id);
    setOfferForm({
      title: offer.title || "",
      company: offer.company || "",
      location: offer.location || "Sénégal",
      contract_type: offer.contract_type || "CDI",
      listing_type: offer.listing_type || "offre_emploi",
      salary_range: offer.salary_range || "",
      min_education_level: offer.min_education_level || "Aucun",
      description: offer.description || "",
      image_url: offer.image_url || "",
      deadline: offer.deadline || "",
      contact_email: offer.contact_email || "",
      contact_phone: offer.contact_phone || "",
      external_link: offer.external_link || "",
      application_url: offer.application_url || "",
      application_email: offer.application_email || "",
      additional_info: offer.additional_info || "",
      requires_cover_letter: !!offer.requires_cover_letter,
    });
    setOfferImageFiles([]);
    setOfferImagePreviews(parseOfferImages(offer.image_url));
    setExamenPasse(true);
    setTimeout(() => offerFormRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleCancelEditOffer = () => {
    setEditingOfferId(null);
    setOfferForm(EMPTY_OFFER);
    setOfferImageFiles([]);
    setOfferImagePreviews([]);
    setAccompanyingText("");
    setExamenPasse(false);
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Retirer définitivement cette offre de la liste publique ?")) return;

    // archive_own_job_offer() (SECURITY DEFINER) : archive plutôt que
    // supprimer la ligne — les candidatures déjà reçues sur cette offre
    // gardent leur contexte (le candidat sait toujours à quoi il a postulé).
    const { error } = await supabase.rpc("archive_own_job_offer", { offer_id: offerId });

    if (error) {
      triggerToast("Erreur lors de l'archivage.");
      return;
    }
    setMyOffers((prev) => prev.filter((o) => o.id !== offerId));
    if (editingOfferId === offerId) handleCancelEditOffer();
    triggerToast("Offre archivée.");
  };

  const handleToggleOfferActive = async (offer) => {
    setTogglingOfferId(offer.id);
    const nextActive = !offer.is_active;

    const { error } = await supabase
      .from("job_offers")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", offer.id)
      .eq("recruiter_id", userSession.user.id);

    setTogglingOfferId(null);

    if (error) {
      triggerToast("Erreur lors du changement de statut.");
      return;
    }
    setMyOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, is_active: nextActive } : o)));
    triggerToast(nextActive ? "Offre réactivée." : "Offre mise en pause.");
  };

  // --- Gestion des candidatures reçues ---
  const myOfferIds = new Set(myOffers.map((o) => o.id));
  // get_recruiter_candidatures() filtre déjà aux candidatures de ce
  // recruteur (offres + candidatures spontanées qui lui sont adressées
  // directement) — un filtre client par myOfferIds exclurait à tort ces
  // dernières (job_offer_id NULL, jamais dans myOfferIds).
  const myApplications = applications;

  const handleApplicationStatusChange = async (applicationId, newStatus) => {
    const previous = applications;
    setUpdatingAppId(applicationId);
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status: newStatus } : a)));

    const { error } = await supabase
      .from("candidatures")
      .update({ status: newStatus })
      .eq("id", applicationId);

    setUpdatingAppId(null);

    if (error) {
      setApplications(previous);
      triggerToast("Impossible de mettre à jour le statut.");
      return;
    }
    triggerToast("Statut de la candidature mis à jour.");
  };

  const handleDownloadApplicationCv = async (application) => {
    if (!application.cv_url) return;
    setDownloadingCvId(application.id);
    const url = await getSignedCvUrl(application.cv_url);
    setDownloadingCvId(null);

    if (!url) {
      triggerToast("Impossible de récupérer le CV.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // --- Gestion CVthèque ---
  const handleOpenCandidateModal = async (candidate) => {
    setSelectedCandidate(candidate);
    setSignedCvUrl(null);

    if (candidate.cv_url) {
      setLoadingCvUrl(true);
      const url = await getSignedCvUrl(candidate.cv_url);
      setSignedCvUrl(url);
      setLoadingCvUrl(false);
    }
  };

  const handleContactCandidate = async (candidate) => {
    if (!userSession?.user?.id) return;
    setContactingId(candidate.id);

    const { error } = await sendMessage({
      senderId: userSession.user.id,
      receiverId: candidate.id,
      content: `Bonjour ${candidate.full_name || ""}, votre profil sur Facilité a retenu notre attention. Seriez-vous disponible pour échanger ?`.trim(),
    });

    setContactingId(null);

    if (error) {
      triggerToast("Impossible d'envoyer le message.");
      return;
    }
    router.push("/messagerie");
  };

  // Recherche sémantique : génère l'embedding de la requête via l'Edge
  // Function gemini-orchestrator, puis appelle match_resumes (base = CV dont
  // l'analyse est terminée, cf. migration 20260730110000). Déclenchée
  // explicitement (bouton) plutôt qu'à chaque frappe, pour ne pas appeler
  // l'API Gemini à chaque caractère tapé.
  const handleSemanticSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSemanticSearching(true);
    setSemanticSearchError("");

    try {
      const { data: embedData, error: embedError } = await supabase.functions.invoke("gemini-orchestrator", {
        body: { action: "embed", text: query },
      });

      if (embedError || !embedData?.success || !Array.isArray(embedData?.embedding)) {
        throw new Error(embedData?.error || embedError?.message || "Échec de la génération de l'embedding.");
      }

      const { data: matches, error: matchError } = await supabase.rpc("match_resumes", {
        query_embedding: `[${embedData.embedding.join(",")}]`,
        match_threshold: 0.5,
        match_count: 10,
      });

      if (matchError) throw new Error(matchError.message);

      setSemanticResults(new Map((matches || []).map((m) => [m.user_id, m.similarity])));
    } catch (err) {
      console.error("Erreur recherche sémantique:", err);
      setSemanticSearchError(err.message || "Erreur lors de la recherche sémantique.");
      setSemanticResults(null);
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const handleResetSemanticSearch = () => {
    setSemanticResults(null);
    setSemanticSearchError("");
  };

  const filteredCandidates = semanticResults
    ? candidates
        .filter((c) => semanticResults.has(c.id))
        .map((c) => ({ ...c, similarity: semanticResults.get(c.id) }))
        .sort((a, b) => b.similarity - a.similarity)
    : candidates.filter((c) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          (c.full_name || "").toLowerCase().includes(q) ||
          (c.headline || "").toLowerCase().includes(q) ||
          (Array.isArray(c.skills) ? c.skills.join(" ") : "").toLowerCase().includes(q);
        const matchesLocation =
          !locationFilter || (c.city || c.location || "").toLowerCase().includes(locationFilter.toLowerCase());
        return matchesSearch && matchesLocation;
      });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de l'Espace Recruteur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Toast */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {/* Header Nav */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilité" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilité</span>
            </Link>
            <RoleBadge role="recruteur" />
          </div>

          <div className="flex items-center space-x-3">
            {recruiterVerified && (
              <button
                type="button"
                onClick={handleOpenPublishOffer}
                className="text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <i className="fa-solid fa-plus"></i>
                <span>Publier une offre</span>
              </button>
            )}
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 relative"
            >
              <i className="fa-solid fa-comments"></i>
              <span className="hidden sm:inline">Messagerie</span>
              <UnreadBadge count={unreadMessagesCount} />
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Tableau de bord Recrutement
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">Espace Recruteur</h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Publiez vos offres, suivez les candidatures reçues et recherchez les meilleurs talents.
            </p>
          </div>
        </div>

        {recruiterVerified ? (
          <>
        {/* Onglets */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs mb-8 max-w-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("vue-ensemble")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "vue-ensemble" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📊 Vue d&apos;ensemble</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("offres")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "offres" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📢 Mes Offres</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("candidatures")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "candidatures" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📥 Candidatures reçues</span>
            {myApplications.length > 0 && (
              <span className={`ml-1 px-1.5 rounded-full text-[10px] ${activeTab === "candidatures" ? "bg-white/20" : "bg-gray-100"}`}>
                {myApplications.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cvtheque")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "cvtheque" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>🔍 CVthèque</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rag-matching")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "rag-matching" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>✨ Matching IA (RAG)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profil")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "profil" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>🏢 Profil Entreprise</span>
          </button>
        </div>

        {activeTab === "vue-ensemble" && (
          <div className="space-y-8">
            {statsLoading ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 italic">
                Chargement des statistiques...
              </div>
            ) : !overviewStats || overviewStats.active_offers_count === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
                <i className="fa-solid fa-chart-line text-3xl text-gray-300 mb-3"></i>
                <p className="text-sm font-bold text-gray-700 mb-1">Aucune statistique pour le moment</p>
                <p className="text-xs text-gray-400 mb-6">Publiez votre première offre pour voir apparaître vos indicateurs ici.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("offres")}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  Publier une offre
                </button>
              </div>
            ) : (
              <>
                {/* KPI */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Offres actives</p>
                    <p className="text-2xl font-extrabold text-gray-900">{overviewStats.active_offers_count}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Candidatures (7j)</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-extrabold text-gray-900">{overviewStats.candidatures_7j}</p>
                      {(() => {
                        const d = formatPeriodDelta(overviewStats.candidatures_7j, overviewStats.candidatures_prev_7j);
                        return (
                          <span className={`text-[11px] font-bold ${d.positive === null ? "text-gray-400" : d.positive ? "text-emerald-600" : "text-red-500"}`}>
                            {d.text}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Candidatures (30j)</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-extrabold text-gray-900">{overviewStats.candidatures_30j}</p>
                      {(() => {
                        const d = formatPeriodDelta(overviewStats.candidatures_30j, overviewStats.candidatures_prev_30j);
                        return (
                          <span className={`text-[11px] font-bold ${d.positive === null ? "text-gray-400" : d.positive ? "text-emerald-600" : "text-red-500"}`}>
                            {d.text}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Vues totales</p>
                    <p className="text-2xl font-extrabold text-gray-900">{overviewStats.total_views}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Taux de conversion</p>
                    <p className="text-2xl font-extrabold text-gray-900">{overviewStats.conversion_rate}%</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Vue → candidature</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">Délai moyen de réponse</p>
                    <p className="text-2xl font-extrabold text-gray-900">{formatHours(overviewStats.avg_first_response_hours)}</p>
                  </div>
                </div>

                {/* Graphique 30 jours */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6">
                  <h2 className="text-sm font-extrabold text-gray-900 mb-4">Candidatures reçues — 30 derniers jours</h2>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1 h-32 min-w-[600px]">
                      {(() => {
                        const max = Math.max(1, ...dailySeries.map((d) => d.count));
                        return dailySeries.map((d) => (
                          <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div
                              className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
                              title={`${new Date(d.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} : ${d.count} candidature(s)`}
                            ></div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-2 min-w-[600px]">
                      <span>{dailySeries[0] && new Date(dailySeries[0].day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                      <span>Aujourd&apos;hui</span>
                    </div>
                  </div>
                </div>

                {/* Entonnoir par offre */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6">
                  <h2 className="text-sm font-extrabold text-gray-900 mb-1">Entonnoir de recrutement</h2>
                  <p className="text-xs text-gray-500 font-medium mb-5">Vues → Candidatures → Présélection → Contactés → Entretien → Retenu / Écarté, par offre active.</p>
                  {funnelData.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucune offre active pour le moment.</p>
                  ) : (
                    <div className="space-y-5">
                      {funnelData.map((f) => {
                        const stages = [
                          { label: "Vues", count: f.view_count, color: "bg-gray-300" },
                          { label: "Présélection", count: f.reviewed_count, color: "bg-blue-400" },
                          { label: "Contactés", count: f.contacted_count, color: "bg-indigo-500" },
                          { label: "Entretien", count: f.interview_count, color: "bg-purple-500" },
                          { label: "Retenu", count: f.accepted_count, color: "bg-emerald-600" },
                        ];
                        const maxStage = Math.max(1, f.view_count);
                        return (
                          <div key={f.job_offer_id} className="border-b border-gray-100 last:border-0 pb-5 last:pb-0">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-extrabold text-gray-900 truncate">{f.title}</p>
                              <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap ml-2">
                                {f.pending_count} en attente · délai moy. {formatHours(f.avg_response_hours)}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {stages.map((s) => (
                                <div key={s.label} className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-500 w-20 shrink-0">{s.label}</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden min-w-0">
                                    <div className={`${s.color} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, (s.count / maxStage) * 100)}%` }}></div>
                                  </div>
                                  <span className="text-[10px] font-extrabold text-gray-700 w-6 text-right shrink-0">{s.count}</span>
                                </div>
                              ))}
                            </div>
                            {f.rejected_count > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1.5">{f.rejected_count} candidature(s) écartée(s)</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5 dernières candidatures */}
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6">
                  <h2 className="text-sm font-extrabold text-gray-900 mb-4">Dernières candidatures</h2>
                  {myApplications.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucune candidature reçue pour le moment.</p>
                  ) : (
                    <div className="space-y-3">
                      {myApplications.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-gray-900 truncate">{c.full_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{c.job_title}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <StatusBadgeMini status={c.status} />
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "offres" && (
          <div className="space-y-8 animate-fade-in">
            {/* EN-TÊTE PUBLEUR D'OFFRES */}
            <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center space-x-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#10E688] to-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-500/20 shrink-0">
                  <i className="fa-solid fa-bullhorn"></i>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    Publieur d&apos;Offres d&apos;Emploi & Scanner IA
                  </h2>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Glissez une affiche de recrutement : l&apos;IA extrait tout automatiquement et prépare la publication en 1 clic.
                  </p>
                </div>
              </div>

              {/* Boutons de Mode */}
              <div className="flex items-center bg-gray-100/90 p-1 rounded-2xl border border-gray-200/80 self-start md:self-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setPublishMode("ai_scanner")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    publishMode === "ai_scanner"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                  <span>Scanner Affiche IA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode("manual")}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    publishMode === "manual"
                      ? "bg-white text-gray-900 shadow-md border border-gray-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                  <span>Saisie Manuelle</span>
                </button>
              </div>
            </div>

            {/* GRILLE PRINCIPALE : SCANNER/FORMULAIRE À GAUCHE + APERÇU EN DIRECT À DROITE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* COLONNE GAUCHE : DÉPÔT MULTI-PHOTOS & FORMULAIRE */}
              <div ref={offerFormRef} className="lg:col-span-7 space-y-6">
                
                {/* SECTION SCANNER & PHOTOS */}
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-6">
                  {/* Onglets Choix Médias */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImageTab("upload")}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                          imageTab === "upload"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        <span>Scanner / Déposer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab("ai_generate")}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                          imageTab === "ai_generate"
                            ? "bg-amber-50 text-amber-900 border border-amber-200"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles text-amber-600"></i>
                        <span>Générateur IA (Format 1:1)</span>
                      </button>
                    </div>

                    {offerImagePreviews.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveAllOfferImages}
                        className="text-xs font-bold text-red-500 hover:text-red-700 transition flex items-center gap-1.5 cursor-pointer"
                        title="Supprimer toutes les photos"
                      >
                        <i className="fa-regular fa-trash-can"></i>
                        <span>Tout supprimer ({offerImagePreviews.length})</span>
                      </button>
                    )}
                  </div>

                  {/* 1. GÉNÉRATEUR D'AFFICHE IA */}
                  {imageTab === "ai_generate" && offerImagePreviews.length === 0 && (
                    <div className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-2xl space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                            <span>🎨 Studio Créatif IA — Format Carré 1:1</span>
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-extrabold">HD</span>
                          </h4>
                          <p className="text-[11px] text-amber-800/80 mt-1 font-medium">
                            Décrivez le style visuel souhaité, ou laissez l&apos;IA s&apos;inspirer de votre intitulé et entreprise.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSuggestPrompt}
                          className="px-2.5 py-1.5 bg-white text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-lg text-[10px] font-extrabold transition shrink-0 cursor-pointer shadow-2xs"
                        >
                          <i className="fa-solid fa-lightbulb text-amber-600 mr-1"></i>
                          Suggérer prompt
                        </button>
                      </div>

                      <div className="relative">
                        <textarea
                          rows={2}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ex: Affiche de recrutement moderne et percutante pour un Responsable Commercial chez Facilité à Dakar, avec couleurs vives et style LinkedIn..."
                          className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-300 transition resize-none placeholder:text-gray-400"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-amber-900 font-bold">
                          <i className="fa-solid fa-crop-simple text-amber-600"></i>
                          <span>Format 1024x1024 (Réseaux & Fil)</span>
                        </div>
                        <button
                          type="button"
                          disabled={isGeneratingAiPoster}
                          onClick={() => handleGenerateAiPoster()}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
                        >
                          <i className={`fa-solid ${isGeneratingAiPoster ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}`}></i>
                          <span>{isGeneratingAiPoster ? "Génération 1:1..." : "Générer l'affiche 1:1"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. ZONE DE GLISSER-DÉPOSER MULTI-PHOTOS */}
                  {imageTab === "upload" && offerImagePreviews.length === 0 && (
                    <div
                      onClick={() => fileDropInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleFilesSelect(e.dataTransfer.files);
                      }}
                      className="border-2 border-dashed border-emerald-400/80 hover:border-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 group"
                    >
                      <input
                        ref={fileDropInputRef}
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFilesSelect(e.target.files)}
                        className="hidden"
                      />
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#10E688] to-emerald-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition duration-300">
                        <i className="fa-solid fa-images"></i>
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-900">
                          Glissez-déposez vos photos ou affiches ici, ou cliquez pour parcourir
                        </h4>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          Formats supportés : JPG, PNG, WEBP, PDF (Vous pouvez sélectionner plusieurs photos à la fois)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-extrabold flex items-center gap-1.5">
                          <i className="fa-solid fa-layer-group"></i> Support Multi-Photos
                        </span>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-extrabold flex items-center gap-1.5">
                          <i className="fa-solid fa-wand-magic-sparkles"></i> Extraction automatique IA
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 3. GALERIE DE PHOTOS ATTACHÉES */}
                  {offerImagePreviews.length > 0 && (
                    <div className="space-y-3 p-4 bg-gray-50/90 rounded-2xl border border-gray-200">
                      <div className="relative rounded-2xl overflow-hidden bg-gray-950 max-h-[300px] flex items-center justify-center group shadow-md">
                        <img
                          src={offerImagePreviews[0]}
                          alt="Photo principale"
                          className="max-h-[300px] w-full object-contain mx-auto"
                        />
                        <OfferImageWatermark />
                        <div className="absolute top-3 left-3 bg-emerald-600/90 text-white text-[11px] font-black px-3 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                          <i className="fa-solid fa-star text-amber-300"></i>
                          <span>Photo Principale (Couverture)</span>
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                          <span className="bg-black/60 text-white text-[11px] font-black px-2.5 py-1 rounded-lg backdrop-blur-xs">
                            {offerImagePreviews.length} photo{offerImagePreviews.length > 1 ? "s" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewImageModal({ isOpen: true, url: offerImagePreviews[0] })}
                            className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black text-white flex items-center justify-center text-xs transition cursor-pointer"
                            title="Agrandir"
                          >
                            <i className="fa-solid fa-expand"></i>
                          </button>
                        </div>
                      </div>

                      {/* Miniatures des photos */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2 px-1">
                          <span>Toutes les photos attachées ({offerImagePreviews.length})</span>
                          <span className="text-[11px] text-gray-400 font-normal">Cliquez sur une photo pour la définir comme couverture</span>
                        </div>
                        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                          <input
                            ref={additionalFileInputRef}
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFilesSelect(e.target.files)}
                            className="hidden"
                          />
                          {offerImagePreviews.map((previewUrl, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSetCoverImage(idx)}
                              className={`relative group rounded-xl overflow-hidden w-20 h-20 shrink-0 border-2 cursor-pointer transition ${
                                idx === 0 ? "border-emerald-500 shadow-md ring-2 ring-emerald-300" : "border-gray-200 hover:border-gray-400"
                              }`}
                              title={idx === 0 ? "Photo de couverture" : "Cliquer pour définir comme couverture"}
                            >
                              <img src={previewUrl} alt={`Vignette ${idx + 1}`} className="w-full h-full object-cover" />
                              {idx === 0 && (
                                <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                                  1ère
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSingleImage(idx);
                                }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition shadow-md"
                                title="Supprimer cette photo"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => additionalFileInputRef.current?.click()}
                            className="w-20 h-20 shrink-0 border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-emerald-700 text-xs font-bold transition cursor-pointer"
                            title="Ajouter d'autres photos"
                          >
                            <i className="fa-solid fa-plus text-base mb-1"></i>
                            <span className="text-[10px]">Ajouter</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                        <span className="flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check text-emerald-600"></i>
                          <span>{offerImagePreviews.length} photo{offerImagePreviews.length > 1 ? "s" : ""} prête{offerImagePreviews.length > 1 ? "s" : ""} pour la publication</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => runAIScanner(offerImageFiles[0] || offerImagePreviews[0], accompanyingText)}
                          disabled={isScanningAI}
                          className="text-emerald-700 hover:text-emerald-900 font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-rotate text-xs"></i>
                          <span>Re-scanner avec l&apos;IA</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 4. TEXTE D'ACCOMPAGNEMENT & BOUTONS D'ACTION IA */}
                  <div className="p-4 sm:p-5 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">
                          <i className="fa-solid fa-file-lines"></i>
                        </span>
                        <span>Texte & Description d&apos;accompagnement</span>
                      </label>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                        Optionnel
                      </span>
                    </div>

                    <textarea
                      rows={3}
                      value={accompanyingText}
                      onChange={(e) => {
                        setAccompanyingText(e.target.value);
                        setExamenPasse(false);
                      }}
                      placeholder="Ex: 🚨 RECRUTEMENT : Nous recherchons un Développeur / Commercial à Dakar. Envoyez votre candidature à recrutement@exemple.com avant le 31 août..."
                      className="w-full p-3.5 bg-white border border-emerald-200/80 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition resize-none placeholder:text-gray-400 shadow-2xs"
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-200/60">
                      <span className="text-[11px] text-gray-600 font-medium flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-info text-emerald-600 text-xs"></i>
                        <span>
                          {offerImageFiles.length > 0 && accompanyingText.trim()
                            ? "Photos + Description détectées : l'IA fusionne et publie tout."
                            : offerImageFiles.length > 0
                            ? "Photos prêtes : la description est facultative."
                            : accompanyingText.trim()
                            ? "Texte prêt : l'IA structurera tout le formulaire."
                            : "Glissez vos photos, écrivez une description (optionnelle), puis publiez !"}
                        </span>
                      </span>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <button
                          type="button"
                          disabled={isScanningAI || (offerImageFiles.length === 0 && offerImagePreviews.length === 0 && !accompanyingText.trim())}
                          onClick={() => runAIScanner(offerImageFiles[0] || offerImagePreviews[0], accompanyingText)}
                          className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Analyser l'affiche et la description, puis ranger chaque information dans son champ"
                        >
                          <i className={`fa-solid ${isScanningAI ? "fa-spinner fa-spin" : "fa-clipboard-check"} text-emerald-600`}></i>
                          <span>{isScanningAI ? "Examen en cours..." : "Examinateur"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={savingOffer || isScanningAI || !examenPasse || (offerImageFiles.length === 0 && offerImagePreviews.length === 0 && !accompanyingText.trim() && !offerForm.title.trim())}
                          onClick={handleInstantAiPublish}
                          title={examenPasse ? "Publier sur le Fil d'Actualité" : "Passez d'abord par l'Examinateur"}
                          className="px-4 py-2.5 bg-gradient-to-r from-[#10E688] to-emerald-600 hover:from-[#0fd57d] hover:to-emerald-700 disabled:opacity-50 text-gray-950 text-xs font-black rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <i className={`fa-solid ${savingOffer ? "fa-spinner fa-spin" : "fa-bolt-lightning"}`}></i>
                          <span>{savingOffer ? "Publication IA..." : "🚀 Publier avec l'IA"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message de statut du Scanner */}
                  {scanMessage && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                        scanSuccess
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          : "bg-amber-50 text-amber-900 border border-amber-200"
                      }`}
                    >
                      <i className={`fa-solid ${scanSuccess ? "fa-circle-check text-emerald-600" : "fa-circle-exclamation text-amber-600"} text-base`}></i>
                      <span>{scanMessage}</span>
                    </div>
                  )}
                </div>

                {/* FORMULAIRE DE SAISIE STRUCTURÉE */}
                <form onSubmit={handleSubmitOffer} className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-5">
                  <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                      <i className="fa-solid fa-list-check text-emerald-600"></i>
                      <span>Champs Détaillés de l&apos;Offre</span>
                    </h3>
                    <span className="text-[11px] text-gray-400 font-medium">* Champs obligatoires</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        Titre du poste ou de l&apos;offre *
                      </label>
                      <input
                        type="text"
                        required
                        value={offerForm.title}
                        onChange={(e) => handleOfferFieldChange("title", e.target.value)}
                        placeholder="Ex: Développeur Full-Stack Senior / Juriste d'entreprise"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Entreprise / Organisation *
                        </label>
                        <input
                          type="text"
                          required
                          value={offerForm.company}
                          onChange={(e) => handleOfferFieldChange("company", e.target.value)}
                          placeholder="Ex: Facilité Recrutement"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Localisation
                        </label>
                        <input
                          type="text"
                          value={offerForm.location}
                          onChange={(e) => handleOfferFieldChange("location", e.target.value)}
                          placeholder="Ex: Dakar, Sénégal / Télétravail"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Type de contrat
                        </label>
                        <select
                          value={offerForm.contract_type}
                          onChange={(e) => handleOfferFieldChange("contract_type", e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs cursor-pointer"
                        >
                          <option value="CDI">CDI</option>
                          <option value="CDD">CDD</option>
                          <option value="Stage">Stage</option>
                          <option value="Freelance">Freelance / Prestation</option>
                          <option value="Alternance">Alternance</option>
                          <option value="Temps partiel">Temps partiel</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Type de publication
                        </label>
                        <select
                          value={offerForm.listing_type}
                          onChange={(e) => handleOfferFieldChange("listing_type", e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs cursor-pointer"
                        >
                          <option value="offre_emploi">Offre d&apos;emploi</option>
                          <option value="stage">Stage</option>
                          <option value="formation">Formation</option>
                          <option value="avis_recrutement">Avis de recrutement</option>
                          <option value="concours">Concours</option>
                          <option value="bourse">Bourse d&apos;études</option>
                          <option value="appel_offres">Appel d&apos;offres</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Date limite (optionnel)
                        </label>
                        <input
                          type="date"
                          value={offerForm.deadline || ""}
                          onChange={(e) => handleOfferFieldChange("deadline", e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Téléphone / WhatsApp
                        </label>
                        <input
                          type="text"
                          value={offerForm.contact_phone || ""}
                          onChange={(e) => handleOfferFieldChange("contact_phone", e.target.value)}
                          placeholder="Ex: +221 77 000 00 00"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Email recruteur (optionnel)
                        </label>
                        <input
                          type="email"
                          value={offerForm.contact_email || ""}
                          onChange={(e) => handleOfferFieldChange("contact_email", e.target.value)}
                          placeholder="Ex: recrutement@entreprise.com"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Lien externe officiel / WhatsApp URL (optionnel)
                        </label>
                        <input
                          type="url"
                          value={offerForm.external_link || ""}
                          onChange={(e) => handleOfferFieldChange("external_link", e.target.value)}
                          placeholder="Ex: https://wa.me/221770000000 ou https://entreprise.com/jobs/123"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        Description de l&apos;offre *
                      </label>
                      <textarea
                        rows={6}
                        required
                        value={offerForm.description}
                        onChange={(e) => handleOfferFieldChange("description", e.target.value)}
                        placeholder="Décrivez les missions, le profil recherché et les instructions de candidature..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-y shadow-2xs"
                      />
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={offerForm.requires_cover_letter}
                          onChange={(e) => handleOfferFieldChange("requires_cover_letter", e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-gray-700">
                          Lettre de motivation obligatoire pour postuler à cette offre
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Actions formulaire */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCancelEditOffer}
                      className="text-xs font-bold text-gray-500 hover:text-gray-800 transition cursor-pointer"
                    >
                      Réinitialiser
                    </button>

                    <button
                      type="submit"
                      disabled={savingOffer}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-2xl transition shadow-md flex items-center gap-2 cursor-pointer active:scale-98"
                    >
                      <i className={`fa-solid ${savingOffer ? "fa-spinner fa-spin" : "fa-check"}`}></i>
                      <span>{savingOffer ? "Enregistrement..." : editingOfferId ? "Enregistrer les modifications" : "Publier sur le Fil d'Actualité"}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* COLONNE DROITE : APERÇU EN DIRECT SUR LE FIL (RENDU 1:1 CANDIDATS) */}
              <div className="lg:col-span-5 sticky top-24 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Aperçu en direct sur le fil
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">
                    Rendu 1:1 Candidats
                  </span>
                </div>

                {/* CARTE D'APERÇU FEED LINKEDIN / SAAS */}
                <div className="bg-white rounded-3xl border border-gray-200/90 shadow-md p-5 sm:p-6 space-y-4">
                  {/* Header En-tête Recruteur */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-sm uppercase shadow-xs overflow-hidden">
                        {recruiterProfileForm.logo_url ? (
                          <img src={recruiterProfileForm.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          (offerForm.company || "E").substring(0, 2)
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-900">
                          {offerForm.company || recruiterProfileForm.company_name || "Nom de l'entreprise"}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5">
                          <span>À l&apos;instant</span>
                          <span>•</span>
                          <i className="fa-solid fa-globe text-[9px]"></i>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Titre & Détails */}
                  <div>
                    <h3 className="text-sm font-black text-gray-900 leading-snug">
                      {offerForm.title || "Titre de l'offre d'emploi"}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                      <span>{offerForm.location || "Sénégal"}</span>
                      <span className="mx-1.5">•</span>
                      <span className="text-emerald-700 capitalize">
                        {LISTING_TYPE_LABELS[offerForm.listing_type] || "Opportunité"}
                      </span>
                      <span className="mx-1.5">•</span>
                      <span className="text-gray-700">{offerForm.contract_type || "CDI"}</span>
                    </p>
                  </div>

                  {/* Description avec liens */}
                  <div className="text-xs text-gray-700 font-normal leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-1">
                    {offerForm.description || "La description détaillée de votre offre apparaîtra ici avec ses emojis et sa mise en page."}
                  </div>

                  {/* Affiche Visuelle Multi-Photos */}
                  {(offerImagePreviews.length > 0 || offerForm.image_url) && (
                    <OfferMediaGallery
                      media={offerImagePreviews.length > 0 ? offerImagePreviews : offerForm.image_url}
                      title={offerForm.title || "Aperçu de l'offre"}
                      onEnlarge={(url) => setViewImageModal({ isOpen: true, url })}
                    />
                  )}

                  {/* Boutons d'Action & Partage */}
                  <div className="pt-2">
                    <SocialShareButtons
                      offer={{
                        id: "preview-id",
                        title: offerForm.title || "Offre d'emploi",
                        company: offerForm.company || recruiterProfileForm.company_name || "Entreprise",
                        location: offerForm.location || "Sénégal",
                        contract: offerForm.contract_type || "CDI",
                        description: offerForm.description,
                        contact_phone: offerForm.contact_phone,
                        contact_email: offerForm.contact_email,
                        external_link: offerForm.external_link,
                      }}
                      variant="feed"
                      onApply={() => triggerToast("Prévisualisation : le candidat sera redirigé vers ce lien.")}
                      onToast={triggerToast}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2 : TOUTES MES OFFRES EN BASE DE DONNÉES */}
            <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">
                    Mes Offres d&apos;Emploi ({myOffers.length})
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Gérez, activez ou modifiez vos offres visibles par tous les candidats.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    value={offerSearchQuery}
                    onChange={(e) => setOfferSearchQuery(e.target.value)}
                    placeholder="Rechercher une offre..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {myOffers.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic text-xs">
                  Aucune offre publiée pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myOffers
                    .filter((o) => {
                      if (!offerSearchQuery.trim()) return true;
                      const q = offerSearchQuery.toLowerCase();
                      return (
                        (o.title || "").toLowerCase().includes(q) ||
                        (o.company || "").toLowerCase().includes(q) ||
                        (o.location || "").toLowerCase().includes(q)
                      );
                    })
                    .map((offer) => {
                      const offerPhotos = parseOfferImages(offer.image_url);
                      const offerApplicationsCount = applications.filter((a) => a.job_offer_id === offer.id).length;

                      return (
                        <div
                          key={offer.id}
                          className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 rounded-2xl px-3 transition"
                        >
                          <div className="flex items-start space-x-3.5 min-w-0">
                            {offerPhotos.length > 0 ? (
                              <div
                                onClick={() => setViewImageModal({ isOpen: true, url: offerPhotos[0] })}
                                className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gray-900 shrink-0 border border-gray-200 cursor-pointer group shadow-2xs"
                              >
                                <img
                                  src={offerPhotos[0]}
                                  alt={offer.title}
                                  className="w-full h-full object-cover group-hover:scale-110 transition"
                                />
                                {offerPhotos.length > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-black px-1 rounded">
                                    +{offerPhotos.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
                                <i className="fa-solid fa-briefcase"></i>
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-gray-900 truncate max-w-xs sm:max-w-md">
                                  {offer.title}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    offer.is_active
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-gray-200 text-gray-600"
                                  }`}
                                >
                                  {offer.is_active ? "Active" : "En pause"}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-gray-600 mt-0.5">
                                {offer.company} — <span className="text-emerald-700">{offer.contract_type || "CDI"}</span>
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                                <span>
                                  <i className="fa-solid fa-location-dot mr-1"></i> {offer.location || "Sénégal"}
                                </span>
                                <span>•</span>
                                <span>
                                  <i className="fa-solid fa-inbox mr-1"></i> {offerApplicationsCount} candidature{offerApplicationsCount !== 1 ? "s" : ""}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOfferForRag(offer.id);
                                setActiveTab("rag-matching");
                                handleRunRagMatching(offer.id, null);
                              }}
                              className="px-3 py-2 text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-emerald-200"
                              title="Lancer le matching IA RAG sur cette offre"
                            >
                              <i className="fa-solid fa-wand-magic-sparkles text-emerald-600"></i>
                              <span className="hidden sm:inline">Matching IA (RAG)</span>
                            </button>
                            <Link
                              href={`/offres/${offer.id}`}
                              target="_blank"
                              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border border-gray-200 flex items-center justify-center transition"
                              title="Voir la fiche détaillée"
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleEditOffer(offer)}
                              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 flex items-center justify-center transition"
                              title="Modifier"
                            >
                              <i className="fa-solid fa-pen-to-square text-xs"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleOfferActive(offer)}
                              disabled={togglingOfferId === offer.id}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
                                offer.is_active
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                              }`}
                              title={offer.is_active ? "Mettre en pause" : "Activer l'offre"}
                            >
                              <i className={`fa-solid ${offer.is_active ? "fa-eye" : "fa-eye-slash"} text-xs`}></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOffer(offer.id)}
                              className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 flex items-center justify-center transition"
                              title="Archiver l'offre"
                            >
                              <i className="fa-regular fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "candidatures" && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Candidatures reçues ({myApplications.length})</h2>
                <p className="text-xs text-gray-500 font-medium">Suivi et évaluation de la compatibilité des candidats</p>
              </div>

              {/* Tri par score */}
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-500">Trier par :</span>
                <select
                  value={sortByScore ? "score_desc" : "date_desc"}
                  onChange={(e) => setSortByScore(e.target.value === "score_desc")}
                  className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                >
                  <option value="date_desc">📅 Plus récentes</option>
                  <option value="score_desc">⚡ Meilleur Match CV (Score ⬇)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Candidat</th>
                    <th className="py-4 px-6">Poste visé</th>
                    <th className="py-4 px-6">Score Match CV</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">CV</th>
                    <th className="py-4 px-6">Entretien</th>
                    <th className="py-4 px-6 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium">
                  {myApplications.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-gray-400 italic">
                        Aucune candidature reçue pour le moment.
                      </td>
                    </tr>
                  ) : (
                    [...myApplications]
                      .sort((a, b) => (sortByScore ? (b.cv_match_score || 0) - (a.cv_match_score || 0) : 0))
                      .map((application) => {
                        const offer = myOffers.find((o) => o.id === application.job_offer_id);
                        const score = application.cv_match_score;
                        const hasScore = score !== null && score !== undefined;
                        const scoreBadgeClass = !hasScore
                          ? "bg-gray-100 text-gray-500 border-gray-200"
                          : score >= 75
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : score >= 50
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-red-100 text-red-800 border-red-200";

                        return (
                          <tr key={application.id} className="hover:bg-emerald-50/30 transition">
                            <td className="py-4 px-6">
                              <span className="font-bold text-gray-900 block">{application.full_name}</span>
                              {application.contact_revealed ? (
                                <span className="text-[10px] text-gray-400">{application.email}</span>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-semibold" title="Visible seulement après acceptation du candidat">
                                  🔒 Coordonnées non révélées
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-gray-600">
                              {offer?.title || application.job_title}
                              {!application.job_offer_id && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Spontanée
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-extrabold border whitespace-nowrap ${scoreBadgeClass}`}>
                                <span>⚡ Match</span>
                                <span>{hasScore ? `${score}%` : "N/A"}</span>
                              </span>
                            </td>
                            <td className="py-4 px-6 text-gray-500">
                              {new Date(application.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                          <td className="py-4 px-6">
                            {application.cv_url ? (
                              <button
                                onClick={() => handleDownloadApplicationCv(application)}
                                disabled={downloadingCvId === application.id}
                                className="text-emerald-600 hover:text-emerald-800 font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                <i className="fa-solid fa-file-pdf"></i>
                                {downloadingCvId === application.id ? "..." : "Télécharger"}
                              </button>
                            ) : application.contact_revealed ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <span className="text-gray-300 text-[10px] italic">Non révélé</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <button
                              type="button"
                              onClick={() => handleStartInterview(application)}
                              disabled={startingInterviewId === application.id}
                              className="text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                              title="Démarrer un entretien vidéo"
                            >
                              <i className={`fa-solid ${startingInterviewId === application.id ? "fa-spinner fa-spin" : "fa-video"}`}></i>
                              {startingInterviewId === application.id ? "Création..." : "Démarrer"}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <select
                              value={application.status || "pending"}
                              disabled={updatingAppId === application.id}
                              onChange={(e) => handleApplicationStatusChange(application.id, e.target.value)}
                              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {APPLICATION_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "cvtheque" && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">
                  CVthèque ({filteredCandidates.length}{candidatesLoading ? "…" : ""})
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  {semanticResults ? "Résultats triés par compatibilité IA" : "Recherchez par nom, métier ou compétence"}
                </p>
                {cvQuota && (
                  <p
                    className={`text-[11px] font-bold mt-1 ${
                      cvQuota.remaining === 0 ? "text-red-600" : cvQuota.remaining <= 10 ? "text-amber-600" : "text-gray-400"
                    }`}
                    title="Nombre de profils candidats distincts consultables aujourd'hui, réinitialisé chaque jour à minuit UTC"
                  >
                    {cvQuota.remaining === 0
                      ? `Quota quotidien atteint (${cvQuota.used}/${cvQuota.limit}) — réinitialisation demain`
                      : `${cvQuota.used}/${cvQuota.limit} consultations aujourd'hui (${cvQuota.remaining} restantes)`}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative max-w-xs w-full">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Nom, métier, compétence..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div className="relative max-w-xs w-full">
                  <i className="fa-solid fa-location-dot absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Localisation..."
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
                {semanticResults ? (
                  <button
                    type="button"
                    onClick={handleResetSemanticSearch}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    <i className="fa-solid fa-xmark"></i> Réinitialiser
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSemanticSearch}
                    disabled={isSemanticSearching || !searchQuery.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSemanticSearching ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    )}
                    Recherche IA
                  </button>
                )}
              </div>
            </div>

            {semanticSearchError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i> {semanticSearchError}
              </div>
            )}

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 italic text-xs py-8">Aucun candidat trouvé.</div>
              ) : (
                filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-emerald-300 transition cursor-pointer"
                    onClick={() => handleOpenCandidateModal(candidate)}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-sm shadow-inner flex-shrink-0">
                        {(candidate.full_name || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-gray-900 text-sm truncate">{candidate.full_name || "Candidat"}</h3>
                        </div>
                        <RoleBadge role="candidat" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold truncate mb-1">{candidate.headline || "Profil candidat"}</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">
                      {candidate.city || candidate.location || "Localisation non renseignée"}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {candidate.cv_url && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600">
                          <i className="fa-solid fa-file-pdf"></i> CV disponible
                        </span>
                      )}
                      {typeof candidate.similarity === "number" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white bg-emerald-600 px-2 py-0.5 rounded-full">
                          <i className="fa-solid fa-wand-magic-sparkles"></i> {Math.round(candidate.similarity * 100)}% compatible
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Onglet Matching IA (RAG) */}
        {activeTab === "rag-matching" && (
          <div className="space-y-6">
            {/* Header & Contrôles RAG */}
            <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black tracking-wide mb-3">
                  <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                  <span>RAG (Retrieval-Augmented Generation)</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  Matching Intelligent Offres & CVs
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium leading-relaxed mb-6">
                  Le système RAG analyse sémantiquement les compétences dans la base vectorielle pgvector, puis génère une synthèse qualitative approfondie pour chaque candidat retenu.
                </p>

                {/* Formulaire de sélection */}
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1.5">
                      1. Choisissez une de vos offres ou saisissez une recherche :
                    </label>
                    <select
                      value={selectedOfferForRag}
                      onChange={(e) => {
                        setSelectedOfferForRag(e.target.value);
                        if (e.target.value !== "custom") setCustomQueryRag("");
                      }}
                      className="w-full px-4 py-3 bg-gray-900/90 border border-emerald-500/40 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                    >
                      <option value="">-- Sélectionnez une offre d&apos;emploi existante --</option>
                      {myOffers.map((off) => (
                        <option key={off.id} value={off.id}>
                          📢 {off.title} ({off.company || "Mon Entreprise"})
                        </option>
                      ))}
                      <option value="custom">✏️ Recherche libre personnalisée</option>
                    </select>
                  </div>

                  {selectedOfferForRag === "custom" && (
                    <div className="animate-fade-in-up">
                      <label className="block text-xs font-bold text-emerald-200 mb-1.5">
                        2. Décrivez le profil recherché (titre, compétences, années d&apos;expérience) :
                      </label>
                      <textarea
                        rows="3"
                        value={customQueryRag}
                        onChange={(e) => setCustomQueryRag(e.target.value)}
                        placeholder="Ex. Développeur Frontend React / Next.js avec 3 ans d'expérience, maîtrisant TypeScript, TailwindCSS et ayant travaillé sur des architectures SaaS..."
                        className="w-full px-4 py-2.5 bg-gray-900/90 border border-emerald-500/40 rounded-xl text-xs font-medium text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition resize-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={ragLoading || (!selectedOfferForRag && !customQueryRag.trim())}
                      onClick={() => handleRunRagMatching()}
                      className="px-6 py-3 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-xs rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                      {ragLoading ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                          <span>Analyse RAG en cours...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-brain text-sm"></i>
                          <span>Lancer le Matching IA RAG</span>
                        </>
                      )}
                    </button>
                    {ragResults && (
                      <button
                        type="button"
                        onClick={() => {
                          setRagResults(null);
                          setRagError("");
                        }}
                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {ragError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-center gap-2.5 animate-shake">
                <i className="fa-solid fa-triangle-exclamation text-base text-red-500"></i>
                <span>{ragError}</span>
              </div>
            )}

            {/* État de chargement animé */}
            {ragLoading && (
              <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <i className="fa-solid fa-wand-magic-sparkles text-2xl text-emerald-600 animate-spin"></i>
                </div>
                <h3 className="text-base font-black text-gray-900 mb-1">
                  Orchestration du RAG en cours
                </h3>
                <p className="text-xs text-gray-500 font-medium max-w-md mx-auto leading-relaxed">
                  1. Extraction vectorielle dans la CVthèque via pgvector...<br />
                  2. Analyse des expériences et compétences par le modèle IA...<br />
                  3. Calcul des scores d&apos;adéquation et questions d&apos;entretien ciblées.
                </p>
              </div>
            )}

            {/* Affichage des Résultats RAG */}
            {!ragLoading && ragResults && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-xs">
                  <div>
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider block">
                      Résultats du Matching RAG
                    </span>
                    <h3 className="text-sm font-extrabold text-gray-900">
                      {ragResults.jobOffer?.title || "Poste évalué"}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
                      {ragResults.totalCount || 0} candidat(s) qualifié(s)
                    </span>
                  </div>
                </div>

                {ragResults.candidates.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 italic text-xs">
                    Aucun candidat correspondant trouvé dans la CVthèque pour ces critères.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ragResults.candidates.map((cand, rank) => {
                      const score = cand.ragAnalysis?.matchScore || cand.similarityScore || 70;
                      const isExpanded = expandedCandidateId === cand.id;
                      const scoreColor = score >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : score >= 65 ? "text-blue-600 bg-blue-50 border-blue-200" : "text-amber-600 bg-amber-50 border-amber-200";
                      const badgeBg = score >= 80 ? "bg-emerald-600" : score >= 65 ? "bg-blue-600" : "bg-amber-600";

                      return (
                        <div
                          key={cand.id}
                          className="bg-white rounded-3xl border border-gray-200 shadow-xs hover:shadow-md transition-all overflow-hidden"
                        >
                          {/* Top Row Card */}
                          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                              <div className="relative flex-shrink-0">
                                <div className="w-14 h-14 rounded-2xl bg-gray-900 text-white font-extrabold flex items-center justify-center text-base shadow-sm overflow-hidden border border-gray-200">
                                  {cand.avatarUrl ? (
                                    <img src={cand.avatarUrl} alt={cand.fullName} className="w-full h-full object-cover" />
                                  ) : (
                                    (cand.fullName || "C").charAt(0).toUpperCase()
                                  )}
                                </div>
                                <span className={`absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full ${badgeBg} text-white font-black text-[11px] flex items-center justify-center shadow-xs border-2 border-white`}>
                                  #{rank + 1}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base font-extrabold text-gray-900 truncate">
                                    {cand.fullName}
                                  </h4>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${scoreColor}`}>
                                    {score}% Match IA
                                  </span>
                                  <span className="text-[11px] font-bold text-gray-500">
                                    · {cand.ragAnalysis?.verdict || "Adéquation confirmée"}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-gray-600 truncate mt-0.5">
                                  {cand.headline || "Profil candidat"}
                                </p>
                                <p className="text-[11px] text-gray-400 font-medium">
                                  <i className="fa-solid fa-location-dot mr-1"></i>
                                  {cand.city || "Sénégal"}
                                </p>
                              </div>
                            </div>

                            {/* Actions rapides */}
                            <div className="flex items-center gap-2 sm:self-center flex-wrap">
                              <button
                                type="button"
                                onClick={() => setExpandedCandidateId(isExpanded ? null : cand.id)}
                                className="px-3.5 py-2 text-xs font-extrabold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                              >
                                <span>{isExpanded ? "Masquer détails" : "Analyse IA"}</span>
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectMessage(cand.id)}
                                className="px-3.5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                              >
                                <i className="fa-solid fa-comment-dots"></i>
                                <span>Contacter</span>
                              </button>
                            </div>
                          </div>

                          {/* Accordéon Analyse IA Détaillée */}
                          {isExpanded && (
                            <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50 space-y-4 animate-fade-in-up">
                              {/* Résumé d'adéquation */}
                              <div className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-2xs">
                                <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <i className="fa-solid fa-circle-info text-blue-500"></i>
                                  <span>Synthèse d&apos;adéquation du profil</span>
                                </h5>
                                <p className="text-xs text-gray-800 font-medium leading-relaxed">
                                  {cand.ragAnalysis?.summary}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Points forts */}
                                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                                  <h5 className="text-[11px] font-black text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-circle-check text-emerald-600"></i>
                                    <span>Points forts pour ce poste</span>
                                  </h5>
                                  <ul className="space-y-1.5">
                                    {(cand.ragAnalysis?.strengths || []).map((str, sIdx) => (
                                      <li key={sIdx} className="text-xs text-emerald-950 font-medium flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                                        <span>{str}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Points d'attention */}
                                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                                  <h5 className="text-[11px] font-black text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                                    <span>Points à vérifier / approfondir</span>
                                  </h5>
                                  <ul className="space-y-1.5">
                                    {(cand.ragAnalysis?.missingSkills || []).map((ms, mIdx) => (
                                      <li key={mIdx} className="text-xs text-amber-950 font-medium flex items-start gap-2">
                                        <span className="text-amber-600 font-bold mt-0.5">•</span>
                                        <span>{ms}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Questions d'entretien recommandées */}
                              {cand.ragAnalysis?.interviewQuestions && cand.ragAnalysis.interviewQuestions.length > 0 && (
                                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/80">
                                  <h5 className="text-[11px] font-black text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-clipboard-question text-indigo-600"></i>
                                    <span>Questions d&apos;entretien recommandées par l&apos;IA</span>
                                  </h5>
                                  <div className="space-y-2">
                                    {cand.ragAnalysis.interviewQuestions.map((q, qIdx) => (
                                      <div key={qIdx} className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 text-xs font-medium text-indigo-950 flex items-start gap-2">
                                        <span className="font-extrabold text-indigo-600">Q{qIdx + 1}:</span>
                                        <span>{q}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "profil" && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 mb-1">Profil Entreprise</h2>
                <p className="text-xs text-gray-500 font-medium">
                  Ces informations apparaissent sur votre vitrine publique, visible par tous les candidats.
                </p>
              </div>
              {userSession?.user?.id && (
                <Link
                  href={`/recruteurs/${userSession.user.id}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition whitespace-nowrap"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Voir ma vitrine publique
                </Link>
              )}
            </div>

            <form onSubmit={handleSaveRecruiterProfile} className="space-y-6">
              {/* Bannière + Logo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Bannière (optionnel)</label>
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="relative h-32 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 bg-cover bg-center cursor-pointer overflow-hidden group border border-gray-200"
                  style={bannerPreview ? { backgroundImage: `url(${bannerPreview})` } : undefined}
                >
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-xs font-extrabold flex items-center gap-1.5">
                      <i className="fa-solid fa-camera"></i> Changer la bannière
                    </span>
                  </div>
                  <input type="file" ref={bannerInputRef} accept="image/png,image/jpeg,image/webp" onChange={handleBannerSelect} className="hidden" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-2xl bg-emerald-100 flex-shrink-0 cursor-pointer overflow-hidden group border border-gray-200 flex items-center justify-center"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-solid fa-building text-emerald-400 text-xl"></i>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <i className="fa-solid fa-camera text-white text-sm"></i>
                  </div>
                  <input type="file" ref={logoInputRef} accept="image/png,image/jpeg,image/webp" onChange={handleLogoSelect} className="hidden" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Logo de l'entreprise</p>
                  <p className="text-[10px] text-gray-400 font-medium">PNG, JPG ou WEBP — 5 Mo maximum</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Nom de l'entreprise *</label>
                  <input
                    type="text"
                    required
                    value={recruiterProfileForm.company_name}
                    onChange={(e) => handleRecruiterProfileFieldChange("company_name", e.target.value)}
                    placeholder="Ex. Facilité"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Secteur d'activité</label>
                  <input
                    type="text"
                    value={recruiterProfileForm.industry}
                    onChange={(e) => handleRecruiterProfileFieldChange("industry", e.target.value)}
                    placeholder="Ex. Technologies, BTP, Santé..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Localisation</label>
                  <input
                    type="text"
                    value={recruiterProfileForm.location}
                    onChange={(e) => handleRecruiterProfileFieldChange("location", e.target.value)}
                    placeholder="Ex. Dakar, Sénégal"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Site web (optionnel)</label>
                  <input
                    type="text"
                    value={recruiterProfileForm.website}
                    onChange={(e) => handleRecruiterProfileFieldChange("website", e.target.value)}
                    placeholder="Ex. www.monentreprise.com"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Description de l'entreprise</label>
                  <textarea
                    rows="4"
                    value={recruiterProfileForm.description}
                    onChange={(e) => handleRecruiterProfileFieldChange("description", e.target.value)}
                    placeholder="Présentez votre entreprise aux candidats..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingRecruiterProfile}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingRecruiterProfile ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Enregistrement...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk"></i>
                    {recruiterProfileId ? "Enregistrer les modifications" : "Créer mon profil vitrine"}
                  </>
                )}
              </button>
            </form>
          </div>
        )}
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8 sm:p-12 max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-6">
              <i className="fa-solid fa-building-shield"></i>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
              Accréditation entreprise requise
            </h1>
            <p className="text-sm text-gray-500 font-medium max-w-md mx-auto mb-8">
              Pour protéger les données de nos candidats, tout l&apos;espace recruteur (offres, candidatures,
              répertoire CVthèque) nécessite une accréditation d&apos;entreprise vérifiée. Cette démarche ne prend
              que quelques minutes.
            </p>

            {pendingBadgeRequest?.status === "pending" ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3 text-left">
                <i className="fa-solid fa-hourglass-half text-amber-600 mt-0.5"></i>
                <div>
                  <h2 className="text-sm font-extrabold text-amber-900">Demande en cours de revue</h2>
                  <p className="text-xs text-amber-800 font-medium mt-1">
                    Votre demande d&apos;accréditation « Recruteur vérifié » est en cours de traitement par notre
                    équipe. Vous serez notifié dès qu&apos;elle sera validée.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-left">
                {pendingBadgeRequest?.status === "rejected" && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    Votre précédente demande a été rejetée
                    {pendingBadgeRequest.rejection_reason ? ` : ${pendingBadgeRequest.rejection_reason}` : "."} Vous
                    pouvez soumettre une nouvelle demande ci-dessous.
                  </div>
                )}
                <form onSubmit={handleSubmitBadgeRequest} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nom de l'entreprise"
                    value={badgeRequestForm.company_name}
                    onChange={(e) => setBadgeRequestForm((prev) => ({ ...prev, company_name: e.target.value }))}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 sm:col-span-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Numéro NINEA"
                    value={badgeRequestForm.ninea_number}
                    onChange={(e) => setBadgeRequestForm((prev) => ({ ...prev, ninea_number: e.target.value }))}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Numéro RCCM"
                    value={badgeRequestForm.rccm_number}
                    onChange={(e) => setBadgeRequestForm((prev) => ({ ...prev, rccm_number: e.target.value }))}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <label className="sm:col-span-2 min-w-0 text-left">
                    <span className="block text-[11px] font-bold text-gray-500 mb-1.5">
                      Attestation officielle (registre de commerce, NINEA ou équivalent — PDF ou image)
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(e) => setBadgeDocumentFile(e.target.files?.[0] || null)}
                      className="w-full max-w-full text-xs font-medium file:mr-3 file:px-3.5 file:py-2 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-extrabold file:cursor-pointer"
                    />
                  </label>
                  {badgeRequestError && (
                    <p className="sm:col-span-2 text-xs font-medium text-red-600">{badgeRequestError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submittingBadgeRequest}
                    className="sm:col-span-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingBadgeRequest ? "Envoi..." : "Envoyer ma demande d'accréditation"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Détails Candidat */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-emerald-800 text-white font-extrabold flex items-center justify-center text-base shadow-inner">
                  {(selectedCandidate.full_name || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-gray-900">{selectedCandidate.full_name || "Candidat"}</h3>
                    <RoleBadge role="candidat" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{selectedCandidate.headline}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-1">À propos</span>
                <p className="text-gray-700 leading-relaxed font-medium bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  {selectedCandidate.bio || "Aucune description complémentaire renseignée."}
                </p>
              </div>

              {Array.isArray(selectedCandidate.skills) && selectedCandidate.skills.length > 0 && (
                <div>
                  <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-1.5">Compétences</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidate.skills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-bold text-[10px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCandidate.cv_url && (
                <div className="pt-2">
                  <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-2">Curriculum Vitae</span>
                  {loadingCvUrl ? (
                    <p className="text-gray-400 italic">Chargement du CV sécurisé...</p>
                  ) : signedCvUrl ? (
                    <a
                      href={signedCvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs"
                    >
                      <i className="fa-solid fa-file-pdf"></i>
                      <span>Ouvrir / Télécharger le CV</span>
                    </a>
                  ) : (
                    <p className="text-red-500 font-medium">Impossible de récupérer l'accès au CV.</p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6 flex justify-end space-x-3">
              <button
                onClick={() => handleContactCandidate(selectedCandidate)}
                disabled={contactingId === selectedCandidate.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>{contactingId === selectedCandidate.id ? "Envoi..." : "Contacter par Messagerie"}</span>
              </button>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agrandissement Photo de l'Offre (Lightbox) */}
      {viewImageModal.isOpen && (
        <div
          className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setViewImageModal({ isOpen: false, url: null })}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-gray-950 rounded-3xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewImageModal({ isOpen: false, url: null })}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center text-sm shadow-md transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <img
              src={viewImageModal.url}
              alt="Affiche en grand"
              className="max-h-[85vh] w-auto object-contain mx-auto rounded-2xl"
            />
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl">
            <img src={lightboxImage} alt="Offre grand format" className="w-full h-full object-contain max-h-[85vh] rounded-3xl" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-lg backdrop-blur-md transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilité - Espace Recruteur Sécurisé.
      </footer>

      <VideoInterviewModal
        interviewId={activeInterviewId}
        isOpen={!!activeInterviewId}
        onClose={() => setActiveInterviewId(null)}
      />
    </div>
  );
}
