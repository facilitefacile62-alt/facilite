const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Zones connectées, vérifiées le 2026-08-21 contre le comportement
      // réel de src/proxy.js (refus par défaut : tout ce qui n'est ni dans
      // PUBLIC_ROUTES ni PUBLIC_BROWSABLE_ROUTES redirige vers /login) —
      // inutile de laisser Google crawler des redirections vers /login,
      // gaspille le budget de crawl et pourrait faire indexer /login sous
      // ces URLs.
      disallow: [
        "/admin",
        "/admin/*",
        "/api",
        "/api/*",
        "/login",
        "/register",
        "/forgot-password",
        "/candidat",
        "/candidat/*",
        "/recruteur",
        "/recruteur/*",
        "/profil",
        "/profil/*",
        "/messagerie",
        "/messagerie/*",
        "/creer-cv",
        "/creer-cv/*",
        "/importer-cv",
        "/importer-cv/*",
        "/recherche",
        "/recherche/*",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
