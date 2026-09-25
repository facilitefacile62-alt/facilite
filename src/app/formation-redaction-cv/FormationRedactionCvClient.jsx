"use client";

import { useState, useSyncExternalStore, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { estDansAppPlay } from "@/lib/contextePlay";
import { obtenirMonInscriptionFormationCv } from "@/lib/formationCvData";

// Garde-fou TWA (même raisonnement que /premium, voir PremiumClient.jsx) :
// la formation est du contenu numérique consommé dans l'application, donc
// soumise à la politique Google Play Billing dès lors qu'elle serait
// proposée depuis l'app Android installée. Cette page n'est donc :
// 1. Volontairement PAS ajoutée à mobile/src/lib/webEcrans.ts (protection
//    structurelle : inatteignable depuis l'app installée).
// 2. Masquée ici même si un jour atteinte via une TWA du même package
//    Android (estDansAppPlay()) — défense en profondeur, même patron que
//    PricingModal.js et PremiumClient.jsx.
// Aucune mention d'un autre moyen de payer dans ce cas (règle anti-steering
// Google).
const MONTANT_XOF = 15000;
const POLL_INTERVAL_MS = 4000;

const CONTENU_FORMATION = [
  "Structurer un CV qui retient l'attention en moins de 10 secondes",
  "Éviter les erreurs qui éliminent un CV avant même sa lecture",
  "Rédiger un résumé professionnel percutant",
  "Adapter son CV à chaque offre plutôt qu'un modèle unique",
];

function formatDateFr(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function FormationRedactionCvClient() {
  const { user, session } = useAuth();

  // Même raisonnement que PremiumClient.jsx : document.referrer/sessionStorage
  // ne peuvent pas être lus au rendu serveur, useSyncExternalStore évite
  // l'aller-retour "affiche le paiement, puis le masque dans un effet".
  const dansAppPlay = useSyncExternalStore(
    () => () => {},
    () => estDansAppPlay(),
    () => false
  );

  const [chargement, setChargement] = useState(true);
  const [inscription, setInscription] = useState(null);
  const [erreurChargement, setErreurChargement] = useState("");

  const [paiement, setPaiement] = useState(null);
  const [statutAchat, setStatutAchat] = useState("inactif"); // inactif | chargement | attente | succes | echec
  const [erreurAchat, setErreurAchat] = useState("");
  const intervalRef = useRef(null);

  const chargerTout = useCallback(async () => {
    if (!user?.id) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreurChargement("");
    try {
      const monInscription = await obtenirMonInscriptionFormationCv();
      setInscription(monInscription);
    } catch (err) {
      setErreurChargement(err.message || "Impossible de charger votre inscription.");
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
    if (!session) return;
    setErreurAchat("");
    setStatutAchat("chargement");

    try {
      const res = await fetch("/api/pay/formation-cv-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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
          const statusRes = await fetch("/api/pay/formation-cv-checkout", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const statusData = await statusRes.json().catch(() => ({}));

          if (statusData.status === "success") {
            setStatutAchat("succes");
            arreterSondage();
            chargerTout();
          }
        } catch {
          // Panne réseau passagère du sondage : ne casse pas l'affichage,
          // la prochaine tentative reprendra normalement.
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error("Erreur génération paiement formation CV :", err);
      setErreurAchat("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setStatutAchat("inactif");
    }
  };

  const nouvelEssai = () => {
    setPaiement(null);
    setStatutAchat("inactif");
    setErreurAchat("");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-12 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-solid fa-file-pen"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Formation Rédaction de CV
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Accès permanent · certification &quot;Rédacteur CV&quot; à la clé
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 sm:p-8">
          {dansAppPlay ? (
            <div className="text-center py-6">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
                Indisponible dans l&apos;application
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Cette formation n&apos;est pas proposée ici pour le moment.
              </p>
            </div>
          ) : !user ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Connectez-vous pour vous inscrire à la formation.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-2xl bg-[#085041] hover:bg-[#0a6252] text-white font-extrabold text-sm transition"
              >
                Se connecter
              </Link>
            </div>
          ) : chargement ? (
            <div className="text-center py-10">
              <span className="w-6 h-6 border-2 border-gray-300 dark:border-gray-700 border-t-transparent rounded-full animate-spin inline-block"></span>
            </div>
          ) : erreurChargement ? (
            <p className="text-xs text-red-600 dark:text-red-400 text-center py-4">{erreurChargement}</p>
          ) : inscription?.paye ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto text-lg">
                <i className="fa-solid fa-check"></i>
              </div>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                Vous êtes inscrit à la formation
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Payé le {formatDateFr(inscription.paye_le)}.
                {inscription.certifie
                  ? " Vous êtes certifié «Rédacteur CV»."
                  : " La liste des modules arrive dans un prochain écran."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Contenu de la formation */}
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Ce que vous apprendrez</p>
                <ul className="space-y-2">
                  {CONTENU_FORMATION.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      <i className="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0"></i>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Accès permanent</span>
                <span className="text-xl font-extrabold text-gray-900 dark:text-white">{MONTANT_XOF.toLocaleString("fr-FR")} FCFA</span>
              </div>

              {/* Paiement */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                {statutAchat === "succes" ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center mx-auto mb-3 text-lg">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Paiement confirmé</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Votre inscription est active.
                    </p>
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
                      {paiement.montantXof.toLocaleString("fr-FR")} FCFA
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
                    <button
                      type="button"
                      onClick={nouvelEssai}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mt-4"
                    >
                      QR expiré ? Générer un nouveau code
                    </button>
                  </div>
                ) : (
                  <div>
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
                      Payer {MONTANT_XOF.toLocaleString("fr-FR")} FCFA avec Orange Money
                    </button>
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
