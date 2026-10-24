"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { doitInterroger, estTelephone, tenterOuvertureAuto } from "@/lib/ouvertureAppPaiement";

// Lecture du téléphone une seule fois, sans écouter d'événement ; faux côté serveur (pas de décalage à l'hydratation).
const sAbonner = () => () => {};
const lireAppareil = () => ({
  userAgent: navigator.userAgent || "",
  userAgentDataMobile: navigator.userAgentData?.mobile,
  maxTouchPoints: navigator.maxTouchPoints || 0,
});
let appareilEnCache = null;
const appareil = () => (appareilEnCache ??= lireAppareil());
const estMobileClient = () => estTelephone(appareil());

/**
 * Pour la page de paiement : `estMobile` (le bouton MAXIT passe au premier plan), `tenterAuto` (ouvre l'application une seule fois par commande)
 * et, tant que `actif` est vrai (QR affiché, paiement en attente), une interrogation IMMÉDIATE du statut dès que le client revient dans le
 * navigateur (visibilitychange / focus / pageshow) — les interrogations régulières de la page continuent ensuite.
 */
export function useOuvertureAppPaiement({ actif, interroger }) {
  const estMobile = useSyncExternalStore(sAbonner, estMobileClient, () => false);
  const derniere = useRef(0);
  const interrogerRef = useRef(interroger);
  useEffect(() => {
    interrogerRef.current = interroger;
  }, [interroger]);

  useEffect(() => {
    if (!actif) return undefined;
    const auRetour = () => {
      if (document.visibilityState === "hidden") return;
      const maintenant = Date.now();
      if (!doitInterroger(maintenant, derniere.current)) return;
      derniere.current = maintenant;
      interrogerRef.current?.();
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);
    window.addEventListener("pageshow", auRetour);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
      window.removeEventListener("pageshow", auRetour);
    };
  }, [actif]);

  const tenterAuto = useCallback((commandeId, liens) => {
    return tenterOuvertureAuto({
      commandeId,
      liens,
      appareil: appareil(),
      ouvrir: (url) => window.location.assign(url),
    });
  }, []);

  return { estMobile, tenterAuto };
}
