"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Pattern standard de détection de montage client : ne peut pas être
    // calculé pendant le rendu par définition, l'objectif est justement de
    // distinguer le premier rendu serveur/client du suivant (next-themes
    // dépend de localStorage, absent côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
      <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center space-x-2">
        <i className="fa-solid fa-gear text-gray-500 dark:text-gray-400"></i>
        <span>Paramètres</span>
      </h2>
      
      <div className="flex flex-col space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800/60">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <i className="fa-solid fa-circle-half-stroke"></i>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Thème de l'application</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Personnalisez l'apparence de Facilite</p>
            </div>
          </div>

          <div className="flex bg-gray-200 dark:bg-gray-900 p-1 rounded-xl">
            <button
              onClick={() => setTheme("system")}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                theme === "system"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <i className="fa-solid fa-desktop"></i>
              <span className="hidden sm:inline">Système</span>
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <i className="fa-regular fa-sun"></i>
              <span className="hidden sm:inline">Clair</span>
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              <i className="fa-regular fa-moon"></i>
              <span className="hidden sm:inline">Sombre</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
