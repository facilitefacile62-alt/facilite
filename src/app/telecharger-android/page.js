"use client";

import { useState } from "react";
import Link from "next/link";
import { getFaciliteWhatsAppUrl } from "@/lib/whatsappHelp";

// Informations de version du canal direct APK
// Note pour les futures mises à jour :
// 1. Remplacer le binaire dans public/facilite.apk
// 2. Mettre à jour les constantes ci-dessous (VERSION_APK, DATE_VERSION, TAILLE_FICHIER)
export const VERSION_APK = "1.0.4";
export const DATE_VERSION = "12 septembre 2026";
export const TAILLE_FICHIER = "1.2 Mo";
export const NOM_FICHIER = "facilite.apk";
export const CHEMIN_APK = "/facilite.apk";

export default function TelechargerAndroidPage() {
  const [etapeActive, setEtapeActive] = useState(1);
  const [faqOuverte, setFaqOuverte] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const FAQS = [
    {
      q: "Pourquoi Android affiche « Fichier potentiellement dangereux » ?",
      a: "Android affiche systématiquement cet avertissement pour tout fichier APK téléchargé directement depuis un navigateur web (Chrome, Samsung Internet, Firefox, etc.) plutôt que depuis le Google Play Store. Ce n'est pas un signe d'infection ou de danger : c'est un message de sécurité standard d'Android. L'application Facilité est 100% sûre, signée et développée par notre équipe officielle.",
    },
    {
      q: "Comment autoriser l'installation sur mon téléphone ?",
      a: "Lors de l'ouverture du fichier, Android vous redirigera vers les Paramètres. Il suffit d'activer l'option « Autoriser cette source » pour votre navigateur (Chrome ou Samsung Internet), puis de revenir en arrière et de toucher « Installer ».",
    },
    {
      q: "Comment fonctionne la mise à jour des versions futures ?",
      a: "Ce canal direct ne propose pas de mise à jour automatique en arrière-plan. Lorsqu'une nouvelle version majeure sera publiée, il vous suffira de revenir sur cette page (/telecharger-android) et de télécharger la nouvelle version qui s'installera simplement par-dessus l'ancienne sans perdre vos données.",
    },
    {
      q: "L'application est-elle identique à la version Google Play ?",
      a: "Oui, c'est rigoureusement la même application officielle Facilité, développée par la même équipe et connectée aux mêmes serveurs sécurisés. Ce canal direct permet simplement une installation immédiate et indépendante.",
    },
    {
      q: "Quelle version d'Android est requise ?",
      a: "L'application est compatible avec Android 8.0 (Oreo) et toutes les versions supérieures (Android 9, 10, 11, 12, 13, 14 et 15).",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-950 text-xs sm:text-sm font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <i className="fa-solid fa-circle-check text-emerald-400 dark:text-emerald-600"></i>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 px-4 max-w-5xl mx-auto text-center">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black">
            <i className="fa-brands fa-android text-emerald-600 dark:text-emerald-400 text-sm"></i>
            Canal Direct Officiel Android
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold">
            <i className="fa-solid fa-code-commit text-[10px]"></i>
            Version {VERSION_APK}
          </span>
        </div>

        {/* Titre Principal */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-950 dark:text-white leading-tight">
          Télécharger l&apos;application <br className="hidden sm:inline" />
          <span className="text-[#00c988] dark:text-[#10e688]">Facilité</span> pour Android (APK)
        </h1>

        <p className="mt-3 text-xs sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Installez directement l&apos;application sur votre smartphone ou tablette Android sans passer par le Play Store. Téléchargement direct, rapide et 100% sécurisé.
        </p>

        {/* CARTE DE TÉLÉCHARGEMENT PRINCIPALE */}
        <div className="mt-8 max-w-md mx-auto bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200/80 dark:border-zinc-800 text-left relative overflow-hidden">
          <div className="flex items-center gap-4 pb-5 border-b border-gray-100 dark:border-zinc-800">
            <div className="w-14 h-14 rounded-2xl bg-[#10e688]/20 dark:bg-[#10e688]/10 border border-emerald-300 dark:border-emerald-700/50 flex items-center justify-center shrink-0">
              <i className="fa-brands fa-android text-3xl text-emerald-600 dark:text-emerald-400"></i>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">
                Facilité Android APK
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {NOM_FICHIER} · {TAILLE_FICHIER}
              </p>
            </div>
          </div>

          {/* Métadonnées de version */}
          <div className="py-4 space-y-2 text-xs">
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
              <span>Date de publication</span>
              <span className="font-bold text-gray-900 dark:text-white">{DATE_VERSION}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
              <span>Compatibilité</span>
              <span className="font-bold text-gray-900 dark:text-white">Android 8.0 et supérieur</span>
            </div>
            <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
              <span>Authenticité</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <i className="fa-solid fa-shield-check"></i> Signé officiel Facilité
              </span>
            </div>
          </div>

          {/* Bouton de Téléchargement Direct */}
          <a
            href={CHEMIN_APK}
            download={NOM_FICHIER}
            onClick={() => showToast("Téléchargement du fichier APK démarré...")}
            className="w-full mt-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#10e688] to-[#00c988] hover:from-[#0fd57d] hover:to-[#00b377] text-gray-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98] transition cursor-pointer"
          >
            <i className="fa-solid fa-download text-lg animate-bounce"></i>
            <span>Télécharger l&apos;APK ({TAILLE_FICHIER})</span>
          </a>

          <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-3">
            Lien direct sans redirection publicitaire ni intermédiaire.
          </p>
        </div>
      </section>

      {/* GUIDE D'INSTALLATION PAS À PAS */}
      <section className="py-10 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <span className="px-3 py-1 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-xs font-bold uppercase tracking-wider">
            Guide d&apos;installation
          </span>
          <h2 className="text-xl sm:text-3xl font-black text-gray-950 dark:text-white mt-2">
            Comment installer l&apos;application en 4 étapes simples
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Suivez ces instructions pour installer facilement l&apos;APK sur votre smartphone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Étape 1 */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-lg flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                Téléchargez le fichier APK
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Appuyez sur le bouton vert <strong>« Télécharger l&apos;APK »</strong> ci-dessus. Le téléchargement commence dans votre navigateur.
              </p>
            </div>
          </div>

          {/* Étape 2 */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-lg flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                Ouvrez le fichier téléchargé
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Une fois le téléchargement terminé, touchez la notification ou ouvrez le dossier <strong>Téléchargements</strong> de votre appareil.
              </p>
            </div>
          </div>

          {/* Étape 3 (Avertissement source inconnue) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 shadow-sm flex items-start gap-4 md:col-span-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black text-lg flex items-center justify-center shrink-0">
              3
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                  Autorisez l&apos;installation (« Source inconnue »)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                  Important &amp; Normal
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Android affiche par défaut le message <em>« Fichier potentiellement dangereux »</em> ou <em>« Application de source inconnue »</em> pour tout fichier téléchargé en dehors du Play Store. <strong>C&apos;est tout à fait normal et attendu</strong>.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                👉 <strong>Action :</strong> Touchez <strong>Paramètres</strong> &gt; Activez <strong>« Autoriser cette source »</strong> pour votre navigateur, puis revenez en arrière.
              </div>
            </div>
          </div>

          {/* Étape 4 */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-sm flex items-start gap-4 md:col-span-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black text-lg flex items-center justify-center shrink-0">
              4
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                Installez et lancez Facilité
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Appuyez sur <strong>« Installer »</strong>. L&apos;icône Facilité apparaîtra instantanément sur votre écran d&apos;accueil. Ouvrez l&apos;application et profitez de tous vos services !
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SÉCURITÉ & TRANSPARENCE */}
      <section className="py-8 px-4 max-w-4xl mx-auto">
        <div className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl"></div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#10e688]/20 flex items-center justify-center text-[#10e688] text-xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h2 className="text-lg sm:text-2xl font-black">
              Sécurité, Confidentialité &amp; Authenticité
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mt-4">
            <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 space-y-1">
              <i className="fa-solid fa-lock text-[#10e688] text-base mb-1"></i>
              <h4 className="font-extrabold text-white">Même équipe officielle</h4>
              <p className="text-emerald-200/80 leading-relaxed">
                Développée et signée par l&apos;équipe technique officielle de ffacilite.com.
              </p>
            </div>

            <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 space-y-1">
              <i className="fa-solid fa-user-shield text-[#10e688] text-base mb-1"></i>
              <h4 className="font-extrabold text-white">Zéro traqueur</h4>
              <p className="text-emerald-200/80 leading-relaxed">
                Pas de publicité invasive, respect strict de la confidentialité de vos données et CVs.
              </p>
            </div>

            <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/60 space-y-1">
              <i className="fa-solid fa-bolt text-[#10e688] text-base mb-1"></i>
              <h4 className="font-extrabold text-white">Canal Direct &amp; Rapide</h4>
              <p className="text-emerald-200/80 leading-relaxed">
                Accès immédiat sans délai de validation tiers, idéal pour les connexions locales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-10 px-4 max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white">
            Questions fréquentes sur l&apos;APK Android
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden transition shadow-xs"
            >
              <button
                type="button"
                onClick={() => setFaqOuverte(faqOuverte === index ? null : index)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-3 cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                  {faq.q}
                </span>
                <i
                  className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 ${
                    faqOuverte === index ? "rotate-180 text-emerald-500" : ""
                  }`}
                ></i>
              </button>
              {faqOuverte === index && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-zinc-800/60 pt-3 animate-fadeIn">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SUPPORT & ASSISTANCE WHATSAPP */}
      <section className="py-8 pb-16 px-4 max-w-4xl mx-auto text-center">
        <div className="p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-sm space-y-3">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
            Besoin d&apos;aide pour l&apos;installation ?
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Notre équipe d&apos;assistance est disponible sur WhatsApp pour vous guider pas à pas dans l&apos;installation sur votre téléphone.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <a
              href={getFaciliteWhatsAppUrl({ page: "Aide Téléchargement APK Android" })}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
            >
              <i className="fa-brands fa-whatsapp text-sm"></i>
              <span>Contacter le support WhatsApp</span>
            </a>
            <Link
              href="/"
              className="py-2.5 px-5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-bold text-xs transition"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
