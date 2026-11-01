"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { adresseImage } from "@/lib/imagesPubliques";
import { indexDepuisDefilement, indexPrecedent, indexSuivant } from "@/lib/carrousselLogique";

/**
 * Carrousel plein écran : toutes les photos d'une carte, à faire glisser (ou flèches du clavier), avec la position, des points et une croix pour fermer.
 * Rendu dans document.body (portail) : la carte a une transformation au survol qui, sinon, décalerait un élément « fixed ». Les clics ne remontent pas à la carte
 * (sinon toucher le carrousel ouvrirait aussi la fiche de l'article, car les événements d'un portail remontent à son parent React).
 *
 * @param {{ photos: string[], titre?: string, indexInitial?: number, onFermer: () => void }} props photos : adresses déjà complètes (le remplacement par le Worker est fait ici, à l'affichage)
 */
export default function CarrousselPhotos({ photos, titre = "", indexInitial = 0, onFermer }) {
  const piste = useRef(null);
  const [index, setIndex] = useState(indexInitial);
  const total = photos.length;

  const aller = useCallback((i) => {
    const el = piste.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }, []);

  // Position de départ et verrouillage du défilement de la page : une seule fois, à l'ouverture.
  useEffect(() => {
    const el = piste.current;
    if (el) el.scrollTo({ left: indexInitial * el.clientWidth, behavior: "auto" });
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clavier : Échap ferme, flèches gauche et droite changent de photo.
  const fermerRef = useRef(onFermer);
  useEffect(() => {
    fermerRef.current = onFermer;
  }, [onFermer]);
  useEffect(() => {
    const photoActuelle = () => (piste.current ? indexDepuisDefilement(piste.current.scrollLeft, piste.current.clientWidth, total) : 0);
    const touche = (e) => {
      if (e.key === "Escape") fermerRef.current();
      else if (e.key === "ArrowRight") aller(indexSuivant(photoActuelle(), total));
      else if (e.key === "ArrowLeft") aller(indexPrecedent(photoActuelle(), total));
    };
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, [aller, total]);

  if (typeof document === "undefined" || total === 0) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre ? `Photos : ${titre}` : "Photos"}
      className="fixed inset-0 z-[1000] flex flex-col bg-black/95"
      onClick={(e) => {
        e.stopPropagation();
        onFermer();
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-bold">{titre}</p>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold tabular-nums text-white/80" aria-live="polite">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer le carrousel"
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-xl flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={piste}
          onScroll={(e) => setIndex(indexDepuisDefilement(e.currentTarget.scrollLeft, e.currentTarget.clientWidth, total))}
          className="flex h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((src, i) => (
            <div key={`${src}-${i}`} className="w-full h-full shrink-0 snap-center flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={adresseImage(src)}
                alt={titre ? `${titre}, photo ${i + 1} sur ${total}` : `Photo ${i + 1} sur ${total}`}
                className="max-w-full max-h-full object-contain rounded-xl"
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                aller(indexPrecedent(index, total));
              }}
              aria-label="Photo précédente"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                aller(indexSuivant(index, total));
              }}
              aria-label="Photo suivante"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center gap-2 py-4" onClick={(e) => e.stopPropagation()}>
          {photos.map((src, i) => (
            <button
              key={`${src}-point-${i}`}
              type="button"
              onClick={() => aller(i)}
              aria-label={`Aller à la photo ${i + 1}`}
              aria-current={i === index}
              className={`h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
