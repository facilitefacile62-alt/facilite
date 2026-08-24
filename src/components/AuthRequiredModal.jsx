"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AuthRequiredModal({
  isOpen,
  onClose,
  featureName = "cette fonctionnalité",
  featureIcon = "fa-solid fa-lock",
  redirectUrl = "/fonctionnalites",
}) {
  // Fermeture avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const returnUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : redirectUrl;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 text-center overflow-hidden transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>

        {/* Halo décoratif */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Icône principale */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20 mb-5">
          <i className={featureIcon}></i>
        </div>

        {/* Titre & Description */}
        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
          Inscription Requise
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed mb-6">
          Pour utiliser <span className="font-bold text-emerald-600 dark:text-emerald-400">{featureName}</span> et accéder à l'ensemble des outils PDF & IA, veuillez créer un compte gratuit ou vous connecter.
        </p>

        {/* Avantages réassurance */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-3.5 mb-6 text-left space-y-2">
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
            <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i>
            <span>Compte 100% gratuit en moins de 30 secondes</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
            <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i>
            <span>Accès illimité aux outils PDF, IA et modèles</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
            <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i>
            <span>Téléchargements instantanés et sécurisés</span>
          </div>
        </div>

        {/* Boutons d'Action */}
        <div className="space-y-2.5">
          <Link
            href={`/register?redirect=${encodeURIComponent(returnUrl)}`}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Créer mon compte gratuit</span>
          </Link>

          <Link
            href={`/login?redirect=${encodeURIComponent(returnUrl)}`}
            className="w-full py-3 px-5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-right-to-bracket"></i>
            <span>J'ai déjà un compte (Se connecter)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
