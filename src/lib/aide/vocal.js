// Règles des messages vocaux, partagées par la route et les tests.
// Supabase Storage compare le type de l'objet à la liste du bucket (« audio/webm ») : un type avec paramètre
// (« audio/webm;codecs=opus », ce que produit MediaRecorder) serait REFUSÉ. On l'envoie donc toujours nu.
export const TAILLE_MAX_OCTETS = 1024 * 1024; // 1 Mo : très au-dessus de 60 s à 32 kbps (~240 Ko)

export const EXTENSIONS_AUDIO = Object.freeze({
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/x-m4a": "m4a",
});

/** « audio/webm;codecs=opus » -> « audio/webm » ; vide ou inconnu -> chaîne vide. */
export function typeAudioSansParametres(type) {
  return String(type || "").split(";")[0].trim().toLowerCase();
}

/** Renvoie { type, extension } si le format est accepté, sinon null. */
export function formatAudioAccepte(type) {
  const nu = typeAudioSansParametres(type);
  const extension = EXTENSIONS_AUDIO[nu];
  return extension ? { type: nu, extension } : null;
}
