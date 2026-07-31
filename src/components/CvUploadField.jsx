"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Champ de livraison de fichier réutilisable : téléverse un PDF vers un
 * bucket Storage privé à un chemin donné, puis renvoie ce chemin au parent.
 * L'upload se fait directement depuis le navigateur (session de l'agent) —
 * la policy RLS du bucket restreint déjà l'écriture au dossier autorisé,
 * pas besoin d'une route API dédiée pour ça.
 */
export default function CvUploadField({ bucket, storagePath, onUploadComplete, disabled = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrorMessage("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    setErrorMessage("");
    setIsUploading(true);

    const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: true,
    });

    setIsUploading(false);

    if (error) {
      console.error("Erreur upload CV finalisé:", error.message);
      setErrorMessage("Échec du téléversement. Réessayez.");
      return;
    }

    onUploadComplete(storagePath);
  };

  return (
    <div>
      <label
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
          disabled || isUploading
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        <i className={`fa-solid ${isUploading ? "fa-spinner fa-spin" : "fa-upload"}`}></i>
        <span>{isUploading ? "Envoi..." : "Livrer le CV (PDF)"}</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled || isUploading}
          onChange={handleFileChange}
        />
      </label>
      {errorMessage && <p className="text-[11px] text-red-600 font-semibold mt-1">{errorMessage}</p>}
    </div>
  );
}
