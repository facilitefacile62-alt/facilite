"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Étape 2A — détection du collage + première tentative d'extraction.
 *
 * Écoute 'paste' sur window plutôt que sur un champ dédié, MAIS ignore
 * systématiquement les collages dont la cible est un champ éditable
 * (input/textarea/contenteditable) : /creer-cv a des dizaines de champs de
 * formulaire (nom, email, bio...) dont le collage normal ne doit jamais
 * être intercepté. Seul un collage "hors champ" (sur la page elle-même,
 * l'aperçu, etc.) déclenche l'extraction.
 *
 * Résultat brut de la sonde (2026-08-15) : Canva met au moins text/plain
 * (texte dans un ordre non garanti) et text/html (avec des déclarations
 * color/background-color et font-family inline) dans le presse-papiers.
 * L'extraction ci-dessous parcourt le HTML collé de façon générique (tout
 * élément avec un attribut style), sans supposer une structure DOM précise
 * — plus robuste si Canva change son balisage, et ça fonctionne déjà avec
 * les seuls faits confirmés à ce stade.
 *
 * Étape 2B : la police détectée est désormais chargée (Google Fonts) et
 * appliquée immédiatement via onFontDetected — la couleur reste diagnostic
 * seul pour l'instant (pas d'appel à setAccentColor ici). Le panneau de
 * prévisualisation/confirmation pour la couleur viendra dans une étape
 * ultérieure.
 */

const NEUTRAL_LIGHTNESS_MIN = 12;
const NEUTRAL_LIGHTNESS_MAX = 92;
const NEUTRAL_SATURATION_MAX = 8;

function rgbStringToHex(rgbStr) {
  const m = rgbStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const [, r, g, b] = m;
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function normalizeColor(raw) {
  const value = raw.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    if (value.length === 4) {
      return (
        "#" +
        value
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
          .toUpperCase()
      );
    }
    return value.toUpperCase();
  }
  if (/^rgb/i.test(value)) return rgbStringToHex(value);
  return null; // mots-clés CSS (ex. "white", "transparent") ignorés — ambigus sans contexte
}

// Filtre les quasi-blancs/noirs/gris via HSL : une couleur "neutre" a une
// faible saturation OU une luminosité extrême, quelle que soit sa teinte.
function isNeutral(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = ((max + min) / 2) * 100;
  const saturation = max === min ? 0 : ((max - min) / (1 - Math.abs(2 * ((max + min) / 2) - 1))) * 100;
  return (
    lightness < NEUTRAL_LIGHTNESS_MIN ||
    lightness > NEUTRAL_LIGHTNESS_MAX ||
    saturation < NEUTRAL_SATURATION_MAX
  );
}

function extractFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const colorCounts = new Map();
  const fontFamilies = new Map();

  doc.querySelectorAll("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";

    const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
    if (bgMatch) {
      const hex = normalizeColor(bgMatch[1]);
      if (hex && !isNeutral(hex)) colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    const colorMatch = style.match(/(?<!background-)(?<!-)\bcolor\s*:\s*([^;]+)/i);
    if (colorMatch) {
      const hex = normalizeColor(colorMatch[1]);
      if (hex && !isNeutral(hex)) colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    const fontMatch = style.match(/font-family\s*:\s*([^;]+)/i);
    if (fontMatch) {
      const name = fontMatch[1].split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      if (name) fontFamilies.set(name, (fontFamilies.get(name) || 0) + 1);
    }
  });

  const sortedColors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedFonts = [...fontFamilies.entries()].sort((a, b) => b[1] - a[1]);

  return {
    accentColor: sortedColors[0]?.[0] || null,
    allColors: sortedColors.map(([hex, count]) => ({ hex, count })),
    fontFamily: sortedFonts[0]?.[0] || null,
  };
}

export default function CanvaStyleImporter({ onFontDetected }) {
  const [lastResult, setLastResult] = useState(null);

  const handlePaste = useCallback((e) => {
    const target = e.target;
    const isEditable =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (isEditable) return; // collage normal dans un champ de formulaire : ne rien intercepter

    const types = Array.from(e.clipboardData?.types || []);
    if (types.length === 0) return;

    let extraction = { accentColor: null, allColors: [], fontFamily: null };
    let sourceType = null;

    if (types.includes("text/html")) {
      const html = e.clipboardData.getData("text/html");
      extraction = extractFromHtml(html);
      sourceType = "text/html";
    } else if (types.includes("image/png") || types.includes("image/jpeg")) {
      sourceType = "image (extraction pixel — étape B, pas encore implémentée)";
    } else if (types.includes("text/plain")) {
      sourceType = "text/plain seul (aucune couleur/police détectable depuis du texte brut)";
    }

    if (extraction.fontFamily && onFontDetected) {
      onFontDetected(extraction.fontFamily);
    }

    setLastResult({
      types,
      sourceType,
      ...extraction,
      at: new Date().toLocaleTimeString("fr-FR"),
    });
  }, [onFontDetected]);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  if (!lastResult) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 text-xs animate-in fade-in slide-in-from-bottom-4"
      role="status"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-black text-gray-900">Style Canva détecté (diagnostic)</span>
        <button
          type="button"
          onClick={() => setLastResult(null)}
          className="text-gray-400 hover:text-gray-700 cursor-pointer"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="space-y-1.5 text-gray-700 font-medium">
        <div>
          <span className="text-gray-400">Formats presse-papiers :</span> {lastResult.types.join(", ") || "aucun"}
        </div>
        <div>
          <span className="text-gray-400">Source d'extraction :</span> {lastResult.sourceType || "—"}
        </div>

        {lastResult.accentColor ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Couleur d'accent proposée :</span>
            <span
              className="w-4 h-4 rounded-full border border-gray-300 inline-block"
              style={{ backgroundColor: lastResult.accentColor }}
            ></span>
            <span className="font-mono">{lastResult.accentColor}</span>
          </div>
        ) : (
          <div className="text-gray-400">Aucune couleur exploitable extraite.</div>
        )}

        {lastResult.allColors.length > 1 && (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-gray-400 mr-1">Autres couleurs vues :</span>
            {lastResult.allColors.slice(1, 6).map((c) => (
              <span
                key={c.hex}
                title={`${c.hex} (${c.count}×)`}
                className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block"
                style={{ backgroundColor: c.hex }}
              ></span>
            ))}
          </div>
        )}

        <div>
          <span className="text-gray-400">Police détectée :</span>{" "}
          {lastResult.fontFamily ? (
            <span className="text-emerald-600 font-bold">{lastResult.fontFamily} (appliquée)</span>
          ) : (
            <span className="text-gray-400">aucune</span>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
        {lastResult.fontFamily
          ? "Police appliquée immédiatement à l'aperçu. Couleur : diagnostic seul pour l'instant."
          : "Diagnostic seul — rien n'est appliqué au CV pour l'instant."}
      </p>
    </div>
  );
}
