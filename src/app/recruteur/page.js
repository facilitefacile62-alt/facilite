/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import { sendMessage } from "@/lib/messages";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import VideoInterviewModal from "@/components/VideoInterviewModal";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

const EMPTY_OFFER = {
  title: "",
  company: "",
  location: "",
  contract_type: "CDI",
  salary_range: "",
  min_education_level: "Aucun",
  description: "",
  image_url: "",
  deadline: "",
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

const APPLICATION_STATUSES = [
  { value: "pending", label: "Envoyée" },
  { value: "reviewed", label: "En revue" },
  { value: "interview_scheduled", label: "Entretien programmé" },
  { value: "accepted", label: "Accepté" },
  { value: "rejected", label: "Refusé" },
];

export default function RecruteurDashboardPage() {
  const router = useRouter();
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [activeTab, setActiveTab] = useState("offres"); // 'offres' | 'candidatures' | 'cvtheque' | 'profil'
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

  // --- Onglet Offres ---
  const [myOffers, setMyOffers] = useState([]);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [togglingOfferId, setTogglingOfferId] = useState(null);
  const [offerImageFile, setOfferImageFile] = useState(null);
  const [offerImagePreview, setOfferImagePreview] = useState(null);
  const [offerImageDragOver, setOfferImageDragOver] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const offerImageInputRef = useRef(null);

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

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }

        // Contrôle d'accès : réservé aux recruteurs (et aux admins, qui
        // peuvent tout superviser). Un candidat qui atterrit ici (lien direct,
        // ancien favori...) est renvoyé à l'accueil.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!profile || (profile.role !== "recruteur" && profile.role !== "admin")) {
          window.location.replace("/");
          return;
        }

        setUserSession(session);

        const [
          { data: offers, error: offersErr },
          { data: candidatesData, error: candidatesErr },
          { data: applicationsData, error: applicationsErr },
          { data: recruiterProfileData, error: recruiterProfileErr },
        ] = await Promise.all([
          supabase.from("job_offers").select("*").eq("recruiter_id", session.user.id).order("created_at", { ascending: false }),
          supabase.from("candidats_recherche").select("*"),
          supabase
            .from("candidatures")
            .select("*")
            .not("job_offer_id", "is", null)
            .order("created_at", { ascending: false }),
          supabase.from("recruiter_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        ]);

        if (offersErr) console.error("Erreur chargement offres:", offersErr);
        else setMyOffers(offers || []);

        if (candidatesErr) console.error("Erreur chargement candidats:", candidatesErr);
        else setCandidates(candidatesData || []);

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

  // Synchronisation temps réel : une nouvelle candidature arrive quand un
  // CANDIDAT postule depuis sa propre session — sans Realtime, le recruteur
  // ne la verrait qu'après un F5. Pas de filtre par recruteur_id (la table
  // candidatures n'a pas cette colonne, seulement job_offer_id) : les
  // policies RLS de candidatures scopent déjà la visibilité aux candidatures
  // liées aux offres de ce recruteur.
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`recruteur-candidatures:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidatures" },
        (payload) => {
          if (!payload.new.job_offer_id) return;
          setApplications((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "candidatures" },
        (payload) => {
          setApplications((prev) => prev.map((a) => (a.id === payload.new.id ? payload.new : a)));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userSession?.user?.id]);

  // --- Gestion des offres ---
  const handleOfferFieldChange = (field, value) => {
    setOfferForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditOffer = (offer) => {
    setActiveTab("offres");
    setEditingOfferId(offer.id);
    setOfferForm({
      title: offer.title || "",
      company: offer.company || "",
      location: offer.location || "",
      contract_type: offer.contract_type || "CDI",
      salary_range: offer.salary_range || "",
      min_education_level: offer.min_education_level || "Aucun",
      description: offer.description || "",
      image_url: offer.image_url || "",
      deadline: offer.deadline || "",
    });
    setOfferImageFile(null);
    setOfferImagePreview(offer.image_url || null);
    setTimeout(() => offerFormRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleCancelEditOffer = () => {
    setEditingOfferId(null);
    setOfferForm(EMPTY_OFFER);
    setOfferImageFile(null);
    setOfferImagePreview(null);
  };

  const applyOfferImageFile = (file) => {
    if (!file) return;
    if (!OFFER_IMAGE_TYPES.includes(file.type)) {
      triggerToast("Format d'image non supporté (PNG, JPG ou WEBP uniquement).");
      return;
    }
    if (file.size > MAX_OFFER_IMAGE_BYTES) {
      triggerToast("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    setOfferImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setOfferImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleOfferImageSelect = (e) => {
    applyOfferImageFile(e.target.files?.[0]);
  };

  const handleOfferImageDrop = (e) => {
    e.preventDefault();
    setOfferImageDragOver(false);
    applyOfferImageFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveOfferImage = () => {
    setOfferImageFile(null);
    setOfferImagePreview(null);
    setOfferForm((prev) => ({ ...prev, image_url: "" }));
    if (offerImageInputRef.current) offerImageInputRef.current.value = "";
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

  // Sans ceci, match_job_offers (RPC utilisée par la recherche sémantique
  // côté /offres) ne renverrait jamais aucun résultat : la colonne
  // job_offers.embedding resterait NULL pour toute nouvelle offre. Appelé en
  // tâche de fond (non "await"-é par l'appelant) pour ne pas retarder le
  // toast de confirmation de publication/modification.
  const generateOfferEmbedding = async (offerId, title, description) => {
    try {
      const text = `${title || ""}\n\n${description || ""}`.trim().slice(0, 8000);
      if (!text) return;

      const { data: embedData, error: embedError } = await supabase.functions.invoke("gemini-orchestrator", {
        body: { action: "embed", text },
      });

      if (embedError || !embedData?.success || !Array.isArray(embedData?.embedding)) {
        console.error("Erreur génération embedding offre:", embedData?.error || embedError?.message);
        return;
      }

      await supabase
        .from("job_offers")
        .update({ embedding: `[${embedData.embedding.join(",")}]` })
        .eq("id", offerId);
    } catch (err) {
      console.error("Erreur génération embedding offre:", err);
    }
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!userSession?.user?.id) return;
    setSavingOffer(true);

    try {
      let imageUrl = offerForm.image_url || "";

      if (offerImageFile) {
        const ext = offerImageFile.name.split(".").pop().toLowerCase();
        const storagePath = buildStoragePath(userSession.user.id, ext);

        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(storagePath, offerImageFile, { upsert: true, contentType: offerImageFile.type });

        if (uploadError) {
          console.error("Erreur upload image offre:", uploadError);
          triggerToast("Erreur lors du téléversement de l'image.");
          setSavingOffer(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from("job-offers").getPublicUrl(storagePath);
        imageUrl = publicUrlData?.publicUrl || "";
      }

      // deadline est une colonne DATE : une chaîne vide ("" par défaut dans le
      // formulaire) ferait échouer l'insert/update avec une erreur de type
      // Postgres ("invalid input syntax for type date"), il faut null.
      const payload = { ...offerForm, image_url: imageUrl, deadline: offerForm.deadline || null };

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
          .insert({ ...payload, recruiter_id: userSession.user.id })
          .select()
          .single();

        if (error) {
          triggerToast("Erreur lors de la publication de l'offre.");
        } else {
          setMyOffers((prev) => [data, ...prev]);
          triggerToast("Offre publiée !");
          generateOfferEmbedding(data.id, payload.title, payload.description);
          setOfferForm(EMPTY_OFFER);
          setOfferImageFile(null);
          setOfferImagePreview(null);
        }
      }
    } catch (err) {
      console.error("Erreur sauvegarde offre:", err);
      triggerToast("Une erreur est survenue.");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Supprimer définitivement cette offre ?")) return;

    const { error } = await supabase
      .from("job_offers")
      .delete()
      .eq("id", offerId)
      .eq("recruiter_id", userSession.user.id);

    if (error) {
      triggerToast("Erreur lors de la suppression.");
      return;
    }
    setMyOffers((prev) => prev.filter((o) => o.id !== offerId));
    if (editingOfferId === offerId) handleCancelEditOffer();
    triggerToast("Offre supprimée.");
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
  const myApplications = applications.filter((a) => myOfferIds.has(a.job_offer_id));

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
      content: `Bonjour ${candidate.full_name || ""}, votre profil sur Facilite a retenu notre attention. Seriez-vous disponible pour échanger ?`.trim(),
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
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <RoleBadge role="recruteur" />
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenPublishOffer}
              className="text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-plus"></i>
              <span>Publier une offre</span>
            </button>
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

        {/* Onglets */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs mb-8 max-w-xl overflow-x-auto">
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
            onClick={() => setActiveTab("profil")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 whitespace-nowrap ${
              activeTab === "profil" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>🏢 Profil Entreprise</span>
          </button>
        </div>

        {activeTab === "offres" && (
          <div className="space-y-8">
            {/* Formulaire de publication */}
            <div ref={offerFormRef} className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8">
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">
                {editingOfferId ? "Modifier l'offre" : "Publier une nouvelle offre"}
              </h2>
              <p className="text-xs text-gray-500 font-medium mb-6">
                {editingOfferId ? "Mettez à jour les informations puis enregistrez." : "Renseignez les détails du poste à pourvoir."}
              </p>

              <form onSubmit={handleSubmitOffer} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Intitulé du poste</label>
                  <input
                    type="text"
                    required
                    value={offerForm.title}
                    onChange={(e) => handleOfferFieldChange("title", e.target.value)}
                    placeholder="Ex. Développeur Front-End React"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Entreprise</label>
                  <input
                    type="text"
                    required
                    value={offerForm.company}
                    onChange={(e) => handleOfferFieldChange("company", e.target.value)}
                    placeholder="Ex. Facilite Corporation"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Localisation</label>
                  <input
                    type="text"
                    required
                    value={offerForm.location}
                    onChange={(e) => handleOfferFieldChange("location", e.target.value)}
                    placeholder="Ex. Dakar, Sénégal"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Type de contrat</label>
                  <select
                    value={offerForm.contract_type}
                    onChange={(e) => handleOfferFieldChange("contract_type", e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Niveau d'étude requis</label>
                  <select
                    value={offerForm.min_education_level}
                    onChange={(e) => handleOfferFieldChange("min_education_level", e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="Aucun">Aucun exigé</option>
                    <option value="CM2">CM2</option>
                    <option value="Brevet">Brevet / BEPC</option>
                    <option value="BAC">BAC</option>
                    <option value="Licence">Licence / Bachelor</option>
                    <option value="Master">Master</option>
                    <option value="Doctorat">Doctorat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Salaire (optionnel)</label>
                  <input
                    type="text"
                    value={offerForm.salary_range}
                    onChange={(e) => handleOfferFieldChange("salary_range", e.target.value)}
                    placeholder="Ex. 300 000 - 450 000 FCFA / mois"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Date limite de candidature (optionnel)</label>
                  <input
                    type="date"
                    value={offerForm.deadline}
                    onChange={(e) => handleOfferFieldChange("deadline", e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Photo / affiche de l'annonce (optionnel)</label>
                  <input
                    type="file"
                    ref={offerImageInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleOfferImageSelect}
                    className="hidden"
                  />
                  {offerImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={offerImagePreview}
                        alt="Aperçu de l'annonce"
                        className="max-h-48 rounded-xl border border-gray-200 shadow-xs object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveOfferImage}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md cursor-pointer"
                        title="Retirer l'image"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => offerImageInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOfferImageDragOver(true);
                      }}
                      onDragLeave={() => setOfferImageDragOver(false)}
                      onDrop={handleOfferImageDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                        offerImageDragOver ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-400 bg-gray-50/50"
                      }`}
                    >
                      <i className="fa-solid fa-image text-2xl text-gray-400 mb-2"></i>
                      <p className="text-xs font-bold text-gray-600">Glissez-déposez une image ou cliquez pour en choisir une</p>
                      <p className="text-[10px] text-gray-400 mt-1">PNG, JPG ou WEBP — 5 Mo maximum</p>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Description du poste & Compétences requises</label>
                  <textarea
                    required
                    rows={4}
                    value={offerForm.description}
                    onChange={(e) => handleOfferFieldChange("description", e.target.value)}
                    placeholder="Missions, compétences requises, profil recherché, avantages..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingOffer}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {savingOffer ? "Enregistrement..." : editingOfferId ? "Enregistrer les modifications" : "Publier l'offre"}
                  </button>
                  {editingOfferId && (
                    <button
                      type="button"
                      onClick={handleCancelEditOffer}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Mes offres */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-extrabold text-gray-900">Mes Offres ({myOffers.length})</h2>
              </div>
              {myOffers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">Aucune offre publiée pour le moment.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myOffers.map((offer) => {
                    const offerApplicationsCount = applications.filter((a) => a.job_offer_id === offer.id).length;
                    return (
                      <div key={offer.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-4 min-w-0">
                          {offer.image_url && (
                            <img
                              src={offer.image_url}
                              alt={offer.title}
                              onClick={() => setLightboxImage(offer.image_url)}
                              className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-xs cursor-pointer hover:opacity-90 transition flex-shrink-0"
                              title="Cliquer pour agrandir"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-extrabold text-gray-900 text-sm">{offer.title}</h3>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                  offer.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {offer.is_active ? "Active" : "Fermée"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">
                              {offer.company} — {offer.location} · {offer.contract_type}
                            </p>
                            <p className="text-[11px] text-gray-400 font-semibold mt-1">
                              <i className="fa-solid fa-inbox mr-1"></i>
                              {offerApplicationsCount} candidature{offerApplicationsCount !== 1 ? "s" : ""} reçue{offerApplicationsCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditOffer(offer)}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleToggleOfferActive(offer)}
                            disabled={togglingOfferId === offer.id}
                            className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-60"
                          >
                            {offer.is_active ? "Mettre en pause" : "Réactiver"}
                          </button>
                          <button
                            onClick={() => handleDeleteOffer(offer.id)}
                            className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            Supprimer
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
                              <span className="text-[10px] text-gray-400">{application.email}</span>
                            </td>
                            <td className="py-4 px-6 text-gray-600">{offer?.title || application.job_title}</td>
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
                            ) : (
                              <span className="text-gray-400">—</span>
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
                <h2 className="text-lg font-extrabold text-gray-900">CVthèque ({filteredCandidates.length})</h2>
                <p className="text-xs text-gray-500 font-medium">
                  {semanticResults ? "Résultats triés par compatibilité IA" : "Recherchez par nom, métier ou compétence"}
                </p>
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
                    placeholder="Ex. Facilite Corporation"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Secteur d'activité</label>
                  <input
                    type="text"
                    value={recruiterProfileForm.sector}
                    onChange={(e) => handleRecruiterProfileFieldChange("sector", e.target.value)}
                    placeholder="Ex. Technologies, Restauration..."
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
        © 2026 Facilite - Espace Recruteur Sécurisé.
      </footer>

      <VideoInterviewModal
        interviewId={activeInterviewId}
        isOpen={!!activeInterviewId}
        onClose={() => setActiveInterviewId(null)}
      />
    </div>
  );
}
