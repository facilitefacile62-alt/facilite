/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import AuthRequiredModal from "@/components/AuthRequiredModal";

// Filet de sécurité : si le serveur renvoie malgré tout une erreur brute
// (JSON stringifié d'un SDK, objet imbriqué...) plutôt qu'une phrase lisible,
// on ne l'affiche jamais telle quelle à l'utilisateur.
export const dynamic = "force-dynamic";

function toReadableErrorMessage(error, fallback = "Impossible d'analyser l'image pour le moment. Réessayez dans quelques instants.") {
  if (!error) return fallback;
  if (typeof error !== "string") return fallback;
  const looksLikeRawJson = error.trim().startsWith("{") || error.trim().startsWith("[");
  return looksLikeRawJson ? fallback : error;
}

export default function ExtracteurPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <ExtracteurContent />
    </Suspense>
  );
}

function ExtracteurContent() {
  const searchParams = useSearchParams();
  const posterId = searchParams.get("posterId");

  const [userSession, setUserSession] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [openInputMode, setOpenInputMode] = useState(null); // null | "photo" | "examinateur"
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [activeChannel, setActiveChannel] = useState("email"); // "email" | "whatsapp" | "form"
  const [rawOfferText, setRawOfferText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedEmail, setExtractedEmail] = useState(null);
  const [extractedWhatsApp, setExtractedWhatsApp] = useState(null);
  const [whatsappUrl, setWhatsappUrl] = useState(null);
  const [extractedFormUrl, setExtractedFormUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionMessage, setExtractionMessage] = useState(null);

  // --- Mode "offre existante" (?posterId=..., ex. depuis /recruteurs/[id]) :
  // saute entièrement l'étape OCR (il n'y a pas de photo à analyser, l'offre
  // existe déjà en base) et postule via /api/postuler (crée candidatures +
  // conversation) plutôt que /api/send-application (simple e-mail, ne
  // fonctionne que quand on a extrait une adresse d'une photo sans compte).
  const [posterOffer, setPosterOffer] = useState(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterError, setPosterError] = useState(null);
  const [candidateIdentity, setCandidateIdentity] = useState({ fullName: "", email: "" });

  // --- Formulaire de préparation de candidature (étape 2) ---
  const [userResumes, setUserResumes] = useState([]);
  const [cvChoice, setCvChoice] = useState("new"); // "existing" | "new"
  const [selectedCvId, setSelectedCvId] = useState("");
  const [newCvFile, setNewCvFile] = useState(null);
  const [applicationSubject, setApplicationSubject] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendErrorMessage, setSendErrorMessage] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });

  const fileInputRef = useRef(null);
  const cvFileInputRef = useRef(null);
  const applicationFormRef = useRef(null);

  const triggerToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 3500);
  };

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setUserSession(session);

      const [{ data: resumesList }, { data: profile }] = await Promise.all([
        supabase.from("resumes").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("full_name, contact_email").eq("id", session.user.id).single(),
      ]);

      setUserResumes(resumesList || []);
      if (resumesList && resumesList.length > 0) {
        setSelectedCvId(resumesList[0].id);
        setCvChoice("existing");
      }

      setCandidateIdentity({
        fullName: profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "",
        email: profile?.contact_email || session.user.email || "",
      });
    }
    checkAuth();
  }, []);

  // Mode "offre existante" : charge directement l'offre depuis job_offers
  // (lecture publique) plutôt que de demander une photo à analyser.
  useEffect(() => {
    if (!posterId) return;

    async function loadPosterOffer() {
      setPosterLoading(true);
      setPosterError(null);
      try {
        const { data, error } = await supabase
          .from("job_offers")
          .select("*")
          .eq("id", posterId)
          .single();

        if (error || !data) {
          setPosterError("Cette offre est introuvable ou n'est plus disponible.");
          return;
        }

        setPosterOffer(data);
      } catch (err) {
        console.error("Erreur chargement de l'offre:", err);
        setPosterError("Impossible de charger cette offre pour le moment.");
      } finally {
        setPosterLoading(false);
      }
    }

    loadPosterOffer();
  }, [posterId]);

  // Pré-remplit l'objet et le message dès que l'IA a identifié le poste (mode
  // photo) OU qu'une offre existante a été chargée (mode ?posterId=), et fait
  // défiler la page jusqu'au formulaire de candidature.
  useEffect(() => {
    if (!extractedEmail && !posterOffer) return;

    const title = posterOffer?.title || extractedData?.job_title || "ce poste";
    const company = posterOffer?.company || extractedData?.company || "";

    // Pré-remplissage initial d'un champ librement éditable ensuite par
    // l'utilisateur (pas une donnée dérivée à garder synchronisée) ; l'effet
    // gère aussi le scroll-into-view associé, qui doit rester ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplicationSubject(`Candidature au poste de ${title}${company ? ` - ${company}` : ""}`);
    setApplicationMessage(
      `Bonjour,\n\nSuite à votre offre pour le poste de ${title}${company ? ` chez ${company}` : ""}, je me permets de vous adresser ma candidature. Vous trouverez ci-joint mon CV détaillant mon parcours et mes compétences.\n\nJe reste à votre disposition pour un entretien à votre convenance.\n\nCordialement.`
    );

    const timer = setTimeout(() => {
      applicationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timer);
  }, [extractedEmail, extractedData, posterOffer]);

  const handleFileSelect = (e) => {
    if (!userSession?.user) {
      setAuthModalOpen(true);
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractedEmail(null);
    setExtractedWhatsApp(null);
    setWhatsappUrl(null);
    setExtractedFormUrl(null);
    setExtractedData(null);
    setExtractionMessage(null);
    setSendSuccess(false);
    setSendErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewCvFile(file);
  };

  const handleExtractEmail = async () => {
    if (!userSession?.user) {
      setAuthModalOpen(true);
      return;
    }
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractedEmail(null);
    setExtractedWhatsApp(null);
    setWhatsappUrl(null);
    setExtractedFormUrl(null);
    setExtractedData(null);
    setExtractionMessage(null);
    setSendSuccess(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/extract-email", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();

      if (data.success && (data.email || data.whatsapp || data.phone || data.apply_url || data.form_url)) {
        if (data.email) setExtractedEmail(data.email);
        if (data.whatsapp || data.phone) {
          setExtractedWhatsApp(data.whatsapp || data.phone);
          setWhatsappUrl(data.whatsapp_url);
        }
        if (data.apply_url || data.form_url) {
          setExtractedFormUrl(data.apply_url || data.form_url);
        }
        setExtractedData(data);
        if (data.email) {
          setActiveChannel("email"); // Toujours E-mail en 1ère position !
        } else if (data.whatsapp || data.phone) {
          setActiveChannel("whatsapp");
        } else if (data.apply_url || data.form_url) {
          setActiveChannel("form");
        }
        setOpenInputMode(null); // Se range automatiquement après analyse !
      } else {
        setExtractionMessage(toReadableErrorMessage(data.error) || "Aucun moyen de contact (WhatsApp, email ou formulaire) détecté sur cette affiche.");
      }
    } catch (err) {
      console.error("Erreur d'extraction Gemini:", err);
      setExtractionMessage(
        err.name === "AbortError"
          ? "L'analyse Gemini a pris trop de temps. Réessayez avec une photo mieux cadrée."
          : "Erreur lors de la lecture de l'image."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  };

  const handleExtractText = async () => {
    if (!userSession?.user) {
      setAuthModalOpen(true);
      return;
    }
    if (!rawOfferText || !rawOfferText.trim()) {
      triggerToast("Veuillez d'abord coller le texte de l'annonce à examiner.");
      return;
    }

    setIsExtracting(true);
    setExtractedEmail(null);
    setExtractedWhatsApp(null);
    setWhatsappUrl(null);
    setExtractedFormUrl(null);
    setExtractedData(null);
    setExtractionMessage(null);
    setSendSuccess(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/extract-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: rawOfferText.trim() }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (data.success && (data.email || data.whatsapp || data.phone || data.apply_url || data.form_url || data.job_title)) {
        if (data.email) setExtractedEmail(data.email);
        if (data.whatsapp || data.phone) {
          setExtractedWhatsApp(data.whatsapp || data.phone);
          setWhatsappUrl(data.whatsapp_url);
        }
        if (data.apply_url || data.form_url) {
          setExtractedFormUrl(data.apply_url || data.form_url);
        }
        setExtractedData(data);
        if (data.email) {
          setActiveChannel("email"); // Toujours E-mail en 1ère position !
        } else if (data.whatsapp || data.phone) {
          setActiveChannel("whatsapp");
        } else if (data.apply_url || data.form_url) {
          setActiveChannel("form");
        }
        setOpenInputMode(null); // Se range automatiquement après examen !
        triggerToast("Annonce examinée ! Résultats classés ci-dessous.");
      } else {
        setExtractionMessage(toReadableErrorMessage(data.error) || "L'examinateur n'a trouvé aucune coordonnée ni information exploitable dans ce texte.");
      }
    } catch (err) {
      console.error("Erreur d'examen du texte:", err);
      setExtractionMessage(
        err.name === "AbortError"
          ? "L'examen a pris trop de temps. Veuillez réessayer."
          : "Erreur lors de l'examen du texte de l'annonce."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  };

  const handleResetForNewOffer = () => {
    setExtractedEmail(null);
    setExtractedWhatsApp(null);
    setWhatsappUrl(null);
    setExtractedFormUrl(null);
    setExtractedData(null);
    setSelectedFile(null);
    setImagePreview(null);
    setRawOfferText("");
    setExtractionMessage(null);
    setSendSuccess(false);
    setOpenInputMode(null);
  };

  const handleSendOneClickApplication = async () => {
    if ((!extractedEmail && !posterOffer) || !userSession?.user?.id) return;

    if (cvChoice === "existing" && !selectedCvId) {
      setSendErrorMessage("Sélectionnez un CV existant ou importez-en un nouveau.");
      return;
    }
    if (cvChoice === "new" && !newCvFile) {
      setSendErrorMessage("Importez un fichier de CV avant d'envoyer votre candidature.");
      return;
    }

    setIsSending(true);
    setSendErrorMessage(null);
    try {
      let res;

      if (posterOffer) {
        // Mode "offre existante" : /api/postuler crée une vraie candidature
        // (table candidatures) et la conversation associée avec le
        // recruteur — /api/send-application (simple e-mail Resend) n'aurait
        // laissé aucune trace exploitable côté recruteur sur la plateforme.
        if (!candidateIdentity.fullName.trim() || !candidateIdentity.email.trim()) {
          setSendErrorMessage("Complétez votre nom et votre e-mail dans votre profil avant de postuler.");
          setIsSending(false);
          return;
        }

        const formData = new FormData();
        formData.append("jobId", posterOffer.id);
        formData.append("jobTitle", posterOffer.title);
        formData.append("company", posterOffer.company);
        formData.append("fullName", candidateIdentity.fullName);
        formData.append("email", candidateIdentity.email);
        formData.append("coverLetter", applicationMessage);
        if (cvChoice === "existing") {
          formData.append("existingCvId", selectedCvId);
        } else {
          formData.append("cvFile", newCvFile);
        }

        res = await fetch("/api/postuler", {
          method: "POST",
          headers: { Authorization: `Bearer ${userSession.access_token}` },
          body: formData,
        });
      } else {
        const formData = new FormData();
        formData.append("recipientEmail", extractedEmail);
        formData.append("subject", applicationSubject);
        formData.append("message", applicationMessage);
        if (cvChoice === "existing") {
          formData.append("existingCvId", selectedCvId);
        } else {
          formData.append("cvFile", newCvFile);
        }

        res = await fetch("/api/send-application", {
          method: "POST",
          headers: { Authorization: `Bearer ${userSession.access_token}` },
          body: formData,
        });
      }

      const data = await res.json();

      if (res.ok && data.success) {
        setSendSuccess(true);
        triggerToast("Votre candidature a été préparée avec succès !");
      } else {
        setSendErrorMessage(toReadableErrorMessage(data.error, "Impossible d'envoyer la candidature pour le moment."));
      }
    } catch (err) {
      console.error("Erreur d'envoi:", err);
      setSendErrorMessage("Une erreur s'est produite lors de l'envoi.");
    } finally {
      setIsSending(false);
    }
  };

  // Alternative rapide : ouvre le client mail par défaut du candidat avec le
  // sujet et le message déjà remplis (le CV n'étant pas joignable via
  // mailto:, le candidat doit l'attacher manuellement dans ce cas).
  const mailtoHref = extractedEmail
    ? `mailto:${extractedEmail}?subject=${encodeURIComponent(applicationSubject)}&body=${encodeURIComponent(applicationMessage)}`
    : "#";

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Toast */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast.message}</span>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex-1 w-full">
        {/* Bouton Retour aux Fonctionnalités */}
        <div className="mb-4">
          <Link
            href="/fonctionnalites"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 font-extrabold text-xs rounded-xl shadow-xs border border-gray-200 transition-all hover:-translate-x-0.5"
          >
            <i className="fa-solid fa-arrow-left text-xs text-emerald-600"></i>
            <span>Retour aux fonctionnalités</span>
          </Link>
        </div>

        {/* Banner Section */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-4 sm:p-5 text-white mb-4 shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-widest block mb-1">
              Postulez en 1 seul clic
            </span>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-1.5">
              L'Extracteur d'Annonces
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
              {posterId
                ? "Préparez votre candidature pour cette offre et envoyez votre CV en un clic."
                : "Importez la photo d'une annonce ou collez le texte d'une offre (WhatsApp, mail). Notre IA classe les infos et prépare votre candidature instantanément."}
            </p>
          </div>
        </div>

        {/* Card Import & Extraction */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 sm:p-5 space-y-4">
          {posterId ? (
            // Mode "offre existante" : pas de photo à analyser, l'offre est
            // déjà en base — juste un état de chargement / erreur / résumé.
            <div>
              <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2">
                Offre sélectionnée
              </label>
              {posterLoading ? (
                <div className="flex items-center justify-center gap-3 p-8 bg-gray-50 rounded-2xl text-gray-500 text-sm font-bold">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  Chargement de l'offre...
                </div>
              ) : posterError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{posterError}</span>
                </div>
              ) : posterOffer ? (
                <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  {posterOffer.image_url ? (
                    <img src={posterOffer.image_url} alt={posterOffer.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-emerald-100" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-emerald-100 text-emerald-500 flex items-center justify-center text-2xl flex-shrink-0">
                      <i className="fa-solid fa-briefcase"></i>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-950 truncate">{posterOffer.title}</p>
                    <p className="text-xs text-emerald-700 font-bold truncate">{posterOffer.company}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* 1. ÉCRAN DE CHOIX INITIAL : 2 CASES CÔTE À CÔTE (SEULEMENT SI PAS ENCORE DE RÉSULTAT ANALYSÉ) */}
              {openInputMode === null && !(extractedWhatsApp || extractedFormUrl || extractedEmail || extractedData || posterOffer) && (
                <div className="space-y-2 animate-fade-in">
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    Choisissez votre méthode d'importation :
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                    
                    {/* CHOIX 1 : PHOTO DE L'ANNONCE */}
                    <button
                      type="button"
                      onClick={() => setOpenInputMode("photo")}
                      className="p-3.5 sm:p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 bg-gradient-to-b from-white to-emerald-50/30 hover:bg-emerald-50 text-left transition cursor-pointer flex flex-col justify-between space-y-3 group shadow-2xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition">
                          📷
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Image
                        </span>
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-gray-900 block">
                          1. Photo d'annonce
                        </span>
                        <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium mt-0.5 leading-snug">
                          Importer une capture d'écran, JPEG ou PNG
                        </p>
                      </div>
                      <div className="pt-2 border-t border-emerald-100 flex items-center justify-between w-full text-xs font-black text-emerald-700 group-hover:text-emerald-800">
                        <span>Choisir</span>
                        <i className="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                      </div>
                    </button>

                    {/* CHOIX 2 : EXAMINATEUR TEXTE BRUT */}
                    <button
                      type="button"
                      onClick={() => setOpenInputMode("examinateur")}
                      className="p-3.5 sm:p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 bg-gradient-to-b from-white to-emerald-50/30 hover:bg-emerald-50 text-left transition cursor-pointer flex flex-col justify-between space-y-3 group shadow-2xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-sm group-hover:scale-105 transition">
                          📝
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Texte
                        </span>
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-gray-900 block">
                          2. Examinateur
                        </span>
                        <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium mt-0.5 leading-snug">
                          Coller un texte reçu (WhatsApp, SMS, Mail)
                        </p>
                      </div>
                      <div className="pt-2 border-t border-emerald-100 flex items-center justify-between w-full text-xs font-black text-emerald-700 group-hover:text-emerald-800">
                        <span>Choisir</span>
                        <i className="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                      </div>
                    </button>

                  </div>
                </div>
              )}

              {/* 2. MODE PHOTO DÉDIÉ (SEUL SUR SA PAGE) */}
              {openInputMode === "photo" && (
                <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-emerald-50/20 border-2 border-emerald-500 rounded-2xl space-y-3.5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => setOpenInputMode(null)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrow-left text-[10px]"></i>
                      <span>Changer de mode</span>
                    </button>
                    <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <span>📷</span>
                      <span>Photo de l'annonce</span>
                    </span>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] shadow-inner"
                  >
                    {imagePreview ? (
                      <div className="relative group max-w-[160px]">
                        <img src={imagePreview} alt="Aperçu" className="max-h-32 rounded-xl shadow-xs border border-gray-200 mx-auto" />
                        <span className="mt-2 block text-xs font-bold text-emerald-700">Changer la photo</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="w-10 h-10 mx-auto bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center text-lg">
                          📷
                        </div>
                        <p className="text-xs sm:text-sm font-black text-gray-800">Cliquez pour importer la photo de l'annonce</p>
                        <p className="text-[11px] text-gray-400">PNG, JPG, JPEG acceptés</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExtractEmail}
                    disabled={isExtracting || !selectedFile}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyse de la photo en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>🔍 Analyser la photo de l'annonce</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 3. MODE EXAMINATEUR DE TEXTE DÉDIÉ (SEUL SUR SA PAGE) */}
              {openInputMode === "examinateur" && (
                <div className="p-4 sm:p-5 bg-gradient-to-b from-white to-emerald-50/30 border-2 border-emerald-500 rounded-2xl space-y-3.5 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <button
                      type="button"
                      onClick={() => setOpenInputMode(null)}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-arrow-left text-[10px]"></i>
                      <span>Changer de mode</span>
                    </button>
                    <div className="flex items-center gap-2">
                      {rawOfferText && (
                        <button
                          type="button"
                          onClick={() => setRawOfferText("")}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Effacer
                        </button>
                      )}
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <span>📝</span>
                        <span>Examinateur de texte</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 font-medium">
                    Collez le texte brut de l'offre (reçu sur WhatsApp, SMS ou e-mail) :
                  </p>

                  <textarea
                    rows={5}
                    value={rawOfferText}
                    onChange={(e) => setRawOfferText(e.target.value)}
                    placeholder={`Exemple :\n"Urgent ! Entreprise à Dakar recrute un Comptable (CDI). Expérience 2 ans. Envoyez votre CV à rh@entreprise.sn ou par WhatsApp au 77 123 45 67 avant le 15 octobre."`}
                    disabled={isExtracting}
                    className="w-full p-3 bg-white border border-emerald-200 focus:border-emerald-500 rounded-xl text-xs sm:text-sm font-medium text-gray-900 focus:outline-none transition leading-relaxed shadow-inner"
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={handleExtractText}
                    disabled={isExtracting || !rawOfferText.trim()}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Examen et classement de l'offre en cours...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wand-magic-sparkles text-emerald-200 text-xs"></i>
                        <span>🔍 Examiner et classer l'annonce</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Message si pas d'email/contacts détectés */}
          {extractionMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center space-x-2">
              <span>⚠️</span>
              <span>{extractionMessage}</span>
            </div>
          )}

          {/* Résultat Détecté : Fiche épurée, Menu déroulant des détails & Choix du canal */}
          {(extractedWhatsApp || extractedFormUrl || extractedEmail || posterOffer || extractedData) && (
            <div className="space-y-3.5 pt-2 border-t border-gray-100 animate-fade-in">
              
              {/* 1. EN-TÊTE ÉPURÉ DE L'OFFRE EXAMINÉE */}
              <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                    Offre analysée
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-emerald-950 truncate">
                    {posterOffer?.title || extractedData?.job_title || "Poste détecté"}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-700 truncate">
                    {posterOffer?.company || extractedData?.company || "Entreprise / Recruteur"} 
                    {(extractedData?.location || posterOffer?.location) && ` • ${extractedData?.location || posterOffer?.location}`}
                    {(extractedData?.contract_type || posterOffer?.contract_type) && ` • ${extractedData?.contract_type || posterOffer?.contract_type}`}
                  </p>
                </div>

                {/* BOUTONS D'ACTION : NOUVELLE ANNONCE & MENU DÉROULANT DES DÉTAILS */}
                <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                  <button
                    type="button"
                    onClick={handleResetForNewOffer}
                    className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-extrabold text-[11px] rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                    title="Examiner ou importer une autre annonce"
                  >
                    <i className="fa-solid fa-rotate-left text-emerald-600"></i>
                    <span>Nouvelle annonce</span>
                  </button>

                  {(extractedData?.skills || extractedData?.summary || extractedData?.salary || extractedData?.deadline) && (
                    <button
                      type="button"
                      onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-extrabold text-[11px] rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                    >
                      <i className="fa-solid fa-list-check text-emerald-600"></i>
                      <span>{showDetailsDropdown ? "Masquer les détails" : "📋 Détails & Critères (menu déroulant)"}</span>
                      <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${showDetailsDropdown ? "rotate-180" : ""}`}></i>
                    </button>
                  )}
                </div>
              </div>

              {/* MENU DÉROULANT : DÉTAILS DU POSTE (ne s'ouvre qu'au clic) */}
              {showDetailsDropdown && extractedData && (
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2.5 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extractedData.salary && (
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Rémunération / Salaire</span>
                        <span className="text-emerald-800 font-black">{extractedData.salary}</span>
                      </div>
                    )}
                    {extractedData.deadline && (
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Date limite</span>
                        <span className="text-rose-600 font-black">{extractedData.deadline}</span>
                      </div>
                    )}
                  </div>

                  {extractedData.skills && (
                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-400 font-extrabold block uppercase mb-0.5">Qualifications requises</span>
                      <p className="text-gray-700 font-medium leading-relaxed text-[11px]">{extractedData.skills}</p>
                    </div>
                  )}

                  {extractedData.summary && (
                    <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-400 font-extrabold block uppercase mb-0.5">Résumé de l'offre</span>
                      <p className="text-gray-700 font-medium leading-relaxed text-[11px]">{extractedData.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* SÉLECTEUR DE CANAL AVEC E-MAIL EN 1ÈRE POSITION */}
              {((extractedWhatsApp && extractedEmail) || extractedFormUrl) && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider">
                    Choisissez votre canal pour postuler :
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1 border border-gray-200">
                    {extractedEmail && (
                      <button
                        type="button"
                        onClick={() => setActiveChannel("email")}
                        className={`flex-1 py-2 px-2.5 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          activeChannel === "email"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <i className="fa-solid fa-envelope text-xs"></i>
                        <span>Par E-mail</span>
                      </button>
                    )}
                    {extractedWhatsApp && (
                      <button
                        type="button"
                        onClick={() => setActiveChannel("whatsapp")}
                        className={`flex-1 py-2 px-2.5 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          activeChannel === "whatsapp"
                            ? "bg-[#25D366] text-white shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <i className="fa-brands fa-whatsapp text-sm"></i>
                        <span>Par WhatsApp</span>
                      </button>
                    )}
                    {extractedFormUrl && (
                      <button
                        type="button"
                        onClick={() => setActiveChannel("form")}
                        className={`flex-1 py-2 px-2.5 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          activeChannel === "form"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <i className="fa-solid fa-link text-xs"></i>
                        <span>Formulaire</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 1. CANAL EMAIL : FORMULAIRE ÉPURÉ CONTENANT UNIQUEMENT L'ESSENTIEL */}
              {sendSuccess ? (
                <div className="p-5 bg-emerald-600 text-white rounded-2xl text-center space-y-1.5 shadow-md animate-bounce">
                  <div className="text-2xl">🎉</div>
                  <h3 className="text-sm font-black">Candidature transmise avec succès !</h3>
                  <p className="text-xs text-emerald-100 font-medium">
                    {posterOffer
                      ? `Votre candidature a été envoyée pour le poste de ${posterOffer.title}.`
                      : `Votre CV et votre demande ont été envoyés à ${extractedEmail}.`}
                  </p>
                </div>
              ) : (extractedEmail || posterOffer) && (activeChannel === "email" || (!extractedWhatsApp && !extractedFormUrl) || posterOffer) ? (
                <div ref={applicationFormRef} className="space-y-3 p-4 bg-gray-50/80 border border-gray-200 rounded-2xl animate-fade-in">
                  
                  {/* DESTINATAIRE / ADRESSE EMAIL */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider mb-1">
                      À qui envoyer (Adresse e-mail du recruteur)
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl">
                      <span className="text-emerald-600 text-xs">✉️</span>
                      <span className="font-mono text-xs font-black text-gray-900">{extractedEmail || posterOffer?.contact_email || "Recruteur"}</span>
                    </div>
                  </div>

                  {/* OBJET DU MAIL */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider mb-1">
                      Objet de l'e-mail
                    </label>
                    <input
                      type="text"
                      value={applicationSubject}
                      onChange={(e) => setApplicationSubject(e.target.value)}
                      placeholder="Candidature au poste de..."
                      disabled={isSending}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* MON CV & LETTRE (MENU DÉROULANT / FICHIER) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider">
                        Mon CV & Lettre
                      </label>
                      {userResumes.length > 0 && (
                        <div className="flex gap-2.5 text-[10px] font-bold text-gray-600">
                          <label className="cursor-pointer flex items-center gap-1">
                            <input
                              type="radio"
                              name="cvChoice"
                              checked={cvChoice === "existing"}
                              onChange={() => setCvChoice("existing")}
                              className="accent-emerald-500"
                              disabled={isSending}
                            />
                            <span>CV enregistré</span>
                          </label>
                          <label className="cursor-pointer flex items-center gap-1">
                            <input
                              type="radio"
                              name="cvChoice"
                              checked={cvChoice === "new"}
                              onChange={() => setCvChoice("new")}
                              className="accent-emerald-500"
                              disabled={isSending}
                            />
                            <span>Nouveau fichier</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {cvChoice === "existing" && userResumes.length > 0 ? (
                      <select
                        value={selectedCvId}
                        onChange={(e) => setSelectedCvId(e.target.value)}
                        disabled={isSending}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-extrabold text-gray-800 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                      >
                        {userResumes.map((cv) => (
                          <option key={cv.id} value={cv.id}>
                            📄 {cv.title} ({new Date(cv.created_at).toLocaleDateString("fr-FR")})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        onClick={() => cvFileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white rounded-xl p-2.5 text-center cursor-pointer transition"
                      >
                        <input
                          type="file"
                          ref={cvFileInputRef}
                          accept=".pdf,.doc,.docx"
                          onChange={handleCvFileSelect}
                          className="hidden"
                          disabled={isSending}
                        />
                        {newCvFile ? (
                          <p className="text-xs font-extrabold text-emerald-800">📄 {newCvFile.name}</p>
                        ) : (
                          <p className="text-xs font-bold text-gray-700">Cliquez pour importer votre CV (PDF, DOCX)</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* MESSAGE D'ACCOMPAGNEMENT */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-wider mb-1">
                      Message d'accompagnement
                    </label>
                    <textarea
                      rows={3}
                      value={applicationMessage}
                      onChange={(e) => setApplicationMessage(e.target.value)}
                      placeholder="Votre message au recruteur..."
                      disabled={isSending}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                    />
                  </div>

                  {sendErrorMessage && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center space-x-2">
                      <span>⚠️</span>
                      <span>{sendErrorMessage}</span>
                    </div>
                  )}

                  {/* BOUTON POSTULER EN 1 CLIC */}
                  <button
                    type="button"
                    onClick={handleSendOneClickApplication}
                    disabled={isSending}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-60"
                  >
                    {isSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Envoi direct en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 Postuler en 1 clic</span>
                        {extractedEmail && <span className="font-mono text-xs opacity-90">({extractedEmail})</span>}
                      </>
                    )}
                  </button>

                  {extractedEmail && (
                    <a
                      href={mailtoHref}
                      className="block text-center text-[10px] font-bold text-gray-400 hover:text-emerald-700 transition underline"
                    >
                      Ou ouvrir dans votre application e-mail
                    </a>
                  )}
                </div>
              ) : null}

              {/* 2. CANAL WHATSAPP */}
              {extractedWhatsApp && (activeChannel === "whatsapp" || (!extractedEmail && !extractedFormUrl)) && (
                <div className="p-4 bg-emerald-50/80 border-2 border-[#25D366]/40 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 bg-[#25D366] text-white rounded-xl flex items-center justify-center text-xl shadow-xs">
                        <i className="fa-brands fa-whatsapp"></i>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                          Numéro WhatsApp du Recruteur
                        </span>
                        <span className="text-sm font-black text-gray-900 tracking-wide">
                          +{extractedWhatsApp}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#25D366]/20 text-emerald-900 text-[10px] font-black uppercase rounded-full">
                      Direct
                    </span>
                  </div>

                  {extractedData?.instructions && (
                    <p className="text-[11px] font-medium text-gray-700 bg-white p-2 rounded-lg border border-emerald-100">
                      <strong className="text-emerald-800">Consigne :</strong> {extractedData.instructions}
                    </p>
                  )}

                  <a
                    href={whatsappUrl || `https://wa.me/${extractedWhatsApp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer no-underline"
                  >
                    <i className="fa-brands fa-whatsapp text-base"></i>
                    <span>Envoyer ma candidature sur WhatsApp (+{extractedWhatsApp})</span>
                  </a>
                </div>
              )}

              {/* 3. CANAL FORMULAIRE */}
              {extractedFormUrl && (activeChannel === "form" || (!extractedWhatsApp && !extractedEmail)) && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center text-base shadow-xs">
                      <i className="fa-solid fa-file-signature"></i>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">
                        Formulaire de Recrutement
                      </span>
                      <span className="text-xs font-bold text-gray-700 truncate block max-w-[280px]">
                        {extractedFormUrl}
                      </span>
                    </div>
                  </div>

                  <a
                    href={extractedFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer no-underline"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>Ouvrir le formulaire de candidature officiel</span>
                  </a>
                </div>
              )}


            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite - L'Extracteur de Candidature Instantané.
      </footer>

      {/* Modale d'inscription requise pour les visiteurs */}
      <AuthRequiredModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        featureName="l'extracteur d'affiche de recrutement"
        featureIcon="fa-solid fa-wand-magic-sparkles"
        redirectUrl="/candidat/extracteur"
      />
    </div>
  );
}
