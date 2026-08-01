"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function formatAudioTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Hauteurs de barres déterministes à partir de l'URL du fichier : pas une
 * vraie analyse de fréquence (décoder chaque note vocale d'un historique de
 * discussion potentiellement long serait coûteux), mais un motif stable et
 * propre à chaque message plutôt qu'un bloc uniforme — xorshift32 léger,
 * usage purement visuel, pas cryptographique.
 */
function buildWaveformBars(seed, count = 32) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let state = hash || 1;
  const bars = [];
  for (let i = 0; i < count; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bars.push(0.25 + (state % 100) / 100 * 0.75); // hauteur entre 25% et 100%
  }
  return bars;
}

export default function VoiceMessagePlayer({ src, variant = "received" }) {
  const audioRef = useRef(null);
  const bars = useMemo(() => buildWaveformBars(src || "voice"), [src]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const fixInfiniteDuration = () => {
      audio.currentTime = 0;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.removeEventListener("timeupdate", fixInfiniteDuration);
    };

    const handleLoadedMetadata = () => {
      // Bug connu Chrome : les blobs webm enregistrés via MediaRecorder
      // rapportent souvent duration = Infinity tant qu'une recherche
      // complète du flux n'a pas été forcée au moins une fois.
      if (!Number.isFinite(audio.duration)) {
        audio.currentTime = 1e101;
        audio.addEventListener("timeupdate", fixInfiniteDuration);
      } else {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", fixInfiniteDuration);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seekToRatio = (ratio) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    audio.currentTime = clamped * duration;
    setCurrentTime(audio.currentTime);
  };

  const handleSeekClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekToRatio((e.clientX - rect.left) / rect.width);
  };

  const handleSeekKeyDown = (e) => {
    if (!duration) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekToRatio((currentTime - 5) / duration);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekToRatio((currentTime + 5) / duration);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const isSent = variant === "sent";

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Mettre en pause" : "Écouter la note vocale"}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition cursor-pointer ${
          isSent ? "bg-white/20 hover:bg-white/30 text-white" : "bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB]"
        }`}
      >
        <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"} text-xs ${isPlaying ? "" : "ml-0.5"}`}></i>
      </button>

      <div
        onClick={handleSeekClick}
        onKeyDown={handleSeekKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Progression de la note vocale"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        className={`flex-1 min-w-0 h-8 flex items-center gap-[2px] cursor-pointer rounded-lg focus:outline-none focus:ring-2 ${
          isSent ? "focus:ring-white/50" : "focus:ring-[#2563EB]/40"
        }`}
      >
        {bars.map((height, i) => {
          const played = i / bars.length <= progressRatio;
          return (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                played ? (isSent ? "bg-white" : "bg-[#2563EB]") : isSent ? "bg-white/35" : "bg-gray-300"
              }`}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-end flex-shrink-0 gap-1">
        <button
          type="button"
          onClick={cyclePlaybackRate}
          title="Vitesse de lecture"
          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md leading-none transition cursor-pointer ${
            isSent ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
          }`}
        >
          {playbackRate}x
        </button>
        <span className={`text-[9px] font-bold tabular-nums ${isSent ? "text-white/80" : "text-gray-500"}`}>
          {formatAudioTime(isPlaying || currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}
