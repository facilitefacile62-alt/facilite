"use client";

import { useEffect } from "react";

/**
 * Enregistrement du service worker (public/sw.js).
 *
 * Uniquement en production : en développement, un service worker met en
 * cache des ressources que `next dev` régénère en permanence, ce qui donne
 * des incohérences difficiles à diagnostiquer (une page qui ne se met pas à
 * jour après une modification).
 *
 * Best-effort : un échec d'enregistrement ne doit jamais casser le rendu.
 * Le site fonctionne exactement comme avant sans service worker — celui-ci
 * n'ajoute que le repli hors ligne.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const enregistrer = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[sw] Enregistrement impossible :", err?.message);
      });
    };

    // Après `load` : l'enregistrement ne doit pas entrer en concurrence
    // avec le chargement initial de la page.
    if (document.readyState === "complete") {
      enregistrer();
    } else {
      window.addEventListener("load", enregistrer);
      return () => window.removeEventListener("load", enregistrer);
    }
  }, []);

  return null;
}
