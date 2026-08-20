"use strict";
"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

const SLIDE_DEFINITIONS = [
  {
    targetKey: "s1",
    filename: "affiche_cv_pro.jpg",
    title: "Modèle 1 — CV Professionnel Moderne",
    desc: "Affiche principale utilisée pour le modèle 1 et les vignettes générales.",
  },
  {
    targetKey: "s2",
    filename: "affiche_boostez_carriere.jpg",
    title: "Modèle 2 — Lettre de Motivation Ciblée",
    desc: "Affiche dédiée à la présentation de la lettre de motivation.",
  },
  {
    targetKey: "s3",
    filename: "affiche_cv_pro.jpg",
    title: "Modèle 3 — Pack Complet (CV + Lettre)",
    desc: "Affiche mettant en avant le pack complet.",
  },
  {
    targetKey: "s4",
    filename: "affiche2.jpg",
    title: "Modèle 4 — CV Exécutif & International",
    desc: "Affiche du format exécutif et candidatures internationales.",
  },
];

// Convertit une URL d'image (URL Supabase Storage classique OU data URI
// base64 de secours renvoyée par generate-job-poster) en File, pour
// réinjecter l'image générée dans exactement le même pipeline
// d'enregistrement qu'un upload manuel (update-poster : écriture
// public/, synchronisation des vignettes miroirs) sans dupliquer cette
// logique.
async function urlToFile(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export default function AdminPosterManagerModal({ isOpen, onClose, onPosterUpdated }) {
  const [uploadingKey, setUploadingKey] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });
  const fileInputRefs = useRef({});
  const [expandedAiKey, setExpandedAiKey] = useState(null);
  const [aiPromptDrafts, setAiPromptDrafts] = useState({});
  const [generatingKey, setGeneratingKey] = useState(null);

  if (!isOpen) return null;

  const handleGenerateAI = async (targetKey, filename) => {
    const prompt = (aiPromptDrafts[targetKey] || "").trim();
    if (!prompt) {
      setStatusMessage({ text: "Décrivez l'affiche à générer avant de lancer l'IA.", type: "error" });
      return;
    }

    setGeneratingKey(targetKey);
    setStatusMessage({ text: "Génération de l'affiche par IA en cours (peut prendre jusqu'à 30s)...", type: "info" });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatusMessage({ text: "Session expirée. Veuillez vous reconnecter.", type: "error" });
        return;
      }

      const genRes = await fetch("/api/admin/generate-job-poster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      const genData = await genRes.json().catch(() => ({}));

      if (!genRes.ok || !genData.success || !genData.imageUrl) {
        throw new Error(genData.error || "Échec de la génération de l'affiche par IA.");
      }

      setStatusMessage({ text: "Affiche générée, enregistrement en cours...", type: "info" });

      const file = await urlToFile(genData.imageUrl, filename);
      setExpandedAiKey(null);
      await handleFileChange(targetKey, file);
    } catch (err) {
      console.error("Erreur génération affiche IA:", err);
      setStatusMessage({ text: err.message || "Une erreur est survenue lors de la génération.", type: "error" });
    } finally {
      setGeneratingKey(null);
    }
  };

  const handleFileChange = async (targetKey, file) => {
    if (!file) return;

    setUploadingKey(targetKey);
    setStatusMessage({ text: "Téléversement et enregistrement en cours...", type: "info" });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatusMessage({ text: "Session expirée. Veuillez vous reconnecter.", type: "error" });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetKey", targetKey);

      const res = await fetch("/api/admin/update-poster", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Échec de la mise à jour de l'affiche.");
      }

      setStatusMessage({
        text: `Affiche mise à jour avec succès ! (${data.message || ""})`,
        type: "success",
      });

      if (onPosterUpdated) {
        onPosterUpdated(targetKey, data.url);
      }
    } catch (err) {
      console.error("Erreur upload affiche:", err);
      setStatusMessage({ text: err.message || "Une erreur est survenue lors de l'upload.", type: "error" });
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <i className="fa-solid fa-images text-lg"></i>
            </div>
            <div>
              <h3 className="text-base font-extrabold">Gestion des Affiches (Admin)</h3>
              <p className="text-xs text-emerald-200/80 font-medium">
                Changez en 1 clic les visuels du carrousel et des modèles de CV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Notification Status */}
        {statusMessage.text && (
          <div
            className={`px-6 py-3 text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : statusMessage.type === "error"
                ? "bg-red-50 text-red-800 border-b border-red-200"
                : "bg-blue-50 text-blue-800 border-b border-blue-200"
            }`}
          >
            <i
              className={`fa-solid ${
                statusMessage.type === "success"
                  ? "fa-circle-check text-emerald-600"
                  : statusMessage.type === "error"
                  ? "fa-triangle-exclamation text-red-600"
                  : "fa-circle-info text-blue-600"
              }`}
            ></i>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Content List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {SLIDE_DEFINITIONS.map((slide, index) => {
            const isUploading = uploadingKey === slide.targetKey;
            const isGenerating = generatingKey === slide.targetKey;
            const isAiExpanded = expandedAiKey === slide.targetKey;
            const previewTimestamp = Date.now();

            return (
              <div
                key={slide.targetKey}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/80 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-950 flex-shrink-0 border border-gray-300 dark:border-gray-700 shadow-2xs">
                      <img
                        src={`/${slide.filename}?t=${previewTimestamp}`}
                        alt={slide.title}
                        className="w-full h-full object-cover object-top"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-black text-center py-0.5">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white truncate">
                        {slide.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1 mt-0.5">
                        {slide.desc}
                      </p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">
                        Fichier : public/{slide.filename}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="file"
                      ref={(el) => (fileInputRefs.current[slide.targetKey] = el)}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileChange(slide.targetKey, file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={isUploading || isGenerating}
                      onClick={() => setExpandedAiKey(isAiExpanded ? null : slide.targetKey)}
                      className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Générer par IA</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploading || isGenerating}
                      onClick={() => fileInputRefs.current[slide.targetKey]?.click()}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isUploading ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Envoi...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                          <span>Remplacer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isAiExpanded && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-gray-200 dark:border-gray-700/80">
                    <input
                      type="text"
                      value={aiPromptDrafts[slide.targetKey] || ""}
                      onChange={(e) =>
                        setAiPromptDrafts((prev) => ({ ...prev, [slide.targetKey]: e.target.value }))
                      }
                      placeholder="Décrivez l'affiche (ex: CV professionnel moderne, ambiance corporate, tons bleus)"
                      disabled={isGenerating}
                      className="flex-1 px-3 py-2 mt-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
                    />
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleGenerateAI(slide.targetKey, slide.filename)}
                      className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 flex-shrink-0"
                    >
                      {isGenerating ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          <span>Génération...</span>
                        </>
                      ) : (
                        <span>Lancer la génération</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-gray-500">
          <span>Formats acceptés : PNG, JPG, WEBP (max 10 Mo)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 rounded-xl transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
