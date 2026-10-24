"use client";

import { useState, useSyncExternalStore, useEffect, useRef, useCallback } from "react";
import { useOuvertureAppPaiement } from "@/lib/useOuvertureAppPaiement";
import { BarrePaiementFixe, QrPaiementCarte } from "@/components/FacturationQr";
import { effacerPaiementEnCours, lirePaiementEnCours, sauvegarderPaiementEnCours } from "@/lib/paiementEnCours";
import { phraseTempsEcoule, secondesRestantes } from "@/lib/validiteQr";
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
  const [reste, setReste] = useState(null); // secondes restantes avant la fin de validité du QR affiché
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

  // Validité du QR (5 minutes) : compte à rebours ; à zéro, le QR est MASQUÉ (plus scannable depuis la page) et le bouton est proposé de nouveau.
  // L'interrogation du statut continue : un paiement réussi, même confirmé après ce délai, est crédité par le serveur et s'affiche ici.
  useEffect(() => {
    if (statutAchat !== "attente" || !paiement?.validForSeconds || qrExpire) return undefined;
    const fin = Date.now() + paiement.validForSeconds * 1000;
    const minuteur = setInterval(() => {
      const restant = secondesRestantes(fin, Date.now());
      setReste(restant);
      if (restant <= 0) {
        setQrExpire(true);
        clearInterval(minuteur);
      }
    }, 1000);
    return () => clearInterval(minuteur);
  }, [statutAchat, paiement, qrExpire]);

  // Affiche le paiement en attente (QR, boutons) et suit son statut toutes les 4 secondes ; sert à la création ET à la restauration après rechargement.
  const demarrerSuivi = useCallback(
    (data) => {
      setPaiement(data);
      setQrExpire(false);
      setReste(data.validForSeconds ?? null);
      setStatutAchat("attente");

      arreterSondage();
      const interroger = async () => {
        try {
          const statusRes = await fetch(`/api/pay/jetons-checkout?transactionId=${data.transactionId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const statusData = await statusRes.json().catch(() => ({}));

          if (statusData.status === "success") {
            effacerPaiementEnCours("jetons");
            setStatutAchat("succes");
            arreterSondage();
            chargerTout();
          } else if (statusData.status === "failed") {
            effacerPaiementEnCours("jetons");
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
    },
    [session, arreterSondage, chargerTout]
  );

  // Retour sur la page (rechargée) avec un paiement encore valable : on retrouve DIRECTEMENT le QR et les boutons, sans refaire de commande.
  const restaureRef = useRef(false);
  useEffect(() => {
    if (!session || !boutique || !user?.id || restaureRef.current) return;
    restaureRef.current = true;
    const sauvegarde = lirePaiementEnCours("jetons", { proprietaire: user.id });
    if (!sauvegarde) return;
    (async () => {
      try {
        const res = await fetch(`/api/pay/jetons-checkout?transactionId=${sauvegarde.transactionId}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const etat = await res.json().catch(() => ({}));
        if (etat.status === "pending") demarrerSuivi(sauvegarde);
        else {
          effacerPaiementEnCours("jetons");
          if (etat.status === "success") chargerTout();
        }
      } catch {
        // Hors ligne : on ne restaure rien, la page reste utilisable.
      }
    })();
  }, [session, boutique, user, demarrerSuivi, chargerTout]);

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
        // Un QR vient d'être préparé pour cette boutique (code 429) : on affiche CELUI-LÀ, avec ses boutons, au lieu d'une erreur.
        const enCours = res.status === 429 ? lirePaiementEnCours("jetons", { proprietaire: user?.id }) : null;
        if (enCours) {
          demarrerSuivi(enCours);
          return;
        }
        setErreurAchat(data.error || "Impossible de générer le QR de paiement. Réessayez.");
        setStatutAchat("inactif");
        return;
      }

      // Gardé sur l'appareil : si la page est rechargée (retour de MAXIT, bouton « Quitter »), le QR et les boutons sont retrouvés.
      sauvegarderPaiementEnCours("jetons", data, { proprietaire: user?.id });
      demarrerSuivi(data);
      // Une seule tentative automatique par commande ; le QR et les boutons restent affichés si l'application ne s'ouvre pas.
      tenterAuto(data.transactionId, { deepLinkMaxit: data.deepLinkMaxit, deepLinkOm: data.deepLinkOm, deepLink: data.deepLink });
    } catch (err) {
      console.error("Erreur génération paiement jetons :", err);
      setErreurAchat("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setStatutAchat("inactif");
    }
  };

  // Bouton « générer le paiement » (formulaire ET écran « temps écoulé ») : « Payer avec MAXIT » sur téléphone, texte habituel sur ordinateur.
  const renderBoutonGenerer = () => (
    <>
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
    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
      {aideBoutonPaiement(estMobile) ?? "Touchez le bouton : votre QR de paiement Orange Money s'affiche."}
    </p>

    </>
  );

  const changerQuantite = (sens) => setQuantiteAchat((q) => Math.min(500, Math.max(10, (Number.isFinite(q) ? q : 10) + sens * 10)));

  const nouvelAchat = () => {
    effacerPaiementEnCours("jetons");
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

  // Messages sous « Acheter des jetons » (maquette) : vert = paiement reçu, rouge = déjà préparé ou erreur, gris = annulé / expiré.
  const enAttenteQr = statutAchat === "attente" && Boolean(paiement) && !qrExpire;
  const classeMessage = (couleur) =>
    ({
      vert: "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/40 dark:text-emerald-300",
      rouge: "bg-[#FEF2F2] text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300",
      gris: "bg-[#F1F2F4] text-[#374151] dark:bg-gray-800 dark:text-gray-300",
      bleu: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    })[couleur];
  let message = null;
  if (statutAchat === "succes") message = { couleur: "vert", texte: `Paiement reçu : +${paiement?.quantiteJetons ?? quantiteAchat} jetons ajoutés à votre solde.` };
  else if (statutAchat === "attente" && paiement && qrExpire) message = { couleur: "gris", texte: phraseTempsEcoule(estMobile, "Générer mon QR de paiement Orange Money") };
  else if (retour?.etat === "succes") message = { couleur: "vert", texte: "Paiement reçu : vos jetons ont été ajoutés à votre solde." };
  else if (retour?.etat === "verification") message = { couleur: "bleu", texte: "Vérification de votre paiement auprès d'Orange Money…" };
  else if (retour?.etat === "echec") message = { couleur: "gris", texte: "Le paiement n'a pas abouti. Vous pouvez recommencer." };
  else if (retour?.etat === "annule") message = { couleur: "gris", texte: "Paiement annulé. Aucun montant n'a été débité." };
  else if (statutAchat === "echec") message = { couleur: "gris", texte: "Le paiement n'a pas abouti. Vous pouvez réessayer." };
  else if (erreurAchat) message = { couleur: "rouge", texte: erreurAchat };

  return (
    <div className={`min-h-screen bg-[#F2F0EA] dark:bg-gray-950 px-4 pt-6 sm:pt-10 ${enAttenteQr ? "pb-44" : "pb-12"}`}>
      <div className="max-w-xl mx-auto">
        <Link
          href="/marketplace?onglet=vendre"
          aria-label="Retour à ma boutique"
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D9D1C1] bg-white text-gray-900 dark:bg-gray-900 dark:text-white dark:border-gray-700"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-[#D9D1C1] dark:border-gray-800 p-4 sm:p-6">
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
            <div>
              {/* Premium actif : l'encadré vert n'apparaît QUE lorsque Premium est actif */}
              {premiumActif && (
                <div className="mb-3 rounded-2xl border border-emerald-200 bg-[#ECFDF5] p-3 dark:bg-emerald-950/30 dark:border-emerald-900/50" data-testid="premium-actif">
                  <p className="text-sm font-extrabold text-[#047857] dark:text-emerald-300">Premium Locaux actif</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Votre boutique est mise en avant jusqu&apos;au {formatDateFr(premiumActif.date_expiration)}.
                  </p>
                </div>
              )}

              {/* Solde de jetons */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-200">Solde de jetons</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">{soldeJetons}</span>
              </div>

              {/* Activation Premium */}
              {!premiumActif && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={activerPremium}
                    disabled={!soldeSuffisant || activationEnCours}
                    className={`w-full min-h-12 px-6 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed ${
                      soldeSuffisant ? "bg-[#F59E0B] hover:bg-[#d98a08]" : "bg-[#FCD58F]"
                    }`}
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                      Il vous manque {jetonsRequis - soldeJetons} jeton{jetonsRequis - soldeJetons > 1 ? "s" : ""}.
                    </p>
                  )}
                  {erreurActivation && (
                    <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">{erreurActivation}</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">Acheter des jetons</p>

                {message && (
                  <div className={`mt-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold ${classeMessage(message.couleur)}`} role="status" data-testid="message-facturation">
                    {message.texte}
                  </div>
                )}

                {statutAchat === "attente" && paiement && !qrExpire ? (
                  <div className="mt-3">
                    <QrPaiementCarte paiement={paiement} />
                  </div>
                ) : !orangeActif ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">
                    Le paiement en ligne sera bientôt disponible.
                  </p>
                ) : (
                  <div className="mt-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center rounded-2xl border border-[#D9D1C1] dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => changerQuantite(-1)}
                          aria-label="Moins de jetons"
                          className="h-12 w-11 text-lg font-bold text-gray-900 dark:text-white"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-base font-black text-gray-900 dark:text-white" data-testid="quantite-jetons">{quantiteAchat}</span>
                        <button
                          type="button"
                          onClick={() => changerQuantite(1)}
                          aria-label="Plus de jetons"
                          className="h-12 w-11 text-lg font-bold text-gray-900 dark:text-white"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        jetons{taux && <> · <strong className="text-gray-900 dark:text-white">{(quantiteAchat * taux.cout_jeton_fcfa).toLocaleString("fr-FR")} FCFA</strong></>}
                      </span>
                    </div>
                    {renderBoutonGenerer()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barre fixe en bas : seulement pendant le QR */}
      {enAttenteQr && <BarrePaiementFixe paiement={paiement} reste={reste} />}
    </div>
  );
}
