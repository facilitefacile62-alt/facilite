"use client";

import { useEffect, useRef, useState } from "react";

export const TAILLE_MAX_AUDIO_OFFRE = 10 * 1024 * 1024; // 10 Mo

/**
 * Choix d'un audio FACULTATIF pour une offre à publier. Ne bloque jamais la publication : sans fichier,
 * l'offre est publiée sans audio. Le fichier n'est envoyé qu'à la publication (voir televerserAudioOffre).
 * @param {{ file: File|null, urlExistante?: string, onChange: (f: File|null) => void, onErreur?: (m: string) => void }} props
 */
export default function SelecteurAudioOffre({ file, urlExistante = "", onChange, onErreur }) {
  const entree = useRef(null);
  const [apercu, setApercu] = useState("");
  const apercuRef = useRef("");

  // Libère l'aperçu à la fermeture du composant.
  useEffect(
    () => () => {
      if (apercuRef.current) URL.revokeObjectURL(apercuRef.current);
    },
    []
  );

  const choisir = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      onErreur?.("Ce fichier n'est pas un audio (formats courants : MP3, M4A, WAV, OGG).");
      return;
    }
    if (f.size > TAILLE_MAX_AUDIO_OFFRE) {
      onErreur?.("L'audio dépasse 10 Mo : choisissez un fichier plus léger.");
      return;
    }
    if (apercuRef.current) URL.revokeObjectURL(apercuRef.current);
    const url = URL.createObjectURL(f);
    apercuRef.current = url;
    setApercu(url);
    onChange(f);
  };

  // Si le parent a vidé le fichier (publication terminée), on n'affiche plus l'ancien aperçu.
  const source = file ? apercu : urlExistante;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-volume-high text-emerald-600 text-sm"></i>
          <span className="text-[11px] font-black text-gray-900 uppercase tracking-wider">Audio de l&apos;offre</span>
          <span className="text-[10px] font-bold text-gray-400">facultatif</span>
        </div>
        {source ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] font-black text-red-600 hover:text-red-700 cursor-pointer"
          >
            Retirer
          </button>
        ) : null}
      </div>
      {source ? (
        <>
          {file ? (
            <p className="text-[11px] font-bold text-gray-600 truncate">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} Mo
            </p>
          ) : null}
          <audio controls preload="none" src={source} className="w-full h-9" />
        </>
      ) : (
        <button
          type="button"
          onClick={() => entree.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-[11px] font-bold text-gray-600 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
        >
          <i className="fa-solid fa-microphone-lines text-gray-400"></i>
          Ajouter un audio (MP3, M4A, WAV — 10 Mo max)
        </button>
      )}
      <input ref={entree} type="file" accept="audio/*" className="hidden" onChange={choisir} />
    </div>
  );
}

/**
 * Envoie l'audio dans le bucket public « job-offers » ({user}/audio-….ext) et renvoie son URL publique, ou ""
 * s'il n'y a pas de fichier ou si l'envoi échoue : la publication continue alors sans audio, jamais bloquée.
 */
export async function televerserAudioOffre(supabase, userId, file) {
  if (!file) return "";
  const ext = ((file.name || "audio.mp3").split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const chemin = `${userId}/audio-offre-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("job-offers").upload(chemin, file, { contentType: file.type || "audio/mpeg" });
  if (error) return "";
  const { data } = supabase.storage.from("job-offers").getPublicUrl(chemin);
  return data?.publicUrl || "";
}
