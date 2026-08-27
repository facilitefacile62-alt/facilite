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
  const [inputMode, setInputMode] = useState("photo"); // "photo" | "examinateur"
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
        triggerToast("Annonce examinée ! Chaque information a été classée à sa place.");
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
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Postulez en 1 seul clic
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
              L'Extracteur d'Annonces
            </h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              {posterId
                ? "Préparez votre candidature pour cette offre et envoyez votre CV en un clic."
                : "Importez la photo d'une offre d'emploi. Notre intelligence OCR extrait l'adresse e-mail du recruteur et vous permet d'envoyer votre CV instantanément."}
            </p>
          </div>
        </div>

        {/* Card Import & Extraction */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-6">
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
              {/* GRILLE DES 2 CASES : PHOTO & EXAMINATEUR DE TEXTE */}
              <div className="space-y-6">
                
                {/* CASE 1 : PHOTO DE L'ANNONCE D'EMPLOI */}
                <div className="p-5 bg-gray-50/60 hover:bg-emerald-50/20 border-2 border-gray-200 hover:border-emerald-300 rounded-3xl transition space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">📷</span>
                      <span>1. Photo de l'annonce d'emploi</span>
                    </label>
                    <span className="text-[10px] font-bold text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-200">
                      Format Image (PNG, JPG)
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
                    className="border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2.5 shadow-2xs"
                  >
                    {imagePreview ? (
                      <div className="relative group max-w-xs">
                        <img src={imagePreview} alt="Aperçu de l'annonce" className="max-h-56 rounded-xl shadow-md border border-gray-200" />
                        <span className="mt-2 block text-xs font-bold text-emerald-700">Changer la photo</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                          📷
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-black text-gray-900">Cliquez pour importer la photo de l'annonce</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, JPEG acceptés</p>
                        </div>
                      </>
                    )}
                  </div>

                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleExtractEmail}
                      disabled={isExtracting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
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
                  )}
                </div>

                {/* SÉPARATEUR VISUEL OU */}
                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-gray-200 w-full"></div>
                  <div className="bg-[#FAF6F1] px-4 text-[11px] font-black text-gray-500 uppercase tracking-widest absolute rounded-full border border-gray-200 shadow-2xs">
                    OU
                  </div>
                </div>

                {/* CASE 2 : EXAMINATEUR DE TEXTE D'ANNONCE (WHATSAPP / SMS / EMAIL) */}
                <div className="p-5 bg-gradient-to-b from-emerald-50/50 to-teal-50/20 border-2 border-emerald-300/80 hover:border-emerald-500 rounded-3xl transition space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">📝</span>
                      <span>2. Examinateur d'annonce (Texte brut)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                        WhatsApp / SMS / Mail
                      </span>
                      {rawOfferText && (
                        <button
                          type="button"
                          onClick={() => setRawOfferText("")}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 font-medium leading-relaxed">
                    Collez ici le texte brut d'une offre (reçu sur WhatsApp, SMS, LinkedIn ou e-mail). L'examinateur IA analyse l'offre et range automatiquement chaque information à sa place.
                  </p>

                  <div className="relative">
                    <textarea
                      rows={6}
                      value={rawOfferText}
                      onChange={(e) => setRawOfferText(e.target.value)}
                      placeholder={`Collez votre texte ici...\nExemple :\n"Urgent ! Entreprise à Dakar recrute un Comptable (CDI). Expérience 2 ans. Envoyez votre CV à rh@entreprise.sn ou par WhatsApp au 77 123 45 67 avant le 15 octobre."`}
                      disabled={isExtracting}
                      className="w-full p-4 bg-white border border-emerald-200 focus:border-emerald-500 rounded-2xl text-xs sm:text-sm font-medium text-gray-900 focus:outline-none transition leading-relaxed shadow-inner"
                    />
                    {rawOfferText && (
                      <div className="absolute bottom-3 right-3 text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
                        {rawOfferText.length} caractères
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExtractText}
                    disabled={isExtracting || !rawOfferText.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-700/20 transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Examen et classement de l'offre en cours...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wand-magic-sparkles text-emerald-200"></i>
                        <span>🔍 Examiner et classer l'annonce</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </>
          )}

          {/* Message si pas d'email/contacts détectés */}
          {extractionMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center space-x-2">
              <span>⚠️</span>
              <span>{extractionMessage}</span>
            </div>
          )}

          {/* Résultat Détecté : WhatsApp, Formulaire ou Email / Offre chargée */}
          {(extractedWhatsApp || extractedFormUrl || extractedEmail || posterOffer || extractedData) && (
            <div className="space-y-4 animate-fade-in">
              
              {/* 1. CANAL WHATSAPP */}
              {extractedWhatsApp && (
                <div className="p-5 bg-emerald-50 border-2 border-[#25D366]/40 rounded-2xl text-emerald-950 space-y-3.5 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 bg-[#25D366] text-white rounded-2xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                        <i className="fa-brands fa-whatsapp"></i>
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider block">
                          Candidature WhatsApp Détectée
                        </span>
                        <span className="text-base font-black text-gray-900 tracking-wide">
                          +{extractedWhatsApp}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-[#25D366]/20 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full flex-shrink-0">
                      WhatsApp 1-Click
                    </span>
                  </div>

                  {extractedData?.instructions && (
                    <div className="p-2.5 bg-white/90 rounded-xl text-xs font-semibold text-gray-700 border border-emerald-100 flex items-start gap-2">
                      <span className="text-emerald-700 font-black">📋 Consigne :</span>
                      <span>{extractedData.instructions}</span>
                    </div>
                  )}

                  <a
                    href={whatsappUrl || `https://wa.me/${extractedWhatsApp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer no-underline"
                  >
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                    <span>Envoyer ma candidature sur WhatsApp (+{extractedWhatsApp})</span>
                  </a>
                </div>
              )}

              {/* 2. CANAL LIEN DE FORMULAIRE */}
              {extractedFormUrl && (
                <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl text-blue-950 space-y-3.5 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-sm flex-shrink-0">
                        <i className="fa-solid fa-file-signature"></i>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider block">
                          Formulaire de Recrutement Détecté
                        </span>
                        <span className="text-xs font-bold text-gray-700 truncate max-w-[260px] block">
                          {extractedFormUrl}
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={extractedFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2.5 cursor-pointer no-underline"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>Remplir le formulaire de candidature officiel</span>
                  </a>
                </div>
              )}

              {/* 3. CANAL EMAIL : Encadré de détection E-mail */}
              {extractedEmail && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-lg shadow-sm">
                        ✉️
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider block">E-mail détecté par l'IA</span>
                        <span className="text-sm font-black text-emerald-900 font-mono">{extractedEmail}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Détails du Poste & Informations classées par l'Examinateur */}
              {extractedData && (extractedData.job_title || extractedData.company || extractedData.contract_type || extractedData.location || extractedData.salary || extractedData.deadline || extractedData.skills || extractedData.summary) && (
                <div className="p-5 bg-gray-50/90 border border-gray-200 rounded-2xl space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-clipboard-check text-emerald-600"></i>
                      <span>Informations classées par l'Examinateur</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Vérifié par IA
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-bold text-gray-900">
                    {extractedData.job_title && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Poste</span>
                        <span className="text-emerald-950 font-black text-xs">{extractedData.job_title}</span>
                      </div>
                    )}
                    {extractedData.company && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Entreprise / Recruteur</span>
                        <span className="text-gray-800">{extractedData.company}</span>
                      </div>
                    )}
                    {extractedData.location && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Lieu / Ville</span>
                        <span className="text-gray-800">{extractedData.location}</span>
                      </div>
                    )}
                    {extractedData.contract_type && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Type de contrat</span>
                        <span className="text-gray-800">{extractedData.contract_type}</span>
                      </div>
                    )}
                    {extractedData.salary && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Rémunération / Salaire</span>
                        <span className="text-emerald-700 font-black">{extractedData.salary}</span>
                      </div>
                    )}
                    {extractedData.deadline && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-extrabold block uppercase">Date limite</span>
                        <span className="text-rose-600 font-black">{extractedData.deadline}</span>
                      </div>
                    )}
                  </div>

                  {extractedData.skills && (
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs text-xs">
                      <span className="text-[10px] text-gray-400 font-extrabold block uppercase mb-1">Qualifications / Compétences requises</span>
                      <p className="text-gray-700 font-medium leading-relaxed">{extractedData.skills}</p>
                    </div>
                  )}

                  {extractedData.summary && (
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs text-xs">
                      <span className="text-[10px] text-gray-400 font-extrabold block uppercase mb-1">Résumé de l'annonce</span>
                      <p className="text-gray-700 font-medium leading-relaxed">{extractedData.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation de succès */}
              {sendSuccess ? (
                <div className="p-6 bg-emerald-600 text-white rounded-2xl text-center space-y-2 shadow-lg animate-bounce">
                  <div className="text-3xl">🎉</div>
                  <h3 className="text-lg font-black">Candidature transmise avec succès !</h3>
                  <p className="text-xs text-emerald-100 font-medium">
                    {posterOffer
                      ? `Votre candidature a été envoyée pour le poste de ${posterOffer.title}.`
                      : `Votre CV et votre demande ont été envoyés à ${extractedEmail}.`}
                  </p>
                </div>
              ) : (extractedEmail || posterOffer) ? (
                <div ref={applicationFormRef} className="space-y-4 pt-2 scroll-mt-24">
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    {extractedWhatsApp || extractedFormUrl ? "Option : Postuler aussi par E-mail" : "2. Vos informations de candidature"}
                  </label>

                  {/* Choix du CV */}
                  <div className="space-y-2.5">
                    {userResumes.length > 0 && (
                      <div className="flex gap-4 border-b border-gray-100 pb-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="cvChoice"
                            checked={cvChoice === "existing"}
                            onChange={() => setCvChoice("existing")}
                            className="accent-emerald-500"
                            disabled={isSending}
                          />
                          <span>CV déjà enregistré</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="cvChoice"
                            checked={cvChoice === "new"}
                            onChange={() => setCvChoice("new")}
                            className="accent-emerald-500"
                            disabled={isSending}
                          />
                          <span>Importer un nouveau CV</span>
                        </label>
                      </div>
                    )}

                    {cvChoice === "existing" && userResumes.length > 0 ? (
                      <select
                        value={selectedCvId}
                        onChange={(e) => setSelectedCvId(e.target.value)}
                        disabled={isSending}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                      >
                        {userResumes.map((cv) => (
                          <option key={cv.id} value={cv.id}>
                            {cv.title} ({new Date(cv.created_at).toLocaleDateString("fr-FR")})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        onClick={() => cvFileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/30 rounded-2xl p-5 text-center cursor-pointer transition"
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
                          <div className="space-y-1">
                            <i className="fa-solid fa-file-pdf text-2xl text-emerald-500"></i>
                            <p className="text-xs font-extrabold text-gray-800 truncate">{newCvFile.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">Cliquez pour remplacer</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <i className="fa-solid fa-cloud-arrow-up text-2xl text-gray-400"></i>
                            <p className="text-xs font-bold text-gray-700">Cliquez pour importer votre CV (PDF, DOCX)</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Objet de l'e-mail */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                      Objet de votre e-mail
                    </label>
                    <input
                      type="text"
                      value={applicationSubject}
                      onChange={(e) => setApplicationSubject(e.target.value)}
                      placeholder="Candidature au poste de..."
                      disabled={isSending}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {/* Message de motivation */}
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                      Message d'accompagnement
                    </label>
                    <textarea
                      rows={5}
                      value={applicationMessage}
                      onChange={(e) => setApplicationMessage(e.target.value)}
                      placeholder="Votre message au recruteur..."
                      disabled={isSending}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                    />
                  </div>

                  {sendErrorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center space-x-2">
                      <span>⚠️</span>
                      <span>{sendErrorMessage}</span>
                    </div>
                  )}

                  {/* Bouton d'envoi + alternative mailto */}
                  <button
                    type="button"
                    onClick={handleSendOneClickApplication}
                    disabled={isSending}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-base rounded-2xl shadow-xl transition cursor-pointer flex items-center justify-center space-x-2 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                  >
                    {isSending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Envoi direct en cours...</span>
                      </>
                    ) : posterOffer ? (
                      <span>🚀 Postuler en 1 clic</span>
                    ) : (
                      <>
                        <span>🚀 Postuler en 1 clic à</span>
                        <span className="font-mono text-emerald-200 underline">{extractedEmail}</span>
                      </>
                    )}
                  </button>

                  {extractedEmail && (
                    <a
                      href={mailtoHref}
                      className="block text-center text-[11px] font-bold text-gray-400 hover:text-emerald-700 transition underline"
                    >
                      Ou ouvrir dans votre messagerie (CV à joindre manuellement)
                    </a>
                  )}
                </div>
              ) : null}
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
