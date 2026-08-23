// Chargé par src/instrumentation.js (register(), runtime "edge" uniquement —
// concerne src/proxy.js, en Edge Runtime dans ce projet).
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/sentryScrub";
import { isCriticalSentryEvent, sendCriticalAlertEmail } from "./lib/sentryAlert";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  sendDefaultPii: false,
  // Même logique que sentry.server.config.js — les routes de paiement
  // tournent en runtime nodejs (pas edge), mais un crash 500 dans le
  // middleware edge (src/proxy.js) reste un "500" au sens de l'alerte.
  beforeSend: async (event) => {
    const scrubbed = scrubSentryEvent(event);
    if (scrubbed && isCriticalSentryEvent(scrubbed)) {
      await sendCriticalAlertEmail(scrubbed);
    }
    return scrubbed;
  },
});
