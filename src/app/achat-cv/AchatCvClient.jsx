"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { estDansAppPlay } from "@/lib/contextePlay";
import AttentePaiementQr from "@/components/AttentePaiementQr";
import { useOuvertureAppPaiement } from "@/lib/useOuvertureAppPaiement";
import { aideBoutonPaiement, libelleBoutonPaiement } from "@/lib/ouvertureAppPaiement";
import { secondesRestantes } from "@/lib/validiteQr";
import {
  adresseApercu,
  lireModele,
  messageAchat,
  motifFiligrane,
  pageDepuisDecalage,
  prixFcfa,
  texteBoutonApercu,
  textePage,
} from "@/lib/achatCvSite";

// Achat de CV (même page que l'onglet « Achat de CV » du Profil de l'application, maquette du 24/10/2026).
//  - Catalogue : grandes miniatures (page 1, filigranée, basse définition), UN SEUL bouton vert « Acheter » par modèle, « Voir l'aperçu ».
//  - Aperçu protégé : pages filigranées « APERÇU · FACILITÉ » défilées de gauche à droite, aucun bouton Télécharger / Partager / Copier.
//    Le fichier d'origine n'est jamais envoyé au navigateur : seulement des images d'aperçu servies par le serveur (compte connecté).
//  - Paiement : même composant que la page Premium (AttentePaiementQr), bouton « Payer avec MAXIT » sur téléphone. Un modèle n'est acheté QUE
//    par le serveur, après la confirmation d'Orange ; cette page lit l'état de l'achat, elle ne le valide jamais.
// Dans l'application iOS (règle Apple 3.1.1), la page affiche un message neutre : ni prix, ni bouton d'achat (voir contextePlay.js).
const POLL_INTERVAL_MS = 4000;
const COULEURS_MESSAGE = {
  vert: "bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/40 dark:text-emerald-300",
  rouge: "bg-[#FEF2F2] text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300",
  gris: "bg-[#F1F2F4] text-[#374151] dark:bg-gray-800 dark:text-gray-300",
};

