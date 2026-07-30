// Initialisation Sentry côté navigateur — remplace l'ancien
// `sentry.client.config.js` (non chargé automatiquement par les versions
// récentes du SDK) : ce nom de fichier est le point d'entrée client détecté
// par `withSentryConfig` (voir next.config.mjs).
import * as Sentry from "@sentry/nextjs";

// Valeur de secours volontaire : un DSN vide désactive silencieusement
// l'envoi d'événements (le SDK ne lève aucune erreur), pour que ni le build
// CI ni le runtime ne dépendent de la présence réelle de la clé.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
