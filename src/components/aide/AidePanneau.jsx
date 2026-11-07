"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { sendMessage, resolveSupportConversation, touchConversation } from "@/lib/messages";
import { evaluerDictee } from "@/lib/aide/parole";
import { isFeatureAllowed } from "@/lib/featureFlags";
import { MENTION_ASSISTANT, libelleEtat, separerQuestions, tailleOrbe } from "@/lib/aide/disposition";
import { OrbeGrande, useMouvement } from "./AideOrbe";

// Panneau « Aide » : UNE seule conversation. L'historique de l'assistant (assistant_messages) et le fil
// du support humain (messages SUPPORT) sont fusionnés par date ; passer à l'équipe ne change pas d'écran.
const LONGUEUR_MAX = 500;
const VOCAL_SECONDES_MAX = 60;
const ACCUEIL = "Bonjour ! Je suis l'assistant de Facilité. Choisissez une question ci-dessous, écrivez votre message ou touchez le micro. Vous pouvez aussi parler à un conseiller à tout moment.";
const { principales: QUESTIONS_PRINCIPALES, autres: QUESTIONS_AUTRES } = separerQuestions();

/** Écran étroit (< 640 px) et zone réellement visible : suit le clavier du téléphone grâce à visualViewport. */
function lireEcran() {
  if (typeof window === "undefined") return { petitEcran: false, clavierOuvert: false, haut: 0, hauteur: null };
  const petitEcran = window.matchMedia("(max-width: 639px)").matches;
  const vv = window.visualViewport;
  return {
    petitEcran,
    clavierOuvert: Boolean(vv) && petitEcran && vv.height < window.innerHeight * 0.75,
    haut: vv ? Math.round(vv.offsetTop) : 0,
    hauteur: petitEcran && vv ? Math.round(vv.height) : null,
  };
}