function Message({ type, nom }) {
  const m = messageAchat(type, nom);
  if (!m) return null;
  return (
    <div className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-bold ${COULEURS_MESSAGE[m.couleur]}`} role="status" data-testid="message-achat-cv">
      {m.texte}
    </div>
  );
}

/** Image d'aperçu d'une page : chargée avec la session de l'acheteur (jamais une adresse publique), affichée floutée, filigrane par-dessus. */
function PageApercu({ modeleId, page, session, hauteurClasse = "" }) {
  const [src, setSrc] = useState(null);
  const [erreur, setErreur] = useState(false);
  const jeton = session?.access_token;
  useEffect(() => {
    const adresse = adresseApercu(modeleId, page);
    if (!adresse || !jeton) return undefined;
    let annule = false;
    let objet = null;
    fetch(adresse, { headers: { Authorization: `Bearer ${jeton}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("aperçu"))))
      .then((blob) => {
        if (annule) return;
        objet = URL.createObjectURL(blob);
        setSrc(objet);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
      if (objet) URL.revokeObjectURL(objet);
    };
  }, [modeleId, page, jeton]);

  return (
    <div className={`relative w-full aspect-[3/4] bg-[#E8E4DA] overflow-hidden select-none ${hauteurClasse}`} onContextMenu={(e) => e.preventDefault()}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Page ${page} du modèle`} draggable={false} className="absolute inset-0 w-full h-full object-cover blur-[1px] pointer-events-none" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-2xl">
          {erreur ? <i className="fa-regular fa-file-lines"></i> : <span className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>}
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: motifFiligrane(), backgroundRepeat: "repeat" }} aria-hidden="true" />
    </div>
  );
}

export default function AchatCvClient({ orangeActif = false }) {
  const { user, session } = useAuth();
  // Même patron que PremiumClient : lu côté navigateur sans aller-retour « affiche le paiement puis le masque ».
  const dansAppSansAchat = useSyncExternalStore(
    () => () => {},
    () => estDansAppPlay(),
    () => false
  );

  const [modeles, setModeles] = useState(null); // null = chargement
  const [erreurChargement, setErreurChargement] = useState(false);
  const [vue, setVue] = useState({ nom: "catalogue" }); // catalogue | apercu {id} | paiement {id, depuis}
  const [message, setMessage] = useState(null); // { type, nom }
  const [paiement, setPaiement] = useState(null);
  const [statutAchat, setStatutAchat] = useState("inactif"); // inactif | chargement | attente
  const [erreurAchat, setErreurAchat] = useState("");
  const [qrExpire, setQrExpire] = useState(false);
  const [reste, setReste] = useState(null);
  const [page, setPage] = useState(1);
  const intervalRef = useRef(null);
  const interrogerRef = useRef(null);
  const nomsRef = useRef({});

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc("lister_modeles_cv");
    if (error) {
      setErreurChargement(true);
      return [];
    }
    const liste = (data ?? []).map(lireModele).filter(Boolean);
    nomsRef.current = Object.fromEntries(liste.map((m) => [m.id, m.nom]));
    setModeles(liste);
    setErreurChargement(false);
    return liste;
  }, []);

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => charger());
  }, [user, charger]);

  const arreterSondage = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    interrogerRef.current = null;
  }, []);
  useEffect(() => () => arreterSondage(), [arreterSondage]);

  // Suit un achat : interroge l'état toutes les 4 s ; « success » → modèle acheté (message vert, catalogue), « failed » → annulé.
  const suivre = useCallback(
    (achatId, nomModele) => {
      arreterSondage();
      const interroger = async () => {
        try {
          const res = await fetch(`/api/pay/cv-checkout?achatId=${encodeURIComponent(achatId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
          const data = await res.json().catch(() => ({}));
          if (data.status === "success") {
            arreterSondage();
            setPaiement(null);
            setStatutAchat("inactif");
            const liste = await charger();
            setMessage({ type: "recu", nom: nomModele || liste.find((m) => m.id === data.modeleId)?.nom || "" });
            setVue({ nom: "catalogue" });
          } else if (data.status === "failed") {
            arreterSondage();
            setPaiement(null);
            setStatutAchat("inactif");
            setMessage({ type: "annule" });
          }
        } catch {
          // Panne passagère du sondage : la prochaine tentative reprendra normalement.
        }
      };
      interrogerRef.current = interroger;
      intervalRef.current = setInterval(interroger, POLL_INTERVAL_MS);
    },
    [arreterSondage, charger, session]
  );

  // Retour depuis Orange (?statut=succes|annule&commande=<id>) : la page LIT l'état de l'achat, elle ne l'accorde jamais sur la seule foi du retour.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statut = params.get("statut");
    const commande = params.get("commande");
    if (!statut || !commande || !session) return;
    if (statut === "annule") {
      queueMicrotask(() => setMessage({ type: "annule" }));
      return;
    }
    queueMicrotask(() => setMessage({ type: "verification" }));
    suivre(commande, "");
  }, [session, suivre]);

  const { estMobile, tenterAuto } = useOuvertureAppPaiement({
    actif: statutAchat === "attente" && Boolean(paiement) && !qrExpire,
    interroger: () => interrogerRef.current?.(),
  });

  // Validité du QR (5 minutes) : compte à rebours ; à zéro, le QR est MASQUÉ. Le suivi continue : un paiement réussi, même confirmé plus tard, s'affiche ici.
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

  const modeleCourant = vue.id ? (modeles ?? []).find((m) => m.id === vue.id) : null;

  const genererPaiement = async () => {
    if (!session || !modeleCourant) return;
    setErreurAchat("");
    setMessage(null);
    setStatutAchat("chargement");
    try {
      // Seul l'identifiant du modèle part au serveur : le prix est lu en base par le serveur.
      const res = await fetch("/api/pay/cv-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ modeleId: modeleCourant.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.qrId) {
        setStatutAchat("inactif");
        if (data.dejaAchete) {
          charger();
          return;
        }
        if (data.paiementEnCours) {
          setMessage({ type: "deja_prepare" });
          if (data.achatId) suivre(data.achatId, modeleCourant.nom);
          return;
        }
        setErreurAchat(data.error || "Impossible de générer le QR de paiement. Réessayez.");
        return;
      }
      setPaiement(data);
      setQrExpire(false);
      setReste(data.validForSeconds ?? null);
      setStatutAchat("attente");
      suivre(data.achatId, modeleCourant.nom);
      // Une seule tentative automatique par commande ; le QR et les boutons restent affichés si l'application ne s'ouvre pas.
      tenterAuto(data.achatId, { deepLinkMaxit: data.deepLinkMaxit, deepLinkOm: data.deepLinkOm, deepLink: data.deepLink });
    } catch {
      setErreurAchat("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setStatutAchat("inactif");
    }
  };

  const utiliser = async (modele) => {
    if (!session) return;
    try {
      const res = await fetch(`/api/cv-modeles/${modele.id}/telecharger`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) window.location.assign(data.url);
      else setErreurAchat(data.error || "Ce modèle n'a pas pu être ouvert. Réessayez dans un instant.");
    } catch {
      setErreurAchat("Ce modèle n'a pas pu être ouvert. Réessayez dans un instant.");
    }
  };

  const ouvrirPaiement = (modele, depuis) => {
    arreterSondage();
    setPaiement(null);
    setStatutAchat("inactif");
    setQrExpire(false);
    setErreurAchat("");
    setMessage(null);
    setVue({ nom: "paiement", id: modele.id, depuis });
  };
  const versCatalogue = () => {
    setVue({ nom: "catalogue" });
    setErreurAchat("");
  };
  const ouvrirApercu = (modele) => {
    setPage(1);
    setErreurAchat("");
    setVue({ nom: "apercu", id: modele.id });
  };
  // Retour : Paiement → Aperçu (si ouvert depuis l'aperçu et pas encore acheté), sinon Catalogue ; Aperçu / Confirmé → Catalogue.
  const retourPaiement = () => (vue.depuis === "apercu" && modeleCourant && !modeleCourant.achete ? setVue({ nom: "apercu", id: vue.id }) : versCatalogue());

  const boutonGenerer = (
    <>
      <button
        type="button"
        onClick={genererPaiement}
        disabled={statutAchat === "chargement"}
        className="w-full min-h-14 py-3.5 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-base flex items-center justify-center gap-2 transition-colors"
      >
        {statutAchat === "chargement" ? <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span> : <i className="fa-solid fa-qrcode"></i>}
        {libelleBoutonPaiement(estMobile, "Générer mon QR de paiement Orange Money")}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{aideBoutonPaiement(estMobile) ?? "Touchez le bouton : votre QR de paiement Orange Money s'affiche."}</p>
    </>
  );

  // ----- Corps de la page -----
  let corps;
  if (dansAppSansAchat) {
    corps = (
      <div className="text-center py-6">
        <h2 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">Indisponible dans l&apos;application</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Les modèles de CV ne sont pas proposés ici pour le moment.</p>
      </div>
    );
  } else if (!user) {
    corps = <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">Connectez-vous pour voir les modèles de CV.</p>;
  } else if (vue.nom === "apercu" && modeleCourant) {
    corps = null; // l'aperçu est un plein écran (voir plus bas)
  } else if (vue.nom === "paiement" && modeleCourant) {
    corps = (
      <div>
        <button type="button" onClick={retourPaiement} aria-label="Retour" className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D9D1C1] bg-white text-gray-900 dark:bg-gray-900 dark:text-white dark:border-gray-700">
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-20 shrink-0 rounded-xl overflow-hidden">
            <PageApercu modeleId={modeleCourant.id} page={1} session={session} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-gray-900 dark:text-white">Modèle {modeleCourant.nom}</p>
            {modeleCourant.achete ? null : <p className="text-lg font-black text-gray-900 dark:text-white">{prixFcfa(modeleCourant.prixXof)}</p>}
          </div>
        </div>
        {message && <Message type={message.type} nom={message.nom} />}
        {erreurAchat && <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-3">{erreurAchat}</p>}
        <div className="mt-4">
          {modeleCourant.achete ? (
            <button type="button" onClick={() => utiliser(modeleCourant)} className="w-full min-h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-base">
              Utiliser ce modèle
            </button>
          ) : !orangeActif ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">Le paiement en ligne sera bientôt disponible.</p>
          ) : statutAchat === "attente" && paiement ? (
            <AttentePaiementQr
              paiement={paiement}
              resume={`Modèle ${modeleCourant.nom} · ${prixFcfa(paiement.montantXof)}`}
              estMobile={estMobile}
              reste={reste}
              qrExpire={qrExpire}
              libelleBoutonOrdinateur="Générer mon QR de paiement Orange Money"
              boutonRecommencer={boutonGenerer}
            />
          ) : (
            boutonGenerer
          )}
        </div>
      </div>
    );
  } else {
    corps = (
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">Modèles de CV</h1>
        {message && <Message type={message.type} nom={message.nom} />}
        {erreurAchat && <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-3">{erreurAchat}</p>}
        {modeles === null && !erreurChargement ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4" data-testid="chargement-modeles">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[#D9D1C1] dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse">
                <div className="aspect-[3/4] bg-[#E8E4DA] dark:bg-gray-800" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-[#E8E4DA] dark:bg-gray-800" />
                  <div className="h-11 rounded-xl bg-[#EFEBE2] dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : erreurChargement && modeles === null ? (
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-10">Impossible de charger les modèles pour le moment.</p>
        ) : modeles.length === 0 ? (
          <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-10">Aucun modèle disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {modeles.map((m) => (
              <div key={m.id} className="rounded-2xl overflow-hidden border border-[#D9D1C1] dark:border-gray-800 bg-white dark:bg-gray-900">
                <button type="button" onClick={() => ouvrirApercu(m)} aria-label={`Voir l'aperçu du modèle ${m.nom}`} className="relative block w-full">
                  <PageApercu modeleId={m.id} page={1} session={session} />
                  {m.achete && <span className="absolute top-2 left-2 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-white">Acheté</span>}
                </button>
                <div className="p-3">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">{m.nom}</p>
                  {m.description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{m.description}</p>}
                  {m.achete ? (
                    <>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1.5">Acheté</p>
                      <button type="button" onClick={() => utiliser(m)} className="mt-2 w-full min-h-12 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-sm">
                        Utiliser ce modèle
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-black text-gray-900 dark:text-white mt-1.5">{prixFcfa(m.prixXof)}</p>
                      <button type="button" onClick={() => ouvrirPaiement(m, "catalogue")} className="mt-2 w-full min-h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-base">
                        Acheter
                      </button>
                      <button type="button" onClick={() => ouvrirApercu(m)} className="w-full min-h-11 text-sm font-bold text-blue-600 dark:text-blue-400">
                        Voir l&apos;aperçu
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0EA] dark:bg-gray-950 px-4 pt-6 pb-12">
      <div className="max-w-3xl mx-auto">
        {vue.nom === "catalogue" && !dansAppSansAchat && (
          <Link href="/profil" aria-label="Retour au profil" className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D9D1C1] bg-white text-gray-900 dark:bg-gray-900 dark:text-white dark:border-gray-700">
            <i className="fa-solid fa-chevron-left"></i>
          </Link>
        )}
        <div className="bg-white/60 dark:bg-gray-900 rounded-3xl border border-[#D9D1C1] dark:border-gray-800 p-4 sm:p-6">{corps}</div>
      </div>

      {/* Aperçu protégé : plein écran sombre, pages aimantées de gauche à droite, aucun bouton de téléchargement. */}
      {!dansAppSansAchat && user && vue.nom === "apercu" && modeleCourant && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#2B2A27] text-white select-none" onContextMenu={(e) => e.preventDefault()} data-testid="apercu-protege">
          <div className="flex items-center gap-3 px-4 pt-3 pb-3">
            <button type="button" onClick={versCatalogue} aria-label="Retour" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <p className="flex-1 truncate text-lg font-black">{modeleCourant.nom}</p>
            {!modeleCourant.achete && <p className="text-base font-black text-amber-200">{prixFcfa(modeleCourant.prixXof)}</p>}
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <div
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-[11%] scrollbar-none"
              onScroll={(e) => {
                const el = e.currentTarget;
                const premier = el.firstElementChild;
                const pas = premier ? premier.getBoundingClientRect().width + 12 : 0;
                setPage(pageDepuisDecalage(el.scrollLeft, pas, modeleCourant.nbPages));
              }}
            >
              {Array.from({ length: modeleCourant.nbPages }, (_, i) => i + 1).map((n) => (
                <div key={n} className="snap-center shrink-0 w-[78%] max-w-[420px] rounded-2xl overflow-hidden bg-white">
                  <PageApercu modeleId={modeleCourant.id} page={n} session={session} />
                </div>
              ))}
              {modeleCourant.nbPages === 0 && <p className="w-full text-center text-sm text-white/75 py-10">Cet aperçu n&apos;est pas disponible pour le moment.</p>}
            </div>
            {modeleCourant.nbPages > 0 && (
              <>
                <div className="flex justify-center items-center gap-1.5 mt-4">
                  {Array.from({ length: modeleCourant.nbPages }, (_, i) => i + 1).map((n) => (
                    <span key={n} className={`h-2 rounded-full ${n === page ? "w-5 bg-emerald-500" : "w-2 bg-white/35"}`}></span>
                  ))}
                </div>
                <p className="text-sm font-bold text-center mt-2 text-white/85">{textePage(page, modeleCourant.nbPages)}</p>
                <p className="text-xs text-center mt-1 text-white/60">Aperçu protégé : non téléchargeable.</p>
              </>
            )}
          </div>
          <div className="bg-[#e3dbcc] px-3 py-3">
            <button
              type="button"
              onClick={() => (modeleCourant.achete ? utiliser(modeleCourant) : ouvrirPaiement(modeleCourant, "apercu"))}
              className="w-full min-h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-base"
            >
              {texteBoutonApercu(modeleCourant)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
