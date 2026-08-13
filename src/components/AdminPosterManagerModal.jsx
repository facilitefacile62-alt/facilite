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

export default function AdminPosterManagerModal({ isOpen, onClose, onPosterUpdated }) {
  const [uploadingKey, setUploadingKey] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });
  const fileInputRefs = useRef({});

  if (!isOpen) return null;

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
            const previewTimestamp = Date.now();

            return (
              <div
                key={slide.targetKey}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
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
                    disabled={isUploading}
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
