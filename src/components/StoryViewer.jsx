"use client";
/* eslint-disable @next/next/no-img-element -- visuels publics Supabase, plein écran */

import { useCallback, useEffect, useState } from "react";
import { adresseImage } from "@/lib/imagesPubliques";

// Lecteur plein écran des stories du fil d'actualité (maquette « Story » :
// barres de progression en haut, titre + « il y a X h », croix, flèches
// précédent/suivant, bouton d'action en bas). Les stories sont celles que
// l'administrateur gère dans /admin/stories (table stories).
const DUREE_MS = 6000;

function ilYA(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function StoryViewer({ stories, debut = 0, onClose }) {
  const [index, setIndex] = useState(Math.min(Math.max(debut, 0), Math.max(stories.length - 1, 0)));
  const [progression, setProgression] = useState(0);
  const story = stories[index];

  const suivante = useCallback(() => {
    if (index >= stories.length - 1) onClose();
    else {
      setIndex((i) => i + 1);
      setProgression(0);
    }
  }, [index, stories.length, onClose]);

  const precedente = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgression(0);
    } else {
      setProgression(0);
    }
  }, [index]);

  // Avance automatique.
  useEffect(() => {
    const debutMs = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - debutMs) / DUREE_MS);
      setProgression(p);
      if (p >= 1) {
        clearInterval(t);
        suivante();
      }
    }, 60);
    return () => clearInterval(t);
  }, [index, suivante]);

  // Clavier : Échap ferme, flèches naviguent.
  useEffect(() => {
    const touche = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") suivante();
      if (e.key === "ArrowLeft") precedente();
    };
    window.addEventListener("keydown", touche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = overflow;
    };
  }, [onClose, suivante, precedente]);

  if (!story) return null;
  // Bouton masqué depuis /admin/stories (bouton_visible = false) : ni bouton ni numéro.
  const externe = story.bouton_visible !== false && story.lien && /^https?:\/\//.test(story.lien);
  const whatsapp = externe && /wa\.me|whatsapp/i.test(story.lien);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`Story : ${story.titre}`}>
      <div className="relative w-full h-full max-w-md bg-[#0a0a0a] overflow-hidden flex flex-col">
        {/* Barres de progression */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2">
          {stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < index ? "100%" : i === index ? `${progression * 100}%` : "0%" }} />
            </div>
          ))}
        </div>

        {/* En-tête */}
        <div className="absolute top-3 left-0 right-0 z-20 flex items-center gap-2.5 px-3 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent">
          <img src={adresseImage(story.image_url)} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white truncate">{story.titre}</p>
            <p className="text-[11px] font-bold text-white/70">{ilYA(story.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer la story" className="w-10 h-10 rounded-full text-white text-lg hover:bg-white/15 cursor-pointer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Visuel */}
        <div className="flex-1 flex items-center justify-center">
          <img src={adresseImage(story.image_url)} alt={story.titre} className="max-w-full max-h-full object-contain select-none" draggable={false} />
        </div>

        {/* Zones de toucher gauche / droite */}
        <button type="button" onClick={precedente} aria-label="Story précédente" className="absolute left-0 top-20 bottom-24 w-1/3 z-10 cursor-pointer" />
        <button type="button" onClick={suivante} aria-label="Story suivante" className="absolute right-0 top-20 bottom-24 w-1/3 z-10 cursor-pointer" />

        {index > 0 ? (
          <button type="button" onClick={precedente} aria-label="Précédente" className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 text-white cursor-pointer">
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
        ) : null}
        <button type="button" onClick={suivante} aria-label="Suivante" className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 text-white cursor-pointer">
          <i className="fa-solid fa-chevron-right text-sm"></i>
        </button>

        {/* Bouton d'action */}
        {externe ? (
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <a
              href={story.lien}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full h-12 rounded-full ${whatsapp ? "bg-[#25D366] hover:bg-[#20bd5a]" : "bg-emerald-600 hover:bg-emerald-700"} text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg`}
            >
              {whatsapp ? <i className="fa-brands fa-whatsapp text-lg"></i> : <i className="fa-solid fa-arrow-up-right-from-square text-sm"></i>}
              <span>{story.libelle_bouton}</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
