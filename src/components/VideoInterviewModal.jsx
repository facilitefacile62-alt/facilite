"use client";

import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { supabase } from "@/lib/supabase";

/**
 * Modale plein écran d'entretien vidéo (Daily.co Prebuilt embarqué).
 *
 * Le jeton de participation est minté à l'ouverture (jamais réutilisé d'un
 * appel à l'autre) via POST /api/interviews/[id]/join — voir le
 * raisonnement dans src/lib/dailyco.js.
 */
export default function VideoInterviewModal({ interviewId, isOpen, onClose }) {
  const containerRef = useRef(null);
  const callFrameRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | joined | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen || !interviewId) return;

    let cancelled = false;

    async function joinInterview() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
        }

        const res = await fetch(`/api/interviews/${interviewId}/join`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.token) {
          throw new Error(data?.error || "Impossible de rejoindre l'entretien.");
        }

        if (cancelled || !containerRef.current) return;

        const callFrame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: { width: "100%", height: "100%", border: "0" },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        callFrameRef.current = callFrame;

        callFrame.on("left-meeting", () => {
          if (!cancelled) onClose();
        });
        callFrame.on("error", (event) => {
          console.error("[Entretien vidéo] Erreur Daily.co :", event);
          if (!cancelled) {
            setErrorMessage(
              event?.errorMsg || "Une erreur est survenue pendant l'entretien (caméra/micro refusé, connexion perdue...)."
            );
            setStatus("error");
          }
        });

        await callFrame.join({ url: data.roomUrl, token: data.token });
        if (!cancelled) setStatus("joined");
      } catch (err) {
        if (!cancelled) {
          console.error("[Entretien vidéo] Échec de connexion :", err);
          setErrorMessage(err.message || "Impossible de rejoindre l'entretien.");
          setStatus("error");
        }
      }
    }

    joinInterview();

    return () => {
      cancelled = true;
      // leave() puis destroy() : garantit la libération de la caméra/micro
      // par le navigateur même si l'utilisateur ferme la modale plutôt que
      // de cliquer sur le bouton "Quitter" natif de Daily Prebuilt.
      if (callFrameRef.current) {
        callFrameRef.current.leave().catch(() => {});
        callFrameRef.current.destroy().catch(() => {});
        callFrameRef.current = null;
      }
    };
  }, [isOpen, interviewId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[900] bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center space-x-2 text-white">
          <i className="fa-solid fa-video text-[#10E688]"></i>
          <span className="text-sm font-extrabold">Entretien vidéo</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
          aria-label="Fermer l'entretien"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 text-white">
            <div className="w-10 h-10 border-4 border-[#10E688] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold">Connexion à l'entretien...</p>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-white p-6 text-center">
            <i className="fa-solid fa-triangle-exclamation text-4xl text-amber-400"></i>
            <p className="text-sm font-bold max-w-md">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
