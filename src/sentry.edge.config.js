// Chargé par src/instrumentation.js (register(), runtime "edge" uniquement —
// concerne src/middleware.js, en Edge Runtime dans ce projet).
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
