"use client";

import { useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { estDansAppPlay } from "@/lib/contextePlay";

// Garde-fou TWA (Point 1 de l'intégration Orange Money) : Google Play
// Billing est écarté pour cet abonnement — le Sénégal ne permet pas
// l'inscription marchand Google — et une transaction Orange Money
// initiée depuis l'app Android installée serait de toute façon un achat
// de contenu numérique fait ET livré dans l'app, donc soumise à la même
// politique Play Billing que la confection de CV (voir contextePlay.js).
// Le paiement ne doit donc jamais apparaître dans la TWA.
//
// Deux niveaux de protection :
// 1. Structurel (garanti) : cette page n'est volontairement PAS ajoutée à
//    la liste blanche WEB_ECRANS de l'app mobile Expo
//    (mobile/src/lib/webEcrans.ts) — elle est donc physiquement
//    inatteignable depuis l'app installée, quel que soit le comportement
//    du referrer.
// 2. Défense en profondeur (ce composant) : estDansAppPlay() couvre le
//    cas d'une vraie TWA Bubblewrap du même package Android
//    (com.ffacilite.app, voir public/.well-known/assetlinks.json) qui
//    afficherait un jour le site complet plutôt qu'un WebView applicatif
//    restreint — même détection déjà éprouvée par PricingModal.js pour la
//    confection de CV.
//
// Note technique : l'app mobile actuelle (mobile/) charge ses pages web via
// react-native-webview (mobile/src/app/web/[cle].tsx), qui NE pose PAS le
// referrer "android-app://" qu'une vraie TWA pose — estDansAppPlay() y
// renverrait donc faux même si la page s'y affichait. C'est justement pour
// cela que la protection n°1 (absence totale de la page dans la liste
// blanche de l'app) est la garantie réelle ici, celle-ci n'étant qu'un
// filet de sécurité supplémentaire.
const URL_PREMIUM_WEB = "https://ffacilite.com/premium";

export default function PremiumClient() {
  const { user } = useAuth();

  // document.referrer / sessionStorage ne peuvent pas être lus au rendu
  // serveur — useSyncExternalStore évite l'aller-retour "affiche le
  // paiement, puis le masque dans un effet", qui le ferait apparaître le
  // temps d'une image dans l'app. Même patron que PricingModal.js.
  const dansAppPlay = useSyncExternalStore(
    () => () => {},
    () => estDansAppPlay(),
    () => false
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-12 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-solid fa-crown"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Facilité Premium
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Débloquez les fonctionnalités avancées de la plateforme.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 sm:p-8">
          {dansAppPlay ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-4 text-lg">
                <i className="fa-solid fa-globe"></i>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Pour souscrire, ouvrez ffacilite.com dans votre navigateur
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                L&apos;abonnement Premium n&apos;est pas disponible dans l&apos;application installée.
              </p>
              <p className="mt-4 inline-block text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-xl select-all">
                {URL_PREMIUM_WEB}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-center gap-1 mb-6">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">2 000</span>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">FCFA / mois</span>
              </div>

              {/* Paiement Orange Money — mécanique réelle à brancher
                  (Points 2-4 : jeton OAuth2, session de paiement, saisie
                  OTP, confirmation). Pas de fausse UI fonctionnelle en
                  attendant : alerte honnête, même convention que le reste
                  de l'app pour une fonctionnalité pas encore branchée. */}
              <button
                type="button"
                disabled
                title="Bientôt disponible"
                className="w-full py-3.5 px-6 rounded-2xl bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 font-extrabold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-mobile-screen-button"></i>
                Payer avec Orange Money — bientôt disponible
              </button>
              <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-3">
                {user ? "Le paiement Orange Money arrive dans une prochaine mise à jour." : "Connectez-vous pour souscrire à Facilité Premium."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
