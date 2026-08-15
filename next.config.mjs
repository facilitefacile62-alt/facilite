import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

/**
 * Content-Security-Policy — appliquée en mode bloquant (header
 * "Content-Security-Policy", pas "-Report-Only" : voir headers() plus bas).
 *
 * Historique : la variable ci-dessous s'appelait cspReportOnly et le
 * commentaire décrivait un plan "observer les violations, ajuster, puis
 * seulement basculer sur le header bloquant" — mais le header réellement
 * utilisé était déjà "Content-Security-Policy" (bloquant), pas
 * "-Report-Only". Trouvé le 2026-08-15 en diagnostiquant un <link>
 * Google Fonts silencieusement bloqué (creer-cv/page.js, sélecteur de
 * police) : le navigateur rapportait un vrai blocage, pas juste un rapport
 * de violation ignoré. Renommé pour refléter l'état réel — aucun
 * changement de comportement, le site tourne déjà sous cette CSP
 * bloquante depuis un moment sans régression connue.
 *
 * Notes sur les assouplissements :
 *  - 'unsafe-inline' / 'unsafe-eval' sur script-src : requis par le runtime
 *    Next.js (scripts d'hydratation inline). Les supprimer demande une
 *    stratégie de nonces via le middleware.
 *  - frame-src supabase.co : la visionneuse PDF du profil affiche le CV dans
 *    une iframe alimentée par une URL signée Supabase.
 */
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""}`,
  // fonts.googleapis.com : feuilles de style chargées dynamiquement par
  // loadFont() (creer-cv/page.js) pour les polices Google Fonts choisies
  // dans le sélecteur de style CV (Outfit, Montserrat, Roboto, Playfair
  // Display, Public Sans) — Inter reste hors CDN, servie par next/font.
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  // fonts.gstatic.com : fichiers de police référencés par les feuilles de
  // style ci-dessus (@font-face url()) — sans cette entrée, la feuille de
  // style Google Fonts chargerait mais les fichiers .woff2 resteraient
  // bloqués.
  "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  // *.googleusercontent.com : photo de profil Google, copiée dans
  // profiles.avatar_url à l'inscription par le trigger handle_new_user
  // (raw_user_meta_data->>'avatar_url') pour les comptes connectés via
  // Google OAuth (seul provider OAuth branché sur /login et /register).
  // images.unsplash.com : visuels des offres d'emploi de démonstration
  // (supabase/seed.sql) — les images réellement uploadées par un recruteur
  // passent toujours par supabase.storage (déjà couvert par *.supabase.co).
  // flagcdn.com : drapeaux des indicatifs pays dans PhoneAuthForm.jsx.
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://images.unsplash.com https://flagcdn.com",
  // *.sentry.io : ingestion des événements par le SDK Sentry (client-side).
  // *.daily.co : signalisation WebRTC de VideoInterviewModal.jsx (daily-js).
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.daily.co wss://*.daily.co",
  // *.daily.co : iframe Daily Prebuilt embarquée par VideoInterviewModal.jsx
  // (DailyIframe.createFrame() pointe vers room_url, un sous-domaine daily.co).
  "frame-src 'self' blob: data: https://*.supabase.co https://*.daily.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // upgrade-insecure-requests délibérément absente : cette directive réécrit
  // toute requête http:// en https:// avant même l'envoi — un effet réel
  // (contrairement à ce que suggérait l'ancien commentaire ici, qui la
  // croyait à tort inoffensive en mode Report-Only). Pas encore vérifié
  // qu'aucune ressource legitime du site ne dépend encore de http:// ; à
  // auditer avant de l'ajouter, pas dans ce nettoyage de nommage.
].join("; ");

const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["unpdf", "mammoth", "tesseract.js", "@napi-rs/canvas", "canvas"],
  // Domaines externes réellement chargés par <Image> de next/image — mêmes 4
  // domaines déjà documentés dans img-src de la CSP ci-dessus (Storage
  // Supabase pour les photos de profil/couverture migrées, avatars Google
  // OAuth via profiles.avatar_url, offres de démo dans supabase/seed.sql,
  // drapeaux pays dans PhoneAuthForm.jsx).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
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
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
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
