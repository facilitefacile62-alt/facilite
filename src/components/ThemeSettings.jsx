"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectTheme = (newTheme) => {
    setTheme(newTheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (newTheme === "dark") {
        root.classList.add("dark");
      } else if (newTheme === "light") {
        root.classList.remove("dark");
      } else {
        const isSystemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isSystemDark) root.classList.add("dark");
        else root.classList.remove("dark");
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs transition-all duration-300">
      {/* Label de catégorie en haut */}
      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-wider uppercase mb-3">
        APPARENCE
      </p>

      {/* Ligne Thème */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0">
          {/* Icône carrée avec division diagonale conforme 1:1 à la capture */}
          <div className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 flex items-center justify-center text-gray-800 dark:text-gray-200 shrink-0">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="3" y1="21" x2="21" y2="3" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">Thème</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Apparence de Facilite</p>
          </div>
        </div>

        {/* Sélecteur d'icônes Système / Clair / Sombre */}
        <div className="flex items-center bg-gray-100/90 dark:bg-gray-800/90 p-1 rounded-xl border border-gray-200/60 dark:border-gray-700/60 shrink-0">
          <button
            type="button"
            onClick={() => handleSelectTheme("system")}
            title="Thème Système"
            aria-label="Thème Système"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer ${
              theme === "system"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold"
                : "text-gray-400 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <i className="fa-solid fa-desktop text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTheme("light")}
            title="Thème Clair"
            aria-label="Thème Clair"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer ${
              theme === "light"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold"
                : "text-gray-400 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <i className="fa-regular fa-sun text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTheme("dark")}
            title="Thème Sombre"
            aria-label="Thème Sombre"
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer ${
              theme === "dark"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold"
                : "text-gray-400 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <i className="fa-regular fa-moon text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
