/**
 * beforeSend partagé par sentry.server.config.js, sentry.edge.config.js ET
 * instrumentation-client.js (2026-08-23 : le scrubbing était jusque-là
 * absent côté navigateur, seul sendDefaultPii=false y était manquant aussi).
 *
 * Capture automatique via onRequestError (instrumentation.js) côté
 * serveur/edge pour toute exception non gérée, plus quelques
 * Sentry.captureMessage explicites ajoutés aux échecs de paiement/webhook
 * déjà catchés (voir sentryAlert.js) — jamais de corps de requête ni de
 * champ sensible ne doit atteindre Sentry, quelle que soit la route.
 *
 * Défense en profondeur : sendDefaultPii=false (explicite, voir configs)
 * évite déjà la capture du corps de requête par défaut, mais ce hook
 * retire quand même toute donnée de requête et toute clé dont le nom
 * évoque un champ sensible, au cas où un futur appel Sentry explicite
 * (ou une évolution du SDK) en attacherait un jour.
 *
 * Élargi (2026-08-23) au-delà de /api/profil/scan-identity-document :
 * coordonnées de contact, secrets/jetons, contenu de messages/CV, données
 * de paiement — motifs de champs qui apparaissent dans plusieurs autres
 * routes de ce dépôt (postuler, ai-chat, pay/*).
 */
const SENSITIVE_KEY_FRAGMENTS = [
  // Pièce d'identité (origine du hook, scan-identity-document)
  "buffer",
  "image",
  "file",
  "nom",
  "prenom",
  "prénom",
  "quartier",
  "identity",
  "identité",
  "document",
  "cni",
  "passeport",
  // Coordonnées de contact
  "email",
  "e-mail",
  "phone",
  "telephone",
  "téléphone",
  "whatsapp",
  "adresse",
  "address",
  // Secrets / authentification
  "password",
  "mot_de_passe",
  "token",
  "secret",
  "signature",
  "authorization",
  // Contenu utilisateur libre (messages, CV, lettres) — fragments français
  // spécifiques plutôt que "message"/"content" (trop génériques : auraient
  // aussi supprimé des clés de diagnostic utiles et non sensibles comme
  // "errorMessage" ou "contentType", contraire à l'objectif du scrubbing
  // ciblé déjà vérifié par les tests existants).
  "contenu",
  "resume",
  "résumé",
  "cv_",
  "coverletter",
  "cover_letter",
  "lettre",
  // Paiement
  "card",
  "carte",
  "iban",
  "cvv",
  "payment_reference",
];

function isSensitiveKey(key) {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function scrubObjectInPlace(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (isSensitiveKey(key)) {
      delete obj[key];
    }
  }
}

export function scrubSentryEvent(event) {
  if (!event) return event;

  if (event.request) {
    // Jamais le corps de requête (multipart contenant potentiellement
    // l'image), jamais les cookies/headers d'authentification.
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
    }
  }

  scrubObjectInPlace(event.extra);
  // Défense en profondeur au-delà de event.extra (2026-08-23) : un futur
  // Sentry.setUser()/setContext() explicite, ou sendDefaultPii réactivé par
  // erreur, ne doit pas non plus faire fuiter un champ sensible.
  scrubObjectInPlace(event.user);
  if (event.contexts) {
    for (const ctx of Object.values(event.contexts)) {
      scrubObjectInPlace(ctx);
    }
  }

  return event;
}
