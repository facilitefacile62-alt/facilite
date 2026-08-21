'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import LiveMapLocation from './LiveMapLocation';

const ORB_GRADIENT = 'conic-gradient(from 0deg, #085041, #14b89a, #9FE1CB, #085041)';

// Widget global (monté une fois dans layout.js, visible sur toutes les
// pages) — remplace l'ancienne carte statique non montée nulle part
// (diagnostic Point 1 : LiveMapLocation et l'assistant vocal existaient
// mais n'étaient jamais composés ensemble ni affichés sur le site réel).
export default function VoiceAssistant() {
  const { session } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [hasEngaged, setHasEngaged] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('');
  const [mapsUrl, setMapsUrl] = useState(null);
  const [inputText, setInputText] = useState('');
  const [location, setLocation] = useState(null);

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
        speakText(data.reply, data.audioBase64);
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
      sendToAssistant(transcript);
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
    sendToAssistant(text);
  };

  // Voix de sortie : synthèse serveur (API Gemini TTS, voix "Sulafat") —
  // remplace speechSynthesis, seule la reconnaissance vocale du micro
  // (startVoice ci-dessus) reste côté navigateur. audioBase64 absent
  // (échec ponctuel de la synthèse côté serveur, jamais volontaire) ->
  // repli sur speechSynthesis pour ne jamais laisser l'utilisateur sans
  // réponse audible.
  const speakText = (text, audioBase64) => {
    if (audioBase64) {
      setIsSpeaking(true);
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      const finish = () => {
        setIsSpeaking(false);
        setStatus(text);
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
      return;
    }

    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stoppe toute lecture en cours
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus(text);
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
                onClick={() => setIsOpen(false)}
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
            if (isOpen) return setIsOpen(false);
            if (!session) return requireLogin();
            // Déclenche le suivi GPS headless dès l'ouverture, pas seulement
            // à l'envoi du premier message : sendToAssistant lit `location`
            // de façon synchrone, donc si le suivi ne démarrait qu'au moment
            // même de l'envoi, le tout premier message partirait toujours
            // sans coordonnées (watchPosition est asynchrone par nature).
            setHasEngaged(true);
            setIsOpen(true);
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
