// Chargé par src/instrumentation.js (register(), runtime "nodejs" uniquement).
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/sentryScrub";
import { isCriticalSentryEvent, sendCriticalAlertEmail } from "./lib/sentryAlert";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Jamais IP/cookies/headers/corps de requête par défaut — explicite
  // plutôt que de dépendre du défaut du SDK. Voir lib/sentryScrub.js.
  sendDefaultPii: false,
  // Toujours scrubber D'ABORD, alerter ensuite sur l'event déjà nettoyé —
  // l'email d'alerte (sentryAlert.js) ne doit jamais contenir plus de
  // données que ce que Sentry lui-même reçoit. best-effort : un échec
  // d'envoi d'email ne doit jamais empêcher l'event d'être transmis à
  // Sentry (voir sendCriticalAlertEmail, ne lève jamais).
  beforeSend: async (event) => {
    const scrubbed = scrubSentryEvent(event);
    if (scrubbed && isCriticalSentryEvent(scrubbed)) {
      await sendCriticalAlertEmail(scrubbed);
    }
    return scrubbed;
  },
});
