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

/**
 * BotID (Vercel) — challenge invisible sur la création de compte.
 *
 * initBotId déclare les chemins que le navigateur doit accompagner des
 * en-têtes de challenge. Sans cette déclaration, checkBotId() côté serveur
 * échoue systématiquement : c'est le client qui décide quelles requêtes
 * sont instrumentées.
 *
 * Seule l'inscription est protégée. La connexion appelle Supabase
 * directement depuis le navigateur (login/page.js, signInWithPassword) :
 * aucune route de l'application n'est traversée, il n'y a donc rien à
 * protéger tant que ce flux n'est pas déplacé côté serveur — chantier
 * volontairement reporté, la gestion de session est entièrement cliente et
 * a déjà causé deux incidents le 2026-08-28.
 *
 * Niveau Basic uniquement : Deep Analysis exige le plan Pro. Basic valide
 * l'intégrité de la réponse au challenge, ce qui arrête les robots qui
 * n'exécutent pas de JavaScript ou rejouent une requête brute — l'essentiel
 * des créations de comptes automatisées.
 */
import { initBotId } from "botid/client/core";

initBotId({
  protect: [{ path: "/api/auth/register", method: "POST" }],
});
