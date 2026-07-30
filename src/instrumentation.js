import * as Sentry from "@sentry/nextjs";

// Point d'entrée détecté automatiquement par Next.js au démarrage du
// serveur (et pendant `next build`, qui invoque aussi l'instrumentation) —
// charge la config Sentry adaptée au runtime réellement actif plutôt qu'une
// config unique qui tenterait d'utiliser des API Node absentes en Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.js");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config.js");
  }
}

export const onRequestError = Sentry.captureRequestError;
