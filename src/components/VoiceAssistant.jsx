'use client';

import { useState, useEffect } from 'react';

export default function VoiceAssistant({ location = null }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('');

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

      try {
        const res = await fetch('/api/voice-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: transcript, location }),
        });

        const data = await res.json();
        if (data.reply) {
          speakText(data.reply);
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

  const speakText = (text) => {
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
    </div>
  );
}
