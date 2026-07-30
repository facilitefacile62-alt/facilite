/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";

export default function ExtracteurPage() {
  const [userSession, setUserSession] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedEmail, setExtractedEmail] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionMessage, setExtractionMessage] = useState(null);

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setUserSession(session);
    }
    checkAuth();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractedEmail(null);
    setExtractionMessage(null);
    setSendSuccess(false);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
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

      if (data.email) {
        setExtractedEmail(data.email);
        setExtractedData(data);
      } else {
        setExtractionMessage(data.error || "Aucune adresse e-mail détectée sur cette affiche.");
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

    setIsSending(true);
    try {
      const res = await fetch("/api/send-application", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession.access_token}`,
        },
        body: JSON.stringify({ recipientEmail: extractedEmail }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSendSuccess(true);
      } else {
        alert(data.error || "Impossible d'envoyer la candidature.");
      }
    } catch (err) {
      console.error("Erreur d'envoi:", err);
      alert("Une erreur s'est produite lors de l'envoi.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
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
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
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
                      <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider block">E-mail détecté par Gemini 2.5 Flash</span>
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
                /* Gros Bouton d'action 1-Click */
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
