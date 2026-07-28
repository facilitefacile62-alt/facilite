"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function DiagnosticModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Transition d'état de chargement
  useEffect(() => {
    let interval;
    if (loading) {
      const steps = [
        "Analyse de la structure globale...",
        "Analyse du design et de la mise en page...",
        "Évaluation des mots-clés professionnels...",
        "Vérification de la compatibilité ATS...",
        "Calcul final du score de performance..."
      ];
      let currentStep = 0;
      setLoadingStep(steps[0]);
      interval = setInterval(() => {
        currentStep = (currentStep + 1) % steps.length;
        setLoadingStep(steps[currentStep]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile) => {
    setFile(selectedFile);
    setErrorMsg("");
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Veuillez vous connecter pour utiliser le diagnostic IA.");
        }

        const response = await fetch("/api/diagnostic-cv", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: selectedFile.name,
            mimeType: selectedFile.type
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Une erreur est survenue lors de l'analyse.");
        }

        setResult(data.result);
      } catch (err) {
        console.error("Erreur Diagnostic CV :", err);
        setErrorMsg("Échec de l'analyse. Veuillez réessayer avec un autre fichier.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(selectedFile);
  };

  const getScoreColorClass = (score) => {
    if (score >= 75) return { text: "text-emerald-500", border: "border-emerald-500", bg: "bg-emerald-50 text-emerald-800 border-emerald-100", progress: "bg-emerald-500" };
    if (score >= 50) return { text: "text-amber-500", border: "border-amber-500", bg: "bg-amber-50 text-amber-800 border-amber-100", progress: "bg-amber-500" };
    return { text: "text-rose-500", border: "border-rose-500", bg: "bg-rose-50 text-rose-800 border-rose-100", progress: "bg-rose-500" };
  };

  const colors = result ? getScoreColorClass(result.score_global) : null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#FAF6F1] px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-xl text-lg flex items-center justify-center shadow-inner">
              <i className="fa-solid fa-stethoscope"></i>
            </span>
            <div>
              <h3 className="font-extrabold text-neutral-900 text-base flex items-center gap-2">
                Diagnostic de mon CV
                <span className="bg-emerald-400 text-emerald-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-xs tracking-wider animate-pulse">
                  GRATUIT
                </span>
              </h3>
              <p className="text-xs text-neutral-500">Obtenez un audit instantané de votre design, mots-clés et compatibilité ATS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-neutral-200/50 flex items-center justify-center text-neutral-500 transition-colors focus:outline-none"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Étape 1 : Aucun fichier sélectionné ni d'analyse en cours */}
          {!file && !loading && !result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
              {/* Option 1 : Importer un fichier */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-neutral-200 hover:border-blue-500 hover:bg-blue-50/20 p-6 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-xs transition">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <h4 className="font-extrabold text-neutral-800 text-sm">Importer un document</h4>
                <p className="text-xs text-neutral-500 leading-relaxed px-4">
                  Déposez ou sélectionnez votre fichier au format PDF, DOCX, PNG, JPG ou WEBP.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                />
              </div>

              {/* Option 2 : Prendre une photo */}
              <div 
                onClick={() => cameraInputRef.current?.click()}
                className="group border-2 border-dashed border-neutral-200 hover:border-[#10E688] hover:bg-emerald-50/20 p-6 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shadow-xs transition">
                  <i className="fa-solid fa-camera"></i>
                </div>
                <h4 className="font-extrabold text-neutral-800 text-sm">Prendre une photo</h4>
                <p className="text-xs text-neutral-500 leading-relaxed px-4">
                  Déclenchez directement l'appareil photo de votre smartphone ou webcam pour capturer votre CV.
                </p>
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Étape 2 : Chargement de l'analyse */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-neutral-100 border-t-blue-600 animate-spin"></div>
                <div className="absolute w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs shadow-inner">
                  <i className="fa-solid fa-stethoscope animate-pulse"></i>
                </div>
              </div>
              <div className="text-center">
                <h4 className="font-extrabold text-neutral-800 text-sm">Diagnostic en cours...</h4>
                <p className="text-xs text-neutral-500 mt-1 animate-pulse font-medium">{loadingStep}</p>
              </div>
            </div>
          )}

          {/* Étape 3 : Affichage des résultats */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Score Gauge & ATS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-neutral-50 p-5 rounded-2xl border border-neutral-100">
                {/* Score Circle */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className={`w-28 h-28 rounded-full border-8 ${colors.border} flex flex-col items-center justify-center bg-white shadow-md`}>
                    <span className="text-3xl font-black text-neutral-800 leading-none">{result.score_global}</span>
                    <span className="text-[10px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">/ 100</span>
                  </div>
                  <span className="text-xs font-black text-neutral-800 mt-3">Score Global</span>
                </div>

                {/* ATS details */}
                <div className="md:col-span-2 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <span className="text-xs font-bold text-neutral-500">Compatibilité ATS :</span>
                    <span className={`text-xs font-black px-3 py-1 rounded-full border ${colors.bg}`}>
                      {result.compatibilite_ats}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-neutral-500">
                      <span>Rapport de lisibilité automatique</span>
                      <span>{result.score_global}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${colors.progress}`} style={{ width: `${result.score_global}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Points Forts & Axes Amélioration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Points Forts */}
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <i className="fa-solid fa-circle-check text-sm text-emerald-500"></i> Points Forts
                  </h4>
                  <ul className="space-y-2">
                    {result.points_forts.map((pt, idx) => (
                      <li key={idx} className="text-xs text-neutral-700 font-semibold flex items-start gap-1.5">
                        <i className="fa-solid fa-check text-[9px] text-emerald-500 mt-1 flex-shrink-0"></i>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Axes d'Amélioration */}
                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <i className="fa-solid fa-circle-exclamation text-sm text-rose-500"></i> Axes d'Amélioration
                  </h4>
                  <ul className="space-y-2">
                    {result.axes_amelioration.map((pt, idx) => (
                      <li key={idx} className="text-xs text-neutral-700 font-semibold flex items-start gap-1.5">
                        <i className="fa-solid fa-arrow-right text-[9px] text-rose-500 mt-1 flex-shrink-0"></i>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Conseils Clés */}
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-150 space-y-2.5">
                <h4 className="text-xs font-extrabold text-neutral-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <i className="fa-regular fa-lightbulb text-sm text-blue-500"></i> Conseils Clés de l'IA
                </h4>
                <ul className="space-y-2">
                  {result.conseils_cles.map((pt, idx) => (
                    <li key={idx} className="text-xs text-neutral-700 font-semibold flex items-start gap-1.5">
                      <i className="fa-solid fa-angles-right text-[8px] text-blue-500 mt-1 flex-shrink-0"></i>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Messages d'erreur */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-[#FAF6F1] flex flex-col sm:flex-row items-center justify-between gap-3">
          {result ? (
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
                setErrorMsg("");
              }}
              className="text-xs font-bold text-neutral-500 hover:text-neutral-700 transition focus:outline-none bg-transparent border-none outline-none cursor-pointer"
            >
              <i className="fa-solid fa-rotate-left mr-1.5"></i> Relancer un audit
            </button>
          ) : (
            <div className="text-[10px] text-neutral-400 font-semibold">
              <i className="fa-solid fa-shield-halved mr-1 text-emerald-500"></i> Données sécurisées et confidentielles
            </div>
          )}

          {result ? (
            <button
              onClick={() => {
                onClose();
                window.location.href = "/importer-cv";
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              <span>Optimiser mon CV avec Facilite</span>
              <i className="fa-solid fa-wand-magic-sparkles text-xs animate-pulse"></i>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-extrabold text-xs rounded-xl transition border-none cursor-pointer"
            >
              Fermer
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
