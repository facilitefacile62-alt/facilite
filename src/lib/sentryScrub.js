/**
 * beforeSend partagé par sentry.server.config.js et sentry.edge.config.js.
 *
 * Aucun appel Sentry.captureException explicite n'existe dans ce dépôt
 * (grep confirmé) — la seule voie de capture est l'instrumentation
 * automatique de @sentry/nextjs (onRequestError = Sentry.captureRequestError
 * dans instrumentation.js), qui joint le contexte de la requête HTTP en
 * cas d'exception non gérée. Pertinent pour
 * /api/profil/scan-identity-document : une exception levée pendant le
 * traitement du buffer image ou des champs extraits (nom/prénom/quartier)
 * ne doit jamais faire remonter ces données à Sentry, même
 * accidentellement via event.request.data ou event.extra.
 *
 * Défense en profondeur : sendDefaultPii=false (explicite, voir configs)
 * évite déjà la capture du corps de requête par défaut, mais ce hook
 * retire quand même toute donnée de requête et toute clé dont le nom
 * évoque un champ sensible, au cas où un futur appel Sentry explicite
 * (ou une évolution du SDK) en attacherait un jour.
 */
const SENSITIVE_KEY_FRAGMENTS = [
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

  return event;
}
