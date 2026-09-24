"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import { ratioAffichage, RATIO_ATTENTE } from "@/lib/formatImage";

/**
 * Image publiée affichée à SON rapport (largeur / hauteur) : ni bandes sur les
 * côtés, ni fond flou, ni réglage demandé à la personne qui publie.
 *
 * Le cadre prend le rapport réel de l'image dès qu'elle est chargée ; comme il
 * a exactement ce rapport, `object-cover` ne recadre rien. Seuls les formats
 * extrêmes sont bornés (voir formatImage.js). En attendant le chargement, une
 * zone neutre unie réserve la place.
 */
export default function ImageAdaptative({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  loading = "lazy",
  children = null,
  ...reste
}) {
  // Le rapport est mémorisé AVEC l'adresse mesurée : si `src` change, on repart
  // de la zone d'attente sans effet de bord.
  const [mesure, setMesure] = useState({ src: null, ratio: null });
  const ratio = mesure.src === src ? mesure.ratio : null;

  const lire = (el) => {
    if (!el || !el.naturalWidth) return;
    const r = ratioAffichage(el.naturalWidth, el.naturalHeight);
    if (r) setMesure((m) => (m.src === src && m.ratio === r ? m : { src, ratio: r }));
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-gray-100 dark:bg-zinc-900 ${className}`}
      style={{ aspectRatio: ratio ?? RATIO_ATTENTE }}
      {...reste}
    >
      <img
        // Image déjà en cache avant l'hydratation : l'événement load est passé.
        ref={(el) => {
          if (el && el.complete && ratio === null) lire(el);
        }}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={(e) => lire(e.currentTarget)}
        className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
      />
      {children}
    </div>
  );
}
