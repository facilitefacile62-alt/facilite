/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

// Filet de sécurité : si le serveur renvoie malgré tout une erreur brute
// (JSON stringifié d'un SDK, objet imbriqué...) plutôt qu'une phrase lisible,
// on ne l'affiche jamais telle quelle à l'utilisateur.
function toReadableErrorMessage(error, fallback = "Impossible d'analyser l'image pour le moment. Réessayez dans quelques instants.") {
  if (!error) return fallback;
  if (typeof error !== "string") return fallback;
  const looksLikeRawJson = error.trim().startsWith("{") || error.trim().startsWith("[");
  return looksLikeRawJson ? fallback : error;
}

export default function ExtracteurPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedEmail, setExtractedEmail] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionMessage, setExtractionMessage] = useState(null);

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

      const { data: resumesList } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setUserResumes(resumesList || []);
      if (resumesList && resumesList.length > 0) {
        setSelectedCvId(resumesList[0].id);
        setCvChoice("existing");
      }
    }
    checkAuth();
  }, []);

  // Pré-remplit l'objet et le message dès que l'IA a identifié le poste,
  // et fait défiler la page jusqu'au formulaire de candidature.
  useEffect(() => {
    if (!extractedEmail) return;

    const title = extractedData?.job_title || "ce poste";
    const company = extractedData?.company || "";

    setApplicationSubject(`Candidature au poste de ${title}${company ? ` - ${company}` : ""}`);
    setApplicationMessage(
      `Bonjour,\n\nSuite à votre offre pour le poste de ${title}${company ? ` chez ${company}` : ""}, je me permets de vous adresser ma candidature. Vous trouverez ci-joint mon CV détaillant mon parcours et mes compétences.\n\nJe reste à votre disposition pour un entretien à votre convenance.\n\nCordialement.`
    );

    const timer = setTimeout(() => {
      applicationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timer);
  }, [extractedEmail, extractedData]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractedEmail(null);
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
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractedEmail(null);
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

      if (data.success && data.email) {
        setExtractedEmail(data.email);
        setExtractedData(data);
      } else {
        setExtractionMessage(toReadableErrorMessage(data.error) || "Aucune adresse e-mail détectée sur cette affiche.");
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

  const handleSendOneClickApplication = async () => {
    if (!extractedEmail || !userSession?.user?.id) return;

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
      const formData = new FormData();
      formData.append("recipientEmail", extractedEmail);
      formData.append("subject", applicationSubject);
      formData.append("message", applicationMessage);
      if (cvChoice === "existing") {
        formData.append("existingCvId", selectedCvId);
      } else {
        formData.append("cvFile", newCvFile);
      }

      const res = await fetch("/api/send-application", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userSession.access_token}`,
        },
        body: formData,
      });

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

      {/* Header Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
              ⚡ L'Extracteur 1-Click
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 relative"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
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
              Importez la photo d'une offre d'emploi. Notre intelligence OCR extrait l'adresse e-mail du recruteur et vous permet d'envoyer votre CV instantanément.
            </p>
          </div>
        </div>

        {/* Card Import & Extraction */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8 space-y-6">
          {/* Zone d'importation */}
          <div>
            <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2">
              1. Photo de l'annonce d'emploi
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
            >
              {imagePreview ? (
                <div className="relative group max-w-xs">
                  <img src={imagePreview} alt="Aperçu de l'annonce" className="max-h-60 rounded-xl shadow-md border border-gray-200" />
                  <span className="mt-2 block text-xs font-bold text-emerald-700">Changer la photo</span>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                    📷
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">Cliquez pour importer la photo de l'annonce</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG acceptés</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bouton d'Extraction */}
          {selectedFile && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExtractEmail}
                disabled={isExtracting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isExtracting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyse de la photo en cours...</span>
                  </>
                ) : (
                  <>
                    <span>🔍 L'Extracteur</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Message si pas d'email détecté */}
          {extractionMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center space-x-2">
              <span>⚠️</span>
              <span>{extractionMessage}</span>
            </div>
          )}

          {/* E-mail détecté & Bouton 1-Click */}
          {extractedEmail && (
            <div className="space-y-4 animate-fade-in">
              {/* Encadré vert de détection avec détails Gemini */}
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

                {extractedData && (extractedData.job_title || extractedData.company || extractedData.contract_type) && (
                  <div className="pt-3 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold text-emerald-950">
                    {extractedData.job_title && (
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 font-extrabold block uppercase">Poste</span>
                        <span>{extractedData.job_title}</span>
                      </div>
                    )}
                    {extractedData.company && (
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 font-extrabold block uppercase">Entreprise</span>
                        <span>{extractedData.company}</span>
                      </div>
                    )}
                    {extractedData.contract_type && (
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] text-emerald-700 font-extrabold block uppercase">Contrat</span>
                        <span>{extractedData.contract_type}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmation de succès */}
              {sendSuccess ? (
                <div className="p-6 bg-emerald-600 text-white rounded-2xl text-center space-y-2 shadow-lg animate-bounce">
                  <div className="text-3xl">🎉</div>
                  <h3 className="text-lg font-black">Candidature transmise avec succès !</h3>
                  <p className="text-xs text-emerald-100 font-medium">Votre CV et votre demande ont été envoyés à {extractedEmail}.</p>
                </div>
              ) : (
                <div ref={applicationFormRef} className="space-y-4 pt-2 scroll-mt-24">
                  <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    2. Vos informations de candidature
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
                          <div className="space-y-1 text-gray-400">
                            <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                            <p className="text-xs font-bold text-gray-600">Cliquez pour importer votre CV (PDF, DOCX)</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Objet de la demande */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                      Objet de la demande
                    </label>
                    <input
                      type="text"
                      value={applicationSubject}
                      onChange={(e) => setApplicationSubject(e.target.value)}
                      disabled={isSending}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                    />
                  </div>

                  {/* Message / lettre de motivation */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                      Message / Lettre de motivation
                    </label>
                    <textarea
                      rows={5}
                      value={applicationMessage}
                      onChange={(e) => setApplicationMessage(e.target.value)}
                      disabled={isSending}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition resize-none"
                    />
                  </div>

                  {sendErrorMessage && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation"></i>
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
                    ) : (
                      <>
                        <span>🚀 Postuler en 1 clic à</span>
                        <span className="font-mono text-emerald-200 underline">{extractedEmail}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={mailtoHref}
                    className="block text-center text-[11px] font-bold text-gray-400 hover:text-emerald-700 transition underline"
                  >
                    Ou ouvrir dans votre messagerie (CV à joindre manuellement)
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
    </div>
  );
}
