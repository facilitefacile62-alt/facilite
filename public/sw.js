/* eslint-disable no-restricted-globals */
/**
 * Service worker minimal de Facilité.
 *
 * Objectif volontairement étroit : donner un vrai mode hors ligne de base
 * (coquille + page d'attente) sans transformer l'application en cache
 * opaque difficile à invalider. C'est le second manque relevé au
 * diagnostic « Thin Content » avant soumission Google Play — un wrapper
 * sans service worker n'apporte rien de plus que le navigateur.
 *
 * Trois règles, dans cet ordre :
 *   1. Tout ce qui n'est pas un GET de même origine passe directement au
 *      réseau, sans jamais être mis en cache. Cela exclut d'office /api/,
 *      Supabase, Gemini, Sentry, Clarity, et toute écriture.
 *   2. Les navigations (documents HTML) sont servies RÉSEAU D'ABORD :
 *      en ligne, le comportement est strictement identique à aujourd'hui.
 *      Hors ligne, on sert la dernière version vue de la page, et à défaut
 *      la page /hors-ligne.html.
 *   3. Les ressources versionnées (/_next/static/, icônes, polices) sont
 *      servies CACHE D'ABORD : leur URL contient déjà une empreinte, elles
 *      ne changent jamais sous une même URL.
 *
 * Aucune réponse authentifiée n'est mise en cache : les documents HTML de
 * ce site sont soit publics, soit régénérés par le middleware côté serveur,
 * et le cache est vidé à chaque changement de VERSION_CACHE.
 */

const VERSION_CACHE = "facilite-v2";
const PAGE_HORS_LIGNE = "/hors-ligne.html";

// Volontairement court : uniquement ce qui est nécessaire pour afficher
// quelque chose d'utile sans réseau. Précacher davantage rendrait
// l'installation lente et fragile (un seul 404 fait échouer addAll).
const PRECACHE = [PAGE_HORS_LIGNE, "/manifest.json", "/icon-192x192.png", "/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Ne jamais bloquer l'installation sur un précache incomplet : le
      // service worker reste utile même si une icône manque.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function estRessourceVersionnee(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Règle 1 — hors périmètre : réseau direct, aucun cache.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Règle 2 — navigations : réseau d'abord.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          // Seules les réponses complètes et valides sont conservées ; une
          // redirection du middleware vers /login n'a rien à faire en cache.
          if (reponse.ok && reponse.type === "basic") {
            const copie = reponse.clone();
            caches.open(VERSION_CACHE).then((cache) => cache.put(request, copie));
          }
          return reponse;
        })
        .catch(() =>
          caches.match(request).then((enCache) => enCache || caches.match(PAGE_HORS_LIGNE))
        )
    );
    return;
  }

  // Règle 3 — ressources versionnées : cache d'abord.
  if (estRessourceVersionnee(url)) {
    event.respondWith(
      caches.match(request).then(
        (enCache) =>
          enCache ||
          fetch(request).then((reponse) => {
            if (reponse.ok && reponse.type === "basic") {
              const copie = reponse.clone();
              caches.open(VERSION_CACHE).then((cache) => cache.put(request, copie));
            }
            return reponse;
          })
      )
    );
  }
});
