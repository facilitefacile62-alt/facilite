"use client";

import { useState } from "react";
import Link from "next/link";

// Pied de page global, rendu sur tout le site (voir layout.js, même garde
// !dansAppMobile que <Header />) — avant ce composant, /confidentialite
// n'était linké nulle part en dehors des 3 pages légales elles-mêmes
// (confidentialite/conditions/suppression-compte se renvoyaient entre
// elles), invisible depuis l'accueil ou le reste du site. Signalé lors
// d'un rejet Google Play ("Invalid Privacy policy") : l'URL déclarée en
// Play Console pointait par erreur vers une page de profil connectée —
// la vraie page était déjà publique, juste introuvable depuis le site.
const URL_CONFIDENTIALITE = "https://ffacilite.com/confidentialite";

export default function Footer() {
  const [copie, setCopie] = useState(false);

  const copierLien = async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(URL_CONFIDENTIALITE);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée...) — le lien reste cliquable juste à côté, pas bloquant.
    }
  };

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-4 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 flex-wrap">
        <span>© {new Date().getFullYear()} Facilité</span>
        <span className="hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1.5">
          <Link href="/confidentialite" className="hover:text-emerald-600 dark:hover:text-[#10E688] transition">
            Politique de confidentialité
          </Link>
          <button
            type="button"
            onClick={copierLien}
            title="Copier le lien"
            className="text-gray-400 hover:text-emerald-600 dark:hover:text-[#10E688] transition cursor-pointer"
          >
            <i className={`fa-solid ${copie ? "fa-check text-emerald-600 dark:text-[#10E688]" : "fa-copy"} text-[10px]`}></i>
          </button>
        </span>
        {copie && <span className="text-emerald-600 dark:text-[#10E688]">Lien copié !</span>}
        <span className="hidden sm:inline">·</span>
        <Link href="/conditions" className="hover:text-emerald-600 dark:hover:text-[#10E688] transition">
          Conditions d&apos;utilisation
        </Link>
      </div>
    </footer>
  );
}
