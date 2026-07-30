"use client";

/**
 * Petite alerte sonore synthétisée via Web Audio API (deux notes brèves) —
 * pas de fichier audio à charger/héberger, jamais bloquant si le navigateur
 * refuse l'autoplay (échoue silencieusement, l'important est le badge visuel).
 */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [880, 1175].forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      const start = now + i * 0.12;
      const end = start + 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });

    setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch (err) {
    console.warn("Alerte sonore indisponible:", err?.message || err);
  }
}
