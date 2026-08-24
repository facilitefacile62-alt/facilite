/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import SocialShareButtons from "@/components/SocialShareButtons";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import { detectWhatsAppNumber, buildWhatsAppLink, resolveOfferAction } from "@/lib/offerContact";
import { isOfferActivelySponsored } from "@/lib/sponsoredFeed";
import { LISTING_TYPE_LABELS } from "@/lib/listingTypes";
import { TexteAvecLiens } from "@/lib/liens";

const EMPTY_OFFER = {
  title: "",
  company: "",
  location: "Sénégal",
  contract_type: "CDI",
  salary_range: "",
  min_education_level: "Aucun",
  description: "",
  image_url: "",
  deadline: "",
  contact_email: "",
  contact_phone: "",
  external_link: "",
  // Adresse de candidature explicitement désignée par l'annonce
  // (20260824120000_offre_adresse_candidature.sql) — distincte de
  // contact_email/external_link, qui restent le contact général et le site
  // institutionnel. Vide = l'annonce n'en donne pas, ce n'est pas une erreur.
  application_url: "",
  application_email: "",
  additional_info: "",
  listing_type: "offre_emploi",
};

export default function AdminOffresPage() {
  const router = useRouter();
  const [userSession, setUserSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // État des offres existantes
  const [allOffers, setAllOffers] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Mode de publication : "ai_scanner" | "manual"
  const [publishMode, setPublishMode] = useState("ai_scanner");

  // Formulaire de l'offre
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [offerImageFile, setOfferImageFile] = useState(null);
  const [offerImagePreview, setOfferImagePreview] = useState(null);
  const [accompanyingText, setAccompanyingText] = useState("");

  // États du Scanner IA
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  // Sous-point 1 : l'Examinateur est une ÉTAPE, pas un raccourci. Passe à
  // true uniquement après une analyse réussie de la source courante
  // (affiche et/ou texte), et retombe à false dès que cette source change —
  // une nouvelle affiche n'a jamais été examinée.
  const [examenPasse, setExamenPasse] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [savingOffer, setSavingOffer] = useState(false);

  // Modal d'agrandissement d'image
  const [viewImageModal, setViewImageModal] = useState({ isOpen: false, url: null });

  // Onglet Image : Upload/Scan ou Génération IA 1:1
  const [imageTab, setImageTab] = useState("upload"); // "upload" | "ai_generate"
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAiPoster, setIsGeneratingAiPoster] = useState(false);

  // Sponsoring — activation manuelle admin uniquement (pas de webhook de
  // paiement pour l'instant), voir set_offer_sponsorship() en base.
  const [sponsoringOfferId, setSponsoringOfferId] = useState(null);
  const [sponsorDurationDays, setSponsorDurationDays] = useState(7);
  const [sponsorPriorityDraft, setSponsorPriorityDraft] = useState(0);
  const [savingSponsorship, setSavingSponsorship] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", icon: "fa-circle-check" });
  const triggerToast = (message, icon = "fa-circle-check") => {
    setToast({ show: true, message, icon });
    setTimeout(() => setToast({ show: false, message: "", icon: "fa-circle-info" }), 3500);
  };

  const fileDropInputRef = useRef(null);

  async function loadAdminData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (!userRoleRow || userRoleRow.role !== "admin") {
        window.location.replace("/");
        return;
      }
      setUserRole(userRoleRow.role);
      setUserSession(session);

      // Fetch all offers
      const { data: offersData, error } = await supabase
        .from("job_offers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        setAllOffers(offersData || []);
      }
    } catch (err) {
      console.error("Exception loading admin offres:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();

    // Abonnement Realtime Supabase sur la table job_offers
    const channel = supabase
      .channel("admin-job-offers-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_offers" },
        () => {
          loadAdminData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Gestion du téléversement de fichier affiche
  const handleFileDropSelect = (file) => {
    if (!file) return;
    setOfferImageFile(file);
    setExamenPasse(false);
    const previewUrl = URL.createObjectURL(file);
    setOfferImagePreview(previewUrl);
    setScanSuccess(false);
    setScanMessage("");

    // Si on est en mode Scanner IA, lancer l'extraction automatique
    if (publishMode === "ai_scanner") {
      runAIScanner(file, accompanyingText);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileDropSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileDropSelect(e.dataTransfer.files[0]);
    }
  };

  // Exécution du Scanner / Organisateur IA
  const runAIScanner = async (fileToScan = offerImageFile, textToInclude = accompanyingText) => {
    const hasFile = !!fileToScan;
    const hasText = typeof textToInclude === "string" && textToInclude.trim().length > 0;

    if (!hasFile && !hasText) {
      triggerToast("Veuillez déposer une affiche ou coller un texte descriptif de l'offre.", "fa-triangle-exclamation");
      return;
    }

    setIsScanningAI(true);
    setScanSuccess(false);
    setScanMessage(
      hasFile && hasText
        ? "✨ Fusion et organisation intelligente de l'affiche et de la description par l'IA..."
        : hasFile
        ? "🔍 Analyse et extraction automatique de l'affiche par l'IA..."
        : "📝 Analyse et structuration intelligente du texte par l'IA..."
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      if (hasFile) {
        formData.append("file", fileToScan);
      }
      if (hasText) {
        formData.append("accompanying_text", textToInclude.trim());
      }

      const res = await fetch("/api/admin/extract-job-poster", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.offer) {
        const extracted = data.offer;
        setOfferForm({
          title: extracted.title || "",
          company: extracted.company || "",
          location: extracted.location || "Sénégal",
          contract_type: extracted.contract_type || "CDI",
          salary_range: extracted.salary_range || "",
          min_education_level: extracted.min_education_level || "Aucun",
          description: extracted.description || "",
          image_url: extracted.image_url || offerForm.image_url || "",
          deadline: extracted.deadline || "",
          contact_email: extracted.contact_email || "",
          contact_phone: extracted.contact_phone || "",
          external_link: extracted.external_link || "",
          application_url: extracted.application_url || "",
          application_email: extracted.application_email || "",
          additional_info: extracted.additional_info || "",
          listing_type: extracted.listing_type || "offre_emploi",
        });

        setScanSuccess(true);
        setExamenPasse(true);
        setScanMessage(
          hasFile && hasText
            ? "✨ Affiche et description fusionnées avec succès ! Tous les champs ont été organisés."
            : hasFile
            ? "✨ Affiche scannée et formulaire pré-rempli avec succès par l'IA !"
            : "✨ Texte structuré et formulaire pré-rempli avec succès par l'IA !"
        );
        triggerToast("Informations organisées par l'IA !", "fa-wand-magic-sparkles");
      } else {
        setScanMessage(data.error || "L'IA n'a pas pu extraire toutes les informations. Vous pouvez compléter le formulaire.");
        triggerToast(data.error || "Extraction partielle.", "fa-triangle-exclamation");
      }
    } catch (err) {
      console.error("Erreur Scanner IA:", err);
      setScanMessage("Erreur réseau lors de l'analyse.");
      triggerToast("Erreur lors de l'analyse IA.", "fa-circle-xmark");
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleRemoveOfferImage = () => {
    setOfferImageFile(null);
    setOfferImagePreview(null);
    setOfferForm((prev) => ({ ...prev, image_url: "" }));
    setScanSuccess(false);
    setScanMessage("");
  };

  // Génération d'une affiche de recrutement IA au format 1:1
  const handleGenerateAiPoster = async (customPrompt = aiPrompt) => {
    const promptToUse = (customPrompt || aiPrompt || "").trim();
    if (!promptToUse && !offerForm.title.trim()) {
      triggerToast("Veuillez saisir un prompt ou renseigner le titre du poste pour guider l'IA.", "fa-triangle-exclamation");
      return;
    }

    setIsGeneratingAiPoster(true);
    triggerToast("🎨 Génération de l'affiche 1:1 en cours par l'IA...", "fa-wand-magic-sparkles");

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
          company: offerForm.company,
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        setOfferImagePreview(data.imageUrl);
        setOfferForm((prev) => ({ ...prev, image_url: data.imageUrl }));
        setScanSuccess(true);
        // Volontairement PAS setExamenPasse(true) : générer une affiche
        // n'examine pas le contenu de l'offre. L'étape Examinateur reste à
        // franchir.
        setScanMessage("✨ Affiche format carré 1:1 générée avec succès et attachée à l'offre !");
        triggerToast("🎉 Affiche 1:1 générée avec succès !", "fa-circle-check");
      } else {
        triggerToast(data.error || "Erreur lors de la génération de l'image.", "fa-triangle-exclamation");
      }
    } catch (err) {
      console.error("Erreur génération image IA:", err);
      triggerToast("Erreur de connexion avec le générateur d'image.", "fa-circle-xmark");
    } finally {
      setIsGeneratingAiPoster(false);
    }
  };

  // Suggérer automatiquement un prompt structuré basé sur les champs du formulaire
  const handleSuggestPrompt = () => {
    const title = offerForm.title || "Offre d'emploi";
    const company = offerForm.company || "Entreprise";
    const location = offerForm.location || "Dakar, Sénégal";
    
    const suggested = `Affiche de recrutement professionnelle et percutante pour le poste de ${title} chez ${company} à ${location}. Style corporate moderne, design soigné, mise en valeur du métier, format carré 1:1`;
    setAiPrompt(suggested);
    triggerToast("Prompt suggéré généré avec succès !", "fa-wand-magic-sparkles");
  };

  // Publication directe en 1 Clic assistée par IA (depuis image et/ou description)
  const handleInstantAiPublish = async () => {
    if (!userSession?.user?.id) {
      triggerToast("Veuillez vous connecter en tant qu'administrateur.", "fa-triangle-exclamation");
      return;
    }
    const hasFile = !!offerImageFile;
    const hasText = typeof accompanyingText === "string" && accompanyingText.trim().length > 0;
    const hasFormFilled = offerForm.title?.trim() && offerForm.company?.trim();

    if (!hasFile && !hasText && !hasFormFilled) {
      triggerToast("Veuillez déposer une image ou saisir une description.", "fa-triangle-exclamation");
      return;
    }

    // Sous-point 4 : rien ne part sur le Fil d'Actualité sans revue. Ce
    // chemin scannait ET publiait dans le même clic (« Publication directe
    // en 1 Clic ») : l'extraction n'était donc jamais relue par personne.
    if (!examenPasse) {
      triggerToast("Lancez l'Examinateur et vérifiez les informations avant de publier.", "fa-triangle-exclamation");
      return;
    }

    setSavingOffer(true);
    triggerToast("⚡ Analyse IA et publication directe en cours...", "fa-wand-magic-sparkles");

    try {
      let currentOfferData = { ...offerForm };

      // Si le formulaire n'a pas encore été analysé / pré-rempli, lancer l'IA
      if (!hasFormFilled || hasFile || hasText) {
        const formData = new FormData();
        if (hasFile) formData.append("file", offerImageFile);
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
            image_url: extJson.offer.image_url || offerForm.image_url || "",
          };
          setOfferForm(currentOfferData);
        } else if (!hasFormFilled) {
          triggerToast(extJson.error || "Extraction incomplète.", "fa-triangle-exclamation");
          setSavingOffer(false);
          return;
        }
      }

      // Upload de l'image si elle n'est pas encore stockée
      let finalImageUrl = currentOfferData.image_url || "";
      if (offerImageFile && (!finalImageUrl || finalImageUrl.startsWith("blob:"))) {
        const ext = offerImageFile.name.split(".").pop().toLowerCase();
        const storagePath = `${userSession.user.id}/admin-offers-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(storagePath, offerImageFile, { contentType: offerImageFile.type });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("job-offers").getPublicUrl(storagePath);
          finalImageUrl = publicUrlData?.publicUrl || "";
        }
      }

      // Détection WhatsApp automatique
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
        company: (currentOfferData.company || "Entreprise").trim(),
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
        status: "approved",
        is_active: true,
        recruiter_id: userSession.user.id,
      };

      const res = await fetch("/api/admin/publish-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!resData.success) {
        triggerToast(resData.error || "Erreur lors de la publication.", "fa-circle-xmark");
      } else {
        setAllOffers((prev) => [resData.offer, ...prev]);
        triggerToast("🎉 Offre analysée et publiée en direct sur le Fil d'Actualité !", "fa-bullhorn");
        setOfferForm(EMPTY_OFFER);
        setOfferImageFile(null);
        setOfferImagePreview(null);
        setAccompanyingText("");
        setScanSuccess(false);
        setScanMessage("");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Erreur lors de la publication automatique.", "fa-circle-xmark");
    } finally {
      setSavingOffer(false);
    }
  };

  // Soumission et Publication directe sur le Fil d'Actualité
  const handleSubmitOffer = async (e) => {
    if (e) e.preventDefault();
    if (!userSession?.user?.id) return;

    if (!offerForm.title || !offerForm.company) {
      triggerToast("Le titre du poste et l'entreprise sont obligatoires.", "fa-triangle-exclamation");
      return;
    }

    // Même verrou que la publication « 1 clic » : le bouton est déjà
    // désactivé, cette garde couvre un submit déclenché autrement
    // (touche Entrée dans un champ du formulaire).
    if (!examenPasse) {
      triggerToast("Vérifiez les informations dans le panneau de revue avant de publier.", "fa-triangle-exclamation");
      return;
    }

    setSavingOffer(true);

    try {
      let imageUrl = offerForm.image_url || "";

      // Si l'image n'est pas encore téléversée sur Supabase Storage
      if (offerImageFile && (!imageUrl || imageUrl.startsWith("blob:"))) {
        const ext = offerImageFile.name.split(".").pop().toLowerCase();
        const storagePath = `${userSession.user.id}/admin-offers-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(storagePath, offerImageFile, { contentType: offerImageFile.type });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("job-offers").getPublicUrl(storagePath);
          imageUrl = publicUrlData?.publicUrl || "";
        }
      }

      // Si un numéro WhatsApp / Téléphone est renseigné et aucun lien externe défini, générer le lien wa.me
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

      const formEmail = (offerForm.contact_email || offerForm.application_email || "").trim();

      const payload = {
        title: offerForm.title.trim(),
        company: offerForm.company.trim(),
        location: offerForm.location.trim() || "Sénégal",
        contract_type: offerForm.contract_type || "CDI",
        salary_range: offerForm.salary_range || null,
        min_education_level: offerForm.min_education_level || "Aucun",
        description: offerForm.description || "",
        image_url: imageUrl || null,
        deadline: offerForm.deadline || null,
        contact_email: formEmail || null,
        application_email: (offerForm.application_email || formEmail || "").trim() || null,
        application_url: offerForm.application_url ? offerForm.application_url.trim() : null,
        additional_info: offerForm.additional_info ? offerForm.additional_info.trim() : null,
        contact_phone: offerForm.contact_phone ? offerForm.contact_phone.trim() : (phoneDigits ? `+${phoneDigits}` : null),
        external_link: externalLink || null,
        listing_type: LISTING_TYPE_LABELS[offerForm.listing_type] ? offerForm.listing_type : "offre_emploi",
        status: "approved",
        is_active: true,
        recruiter_id: userSession.user.id,
      };

      const res = await fetch("/api/admin/publish-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!resData.success) {
        triggerToast(resData.error || "Erreur lors de la publication de l'offre.", "fa-circle-xmark");
        console.error(resData);
      } else {
        setAllOffers((prev) => [resData.offer, ...prev]);
        triggerToast("🎉 Offre publiée en direct sur le Fil d'Actualité !", "fa-bullhorn");
        
        // Reset
        setOfferForm(EMPTY_OFFER);
        setOfferImageFile(null);
        setOfferImagePreview(null);
        setAccompanyingText("");
        setScanSuccess(false);
        setScanMessage("");
      }
    } catch (err) {
      triggerToast("Une erreur est survenue.", "fa-circle-xmark");
      console.error(err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleToggleOfferActive = async (offer) => {
    const nextActive = !offer.is_active;

    const { error } = await supabase
      .from("job_offers")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", offer.id);

    if (error) {
      triggerToast("Erreur modification statut.", "fa-circle-xmark");
      return;
    }
    setAllOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, is_active: nextActive } : o)));
    triggerToast(nextActive ? "Offre activée et visible sur le fil." : "Offre masquée du fil d'actualité.");
  };

  // Seul chemin d'écriture pour is_sponsored/sponsored_until/sponsor_priority
  // — un .update() direct est bloqué par trg_prevent_sponsorship_self_edit
  // pour quiconque n'est pas admin ; ici l'appel passe par la fonction
  // SECURITY DEFINER dédiée (set_offer_sponsorship), qui revérifie
  // elle-même le rôle admin côté base plutôt que de faire confiance à
  // l'UI seule.
  const handleActivateSponsorship = async (offerId) => {
    const days = Number(sponsorDurationDays);
    if (!days || days <= 0) {
      triggerToast("Durée invalide.", "fa-circle-xmark");
      return;
    }
    setSavingSponsorship(true);
    const sponsoredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: ok, error } = await supabase.rpc("set_offer_sponsorship", {
      p_offer_id: offerId,
      p_is_sponsored: true,
      p_sponsored_until: sponsoredUntil,
      p_sponsor_priority: Number(sponsorPriorityDraft) || 0,
    });
    setSavingSponsorship(false);

    if (error || !ok) {
      triggerToast("Échec de l'activation : " + (error?.message || "offre introuvable"), "fa-circle-xmark");
      return;
    }

    setAllOffers((prev) =>
      prev.map((o) =>
        o.id === offerId
          ? { ...o, is_sponsored: true, sponsored_until: sponsoredUntil, sponsor_priority: Number(sponsorPriorityDraft) || 0 }
          : o
      )
    );
    setSponsoringOfferId(null);
    triggerToast(`Offre sponsorisée pour ${days} jour(s).`, "fa-star");
  };

  const handleDeactivateSponsorship = async (offerId) => {
    setSavingSponsorship(true);
    const { data: ok, error } = await supabase.rpc("set_offer_sponsorship", {
      p_offer_id: offerId,
      p_is_sponsored: false,
    });
    setSavingSponsorship(false);

    if (error || !ok) {
      triggerToast("Échec de la désactivation : " + (error?.message || "offre introuvable"), "fa-circle-xmark");
      return;
    }

    setAllOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, is_sponsored: false, sponsored_until: null, sponsor_priority: 0 } : o))
    );
    triggerToast("Sponsoring désactivé.");
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Voulez-vous vraiment archiver cette offre ?")) return;
    const { error } = await supabase
      .from("job_offers")
      .update({ status: "archived", is_active: false })
      .eq("id", offerId);

    if (error) {
      triggerToast("Erreur lors de l'archivage.", "fa-circle-xmark");
      return;
    }
    setAllOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "archived", is_active: false } : o)));
    triggerToast("Offre archivée.");
  };

  const filteredOffers = allOffers.filter((o) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (o.title || "").toLowerCase().includes(q) ||
      (o.company || "").toLowerCase().includes(q) ||
      (o.location || "").toLowerCase().includes(q)
    );
  });

  const detectedPhoneOnForm = detectWhatsAppNumber({
    contact_phone: offerForm.contact_phone,
    description: offerForm.description,
    title: offerForm.title,
    company: offerForm.company,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-extrabold text-gray-700">Initialisation du Publieur d'Offres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-20 right-4 z-[700] bg-gray-950 text-white px-5 py-3 rounded-2xl shadow-2xl animate-fade-in-down flex items-center space-x-3 border border-gray-800">
          <i className={`fa-solid ${toast.icon} text-emerald-400 text-base`}></i>
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-black text-gray-900 tracking-tight hidden sm:inline">Facilite</span>
            </Link>
            <RoleBadge role={userRole} />
            <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              ⚡ Publieur IA
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs font-extrabold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
              title="Voir le fil d'actualité en direct"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              <span className="hidden sm:inline">Voir le Fil en direct</span>
            </Link>
            <Link
              href="/admin"
              className="text-xs font-extrabold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-left text-xs"></i>
              <span className="hidden md:inline">Dashboard Admin</span>
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-extrabold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition flex items-center space-x-1"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 flex-1 w-full flex flex-col space-y-8">
        
        {/* Titre & Sélecteur de Mode */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 bg-gradient-to-tr from-[#10E688] to-emerald-600 text-gray-950 rounded-2xl text-lg shadow-sm font-black">
                📢
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
                  Publieur d'Offres d'Emploi & Scanner IA
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  Glissez une affiche de recrutement : l'IA extrait tout automatiquement et prépare la publication en 1 clic.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
            <button
              type="button"
              onClick={() => setPublishMode("ai_scanner")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                publishMode === "ai_scanner"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-700 hover:text-gray-950"
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Scanner Affiche IA</span>
            </button>
            <button
              type="button"
              onClick={() => setPublishMode("manual")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                publishMode === "manual"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-700 hover:text-gray-950"
              }`}
            >
              <i className="fa-solid fa-pen-to-square"></i>
              <span>Saisie Manuelle</span>
            </button>
          </div>
        </div>

        {/* SECTION 1 : ZONE DE PUBLICATION (DRAG & DROP + IA + FORMULAIRE + LIVE PREVIEW) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Colonne Gauche : Formulaire & Zone de Scanner IA */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            
            {/* Zone Affiche : Sélecteur d'Onglets (Upload vs Générateur IA 1:1) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setImageTab("upload")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      imageTab === "upload"
                        ? "bg-white text-emerald-900 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <i className="fa-solid fa-cloud-arrow-up text-emerald-600"></i>
                    <span>Scanner / Déposer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageTab("ai_generate")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      imageTab === "ai_generate"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>
                    <span>Générateur IA (Format 1:1)</span>
                  </button>
                </div>

                {offerImagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveOfferImage}
                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Supprimer</span>
                  </button>
                )}
              </div>

              {/* Contenu selon l'onglet choisi */}
              {imageTab === "ai_generate" && !offerImagePreview && (
                <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-cyan-50/30 border border-emerald-200 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
                        <i className="fa-solid fa-paintbrush"></i>
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                          Studio Affiche IA • Format 1:1
                        </h4>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Créez un visuel carré haute fidélité prêt pour les réseaux sociaux.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSuggestPrompt}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-100/70 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Générer automatiquement un prompt avec les infos du formulaire"
                    >
                      <i className="fa-solid fa-lightbulb text-amber-500"></i>
                      <span>Suggérer prompt</span>
                    </button>
                  </div>

                  {/* Textarea du Prompt */}
                  <div>
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Décrivez l'affiche souhaitée (ex: Affiche de recrutement moderne et percutante pour Stagiaire Informaticien à Dakar, fond épuré, style corporate 1:1...)"
                      className="w-full p-3 bg-white border border-emerald-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition resize-none placeholder:text-gray-400"
                    />
                  </div>

                  {/* Suggestions rapides en 1 clic */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase mr-1">Raccourcis :</span>
                    {[
                      { label: "💻 Tech / Informatique", p: "Affiche de recrutement moderne Développeur & Informaticien, bureau high-tech avec ordinateurs, tons bleu et vert néon, format carré 1:1" },
                      { label: "🏢 Commercial / Vente", p: "Affiche corporate recrutement Commercial B2B dynamique à Dakar, poignée de main, cadre professionnel prestigieux, format 1:1" },
                      { label: "🏗️ BTP / Chantier", p: "Affiche professionnelle recrutement BTP & Chantier au Sénégal, ingénieurs et casques de sécurité, fond urbain moderne, format carré 1:1" },
                      { label: "🛵 Logistique / Livreur", p: "Affiche dynamique recrutement Agent Livreur et Coursier avec scooter moderne dans les rues de Dakar, format 1:1" },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiPrompt(item.p);
                          triggerToast(`Modèle "${item.label}" sélectionné`, "fa-wand-magic-sparkles");
                        }}
                        className="px-2 py-0.5 bg-white/90 hover:bg-emerald-100 text-gray-700 text-[10px] font-bold rounded-lg border border-emerald-200/80 transition cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Bouton de Lancement Génération */}
                  <button
                    type="button"
                    disabled={isGeneratingAiPoster}
                    onClick={() => handleGenerateAiPoster()}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white text-xs font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGeneratingAiPoster ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Génération du visuel 1:1 par l'IA...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wand-magic-sparkles text-amber-300 text-sm"></i>
                        <span>Générer l'Affiche 1:1 avec l'IA</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Mode Upload / Drag & Drop classique */}
              {imageTab === "upload" && !offerImagePreview && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileDropInputRef.current?.click()}
                  className="relative group border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <input
                    ref={fileDropInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900">
                      Glissez-déposez l'affiche ici, ou cliquez pour parcourir
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium mt-1">
                      Formats supportés : JPG, PNG, WEBP, PDF (l'IA analysera automatiquement le texte)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-emerald-800 text-[11px] font-extrabold rounded-full border border-emerald-200 shadow-2xs">
                    <i className="fa-solid fa-wand-magic-sparkles text-emerald-600"></i>
                    <span>Extraction automatique en 1 seconde</span>
                  </span>
                </div>
              )}

              {/* Aperçu de l'Affiche (qu'elle soit issue d'upload ou générée par IA) */}
              {offerImagePreview && (
                <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gray-950 flex flex-col items-center group">
                  <div className="relative w-full aspect-square max-h-[380px] flex items-center justify-center overflow-hidden bg-black/40">
                    <img
                      src={offerImagePreview}
                      alt="Affiche de recrutement"
                      className="w-full h-full object-cover transition group-hover:scale-[1.01]"
                    />
                    
                    {/* Badge Format 1:1 */}
                    <div className="absolute top-3 left-3 bg-black/80 text-white text-[10px] font-black px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10 flex items-center gap-1 shadow-md">
                      <i className="fa-solid fa-crop-simple text-[#10E688]"></i>
                      <span>Format 1:1</span>
                    </div>

                    {/* Animation Laser Scanner IA */}
                    {isScanningAI && (
                      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-white z-30">
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#10E688] to-transparent absolute top-0 animate-bounce"></div>
                        <div className="w-12 h-12 border-4 border-[#10E688] border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-xs font-black text-[#10E688] uppercase tracking-wider animate-pulse">
                          Extraction IA en cours...
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewImageModal({ isOpen: true, url: offerImagePreview || offerForm.image_url })}
                      className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <i className="fa-solid fa-magnifying-glass-plus"></i>
                      <span>Agrandir</span>
                    </button>
                  </div>

                  {/* Barre d'action sous l'image */}
                  <div className="w-full bg-gray-900 p-3 px-4 flex items-center justify-between border-t border-gray-800">
                    <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
                      <i className="fa-solid fa-check text-emerald-400"></i>
                      <span>Affiche attachée à la publication</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {imageTab === "ai_generate" && (
                        <button
                          type="button"
                          disabled={isGeneratingAiPoster}
                          onClick={() => handleGenerateAiPoster()}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles text-amber-300 text-[11px]"></i>
                          <span>Régénérer</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isScanningAI}
                        onClick={() => runAIScanner()}
                        className="px-3.5 py-1.5 bg-[#10E688] hover:bg-[#0fd57d] disabled:opacity-50 text-gray-950 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <i className="fa-solid fa-rotate text-[11px]"></i>
                        <span>Scanner le texte</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zone de description / texte accompagnant l'affiche (Optionnel mais ultra-pratique) */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-cyan-50/30 p-4 sm:p-5 rounded-3xl border border-emerald-200/90 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs shadow-xs">
                    <i className="fa-solid fa-file-pen"></i>
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Texte & Description d'accompagnement
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Facultatif : collez le texte accompagnant l'affiche (WhatsApp, LinkedIn, Email...).
                    </p>
                  </div>
                </div>

                <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
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
                placeholder="Ex: 🚨 RECRUTEMENT URGENT : Nous recherchons un Ingénieur / Juriste / Commercial à Dakar. Envoyez votre candidature à recrutement@exemple.com avant le 31 août..."
                className="w-full p-3.5 bg-white border border-emerald-200/80 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition resize-none placeholder:text-gray-400 shadow-2xs"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-200/60">
                <span className="text-[11px] text-gray-600 font-medium flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info text-emerald-600 text-xs"></i>
                  <span>
                    {offerImageFile && accompanyingText.trim()
                      ? "Affiche + Description détectées : l'IA fusionne et publie tout."
                      : offerImageFile
                      ? "Affiche prête : la description est facultative."
                      : accompanyingText.trim()
                      ? "Texte prêt : l'IA structurera tout le formulaire."
                      : "Glissez une image, écrivez une description (optionnelle), puis publiez !"}
                  </span>
                </span>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    disabled={isScanningAI || (!offerImageFile && !accompanyingText.trim())}
                    onClick={() => runAIScanner(offerImageFile, accompanyingText)}
                    className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Analyser l'affiche et la description, puis ranger chaque information dans son champ — à vérifier avant publication"
                  >
                    <i className={`fa-solid ${isScanningAI ? "fa-spinner fa-spin" : "fa-clipboard-check"} text-emerald-600`}></i>
                    <span>{isScanningAI ? "Examen en cours..." : "Examinateur"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingOffer || isScanningAI || !examenPasse || (!offerImageFile && !accompanyingText.trim() && !offerForm.title.trim())}
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
                <i
                  className={`fa-solid ${
                    scanSuccess ? "fa-circle-check text-emerald-600 text-base" : "fa-triangle-exclamation text-amber-600 text-base"
                  }`}
                ></i>
                <span>{scanMessage}</span>
              </div>
            )}

            {/* RÉSULTAT DE L'EXAMINATEUR (sous-point 1) — l'IA a rangé chaque
                information dans son champ, on l'affiche AVANT publication.
                Auparavant le seul retour était un toast « formulaire
                pré-rempli » : il fallait relire soi-même les 14 champs du
                formulaire pour savoir ce que l'IA avait compris. */}
            {(examenPasse || offerForm.title.trim()) && (
              <div className={`rounded-2xl border bg-white overflow-hidden ${examenPasse ? "border-emerald-200" : "border-amber-300"}`}>
                <div className={`px-4 py-3 border-b flex items-center gap-2 ${examenPasse ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  <i className={`fa-solid ${examenPasse ? "fa-clipboard-check text-emerald-600" : "fa-triangle-exclamation text-amber-600"}`}></i>
                  <span className={`text-xs font-black uppercase tracking-wide ${examenPasse ? "text-emerald-900" : "text-amber-900"}`}>
                    {examenPasse
                      ? "Résultat de l'Examinateur — à vérifier avant publication"
                      : "Revue obligatoire avant publication"}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {[
                    {
                      titre: "Poste",
                      champs: [
                        ["Titre", offerForm.title],
                        ["Entreprise / organisation", offerForm.company],
                        ["Lieu", offerForm.location],
                        ["Type de contrat", offerForm.contract_type],
                        ["Type de publication", offerForm.listing_type],
                        ["Rémunération", offerForm.salary_range],
                      ],
                    },
                    {
                      titre: "Conditions",
                      champs: [
                        ["Niveau d'études requis", offerForm.min_education_level],
                        ["Date limite", offerForm.deadline],
                      ],
                    },
                    {
                      titre: "Adresse de candidature (destination du bouton Postuler)",
                      champs: [
                        ["Lien de candidature", offerForm.application_url],
                        ["E-mail de candidature", offerForm.application_email],
                      ],
                    },
                    {
                      titre: "Contact & site (jamais utilisés comme destination)",
                      champs: [
                        ["E-mail de contact", offerForm.contact_email],
                        ["Téléphone / WhatsApp", offerForm.contact_phone],
                        ["Site officiel", offerForm.external_link],
                      ],
                    },
                  ].map((groupe) => (
                    <div key={groupe.titre}>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">{groupe.titre}</p>
                      <dl className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                        {groupe.champs.map(([libelle, valeur]) => (
                          <div key={libelle} className="grid grid-cols-3 gap-2 px-3 py-2 text-xs">
                            <dt className="font-bold text-gray-500 col-span-1">{libelle}</dt>
                            <dd className={`col-span-2 break-words ${valeur ? "font-semibold text-gray-900" : "italic text-gray-400"}`}>
                              {valeur || "non renseigné"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}

                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                      Informations complémentaires
                    </p>
                    <div className="border border-gray-100 rounded-xl px-3 py-2 text-xs break-words">
                      {offerForm.additional_info ? (
                        <TexteAvecLiens texte={offerForm.additional_info} className="text-gray-900" />
                      ) : (
                        <span className="italic text-gray-400">aucune</span>
                      )}
                    </div>
                  </div>

                  {/* Ce que fera RÉELLEMENT le bouton, calculé par la même
                      fonction que la fiche publique — pas une promesse. */}
                  {(() => {
                    const action = resolveOfferAction(offerForm);
                    const destination =
                      action.type === "email"
                        ? `e-mail : ${action.email}`
                        : action.type === "whatsapp"
                        ? `WhatsApp : ${action.url}`
                        : action.type === "external"
                        ? `lien : ${action.url}`
                        : "candidature interne Facilité (CV du candidat)";
                    return (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                        <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider">
                          Le bouton « {action.label} » enverra le candidat vers
                        </p>
                        <p className="text-xs font-bold text-blue-900 break-words mt-0.5">{destination}</p>
                      </div>
                    );
                  })()}

                  {examenPasse ? (
                    <p className="text-[11px] text-gray-500 font-medium">
                      Corrigez ce qui est faux dans le formulaire ci-dessous, puis publiez.
                    </p>
                  ) : (
                    // Chemin 100% manuel : l'Examinateur ne peut pas tourner
                    // (il analyse une affiche ou un texte, et il n'y en a
                    // pas). Sans cette porte de sortie, une offre saisie à la
                    // main serait impossible à publier. La revue reste
                    // obligatoire, elle est juste confirmée à la main.
                    <div className="space-y-2">
                      <p className="text-[11px] text-amber-800 font-bold">
                        La publication est verrouillée tant que ces informations n&apos;ont pas été revues. Lancez
                        l&apos;Examinateur sur l&apos;affiche ou la description, ou confirmez la revue ci-dessous.
                      </p>
                      <button
                        type="button"
                        onClick={() => setExamenPasse(true)}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-check"></i>
                        <span>J&apos;ai vérifié ces informations</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Formulaire des Informations de l'Offre */}
            <form onSubmit={handleSubmitOffer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Titre */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Titre du poste ou de l'offre *
                  </label>
                  <input
                    type="text"
                    required
                    value={offerForm.title}
                    onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: CASTING : FAMILLE HALPULAR (EVENPROD)"
                  />
                </div>

                {/* Entreprise */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Entreprise / Organisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={offerForm.company}
                    onChange={(e) => setOfferForm({ ...offerForm, company: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: EvenProd"
                  />
                </div>

                {/* Lieu */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Localisation</label>
                  <input
                    type="text"
                    value={offerForm.location}
                    onChange={(e) => setOfferForm({ ...offerForm, location: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: Dakar, Sénégal"
                  />
                </div>

                {/* Contrat */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Type de contrat</label>
                  <select
                    value={offerForm.contract_type}
                    onChange={(e) => setOfferForm({ ...offerForm, contract_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Casting / Tournage">Casting / Tournage</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Intérim">Intérim</option>
                    <option value="Bourse d'études">Bourse d'études</option>
                    <option value="Concours / Fonction Publique">Concours / Fonction Publique</option>
                    <option value="Plein Temps">Plein Temps</option>
                  </select>
                </div>

                {/* Type de publication (point 4) — auto-déterminé par le Scanner IA,
                    toujours modifiable manuellement ici avant publication. */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Type de publication</label>
                  <select
                    value={offerForm.listing_type}
                    onChange={(e) => setOfferForm({ ...offerForm, listing_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Date limite */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Date limite (optionnel)</label>
                  <input
                    type="date"
                    value={offerForm.deadline}
                    onChange={(e) => setOfferForm({ ...offerForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Téléphone / WhatsApp */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Téléphone / WhatsApp</span>
                    {detectedPhoneOnForm && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                        <i className="fa-brands fa-whatsapp mr-1"></i> WhatsApp Détecté
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={offerForm.contact_phone}
                    onChange={(e) => setOfferForm({ ...offerForm, contact_phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: +221 77 717 73 73"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">Email recruteur (optionnel)</label>
                  <input
                    type="email"
                    value={offerForm.contact_email}
                    onChange={(e) => setOfferForm({ ...offerForm, contact_email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: recrutement@evenprod.sn"
                  />
                </div>

                {/* Lien externe */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Lien externe officiel / WhatsApp URL (optionnel)
                  </label>
                  <input
                    type="url"
                    value={offerForm.external_link}
                    onChange={(e) => setOfferForm({ ...offerForm, external_link: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: https://wa.me/221777177373 ou https://mirador..."
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">Description de l'offre *</label>
                <textarea
                  rows={5}
                  required
                  value={offerForm.description}
                  onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-normal text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                  placeholder="Décrivez les missions, le profil recherché et les instructions de candidature..."
                ></textarea>
              </div>

              {/* Bouton de Publication 1-Clic */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOfferForm(EMPTY_OFFER);
                    setOfferImageFile(null);
                    setOfferImagePreview(null);
                    setAccompanyingText("");
                    setScanSuccess(false);
                    setScanMessage("");
                  }}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 transition"
                >
                  Réinitialiser
                </button>

                <button
                  type="submit"
                  disabled={savingOffer || isScanningAI || !examenPasse}
                  title={examenPasse ? "Publier sur le Fil d'Actualité" : "Passez d'abord par la revue (Examinateur)"}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#10E688] to-emerald-600 hover:from-[#0fd57d] hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-black text-sm rounded-2xl transition shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <i className={`fa-solid ${savingOffer ? "fa-spinner fa-spin" : examenPasse ? "fa-paper-plane" : "fa-lock"}`}></i>
                  <span>
                    {savingOffer
                      ? "Publication en cours..."
                      : examenPasse
                      ? "🚀 Publier sur le Fil d'Actualité"
                      : "Revue requise avant publication"}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Colonne Droite : Prévisualisation en Direct (Live Feed Preview) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fa-solid fa-eye text-emerald-600"></i>
                <span>Aperçu en Direct sur le Fil</span>
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">
                Rendu 1:1 Candidats
              </span>
            </div>

            {/* Carte Prévisualisée façon Feed */}
            <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-md space-y-3">
              {/* Header Post */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-extrabold text-xs shadow-2xs flex-shrink-0">
                  {offerForm.company ? offerForm.company.substring(0, 2).toUpperCase() : "CO"}
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">
                    {offerForm.company || "Nom de l'entreprise"}
                  </p>
                  <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                    <span>À l'instant</span>
                    <span>·</span>
                    <i className="fa-solid fa-earth-africa text-[9px]" title="Offre publique"></i>
                  </div>
                </div>
              </div>

              {/* Titre & Sous-titre */}
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-gray-900 leading-snug break-words">
                  {offerForm.title || "Titre de l'offre d'emploi"}
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{offerForm.location || "Sénégal"}</span>
                  <span>·</span>
                  <span>Opportunité</span>
                  <span>·</span>
                  <span>{offerForm.contract_type || "CDI"}</span>
                  {offerForm.deadline && (
                    <>
                      <span>·</span>
                      <span>Jusqu'au {offerForm.deadline}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Description */}
              <div className="text-xs text-gray-700 font-normal leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto custom-scrollbar">
                {offerForm.description || "La description détaillée de votre offre apparaîtra ici avec ses emojis et sa mise en page."}
              </div>

              {/* Affiche Visuelle */}
              {(offerImagePreview || offerForm.image_url) && (
                <div className="relative w-full rounded-2xl overflow-hidden bg-gray-950 border border-gray-200 flex items-center justify-center min-h-[180px] max-h-[300px]">
                  <img
                    src={offerImagePreview || offerForm.image_url}
                    alt="Aperçu"
                    className="w-full h-auto max-h-[300px] object-contain mx-auto block"
                  />
                  <OfferImageWatermark />
                </div>
              )}

              {/* Bouton d'action calculé par le moteur de contact */}
              <div className="pt-2">
                <SocialShareButtons
                  offer={{
                    id: "preview-id",
                    title: offerForm.title || "Offre d'emploi",
                    company: offerForm.company || "Entreprise",
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

        {/* SECTION 2 : TOUTES LES OFFRES EN BASE DE DONNÉES */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-950">
                Offres d'Emploi en Base de Données ({filteredOffers.length})
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Gérez, activez ou archivez les offres visibles par tous les candidats.
              </p>
            </div>

            {/* Barre de recherche locale */}
            <div className="relative w-full sm:w-72">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Rechercher une offre..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {filteredOffers.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic text-sm">
              Aucune offre d'emploi ne correspond à vos critères.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOffers.map((offer) => {
                const isActivelySponsored = isOfferActivelySponsored(offer);
                return (
                <div
                  key={offer.id}
                  className="py-4 sm:py-5 hover:bg-gray-50/80 rounded-2xl px-3 transition"
                >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    {offer.image_url ? (
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                        {offer.company ? offer.company.substring(0, 2).toUpperCase() : "CO"}
                      </div>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-black text-gray-900">{offer.title}</h3>
                        {!offer.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">
                            Désactivée
                          </span>
                        )}
                        {offer.status === "archived" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-200 text-gray-700">
                            Archivée
                          </span>
                        )}
                        {isActivelySponsored && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                            <i className="fa-solid fa-star text-[9px] mr-0.5"></i>
                            Sponsorisée jusqu'au {new Date(offer.sponsored_until).toLocaleDateString("fr-FR")} (priorité {offer.sponsor_priority})
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-600">
                        {offer.company} — <span className="text-emerald-700">{offer.contract_type || "CDI"}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>
                          <i className="fa-solid fa-location-dot mr-1"></i> {offer.location || "Sénégal"}
                        </span>
                        <span>•</span>
                        <span>
                          <i className="fa-regular fa-clock mr-1"></i> {new Date(offer.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                      onClick={() => handleToggleOfferActive(offer)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
                        offer.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                      }`}
                      title={offer.is_active ? "Masquer du fil" : "Rendre visible sur le fil"}
                    >
                      <i className={`fa-solid ${offer.is_active ? "fa-eye" : "fa-eye-slash"} text-xs`}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(offer.id)}
                      disabled={offer.status === "archived"}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 flex items-center justify-center transition disabled:opacity-40"
                      title="Archiver l'offre"
                    >
                      <i className="fa-regular fa-trash-can text-xs"></i>
                    </button>
                    {isActivelySponsored ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivateSponsorship(offer.id)}
                        disabled={savingSponsorship}
                        className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 flex items-center justify-center transition disabled:opacity-40"
                        title="Désactiver le sponsoring"
                      >
                        <i className="fa-solid fa-star text-xs"></i>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSponsoringOfferId(sponsoringOfferId === offer.id ? null : offer.id)}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-700 hover:text-amber-700 border border-gray-200 flex items-center justify-center transition"
                        title="Sponsoriser cette offre"
                      >
                        <i className="fa-regular fa-star text-xs"></i>
                      </button>
                    )}
                  </div>
                </div>

                  {sponsoringOfferId === offer.id && (
                    <div className="w-full flex flex-wrap items-end gap-3 bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 mt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Durée (jours)</label>
                        <input
                          type="number"
                          min="1"
                          value={sponsorDurationDays}
                          onChange={(e) => setSponsorDurationDays(e.target.value)}
                          className="w-24 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Priorité</label>
                        <input
                          type="number"
                          value={sponsorPriorityDraft}
                          onChange={(e) => setSponsorPriorityDraft(e.target.value)}
                          className="w-20 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleActivateSponsorship(offer.id)}
                        disabled={savingSponsorship}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-xl transition disabled:opacity-50 cursor-pointer"
                      >
                        {savingSponsorship ? "..." : "Activer le sponsoring"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSponsoringOfferId(null)}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 text-xs font-bold cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Agrandissement d'Image */}
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
    </div>
  );
}
