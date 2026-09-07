"use client";

import { useEffect, useState } from "react";

/**
 * Diagnostic temporaire, invisible par défaut (activé par ?debug=viewport
 * dans l'URL) — l'utilisateur signale un bug qui n'apparaît QU'APRÈS avoir
 * pivoté sa tablette (Samsung Galaxy Tab), jamais au chargement initial.
 * Reproduction impossible via Playwright malgré des tests approfondis
 * (profils d'appareil réels, simulation de rotation par resize+
 * orientationchange programmatiques) : le mécanisme exact qui diffère sur
 * l'appareil réel reste inconnu. Ce composant transforme la tablette elle-
 * même en outil de diagnostic — même démarche que pour le bug d'écran noir
 * du globe MapLibre du Marketplace, qui ne s'était résolu qu'ainsi.
 *
 * À retirer une fois la cause confirmée.
 */
export default function DiagnosticViewport() {
  const [infos, setInfos] = useState(null);
  const [compteurResize, setCompteurResize] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "viewport") return undefined;

    const lireInfos = () => {
      const vv = window.visualViewport;
      setInfos({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        visualViewportWidth: vv ? Math.round(vv.width) : "absent",
        visualViewportScale: vv ? vv.scale : "absent",
        orientationAngle: screen.orientation ? screen.orientation.angle : "absent",
        orientationType: screen.orientation ? screen.orientation.type : "absent",
        devicePixelRatio: window.devicePixelRatio,
        heure: new Date().toLocaleTimeString("fr-FR"),
      });
    };

    // setState différé : corps de l'effet, pas un callback d'un système
    // externe — exigé par la règle react-hooks correspondante.
    queueMicrotask(lireInfos);

    const surChangement = (evt) => {
      setCompteurResize((c) => c + 1);
      lireInfos();
      console.log("[diagnostic-viewport] événement:", evt.type, {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      });
    };

    window.addEventListener("resize", surChangement);
    window.addEventListener("orientationchange", surChangement);
    window.visualViewport?.addEventListener("resize", surChangement);

    return () => {
      window.removeEventListener("resize", surChangement);
      window.removeEventListener("orientationchange", surChangement);
      window.visualViewport?.removeEventListener("resize", surChangement);
    };
  }, []);

  if (!infos) return null;

  const debordement = infos.scrollWidth - infos.innerWidth;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        right: 8,
        zIndex: 999999,
        background: debordement > 2 ? "#dc2626" : "#000000cc",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.5,
        padding: "10px 12px",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div>
        <b>DIAGNOSTIC VIEWPORT</b> (resize #{compteurResize}, {infos.heure})
      </div>
      <div>
        innerWidth: {infos.innerWidth} · clientWidth: {infos.clientWidth} · scrollWidth: {infos.scrollWidth}{" "}
        {debordement > 2 ? `⚠️ débordement de ${debordement}px` : "✓ aucun débordement"}
      </div>
      <div>
        visualViewport: {infos.visualViewportWidth}px (scale {infos.visualViewportScale}) · dpr:{" "}
        {infos.devicePixelRatio}
      </div>
      <div>
        orientation: {infos.orientationType} ({infos.orientationAngle}°)
      </div>
    </div>
  );
}
