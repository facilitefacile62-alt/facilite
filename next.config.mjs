import { withSentryConfig } from "@sentry/nextjs";
// BotID (Vercel) — withBotId injecte les rewrites et en-têtes qui font
// transiter le challenge par notre propre domaine plutôt que par un domaine
// tiers : les bloqueurs de publicité et les extensions ne peuvent donc pas
// le neutraliser. Appliqué AVANT withSentryConfig pour que Sentry enveloppe
// la configuration déjà complétée par BotID, et non l'inverse.
import { withBotId } from "botid/next/config";

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
  // clarity.ms ajouté le 2026-08-28 : le script Microsoft Clarity est chargé
  // par src/app/layout.js depuis le début, mais son domaine n'a JAMAIS
  // figuré dans script-src. La console de tout visiteur affichait donc
  // « Loading the script 'https://www.clarity.ms/tag/…' violates the
  // following Content Security Policy directive » et l'analytics ne
  // remontait rien du tout. script-src-elem n'étant pas défini, script-src
  // sert de repli — c'est bien lui qu'il faut élargir.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://plausible.io https://www.clarity.ms https://scripts.clarity.ms https://*.clarity.ms https://c.clarity.ms",
  "worker-src 'self' blob: https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://images.unsplash.com https://flagcdn.com https://*.clarity.ms https://c.clarity.ms https://*.tile.openstreetmap.org",
  "media-src 'self' blob: data: https://*.supabase.co",
  // Clarity renvoie ses mesures par fetch/beacon vers *.clarity.ms : sans
  // cette entrée, le script se chargerait mais n'enverrait toujours rien.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.daily.co wss://*.daily.co https://plausible.io https://*.clarity.ms",
  "frame-src 'self' blob: data: https://*.supabase.co https://*.daily.co https://www.youtube.com https://www.youtube-nocookie.com https://maps.google.com https://*.google.com",
  "object-src 'self' blob: data: https://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self'",
  isDev ? "frame-ancestors 'self' vscode-webview: http://localhost:* http://127.0.0.1:*" : "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  serverExternalPackages: ["unpdf", "mammoth", "tesseract.js", "@napi-rs/canvas", "canvas"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
          ...(isDev
            ? []
            : [
                {
                  key: "X-Frame-Options",
                  value: "DENY",
                },
              ]),
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self), payment=(self), usb=()",
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
export default withSentryConfig(withBotId(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