function horodatage(iso) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AidePanneau({ session, onFermer, arbre, role }) {
  const userId = session.user.id;
  const token = session.access_token;
  const [fil, setFil] = useState([]); // { id, qui: 'moi'|'assistant'|'equipe'|'systeme', texte, lien?, date }
  const [mode, setMode] = useState("ia"); // ia | attente_humain | humain
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [dictee, setDictee] = useState({ etat: "repos", echecs: 0, texte: "" }); // repos | ecoute | confirmer
  const [enregistre, setEnregistre] = useState(0); // secondes d'enregistrement vocal (0 = inactif)
  const [alternatives, setAlternatives] = useState(false);
  const defilRef = useRef(null);
  const [agrandi, setAgrandi] = useState(false);
  const [plusDeQuestions, setPlusDeQuestions] = useState(false);
  const [menuMicro, setMenuMicro] = useState(false);
  const [aDefile, setADefile] = useState(false);
  const [ecran, setEcran] = useState(lireEcran);
  const animer = useMouvement();
  const rec = useRef(null);
  const recFlux = useRef(null);
  const recMorceaux = useRef([]);
  const recTimer = useRef(null);
  const supportRef = useRef(null);
  const enregistreRef = useRef(0); // durée lue à l'arrêt (le compteur affiché peut avoir un rendu de retard)

  const charger = useCallback(async () => {
    const [{ data: ia }, { data: equipe }, { data: ligneFil }] = await Promise.all([
      supabase.from("assistant_messages").select("id, role, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
      supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("type_discussion", "SUPPORT")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("support_threads").select("mode").eq("user_id", userId).maybeSingle(),
    ]);
    const lignes = [
      ...(ia || []).map((m) => ({ id: `ia-${m.id}`, qui: m.role === "user" ? "moi" : "assistant", texte: m.content, date: m.created_at })),
      ...(equipe || []).map((m) => ({ id: `eq-${m.id}`, qui: m.sender_id === userId ? "moi" : "equipe", texte: m.content, date: m.created_at })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    setFil(lignes);
    setMode(ligneFil?.mode || "ia");
  }, [userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Une fois avec l'équipe, on relit le fil régulièrement pour voir leur réponse.
  useEffect(() => {
    if (mode === "ia") return undefined;
    const t = setInterval(charger, 8000);
    return () => clearInterval(t);
  }, [mode, charger]);

  // Seuls les messages défilent : on garde le bas visible à chaque nouveau message.
  useEffect(() => {
    const zone = defilRef.current;
    if (zone) zone.scrollTop = zone.scrollHeight;
  }, [fil, dictee.etat]);

  // Échap ferme d'abord le petit menu du micro, puis le panneau.
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key !== "Escape") return;
      if (menuMicro) setMenuMicro(false);
      else onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer, menuMicro]);

  // Taille de l'écran et clavier (téléphone) : le panneau épouse la zone réellement visible.
  useEffect(() => {
    const maj = () => setEcran(lireEcran());
    maj();
    window.addEventListener("resize", maj);
    window.visualViewport?.addEventListener("resize", maj);
    window.visualViewport?.addEventListener("scroll", maj);
    return () => {
      window.removeEventListener("resize", maj);
      window.visualViewport?.removeEventListener("resize", maj);
      window.visualViewport?.removeEventListener("scroll", maj);
    };
  }, []);

  useEffect(() => () => arreterEnregistrement(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const ajouter = (ligne) => setFil((f) => [...f, { id: `l-${Date.now()}-${Math.random()}`, date: new Date().toISOString(), ...ligne }]);

  async function envoyerALEquipe(contenu, extra = {}) {
    if (!supportRef.current) supportRef.current = await resolveSupportConversation(userId);
    const s = supportRef.current;
    const { data, error } = await sendMessage({
      senderId: userId,
      receiverId: s?.adminId ?? null,
      conversationId: s?.conversationId ?? null,
      content: contenu,
      typeDiscussion: "SUPPORT",
      ...extra,
    });
    if (error || !data) throw new Error("envoi");
    if (s?.conversationId) touchConversation(s.conversationId, contenu);
  }

  async function envoyer(valeur) {
    const message = String(valeur ?? texte).trim();
    if (!message || occupe) return;
    setErreur("");
    setTexte("");
    setAlternatives(false);
    setOccupe(true);
    ajouter({ qui: "moi", texte: message });
    try {
      if (mode !== "ia") {
        await envoyerALEquipe(message);
        return;
      }
      const res = await fetch("/api/aide/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Le message n'a pas pu être envoyé.");
      if (json.source === "equipe") {
        setMode(json.mode);
        await envoyerALEquipe(message);
        return;
      }
      if (json.reponse) {
        // Un lien n'est proposé que si la page est ouverte à cette personne (interrupteurs du site) : sinon elle
        // atterrirait sur « fonctionnalité indisponible ». Dans ce cas on donne la réponse de repli, sans lien.
        const demandes = Array.isArray(json.liens) ? json.liens : [];
        const ouverts = demandes.filter((l) => isFeatureAllowed(arbre, l.href, role));
        const sansPage = demandes.length > 0 && ouverts.length === 0 && json.repliSansLien;
        ajouter({ qui: "assistant", texte: sansPage ? json.repliSansLien : json.reponse, liens: sansPage ? [] : ouverts, proposerEquipe: json.proposerEquipe });
      }
      if (json.passerEquipe) setMode(json.mode || "attente_humain");
    } catch (e) {
      setErreur(e?.message === "envoi" ? "Votre message n'a pas pu être transmis à l'équipe. Réessayez." : e?.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  async function parlerALEquipe() {
    if (occupe || mode !== "ia") return;
    setErreur("");
    setOccupe(true);
    try {
      const { data, error } = await supabase.rpc("demander_un_humain", { p_motif: null });
      if (error) throw error;
      setMode(data?.mode || "attente_humain");
      ajouter({ qui: "systeme", texte: "Un conseiller a été prévenu. Il répondra dans cette même conversation : tout ce que vous avez déjà écrit lui est visible." });
    } catch {
      setErreur("Impossible de joindre l'équipe pour le moment. Réessayez dans un instant.");
    } finally {
      setOccupe(false);
    }
  }

  // --- Dictée (reconnaissance vocale du navigateur, fr-FR) : voix -> texte, puis Confirmer / Corriger. ---
  function dicter() {
    const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    if (!SR) {
      setErreur("La dictée n'est pas disponible sur ce navigateur. Écrivez votre message ou laissez un message vocal à l'équipe.");
      setAlternatives(true);
      return;
    }
    setErreur("");
    const reco = new SR();
    reco.lang = "fr-FR";
    reco.interimResults = false;
    reco.maxAlternatives = 1;
    let traite = false;
    const apres = (res) => {
      if (traite) return;
      traite = true;
      const bilan = evaluerDictee({ texte: res?.texte, confiance: res?.confiance ?? null, echecsAvant: dictee.echecs });
      if (bilan.action === "confirmer") {
        setDictee({ etat: "confirmer", echecs: 0, texte: bilan.texte });
      } else {
        setDictee({ etat: "repos", echecs: bilan.echecs, texte: "" });
        ajouter({ qui: "assistant", texte: bilan.message });
        if (bilan.action === "alternatives") setAlternatives(true);
      }
    };
    reco.onresult = (e) => {
      const alt = e.results?.[0]?.[0];
      apres({ texte: alt?.transcript, confiance: typeof alt?.confidence === "number" ? alt.confidence : null });
    };
    reco.onerror = () => apres({ texte: "", confiance: null });
    reco.onend = () => apres({ texte: "", confiance: null });
    setDictee((d) => ({ ...d, etat: "ecoute" }));
    try {
      reco.start();
    } catch {
      apres({ texte: "", confiance: null });
    }
  }

  // --- Message vocal à l'équipe : 60 s maximum, compressé (32 kbps), envoyé dans un espace privé. ---
  async function demarrerEnregistrement() {
    setErreur("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErreur("L'enregistrement vocal n'est pas disponible sur ce navigateur.");
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      recFlux.current = flux;
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t));
      const r = new MediaRecorder(flux, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
      recMorceaux.current = [];
      r.ondataavailable = (e) => e.data?.size && recMorceaux.current.push(e.data);
      r.onstop = () => envoyerVocal(r.mimeType || type || "audio/webm");
      rec.current = r;
      r.start();
      enregistreRef.current = 1;
      setEnregistre(1);
      recTimer.current = setInterval(() => {
        enregistreRef.current += 1;
        setEnregistre(enregistreRef.current);
        if (enregistreRef.current >= VOCAL_SECONDES_MAX) arreterEnregistrement(false);
      }, 1000);
    } catch {
      setErreur("Le micro n'est pas accessible. Autorisez-le dans votre navigateur, ou écrivez votre message.");
    }
  }

  function arreterEnregistrement(abandon) {
    clearInterval(recTimer.current);
    const r = rec.current;
    if (abandon) {
      recMorceaux.current = [];
      enregistreRef.current = 0;
      setEnregistre(0);
    }
    rec.current = null;
    if (r && r.state !== "inactive") {
      if (abandon) r.onstop = null;
      r.stop();
    }
    recFlux.current?.getTracks?.().forEach((t) => t.stop());
    recFlux.current = null;
  }

  async function envoyerVocal(type) {
    const duree = Math.min(Math.max(1, enregistreRef.current), VOCAL_SECONDES_MAX);
    enregistreRef.current = 0;
    setEnregistre(0);
    const blob = new Blob(recMorceaux.current, { type: type.split(";")[0] });
    recMorceaux.current = [];
    if (!blob.size) return;
    setOccupe(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "vocal");
      form.append("duree", String(duree));
      const res = await fetch("/api/aide/vocal", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Le message vocal n'a pas pu être envoyé.");
      await envoyerALEquipe(`🎤 Message vocal (${duree} s)`, { fileName: `aide-vocal:${json.id}` });
      setMode((m) => (m === "humain" ? m : "attente_humain"));
      ajouter({ qui: "moi", texte: `🎤 Message vocal (${duree} s)` });
      ajouter({ qui: "systeme", texte: "Votre message vocal est transmis à l'équipe. Elle vous répondra ici." });
    } catch (e) {
      setErreur(e?.message || "Le message vocal n'a pas pu être envoyé.");
    } finally {
      setOccupe(false);
    }
  }

  const bulle = (l) => {
    if (l.qui === "systeme") return "mx-auto bg-amber-50 text-amber-900 border border-amber-200 text-xs";
    if (l.qui === "moi") return "ml-auto bg-blue-600 text-white";
    if (l.qui === "equipe") return "mr-auto bg-emerald-50 text-emerald-900 border border-emerald-200";
    return "mr-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm";
  };

  const petiteOrbe = tailleOrbe({ conversationCommencee: fil.length > 0 || occupe, aDefile, petitEcran: ecran.petitEcran, clavierOuvert: ecran.clavierOuvert }) === "petit";
  const pilule = "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm text-left bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-blue-100 dark:border-gray-700 shadow-sm hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50";
  // Sur téléphone : plein écran, zones de sécurité respectées, hauteur = zone visible (clavier compris).
  const styleTelephone = ecran.petitEcran
    ? { top: ecran.haut, height: ecran.hauteur ?? undefined, paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }
    : undefined;
  const iconeEnTete = "w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800";
  const masqueFondu = "linear-gradient(to bottom, transparent 0, #000 22px)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aide Facilité"
      style={styleTelephone}
      className={`fixed z-[1000] inset-x-0 top-0 h-[100dvh] sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-4 ${
        agrandi ? "sm:w-[min(680px,calc(100vw-2rem))] sm:h-[min(820px,calc(100dvh-2rem))]" : "sm:w-[400px] sm:h-[min(640px,calc(100dvh-2rem))]"
      } bg-white dark:bg-gray-900 sm:rounded-3xl sm:shadow-2xl sm:border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden`}
    >
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#4aa3ff] to-[#0b3fae] flex items-center justify-center text-white" aria-hidden="true">
          <i className="fa-solid fa-life-ring"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-base leading-tight text-gray-900 dark:text-white truncate">Aide Facilité</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${mode === "ia" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true"></span>
            {libelleEtat(mode)}
          </p>
        </div>
        {mode === "ia" ? (
          <button
            type="button"
            onClick={parlerALEquipe}
            disabled={occupe}
            aria-label="Parler à un conseiller"
            title="Parler à un conseiller"
            className="h-9 shrink-0 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
          >
            <i className="fa-solid fa-headset" aria-hidden="true"></i>
            {/* Texte court au format normal (400 px) pour laisser la place au titre ; texte complet une fois agrandi. */}
            <span className="hidden sm:inline whitespace-nowrap">{agrandi ? "Parler à un conseiller" : "Conseiller"}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setAgrandi((a) => !a)}
          aria-label={agrandi ? "Réduire l'aide" : "Agrandir l'aide"}
          aria-pressed={agrandi}
          className={`${iconeEnTete} hidden sm:flex`}
        >
          <i className={`fa-solid ${agrandi ? "fa-compress" : "fa-expand"}`} aria-hidden="true"></i>
        </button>
        <button type="button" onClick={onFermer} aria-label="Fermer l'aide" className={iconeEnTete}>
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-blue-50/80 to-white dark:from-gray-900 dark:to-gray-900">
        {/* L'orbe reste FIXE en haut de la zone : il ne défile pas, il rétrécit en douceur. */}
        <div className="shrink-0 flex justify-center" style={{ paddingTop: petiteOrbe ? 10 : 18, paddingBottom: petiteOrbe ? 10 : 14, transition: animer ? "padding .35s ease" : "none" }}>
          <OrbeGrande petit={petiteOrbe} animer={animer} />
        </div>

        <div
          ref={defilRef}
          onScroll={(e) => {
            if (e.currentTarget.scrollTop > 4) setADefile(true);
          }}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 space-y-2"
          style={{ WebkitMaskImage: masqueFondu, maskImage: masqueFondu }}
          aria-live="polite"
        >
          <div className="mr-auto max-w-[88%] rounded-2xl rounded-tl-md px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm">
            {ACCUEIL}
          </div>

          <div className="flex flex-col items-start gap-2" aria-label="Questions fréquentes">
            {QUESTIONS_PRINCIPALES.map((q) => (
              <button key={q.id} type="button" disabled={occupe} onClick={() => envoyer(q.libelle)} className={pilule}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true"></span>
                {q.libelle}
              </button>
            ))}
            {plusDeQuestions
              ? QUESTIONS_AUTRES.map((q) => (
                  <button key={q.id} type="button" disabled={occupe} onClick={() => envoyer(q.libelle)} className={pilule}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true"></span>
                    {q.libelle}
                  </button>
                ))
              : null}
            <button
              type="button"
              onClick={() => setPlusDeQuestions((v) => !v)}
              aria-expanded={plusDeQuestions}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-extrabold text-blue-700 dark:text-blue-300 hover:underline"
            >
              {plusDeQuestions ? "Moins de questions" : "Plus de questions"}
              <i className={`fa-solid ${plusDeQuestions ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`} aria-hidden="true"></i>
            </button>
          </div>

          {fil.map((l) => (
            <div key={l.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${bulle(l)}`}>
              {l.qui === "equipe" ? <span className="block text-[10px] font-extrabold uppercase tracking-wide mb-0.5">Équipe Facilité</span> : null}
              {l.texte}
              {(l.liens || []).map((lien) => (
                <Link key={lien.href} href={lien.href} onClick={onFermer} className="block mt-1.5 font-bold underline">
                  {lien.libelle}
                </Link>
              ))}
              {l.date ? <span className="block text-[10px] opacity-60 mt-0.5">{horodatage(l.date)}</span> : null}
            </div>
          ))}
          {dictee.etat === "ecoute" ? <p className="text-center text-xs text-blue-700 font-bold">Je vous écoute… parlez maintenant.</p> : null}
          {dictee.etat === "confirmer" ? (
            <div className="ml-auto max-w-[90%] rounded-2xl border-2 border-blue-300 bg-blue-50 p-3 text-sm text-gray-900">
              <p className="text-xs font-bold text-blue-700 mb-1">J'ai compris :</p>
              <p className="font-semibold">« {dictee.texte} »</p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const t = dictee.texte;
                    setDictee({ etat: "repos", echecs: 0, texte: "" });
                    envoyer(t);
                  }}
                  className="flex-1 rounded-full bg-blue-600 text-white font-bold py-2"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTexte(dictee.texte);
                    setDictee({ etat: "repos", echecs: 0, texte: "" });
                  }}
                  className="flex-1 rounded-full bg-white border border-blue-300 text-blue-700 font-bold py-2"
                >
                  Corriger
                </button>
              </div>
            </div>
          ) : null}
          {alternatives ? (
            <div className="flex flex-wrap gap-2 justify-center">
              <button type="button" onClick={demarrerEnregistrement} className="text-xs font-bold px-3 py-2 rounded-full bg-emerald-600 text-white">
                Laisser un message vocal
              </button>
            </div>
          ) : null}
          {erreur ? <p role="alert" className="text-center text-xs font-semibold text-red-600">{erreur}</p> : null}
        </div>
      </div>

      <div className="shrink-0 px-3 pt-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {enregistre > 0 ? (
          <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-3 py-2">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" aria-hidden="true"></span>
            <p className="flex-1 text-sm font-bold text-red-700">Enregistrement… {enregistre} s / {VOCAL_SECONDES_MAX} s</p>
            <button type="button" onClick={() => arreterEnregistrement(true)} className="text-xs font-bold px-3 py-2 rounded-full bg-white border border-gray-300">
              Annuler
            </button>
            <button type="button" onClick={() => arreterEnregistrement(false)} className="text-xs font-bold px-3 py-2 rounded-full bg-red-600 text-white">
              Envoyer
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              envoyer();
            }}
            className="relative flex items-end gap-1.5 rounded-3xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-4 pr-1.5 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-300"
          >
            <label htmlFor="aide-saisie" className="sr-only">
              Votre message
            </label>
            <textarea
              id="aide-saisie"
              value={texte}
              onChange={(e) => setTexte(e.target.value.slice(0, LONGUEUR_MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer();
                }
              }}
              rows={1}
              maxLength={LONGUEUR_MAX}
              placeholder="Écrivez à l'assistant…"
              className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none py-2 text-sm text-gray-900 dark:text-gray-100 max-h-28"
            />
            <button
              type="button"
              onClick={() => setMenuMicro((m) => !m)}
              disabled={occupe || dictee.etat !== "repos"}
              aria-label="Micro : dicter mon message ou laisser un message vocal"
              aria-haspopup="menu"
              aria-expanded={menuMicro}
              className="w-10 h-10 shrink-0 rounded-full text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 flex items-center justify-center disabled:opacity-50"
            >
              <i className="fa-solid fa-microphone" aria-hidden="true"></i>
            </button>
            <button type="submit" disabled={occupe || !texte.trim()} aria-label="Envoyer" className="w-10 h-10 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40">
              <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
            </button>
            {menuMicro ? (
              <div role="menu" className="absolute right-1 bottom-full mb-2 w-64 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-1.5 z-10">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuMicro(false);
                    dicter();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-left text-gray-800 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-800"
                >
                  <i className="fa-solid fa-microphone-lines text-blue-600 w-4" aria-hidden="true"></i>
                  Dicter mon message
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuMicro(false);
                    demarrerEnregistrement();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-left text-gray-800 dark:text-gray-100 hover:bg-emerald-50 dark:hover:bg-gray-800"
                >
                  <i className="fa-solid fa-circle-dot text-emerald-600 w-4" aria-hidden="true"></i>
                  Message vocal à l&apos;équipe
                </button>
              </div>
            ) : null}
          </form>
        )}
        <p className="mt-1.5 text-center text-[11px] leading-tight text-gray-400 dark:text-gray-500">{MENTION_ASSISTANT}</p>
      </div>
    </div>
  );
}
