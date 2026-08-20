'use client';

import { useState, useEffect } from 'react';

export default function VoiceAssistant({ location = null }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('');
  const [mapsUrl, setMapsUrl] = useState(null);

  const startVoice = () => {
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
      setStatus("Je vous écoute...");
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setStatus(`"${transcript}"`);
      setMapsUrl(null);

      try {
        const res = await fetch('/api/voice-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: transcript, location }),
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
        setStatus("Erreur lors de la communication.");
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatus("Erreur de capture audio.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-sm w-full mx-auto">
      <div className="relative mb-4">
        {isListening && (
          <span className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-ping" />
        )}
        <button
          type="button"
          onClick={startVoice}
          disabled={isListening || isSpeaking}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl transition-all shadow-lg ${
            isListening
              ? 'bg-red-500 scale-105'
              : isSpeaking
              ? 'bg-amber-500'
              : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105'
          }`}
          aria-label="Activer l'assistant vocal"
        >
          {isListening ? '🎙️' : isSpeaking ? '🔊' : '🎤'}
        </button>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 text-center min-h-[40px] flex items-center justify-center">
        {status || "Appuyez sur le micro pour poser une question"}
      </p>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-sm"
        >
          🧭 Ouvrir l'itinéraire dans Google Maps
        </a>
      )}
    </div>
  );
}
