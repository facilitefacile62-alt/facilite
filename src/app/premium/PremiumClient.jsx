"use client";

import { useState, useSyncExternalStore, useEffect, useRef, useCallback } from "react";
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
// Message affiché dans ce cas : AUCUNE mention d'un autre moyen de payer
// ni d'une URL à ouvrir ailleurs — la règle anti-steering de Google
// interdit jusqu'à l'allusion (voir PricingModal.js, même raisonnement,
// et le retrait de la recharge de crédits documenté dans
// src/app/api/pay/checkout/route.js). Une première version de ce
// composant affichait "ouvrez ffacilite.com dans votre navigateur" — c'est
// exactement l'allusion que la règle interdit, corrigé ici pour rester
// cohérent avec PricingModal.js.
//
// Note technique : l'app mobile actuelle (mobile/) charge ses pages web via
// react-native-webview (mobile/src/app/web/[cle].tsx), qui NE pose PAS le
// referrer "android-app://" qu'une vraie TWA pose — estDansAppPlay() y
// renverrait donc faux même si la page s'y affichait. C'est justement pour
// cela que la protection n°1 (absence totale de la page dans la liste
// blanche de l'app) est la garantie réelle ici, celle-ci n'étant qu'un
// filet de sécurité supplémentaire.

const POLL_INTERVAL_MS = 4000;

export default function PremiumClient() {
  const { user, session } = useAuth();

  // document.referrer / sessionStorage ne peuvent pas être lus au rendu
  // serveur — useSyncExternalStore évite l'aller-retour "affiche le
  // paiement, puis le masque dans un effet", qui le ferait apparaître le
  // temps d'une image dans l'app. Même patron que PricingModal.js.
  const dansAppPlay = useSyncExternalStore(
    () => () => {},
    () => estDansAppPlay(),
    () => false
  );

  const [paiement, setPaiement] = useState(null); // { transactionId, qrCodeBase64, deepLinkMaxit, deepLinkOm }
  const [statut, setStatut] = useState("inactif"); // inactif | chargement | attente | succes | echec
  const [erreur, setErreur] = useState("");
  const intervalRef = useRef(null);

  const arreterSondage = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => arreterSondage(), [arreterSondage]);

  const genererPaiement = async () => {
    if (!session) return;
    setErreur("");
    setStatut("chargement");

    try {
      const res = await fetch("/api/pay/orange-money-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.qrId) {
        setErreur(data.error || "Impossible de générer le QR de paiement. Réessayez.");
        setStatut("inactif");
        return;
      }

      setPaiement(data);
      setStatut("attente");

      arreterSondage();
      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/pay/orange-money-checkout?transactionId=${data.transactionId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const statusData = await statusRes.json().catch(() => ({}));

          if (statusData.status === "success") {
            setStatut("succes");
            arreterSondage();
          } else if (statusData.status === "failed") {
            setStatut("echec");
            arreterSondage();
          }
        } catch {
          // Panne réseau passagère du sondage : ne casse pas l'affichage,
          // la prochaine tentative reprendra normalement.
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error("Erreur génération paiement Orange Money :", err);
      setErreur("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setStatut("inactif");
    }
  };

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
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
                Indisponible dans l&apos;application
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                L&apos;abonnement Premium n&apos;est pas proposé ici pour le moment.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-center gap-1 mb-6">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">2 000</span>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">FCFA / mois</span>
              </div>

              {!user ? (
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">
                  Connectez-vous pour souscrire à Facilité Premium.
                </p>
              ) : statut === "succes" ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center mx-auto mb-4 text-lg">
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Paiement confirmé</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Votre abonnement Premium est actif.
                  </p>
                </div>
              ) : statut === "attente" && paiement ? (
                <div className="text-center">
                  {paiement.qrCodeBase64 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${paiement.qrCodeBase64}`}
                      alt="QR code de paiement Orange Money"
                      className="w-48 h-48 mx-auto rounded-xl border border-gray-200 dark:border-gray-800"
                    />
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                    Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez
                    directement votre application :
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    {paiement.deepLinkOm && (
                      <a
                        href={paiement.deepLinkOm}
                        className="flex-1 py-3 px-4 rounded-2xl bg-orange-500 text-white font-extrabold text-sm hover:bg-orange-600 transition-colors"
                      >
                        Ouvrir Orange Money
                      </a>
                    )}
                    {paiement.deepLinkMaxit && (
                      <a
                        href={paiement.deepLinkMaxit}
                        className="flex-1 py-3 px-4 rounded-2xl bg-gray-900 text-white font-extrabold text-sm hover:bg-black transition-colors"
                      >
                        Ouvrir MAXIT
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-4 flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin"></span>
                    En attente de confirmation du paiement…
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={genererPaiement}
                    disabled={statut === "chargement"}
                    className="w-full py-3.5 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {statut === "chargement" ? (
                      <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <i className="fa-solid fa-qrcode"></i>
                    )}
                    Générer mon QR de paiement Orange Money
                  </button>
                  {statut === "echec" && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center mt-3">
                      Le paiement n&apos;a pas abouti. Vous pouvez réessayer.
                    </p>
                  )}
                  {erreur && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center mt-3">{erreur}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
