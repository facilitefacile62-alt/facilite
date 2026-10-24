"use client";

import { useState, useSyncExternalStore, useEffect, useRef, useCallback } from "react";
import { useOuvertureAppPaiement } from "@/lib/useOuvertureAppPaiement";
import { aideBoutonPaiement, libelleBoutonPaiement } from "@/lib/ouvertureAppPaiement";
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

export default function PremiumClient({ orangeActif = false }) {
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

  // Retour depuis Orange (callbackSuccessUrl / callbackCancelUrl → ?statut=succes|annule&commande=<id>) : la page LIT l'état de la commande,
  // elle ne crédite jamais sur la seule foi de ce retour (seule la confirmation serveur auprès d'Orange crédite).
  const [retour, setRetour] = useState(null); // { statut, etat: "verification" | "succes" | "echec" | "annule" }
  const [qrExpire, setQrExpire] = useState(false);
  const interrogerRef = useRef(null);

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
    interrogerRef.current = null;
  }, []);

  // Ouverture automatique de MAXIT sur téléphone (une seule fois par commande) et interrogation immédiate du statut au retour dans le navigateur.
  const { estMobile, tenterAuto } = useOuvertureAppPaiement({
    actif: statutAchat === "attente" && Boolean(paiement) && !qrExpire,
    interroger: () => interrogerRef.current?.(),
  });

  useEffect(() => () => arreterSondage(), [arreterSondage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statut = params.get("statut");
    const commande = params.get("commande");
    if (!statut || !commande || !session) return undefined;
    if (statut === "annule") {
      setRetour({ statut, etat: "annule" });
      return undefined;
    }
    setRetour({ statut, etat: "verification" });
    let essais = 0;
    const minuteur = setInterval(async () => {
      essais += 1;
      try {
        const res = await fetch(`/api/pay/jetons-checkout?transactionId=${encodeURIComponent(commande)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data = await res.json().catch(() => ({}));
        if (data.status === "success") {
          setRetour({ statut, etat: "succes" });
          clearInterval(minuteur);
          chargerTout();
        } else if (data.status === "failed") {
          setRetour({ statut, etat: "echec" });
          clearInterval(minuteur);
        }
      } catch {
        // Panne passagère : on réessaie au prochain tour.
      }
      if (essais >= 40) clearInterval(minuteur); // ~2 min ; le rattrapage serveur prend ensuite le relais
    }, POLL_INTERVAL_MS);
    return () => clearInterval(minuteur);
  }, [session, chargerTout]);

  // QR expiré (validité 15 min, code Orange 4004) : plus de paiement possible avec ce code, on propose d'en générer un nouveau.
  useEffect(() => {
    if (statutAchat !== "attente" || !paiement?.validForSeconds) return undefined;
    const t = setTimeout(() => setQrExpire(true), paiement.validForSeconds * 1000);
    return () => clearTimeout(t);
  }, [statutAchat, paiement]);

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
      setQrExpire(false);
      setStatutAchat("attente");

      arreterSondage();
      const interroger = async () => {
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
      };
      interrogerRef.current = interroger;
      intervalRef.current = setInterval(interroger, POLL_INTERVAL_MS);
      // Une seule tentative automatique par commande ; le QR et les boutons restent affichés si l'application ne s'ouvre pas.
      tenterAuto(data.transactionId, { deepLinkMaxit: data.deepLinkMaxit, deepLinkOm: data.deepLinkOm, deepLink: data.deepLink });
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
      setErreurActivation(err.message || "Impossible d'activer Premium Locaux.");
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
            Premium Locaux
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
                Premium Locaux n&apos;est pas proposé ici pour le moment.
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
                Premium Locaux s&apos;active sur une boutique — ouvrez la vôtre d&apos;abord, gratuitement.
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
                  {premiumActif ? "Premium Locaux actif" : "Premium Locaux non actif"}
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
                      : "Activer Premium Locaux"}
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

                {retour && (
                  <div
                    className={`mb-3 rounded-xl px-3 py-2.5 text-xs font-bold ${
                      retour.etat === "succes"
                        ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                        : retour.etat === "verification"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                    role="status"
                  >
                    {retour.etat === "verification" && "Vérification de votre paiement auprès d'Orange Money…"}
                    {retour.etat === "succes" && "Paiement confirmé : vos jetons ont été crédités."}
                    {retour.etat === "echec" && "Le paiement n'a pas abouti. Vous pouvez recommencer."}
                    {retour.etat === "annule" && "Paiement annulé. Aucun montant n'a été débité."}
                  </div>
                )}

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
                ) : statutAchat === "attente" && paiement && qrExpire ? (
                  <div className="text-center py-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Le code de paiement a expiré</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">Générez-en un nouveau pour réessayer.</p>
                    <button type="button" onClick={nouvelAchat} className="py-2.5 px-4 rounded-2xl bg-gray-900 text-white font-extrabold text-sm hover:bg-black transition-colors">
                      Nouveau code de paiement
                    </button>
                  </div>
                ) : statutAchat === "attente" && paiement ? (
                  <div className="text-center flex flex-col">
                    {paiement.qrCodeBase64 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${paiement.qrCodeBase64}`}
                        alt="QR code de paiement Orange Money"
                        className="order-2 sm:order-1 w-48 h-48 mx-auto rounded-xl border border-gray-200 dark:border-gray-800"
                      />
                    )}
                    <p className="order-1 sm:order-2 text-xs text-gray-500 dark:text-gray-400 mt-4 sm:mt-4">
                      {paiement.quantiteJetons} jeton{paiement.quantiteJetons > 1 ? "s" : ""} · {paiement.montantXof} FCFA
                      <br />
                      Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
                    </p>
                    <div className="order-1 sm:order-3 flex flex-col sm:flex-row gap-2 mt-3 mb-4 sm:mb-0">
                      {paiement.deepLinkOm && (
                        <a
                          href={paiement.deepLinkOm}
                          className={`flex-1 py-3 px-4 rounded-2xl text-white font-extrabold text-sm transition-colors ${estMobile ? "bg-gray-900 hover:bg-black" : "bg-orange-500 hover:bg-orange-600"}`}
                        >
                          Ouvrir Orange Money
                        </a>
                      )}
                      {paiement.deepLinkMaxit && (
                        <a
                          href={paiement.deepLinkMaxit}
                          className={`flex-1 px-4 rounded-2xl text-white font-extrabold transition-colors ${estMobile ? "order-first py-4 text-base bg-orange-500 hover:bg-orange-600" : "py-3 text-sm bg-gray-900 hover:bg-black"}`}
                        >
                          Ouvrir MAXIT
                        </a>
                      )}
                    </div>
                    {estMobile && paiement.deepLinkMaxit && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 order-2 sm:hidden mb-2">
                        MAXIT s&apos;ouvre tout seul. Sinon, touchez « Ouvrir MAXIT ».
                      </p>
                    )}
                    <p className="order-3 sm:order-4 text-[11px] text-gray-400 dark:text-gray-600 mt-4 flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin"></span>
                      En attente de confirmation du paiement…
                    </p>
                  </div>
                ) : !orangeActif ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
                    Le paiement en ligne sera bientôt disponible.
                  </p>
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
                      {libelleBoutonPaiement(estMobile, "Générer mon QR de paiement Orange Money")}
                    </button>
                    {aideBoutonPaiement(estMobile) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{aideBoutonPaiement(estMobile)}</p>
                    )}
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
