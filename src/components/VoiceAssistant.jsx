'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendMessage, resolveConversationWith, touchConversation } from '@/lib/messages';
import { getFeatureFlagsTreeAsync, isFeatureAllowed, DEFAULT_FEATURE_TREE } from '@/lib/featureFlags';
import { triggerFeatureDisabledModal } from '@/components/FeatureDisabledModal';
import LiveMapLocation from './LiveMapLocation';

// Mots-clés oui/non — jamais confié au LLM : une confirmation d'envoi de
// message doit rester déterministe, même principe que READ_MESSAGES_TRIGGERS
// côté serveur (voir /api/voice-assistant/route.js).
const REPLY_YES_WORDS = ["oui", "ouais", "yes", "d'accord", "daccord", "ok", "vas-y", "confirme"];
const REPLY_NO_WORDS = ["non", "nan", "no", "annule", "stop", "laisse tomber"];

function matchYesNo(text) {
  const lower = text.toLowerCase();
  if (REPLY_NO_WORDS.some((w) => lower.includes(w))) return "no";
  if (REPLY_YES_WORDS.some((w) => lower.includes(w))) return "yes";
  return null;
}

const ORB_GRADIENT = 'conic-gradient(from 0deg, #085041, #14b89a, #9FE1CB, #085041)';

