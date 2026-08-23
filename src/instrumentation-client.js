// Initialisation Sentry côté navigateur — remplace l'ancien
// `sentry.client.config.js` (non chargé automatiquement par les versions
// récentes du SDK) : ce nom de fichier est le point d'entrée client détecté
// par `withSentryConfig` (voir next.config.mjs).
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/sentryScrub";

// Valeur de secours volontaire : un DSN vide désactive silencieusement
// l'envoi d'événements (le SDK ne lève aucune erreur), pour que ni le build
// CI ni le runtime ne dépendent de la présence réelle de la clé.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Trouvaille du 2026-08-23 : contrairement à sentry.server.config.js et
  // sentry.edge.config.js, cette config n'avait ni sendDefaultPii=false ni
  // beforeSend — le scrubbing n'était donc PAS global, seulement
  // serveur/edge. Pas d'envoi d'email ici (sendCriticalAlertEmail a besoin
  // d'une clé Resend serveur, jamais exposée au navigateur) : seul le
  // scrubbing s'applique côté client.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
