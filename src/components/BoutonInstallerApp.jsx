"use client";

// Bouton « Télécharger l'application » — installe la PWA depuis le site,
// sans passer par le Play Store : le manifest et le service worker existent
// déjà (public/manifest.json, public/sw.js), il ne manquait qu'un endroit
// visible pour le déclencher. Jusqu'ici, seul le menu caché du navigateur
// permettait l'installation.
//
// Le bouton s'efface tout seul dans deux cas : l'app est déjà installée, ou
// le navigateur ne propose aucune voie d'installation (ni événement
// `beforeinstallprompt`, ni instructions iOS) — jamais un bouton qui ne fait
// rien au clic.
import { useState } from "react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

export default function BoutonInstallerApp({ className = "", compact = false, variant = "bouton" }) {
  const { peutProposer, proposerInstallation, installee, plateforme } = useInstallPrompt();
  const [instructionsIOS, setInstructionsIOS] = useState(false);

  if (installee) return null;
  if (!peutProposer && plateforme !== "ios") return null;

  const cliquer = async () => {
    if (plateforme === "ios") {
      setInstructionsIOS(true);
      return;
    }
    await proposerInstallation();
  };

  return (
    <>
      {variant === "tuile" ? (
        // Même gabarit que les autres tuiles « Nouveau » du menu mobile
        // (Mon activité, Établissements ouverts) : un bouton plutôt qu'un
        // Link, seule différence — celle-ci ne navigue nulle part, elle
        // déclenche l'installation.
        <button
          type="button"
          onClick={cliquer}
          className="rounded-2xl p-3.5 border shadow-xs transition active:scale-95 flex flex-col justify-between min-h-[92px] bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 hover:shadow-md cursor-pointer text-left"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-sm shadow-2xs">
              <i className="fa-solid fa-arrow-down-to-line"></i>
            </div>
            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-black rounded-md uppercase">
              Nouveau
            </span>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">
              Télécharger l&apos;application
            </h4>
            <p className="text-[10px] text-gray-500 font-medium truncate">
              {plateforme === "ios" ? "Installer sur iPhone / iPad" : "Installez Facilité en un geste"}
            </p>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={cliquer}
          className={
            className ||
            `flex items-center gap-2 font-extrabold text-white bg-[#1877F2] hover:bg-[#1566d8] transition cursor-pointer ${
              compact ? "text-xs px-3 py-2 rounded-xl" : "text-sm px-5 py-3 rounded-2xl"
            }`
          }
        >
          <i className="fa-solid fa-arrow-down-to-line"></i>
          {compact ? "Télécharger" : "Télécharger l'application"}
        </button>
      )}

      {instructionsIOS && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setInstructionsIOS(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setInstructionsIOS(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-pointer"
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <h3 className="text-base font-black text-gray-900 dark:text-white pr-8">
              Installer sur iPhone ou iPad
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
              Safari ne permet pas d&apos;installer en un clic — deux gestes suffisent :
            </p>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black flex items-center justify-center">
                  1
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  Appuyez sur <i className="fa-solid fa-arrow-up-from-bracket mx-1"></i>
                  <strong>Partager</strong>, en bas de l&apos;écran dans Safari.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black flex items-center justify-center">
                  2
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  Faites défiler et appuyez sur <strong>Sur l&apos;écran d&apos;accueil</strong>.
                </p>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setInstructionsIOS(false)}
              className="mt-5 w-full py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm cursor-pointer"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
