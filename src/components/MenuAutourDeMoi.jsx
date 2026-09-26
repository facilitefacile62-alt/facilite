"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bouton « Autour de moi » de la barre de navigation Marketplace, avec son menu
 * déroulant à trois choix :
 *  - liste  : « Articles proches »  → grille des articles de la zone, sans carte ;
 *  - mini   : « Mini carte »        → carte compacte au-dessus des catégories ;
 *  - pleine : « Pleine carte »      → explorateur de carte en grand écran.
 */
export const OPTIONS_AUTOUR_DE_MOI = [
  { mode: "liste", libelle: "Articles proches", sous: "Les articles de votre zone", icone: "fa-table-cells-large" },
  { mode: "mini", libelle: "Mini carte", sous: "Aperçu de la carte sur la page", icone: "fa-map" },
  { mode: "pleine", libelle: "Pleine carte", sous: "Carte en grand écran", icone: "fa-expand" },
];

const LARGEUR_MENU = 248;
const DUREE_ANIMATION_MS = 160;

export default function MenuAutourDeMoi({ onChoisir, className = "", title = "", children }) {
  const boutonRef = useRef(null);
  const menuRef = useRef(null);
  const minuterieRef = useRef(null);
  // `monte` : le menu existe dans la page ; `ouvert` : il est affiché (sert à l'animation d'entrée et de sortie).
  const [monte, setMonte] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState({ haut: 0, gauche: 0 });

  const fermer = useCallback(() => {
    setOuvert(false);
    clearTimeout(minuterieRef.current);
    minuterieRef.current = setTimeout(() => setMonte(false), DUREE_ANIMATION_MS);
  }, []);

  const ouvrir = () => {
    const bouton = boutonRef.current;
    if (bouton) {
      const r = bouton.getBoundingClientRect();
      const gauche = Math.min(
        Math.max(8, r.left + r.width / 2 - LARGEUR_MENU / 2),
        Math.max(8, window.innerWidth - LARGEUR_MENU - 8)
      );
      setPosition({ haut: r.bottom + 8, gauche });
    }
    clearTimeout(minuterieRef.current);
    setMonte(true);
    requestAnimationFrame(() => setOuvert(true));
  };

  const basculer = () => (ouvert ? fermer() : ouvrir());

  // Fermeture : clic à l'extérieur, Échap, redimensionnement, défilement.
  useEffect(() => {
    if (!monte) return undefined;
    const surClic = (e) => {
      if (menuRef.current?.contains(e.target) || boutonRef.current?.contains(e.target)) return;
      fermer();
    };
    const surTouche = (e) => {
      if (e.key === "Escape") {
        fermer();
        boutonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", surClic);
    document.addEventListener("keydown", surTouche);
    window.addEventListener("resize", fermer);
    window.addEventListener("scroll", fermer, true);
    return () => {
      document.removeEventListener("pointerdown", surClic);
      document.removeEventListener("keydown", surTouche);
      window.removeEventListener("resize", fermer);
      window.removeEventListener("scroll", fermer, true);
    };
  }, [monte, fermer]);

  useEffect(() => () => clearTimeout(minuterieRef.current), []);

  const choisir = (mode) => {
    fermer();
    onChoisir?.(mode);
  };

  return (
    <>
      <button
        ref={boutonRef}
        type="button"
        onClick={basculer}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title={title}
        className={className}
      >
        {children}
      </button>

      {monte && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Autour de moi"
          style={{ position: "fixed", top: position.haut, left: position.gauche, width: LARGEUR_MENU, zIndex: 700 }}
          className={`rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-xl p-1.5 origin-top transition duration-150 ease-out ${
            ouvert ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1 scale-95 pointer-events-none"
          }`}
        >
          {OPTIONS_AUTOUR_DE_MOI.map((o) => (
            <button
              key={o.mode}
              type="button"
              role="menuitem"
              onClick={() => choisir(o.mode)}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <span className="w-9 h-9 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
                <i className={`fa-solid ${o.icone}`}></i>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{o.libelle}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{o.sous}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
