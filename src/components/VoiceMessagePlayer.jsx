"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function formatAudioTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Hauteurs de barres déterministes style WhatsApp
 */
function buildWaveformBars(seed, count = 30) {
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
    bars.push(0.25 + ((state % 100) / 100) * 0.75);
  }
  return bars;
}

export default function VoiceMessagePlayer({
  src,
  variant = "received",
  avatarUrl = null,
  avatarInitials = null,
  avatarColor = "bg-[#10E688]"
}) {
  const audioRef = useRef(null);
  const bars = useMemo(() => buildWaveformBars(src || "voice", 28), [src]);
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
    <div className="flex items-center gap-2.5 w-full min-w-[240px] sm:min-w-[280px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Bouton Play/Pause WhatsApp */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Mettre en pause" : "Écouter la note vocale"}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer bg-[#111B21] text-white hover:bg-black shadow-xs"
      >
        <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"} text-xs ${isPlaying ? "" : "ml-0.5"}`}></i>
      </button>

      {/* Waveform avec scrubber cyan WhatsApp */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div
          onClick={handleSeekClick}
          onKeyDown={handleSeekKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Progression de la note vocale"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          className="relative w-full h-7 flex items-center gap-[2.5px] cursor-pointer focus:outline-none"
        >
          {bars.map((height, i) => {
            const played = i / bars.length <= progressRatio;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${
                  played ? "bg-[#53BDEB]" : isSent ? "bg-[#7DB596]" : "bg-[#8696A0]"
                }`}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}

          {/* Point indicateur de lecture cyan */}
          {progressRatio > 0 && (
            <span
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#53BDEB] border-2 border-white shadow-xs pointer-events-none transition-all"
              style={{ left: `calc(${progressRatio * 100}% - 6px)` }}
            />
          )}
        </div>

        {/* Temps & vitesse */}
        <div className="flex items-center justify-between text-[10px] font-bold text-[#667781] px-0.5">
          <span className="tabular-nums">
            {formatAudioTime(isPlaying || currentTime > 0 ? currentTime : duration)}
          </span>
          <button
            type="button"
            onClick={cyclePlaybackRate}
            title="Vitesse de lecture"
            className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-black/5 hover:bg-black/10 text-gray-700 transition cursor-pointer"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Avatar avec mini badge microphone cyan (style WhatsApp) */}
      {(avatarUrl || avatarInitials) && (
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover shadow-2xs border border-white"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shadow-2xs border border-white ${avatarColor}`}
            >
              {avatarInitials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border border-[#EFEAE2] flex items-center justify-center shadow-2xs">
            <i className="fa-solid fa-microphone text-[#53BDEB] text-[8px]"></i>
          </span>
        </div>
      )}
    </div>
  );
}
