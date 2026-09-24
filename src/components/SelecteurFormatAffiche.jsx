"use client";

import React from "react";
import { FORMATS_AFFICHE } from "@/lib/formatsAffiche";

/**
 * Choix du format de l'affiche générée par l'IA. Chaque puce dessine le
 * rapport réel (carré, portrait, paysage) pour qu'on le reconnaisse sans lire.
 *
 * Ce choix ne concerne QUE la génération. Une affiche déposée depuis
 * l'appareil n'a aucun réglage : elle s'affiche à son propre format.
 */
export default function SelecteurFormatAffiche({ valeur, onChange, desactive = false }) {
  return (
    <div role="radiogroup" aria-label="Format de l'affiche" className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-extrabold text-gray-500 uppercase mr-1">Format :</span>
      {FORMATS_AFFICHE.map((f) => {
        const actif = f.id === valeur;
        // Aperçu 18 px de côté maximum, proportionnel au format.
        const plusLarge = f.largeur >= f.hauteur;
        const l = plusLarge ? 18 : Math.round((18 * f.largeur) / f.hauteur);
        const h = plusLarge ? Math.round((18 * f.hauteur) / f.largeur) : 18;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={actif}
            disabled={desactive}
            onClick={() => onChange(f.id)}
            title={`${f.libelle} — ${f.usage} (${f.largeur}×${f.hauteur})`}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              actif
                ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                : "border-gray-300 bg-white text-gray-700 hover:border-emerald-400"
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block rounded-[3px] border-2 ${actif ? "border-white" : "border-gray-400"}`}
              style={{ width: l, height: h }}
            />
            <span>{f.id}</span>
            <span className={`hidden sm:inline font-medium ${actif ? "text-emerald-50" : "text-gray-500"}`}>{f.libelle}</span>
          </button>
        );
      })}
    </div>
  );
}
