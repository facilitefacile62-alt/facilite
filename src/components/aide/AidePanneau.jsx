"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { sendMessage, resolveSupportConversation, touchConversation } from "@/lib/messages";
import { QUESTIONS_FREQUENTES } from "@/lib/aide/preparees";
import { evaluerDictee } from "@/lib/aide/parole";
import { isFeatureAllowed } from "@/lib/featureFlags";

// Panneau « Aide » : UNE seule conversation. L'historique de l'assistant (assistant_messages) et le fil
// du support humain (messages SUPPORT) sont fusionnés par date ; passer à l'équipe ne change pas d'écran.
const LONGUEUR_MAX = 500;
const VOCAL_SECONDES_MAX = 60;
const ACCUEIL = "Bonjour ! Choisissez une question ci-dessus, écrivez votre message ou touchez le micro. Vous pouvez aussi parler à l'équipe à tout moment.";

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
  const finRef = useRef(null);
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

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: "end" });
  }, [fil, dictee.etat]);

  useEffect(() => {
    const surTouche = (e) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

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
    return "mr-auto bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aide Facilité"
      className="fixed z-[1000] inset-x-0 bottom-0 sm:inset-x-auto sm:right-6 sm:bottom-28 sm:w-[400px] h-[85vh] sm:h-[600px] max-h-[100dvh] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
    >
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0b3fae] to-[#2f86f5] text-white">
        <div>
          <p className="font-extrabold text-base leading-tight">Aide</p>
          <p className="text-[11px] opacity-90">
            {mode === "humain" ? "Un conseiller vous répond" : mode === "attente_humain" ? "En attente d'un conseiller" : "Réponses rapides et équipe Facilité"}
          </p>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer l'aide" className="w-9 h-9 rounded-full hover:bg-white/20 flex items-center justify-center">
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div className="px-3 pt-3 pb-2 flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800" aria-label="Questions fréquentes">
        {QUESTIONS_FREQUENTES.map((q) => (
          <button
            key={q.id}
            type="button"
            disabled={occupe}
            onClick={() => envoyer(q.libelle)}
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {q.libelle}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" aria-live="polite">
        <div className="mr-auto max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">{ACCUEIL}</div>
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
        <div ref={finRef} />
      </div>

      {enregistre > 0 ? (
        <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-red-50">
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
        <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
          {mode === "ia" ? (
            <button type="button" onClick={parlerALEquipe} disabled={occupe} className="mb-2 w-full text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full py-2 disabled:opacity-50">
              Parler à l'équipe
            </button>
          ) : (
            <button type="button" onClick={demarrerEnregistrement} disabled={occupe} className="mb-2 w-full text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full py-2 disabled:opacity-50">
              Laisser un message vocal à l'équipe
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              envoyer();
            }}
            className="flex items-end gap-2"
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
              placeholder="Écrivez votre message…"
              className="flex-1 resize-none rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm max-h-28"
            />
            <button
              type="button"
              onClick={dicter}
              disabled={occupe || dictee.etat !== "repos"}
              aria-label="Dicter mon message"
              className="w-10 h-10 shrink-0 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center disabled:opacity-50"
            >
              <i className="fa-solid fa-microphone" aria-hidden="true"></i>
            </button>
            <button type="submit" disabled={occupe || !texte.trim()} aria-label="Envoyer" className="w-10 h-10 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40">
              <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
