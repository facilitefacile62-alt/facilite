"use client";

import { useState, useSyncExternalStore, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { estDansAppPlay } from "@/lib/contextePlay";
import {
  chargerMesBoutiques,
  obtenirTauxJetons,
  obtenirSoldeJetons,
  obtenirPremiumActif,
  activerPremiumMarketplace,
} from "@/lib/marketplaceData";

// Garde-fou TWA (inchangé depuis la première version de cette page) :
// Google Play Billing est écarté pour cet achat — le Sénégal ne permet pas
// l'inscription marchand Google — et un achat de jetons initié depuis
// l'app Android installée serait de toute façon un achat de contenu
// numérique fait ET livré dans l'app, donc soumis à la même politique Play
// Billing que la confection de CV (voir contextePlay.js). Le paiement ne
// doit donc jamais apparaître dans la TWA.
//
// Deux niveaux de protection :
// 1. Structurel (garanti) : cette page n'est volontairement PAS ajoutée à
//    la liste blanche WEB_ECRANS de l'app mobile Expo
//    (mobile/src/lib/webEcrans.ts) — elle est donc physiquement
//    inatteignable depuis l'app installée, quel que soit le comportement
//    du referrer.
// 2. Défense en profondeur (ce composant) : estDansAppPlay() couvre le cas
//    d'une vraie TWA Bubblewrap du même package Android
//    (com.ffacilite.app, voir public/.well-known/assetlinks.json) qui
//    afficherait un jour le site complet plutôt qu'un WebView applicatif
//    restreint — même détection déjà éprouvée par PricingModal.js.
//
// Message affiché dans ce cas : AUCUNE mention d'un autre moyen de payer
// ni d'une URL à ouvrir ailleurs — la règle anti-steering de Google
// interdit jusqu'à l'allusion (voir PricingModal.js, même raisonnement).
const POLL_INTERVAL_MS = 4000;

function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

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

  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState(null);
  const [taux, setTaux] = useState(null);
  const [soldeJetons, setSoldeJetons] = useState(0);
  const [premiumActif, setPremiumActif] = useState(null);
  const [erreurChargement, setErreurChargement] = useState("");

  const [quantiteAchat, setQuantiteAchat] = useState(10);
  const [paiement, setPaiement] = useState(null);
  const [statutAchat, setStatutAchat] = useState("inactif"); // inactif | chargement | attente | succes | echec
  const [erreurAchat, setErreurAchat] = useState("");
  const intervalRef = useRef(null);

  const [activationEnCours, setActivationEnCours] = useState(false);
  const [erreurActivation, setErreurActivation] = useState("");

  const chargerTout = useCallback(async () => {
    if (!user?.id) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreurChargement("");
    try {
      const [boutiques, tauxCourant] = await Promise.all([chargerMesBoutiques(user.id), obtenirTauxJetons()]);
      const maBoutique = boutiques[0] || null;
      setBoutique(maBoutique);
      setTaux(tauxCourant);

      if (maBoutique) {
        const [solde, actif] = await Promise.all([
          obtenirSoldeJetons(maBoutique.id),
          obtenirPremiumActif(maBoutique.id),
        ]);
        setSoldeJetons(solde);
        setPremiumActif(actif);
      }
    } catch (err) {
      setErreurChargement(err.message || "Impossible de charger vos informations.");
    } finally {
      setChargement(false);
    }
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => chargerTout());
  }, [chargerTout]);

  const arreterSondage = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => arreterSondage(), [arreterSondage]);

  const genererPaiement = async () => {
    if (!session || !boutique) return;
    setErreurAchat("");
    setStatutAchat("chargement");

    try {
      const res = await fetch("/api/pay/jetons-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId: boutique.id, quantiteJetons: quantiteAchat }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.qrId) {
        setErreurAchat(data.error || "Impossible de générer le QR de paiement. Réessayez.");
        setStatutAchat("inactif");
        return;
      }

      setPaiement(data);
      setStatutAchat("attente");

      arreterSondage();
      intervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/pay/jetons-checkout?transactionId=${data.transactionId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const statusData = await statusRes.json().catch(() => ({}));

          if (statusData.status === "success") {
            setStatutAchat("succes");
            arreterSondage();
            chargerTout();
          } else if (statusData.status === "failed") {
            setStatutAchat("echec");
            arreterSondage();
          }
        } catch {
          // Panne réseau passagère du sondage : ne casse pas l'affichage,
          // la prochaine tentative reprendra normalement.
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error("Erreur génération paiement jetons :", err);
      setErreurAchat("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setStatutAchat("inactif");
    }
  };

  const nouvelAchat = () => {
    setPaiement(null);
    setStatutAchat("inactif");
    setErreurAchat("");
  };

  const activerPremium = async () => {
    if (!boutique) return;
    setErreurActivation("");
    setActivationEnCours(true);
    try {
      await activerPremiumMarketplace(boutique.id);
      await chargerTout();
    } catch (err) {
      setErreurActivation(err.message || "Impossible d'activer Premium Marketplace.");
    } finally {
      setActivationEnCours(false);
    }
  };

  const jetonsRequis = taux?.jetons_requis_premium_an ?? null;
  const soldeSuffisant = jetonsRequis != null && soldeJetons >= jetonsRequis;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-12 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-solid fa-crown"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Premium Marketplace
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Jetons rechargeables pour mettre votre boutique en avant sur la carte et la recherche.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 sm:p-8">
          {dansAppPlay ? (
            <div className="text-center py-6">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
                Indisponible dans l&apos;application
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Premium Marketplace n&apos;est pas proposé ici pour le moment.
              </p>
            </div>
          ) : !user ? (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">
              Connectez-vous pour gérer les jetons de votre boutique.
            </p>
          ) : chargement ? (
            <div className="text-center py-10">
              <span className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin inline-block"></span>
            </div>
          ) : erreurChargement ? (
            <p className="text-xs text-red-600 dark:text-red-400 text-center py-4">{erreurChargement}</p>
          ) : !boutique ? (
            <div className="text-center py-6">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Vous n&apos;avez pas encore de boutique
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-4">
                Premium Marketplace s&apos;active sur une boutique — ouvrez la vôtre d&apos;abord, gratuitement.
              </p>
              <Link
                href="/marketplace?onglet=vendre"
                className="inline-block px-6 py-3 rounded-2xl bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold text-sm transition"
              >
                Ouvrir ma boutique
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statut Premium actuel */}
              <div
                className={`rounded-2xl p-4 border ${
                  premiumActif
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                    : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
                }`}
              >
                <p className={`text-sm font-black ${premiumActif ? "text-emerald-700 dark:text-emerald-300" : "text-gray-700 dark:text-gray-300"}`}>
                  {premiumActif ? "Premium Marketplace actif" : "Premium Marketplace non actif"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {premiumActif
                    ? `Valable jusqu'au ${formatDateFr(premiumActif.date_expiration)}. Priorité de position sur la carte et la recherche.`
                    : "Activez-le en dépensant vos jetons pour mettre votre boutique en avant pendant 1 an."}
                </p>
              </div>

              {/* Solde de jetons */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Solde de jetons</span>
                <span className="text-xl font-extrabold text-gray-900 dark:text-white">{soldeJetons}</span>
              </div>

              {/* Activation Premium */}
              {!premiumActif && (
                <div>
                  <button
                    type="button"
                    onClick={activerPremium}
                    disabled={!soldeSuffisant || activationEnCours}
                    className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {activationEnCours ? (
                      <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <i className="fa-solid fa-crown"></i>
                    )}
                    {jetonsRequis != null
                      ? `Activer Premium pour ${jetonsRequis} jetons`
                      : "Activer Premium Marketplace"}
                  </button>
                  {!soldeSuffisant && jetonsRequis != null && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-2">
                      Il vous manque {jetonsRequis - soldeJetons} jeton{jetonsRequis - soldeJetons > 1 ? "s" : ""}.
                    </p>
                  )}
                  {erreurActivation && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">{erreurActivation}</p>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Acheter des jetons</p>

                {statutAchat === "succes" ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center mx-auto mb-3 text-lg">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Paiement confirmé</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                      Vos jetons ont été crédités.
                    </p>
                    <button
                      type="button"
                      onClick={nouvelAchat}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Acheter d&apos;autres jetons
                    </button>
                  </div>
                ) : statutAchat === "attente" && paiement ? (
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
                      {paiement.quantiteJetons} jeton{paiement.quantiteJetons > 1 ? "s" : ""} · {paiement.montantXof} FCFA
                      <br />
                      Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
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
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={quantiteAchat}
                        onChange={(e) => setQuantiteAchat(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-24 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-center"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        jeton{quantiteAchat > 1 ? "s" : ""}
                        {taux && ` · ${quantiteAchat * taux.cout_jeton_fcfa} FCFA`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={genererPaiement}
                      disabled={statutAchat === "chargement"}
                      className="w-full py-3.5 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {statutAchat === "chargement" ? (
                        <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <i className="fa-solid fa-qrcode"></i>
                      )}
                      Générer mon QR de paiement Orange Money
                    </button>
                    {statutAchat === "echec" && (
                      <p className="text-xs text-red-600 dark:text-red-400 text-center mt-3">
                        Le paiement n&apos;a pas abouti. Vous pouvez réessayer.
                      </p>
                    )}
                    {erreurAchat && (
                      <p className="text-xs text-red-600 dark:text-red-400 text-center mt-3">{erreurAchat}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
