import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

/**
 * Content-Security-Policy en mode Report-Only.
 *
 * Volontairement non bloquante pour l'instant : une CSP stricte appliquée
 * d'emblée casserait le rendu (Font Awesome via cdnjs, images et PDF servis
 * depuis Supabase Storage). Observer d'abord les violations rapportées dans la
 * console du navigateur, ajuster, puis seulement basculer la clé sur
 * "Content-Security-Policy" pour qu'elle bloque réellement.
 *
 * Notes sur les assouplissements :
 *  - 'unsafe-inline' / 'unsafe-eval' sur script-src : requis par le runtime
 *    Next.js (scripts d'hydratation inline). Les supprimer demande une
 *    stratégie de nonces via le middleware.
 *  - frame-src supabase.co : la visionneuse PDF du profil affiche le CV dans
 *    une iframe alimentée par une URL signée Supabase.
 */
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com",
  // *.googleusercontent.com : photo de profil Google, copiée dans
  // profiles.avatar_url à l'inscription par le trigger handle_new_user
  // (raw_user_meta_data->>'avatar_url') pour les comptes connectés via
  // Google OAuth (seul provider OAuth branché sur /login et /register).
  // images.unsplash.com : visuels des offres d'emploi de démonstration
  // (supabase/seed.sql) — les images réellement uploadées par un recruteur
  // passent toujours par supabase.storage (déjà couvert par *.supabase.co).
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://images.unsplash.com",
  // *.sentry.io : ingestion des événements par le SDK Sentry (client-side).
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
  "frame-src 'self' blob: data: https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // upgrade-insecure-requests n'a aucun effet en mode Report-Only (le
  // navigateur le rapporte explicitement comme ignoré) : cette directive ne
  // fait que réécrire les requêtes http:// en https://, ce qui exige une
  // application réelle. À réintroduire uniquement au moment du bascule vers
  // le header "Content-Security-Policy" (enforced), pas avant.
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["unpdf", "mammoth", "tesseract.js", "@napi-rs/canvas", "canvas"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // camera=(self) : l'import de CV par photo (DiagnosticModal) utilise
            // capture="environment" et serait bloqué avec camera=().
            // microphone=(self) : la note vocale de /messagerie (getUserMedia
            // audio, déclenchée au clic sur le bouton micro) serait bloquée par
            // le navigateur AVANT même l'appel JS avec microphone=() — quel que
            // soit le geste utilisateur, un allowlist vide refuse toujours.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

// org/project/authToken absents en local et en CI (aucun secret Sentry
// configuré) : le plugin webpack de Sentry se contente alors de sauter
// l'upload des source maps avec un avertissement, sans faire échouer le
// build (`silent: true` supprime ce bruit plutôt que de le rendre bloquant).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
