"use client";

import { useEffect, useRef, useState } from "react";
import { adresseImage } from "@/lib/imagesPubliques";

// Un seul audio d'offre joue à la fois : lancer une offre arrête celle qui jouait.
let arreterLecteurActif = null;

/**
 * Bouton « Écouter » d'une offre qui a un audio (champ audio_url, facultatif à la publication).
 * Rien n'est téléchargé avant le premier appui (preload="none" : un fil de 30 offres ne charge pas 30 audios).
 * Un second appui met en pause ; un fin de lecture remet le bouton à zéro.
 */
export default function LecteurAudioOffre({ url, className = "" }) {
  const audioRef = useRef(null);
  const [etat, setEtat] = useState("repos"); // repos | chargement | lecture | pause | erreur
  const [progression, setProgression] = useState(0);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!url) return null;

  const basculer = (e) => {
    e.stopPropagation();
    e.preventDefault();
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "none";
      // Interrupteur images-Worker ouvert : l'audio vient du Worker ; sinon (ou en cas d'échec, voir « error » plus bas) de Supabase, comme avant.
      audio.src = adresseImage(url);
      let repli = false;
      audio.addEventListener("playing", () => setEtat("lecture"));
      audio.addEventListener("waiting", () => setEtat("chargement"));
      audio.addEventListener("pause", () => setEtat((s) => (s === "lecture" || s === "chargement" ? "pause" : s)));
      audio.addEventListener("ended", () => {
        setEtat("repos");
        setProgression(0);
      });
      audio.addEventListener("error", () => {
        // Un élément Audio créé par script n'est pas dans la page : le filet global ne le voit pas. Une seule nouvelle tentative sur l'adresse Supabase d'origine.
        if (!repli && adresseImage(url) !== url) {
          repli = true;
          audio.src = url;
          audio.play().catch(() => setEtat("erreur"));
          return;
        }
        setEtat("erreur");
      });
      audio.addEventListener("timeupdate", () => {
        if (audio.duration > 0) setProgression(Math.min(100, (audio.currentTime / audio.duration) * 100));
      });
      audioRef.current = audio;
    }
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (arreterLecteurActif && arreterLecteurActif !== audio) arreterLecteurActif();
    arreterLecteurActif = () => audio.pause();
    setEtat("chargement");
    audio.play().catch(() => setEtat("erreur"));
  };

  const enLecture = etat === "lecture" || etat === "chargement";
  const icone = etat === "erreur" ? "fa-triangle-exclamation" : etat === "chargement" ? "fa-circle-notch fa-spin" : enLecture ? "fa-pause" : "fa-volume-high";
  const libelle = etat === "erreur" ? "Audio indisponible" : enLecture ? "Pause" : etat === "pause" ? "Reprendre" : "Écouter";

  return (
    <button
      type="button"
      onClick={basculer}
      title={etat === "erreur" ? "Cet audio ne peut pas être lu pour le moment" : "Écouter l'audio de cette offre"}
      aria-label={`${libelle} l'audio de l'offre`}
      aria-pressed={enLecture}
      className={`relative overflow-hidden flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer border select-none active:scale-95 ${
        enLecture
          ? "bg-emerald-600 text-white border-emerald-600"
          : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
      } ${className}`}
    >
      <i className={`fa-solid ${icone} text-sm`}></i>
      <span className="hidden xs:inline">{libelle}</span>
      {progression > 0 ? <span className="absolute left-0 bottom-0 h-[3px] bg-emerald-400" style={{ width: `${progression}%` }} /> : null}
    </button>
  );
}