// Widget global (monté une fois dans layout.js, visible sur toutes les
// pages) — contrôlé dynamiquement par le Feature Flag 'feat_voice_assistant'.
export default function VoiceAssistant() {
  const pathname = usePathname();
  const { session, isAdmin, isRecruiter } = useAuth();
  const [featureFlagsTree, setFeatureFlagsTree] = useState(DEFAULT_FEATURE_TREE);

  useEffect(() => {
    getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});

    const channel = supabase
      .channel("public-feature-flags-voice-assistant")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, () => {
        getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [hasEngaged, setHasEngaged] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('');
  const [mapsUrl, setMapsUrl] = useState(null);
  const [inputText, setInputText] = useState('');
  const [location, setLocation] = useState(null);

  // État du flux "répondre à un message par la voix" — en refs (pas des
  // useState) car lu/écrit depuis des callbacks recognition.onresult
  // successifs qui ne doivent jamais agir sur une valeur figée par une
  // fermeture React périmée. null = aucun flux en cours ; sinon
  // 'confirm_reply' | 'dictate_reply' | 'confirm_send'.
  const replyFlowRef = useRef(null);
  const pendingReplyTargetRef = useRef(null); // actor_id du message à répondre
  const pendingReplyTextRef = useRef('');

  const resetReplyFlow = () => {
    replyFlowRef.current = null;
    pendingReplyTargetRef.current = null;
    pendingReplyTextRef.current = '';
  };

  // Masquer sur le panneau d'administration pour éviter de recouvrir les réglages
  const isDashboard = pathname?.startsWith('/admin');
  const userRole = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const isAllowed = isFeatureAllowed(featureFlagsTree, "feat_voice_assistant", userRole);

  // isDashboard reste un MASQUAGE PUR : le widget n'a rien à faire sur le
  // panneau d'administration, où il recouvrirait les réglages. Ce n'est pas
  // une désactivation par l'admin, c'est une question de place.
  if (isDashboard) {
    return null;
  }

  // Désactivation par l'admin (feat_voice_assistant) : point 4 du
  // 2026-08-27. Avant, ce cas tombait dans le `return null` ci-dessus et le
  // widget s'évaporait — seul endroit du produit où une fonctionnalité
  // destinée à l'utilisateur disparaissait au lieu d'être grisée, alors que
  // les 51 autres points de consommation des feature_flags (Header,
  // HomeClient, ServiceClient) la laissent visible et grisée. L'orbe reste
  // donc à sa place, grisé, et explique au clic pourquoi il ne répond pas —
  // même dispositif que handleGuardedClick dans Header.jsx.
  if (!isAllowed) {
    return (
      <div className="fixed bottom-32 right-4 sm:right-6 z-[999] flex flex-col items-end gap-3">
        <button
          type="button"
          onClick={() =>
            triggerFeatureDisabledModal(
              "Assistant vocal temporairement indisponible",
              "L'assistant vocal est temporairement désactivé le temps de finaliser les travaux et chantiers sur la plateforme. Merci pour votre patience !"
            )
          }
          aria-label="Assistant vocal temporairement indisponible"
          title="Assistant vocal temporairement indisponible"
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center cursor-pointer bg-gray-300 opacity-60 grayscale"
        >
          <i className="fa-solid fa-microphone-slash text-2xl text-gray-600"></i>
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-500 text-white text-[10px] font-black flex items-center justify-center">
            <i className="fa-solid fa-lock text-[9px]"></i>
          </span>
        </button>
      </div>
    );
  }

  const requireLogin = () => {
    window.location.href = '/login';
  };

  // Position GPS pilotée en interne (plus une prop externe) : le widget
  // monte lui-même LiveMapLocation en mode headless (render=false), suivi
  // actif dès le premier engagement (clic sur l'orbe/bouton d'appel) —
  // jamais avant, pour ne pas déclencher la demande de permission GPS tant
  // que personne n'a sollicité l'assistant.
  const handleLocationUpdate = (coords) => setLocation(coords);

  const sendToAssistant = async (message) => {
    setStatus(`"${message}"`);
    setMapsUrl(null);

    try {
      const res = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message, location }),
      });

      const data = await res.json();
      if (data.reply) {
        if (data.replyTarget) {
          // "Lis mes messages" a trouvé un message auquel répondre — enchaîne
          // sur la proposition de réponse une fois le résumé énoncé. Cible
          // (actor_id) et déclenchement du flux : jamais décidés par le LLM,
          // uniquement par la présence de replyTarget renvoyée par le serveur
          // (voir buildUnreadMessagesSummary, route.js).
          speakText(data.reply, data.audioBase64, () => {
            replyFlowRef.current = 'confirm_reply';
            pendingReplyTargetRef.current = data.replyTarget;
            speakLocal('Tu veux répondre ?', () => startVoice());
          });
        } else {
          speakText(data.reply, data.audioBase64);
        }
      }
      // Lien Google Maps réel (origin = position GPS transmise dans la
      // requête, jamais persistée) : seulement quand une destination
      // reconnue ET une position ont été fournies (voir route.js).
      if (data.mapsUrl) {
        setMapsUrl(data.mapsUrl);
      }
    } catch (err) {
      setStatus('Erreur lors de la communication.');
    }
  };

  // Voix de sortie purement locale (speechSynthesis navigateur, jamais
  // Gemini TTS) pour les invites de confirmation du flux de réponse — ce
  // sont des chaînes fixes côté client, aucun besoin du pipeline serveur
  // (LLM + TTS) pour "Tu veux répondre ?" ou un texte déjà transcrit par
  // l'utilisateur lui-même.
  const speakLocal = (text, onFinish) => {
    setStatus(text);
    if (!('speechSynthesis' in window)) {
      if (onFinish) onFinish();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    setIsSpeaking(true);
    const finish = () => {
      setIsSpeaking(false);
      if (onFinish) onFinish();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  };

  // Dispatch déterministe de chaque transcript selon l'étape du flux de
  // réponse en cours (jamais confié au LLM) — sendToAssistant reste le
  // chemin par défaut hors flux de réponse.
  const handleTranscript = (transcript) => {
    const flow = replyFlowRef.current;
    if (flow === 'confirm_reply') return handleReplyConfirmation(transcript);
    if (flow === 'dictate_reply') return handleReplyDictation(transcript);
    if (flow === 'confirm_send') return handleSendConfirmation(transcript);
    sendToAssistant(transcript);
  };

  const handleReplyConfirmation = (transcript) => {
    const answer = matchYesNo(transcript);
    if (answer === 'yes') {
      replyFlowRef.current = 'dictate_reply';
      speakLocal('Je t\'écoute, dicte ta réponse.', () => startVoice());
    } else if (answer === 'no') {
      resetReplyFlow();
      speakLocal("D'accord, pas de réponse envoyée.");
    } else {
      speakLocal('Dis oui pour répondre, ou non pour annuler.', () => startVoice());
    }
  };

  const handleReplyDictation = (transcript) => {
    pendingReplyTextRef.current = transcript;
    replyFlowRef.current = 'confirm_send';
    speakLocal(`Tu veux envoyer : "${transcript}" — confirme ?`, () => startVoice());
  };

  // Envoi réel : sendMessage()/resolveConversationWith() (@/lib/messages),
  // exactement le même chemin — même client Supabase navigateur, même RLS —
  // que la messagerie normale (MessagerieClient.js). Aucun nouveau chemin
  // d'écriture, aucune route serveur dédiée : seule une confirmation
  // explicite ("oui") déclenche l'envoi.
  const handleSendConfirmation = async (transcript) => {
    const answer = matchYesNo(transcript);
    if (answer === 'yes') {
      const targetId = pendingReplyTargetRef.current;
      const text = pendingReplyTextRef.current;
      resetReplyFlow();
      try {
        const resolved = await resolveConversationWith(session.user.id, targetId);
        const { data: sentMsg, error } = await sendMessage({
          senderId: session.user.id,
          receiverId: targetId,
          conversationId: resolved?.conversationId || null,
          content: text,
          typeDiscussion: 'ECHANGE',
        });
        if (error || !sentMsg) throw new Error(error || 'Échec de l\'envoi');
        if (resolved?.conversationId) await touchConversation(resolved.conversationId, text);
        speakLocal('Message envoyé !');
      } catch (err) {
        console.error('[VoiceAssistant] Échec envoi réponse vocale:', err);
        speakLocal("Désolé, l'envoi a échoué.");
      }
    } else if (answer === 'no') {
      resetReplyFlow();
      speakLocal('Message annulé.');
    } else {
      speakLocal("Dis oui pour envoyer, ou non pour annuler.", () => startVoice());
    }
  };

  const startVoice = () => {
    if (!session) return requireLogin();

    setIsOpen(true);
    setHasEngaged(true);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Je t'écoute...");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleTranscript(transcript);
    };

    // event.error jamais exposé auparavant : impossible de distinguer
    // permission refusée / pas de réseau / silence / micro absent depuis
    // une seule et même formule générique. Loggé en clair + message
    // spécifique par code pour que le prochain signalement soit exploitable.
    recognition.onerror = (event) => {
      console.error('[VoiceAssistant] SpeechRecognition error:', event.error);
      setIsListening(false);
      const ERROR_MESSAGES = {
        'not-allowed': "Autorisation micro refusée.",
        'service-not-allowed': "Autorisation micro refusée.",
        network: "Problème réseau.",
        'no-speech': "Aucune parole détectée.",
        'audio-capture': "Micro introuvable.",
      };
      setStatus(ERROR_MESSAGES[event.error] || 'Erreur de capture audio.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!session) return requireLogin();

    const text = inputText.trim();
    if (!text) return;

    setIsOpen(true);
    setHasEngaged(true);
    setInputText('');
    // Passe par le même dispatch que la voix : un "oui"/"non" tapé doit
    // aussi faire avancer un flux de réponse en cours, pas uniquement une
    // réponse dictée à voix haute.
    handleTranscript(text);
  };

  // Voix de sortie : synthèse serveur (API Gemini TTS, voix "Sulafat") —
  // remplace speechSynthesis, seule la reconnaissance vocale du micro
  // (startVoice ci-dessus) reste côté navigateur. audioBase64 absent
  // (échec ponctuel de la synthèse côté serveur, jamais volontaire) ->
  // repli sur speechSynthesis pour ne jamais laisser l'utilisateur sans
  // réponse audible.
  const speakText = (text, audioBase64, onFinish) => {
    if (audioBase64) {
      setIsSpeaking(true);
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      const finish = () => {
        setIsSpeaking(false);
        setStatus(text);
        if (onFinish) onFinish();
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
      return;
    }

    if (!('speechSynthesis' in window)) {
      if (onFinish) onFinish();
      return;
    }

    window.speechSynthesis.cancel(); // Stoppe toute lecture en cours
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus(text);
      if (onFinish) onFinish();
    };

    window.speechSynthesis.speak(utterance);
  };

  const statusLine = status || (isListening ? "Je t'écoute..." : 'Appuie sur l\'orbe ou écris pour commencer');
  const callButtonIcon = isListening ? 'fa-microphone' : isSpeaking ? 'fa-volume-high' : 'fa-phone';
  const callButtonColor = isListening ? 'bg-red-500' : isSpeaking ? 'bg-amber-500' : 'bg-[#085041] hover:bg-[#0a6350]';

  return (
    <>
      <LiveMapLocation onLocationUpdate={handleLocationUpdate} render={false} active={hasEngaged} />

      {/* bottom-32 : dégage ScrollToTop.jsx (bottom-20/bottom-8, jusqu'à 112px
          de hauteur sur mobile) pour éviter que les deux boutons flottants
          se chevauchent en bas d'écran. */}
      <div className="fixed bottom-32 right-4 sm:right-6 z-[999] flex flex-col items-end gap-3">
        {isOpen && (
          <div className="w-[320px] max-w-[calc(100vw-2.5rem)] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-[#085041] text-white flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse flex-shrink-0" />
                <span className="text-sm font-bold truncate">Assistant Facilite — En ligne</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetReplyFlow();
                  setIsOpen(false);
                }}
                aria-label="Fermer l'assistant"
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition flex-shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            <div className="flex flex-col items-center px-5 pt-5 pb-4">
              <div className="relative mb-3">
                {isListening && <span className="absolute -inset-3 rounded-full bg-[#14b89a]/25 animate-ping" />}
                <div
                  className={`w-16 h-16 rounded-full ${isListening ? 'animate-pulse' : ''}`}
                  style={{ background: ORB_GRADIENT }}
                />
              </div>

              <p className="text-xs font-semibold text-slate-500 text-center min-h-[32px] flex items-center justify-center px-2">
                {statusLine}
              </p>

              <button
                type="button"
                onClick={startVoice}
                disabled={isListening || isSpeaking}
                aria-label="Parler à l'assistant"
                className={`mt-1 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition cursor-pointer disabled:cursor-not-allowed ${callButtonColor}`}
              >
                <i className={`fa-solid ${callButtonIcon} text-sm`}></i>
              </button>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  🧭 Ouvrir l'itinéraire dans Google Maps
                </a>
              )}
            </div>

            <form onSubmit={handleSendText} className="flex items-center gap-2 px-4 pb-4 flex-shrink-0">
              <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-full px-3.5 py-2.5 min-w-0">
                <button
                  type="button"
                  onClick={startVoice}
                  disabled={isListening || isSpeaking}
                  aria-label="Activer le micro"
                  className="text-slate-500 hover:text-[#085041] transition flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-microphone text-sm"></i>
                </button>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Écris ta question..."
                  className="flex-1 min-w-0 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!inputText.trim()}
                aria-label="Envoyer"
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white bg-[#085041] hover:bg-[#0a6350] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              resetReplyFlow();
              return setIsOpen(false);
            }
            // Un seul geste : ouvrir ET démarrer l'écoute (comme décrocher un
            // appel), plutôt que d'exiger un second clic sur le bouton
            // d'appel interne une fois le panneau ouvert — c'est ce second
            // clic manquant qui donnait l'impression que l'assistant ne
            // répondait jamais à la voix. startVoice() gère déjà la
            // vérification de session, l'ouverture du panneau et
            // l'engagement GPS ; le bouton d'appel interne reste disponible
            // pour relancer l'écoute après une réponse.
            startVoice();
          }}
          aria-label="Assistant Facilite"
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center cursor-pointer"
          style={{ background: ORB_GRADIENT }}
        >
          {isListening && <span className="absolute -inset-2 rounded-full bg-[#14b89a]/30 animate-ping" />}
          <i className={`fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-microphone-lines'} text-white text-lg relative`}></i>
        </button>
      </div>
    </>
  );
}
