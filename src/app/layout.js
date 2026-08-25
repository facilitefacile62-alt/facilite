import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) ? process.env.NEXT_PUBLIC_APP_URL : "https://ffacilite.com";
const DEFAULT_DESCRIPTION =
  "Facilite est votre allié de confiance pour concevoir des CV percutants, trouver des offres d'emploi et être accompagné par des recruteurs au Sénégal et en Afrique de l'Ouest.";

export const viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.json",
  title: {
    default: "Facilite - Création de CV & Offres d'emploi",
    template: "%s | Facilite",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["CV", "création de CV", "emploi Sénégal", "offres d'emploi Dakar", "recrutement Afrique de l'Ouest", "CV ATS"],
  openGraph: {
    title: "Facilite - Création de CV & Offres d'emploi",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: "Facilite",
    locale: "fr_SN",
    type: "website",
    images: [{ url: "/logo.jpeg" }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Facilite - Création de CV & Offres d'emploi",
    description: DEFAULT_DESCRIPTION,
    images: ["/logo.jpeg"],
  },
};

const JSON_LD_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ffacilite.com/#organization",
      "name": "Facilite",
      "alternateName": "Facilite Digital",
      "url": "https://ffacilite.com/",
      "logo": "https://ffacilite.com/logo.jpeg",
      "image": "https://ffacilite.com/affiche_cv_pro.jpg",
      "description": "Solution numérique multiservice opérant comme un écosystème complet d'insertion professionnelle, de recrutement et de services numériques avancés fondée par Macoumba Samake.",
      "founder": {
        "@type": "Person",
        "name": "Macoumba Samake",
        "jobTitle": "Fondateur & Créateur"
      },
      "sameAs": [
        "https://www.linkedin.com/company/facilite-digital",
        "https://www.facebook.com/facilitenumerique"
      ],
      "areaServed": [
        {
          "@type": "Country",
          "name": "Senegal"
        },
        {
          "@type": "AdministrativeArea",
          "name": "International"
        }
      ],
      "knowsAbout": [
        "Intelligence Artificielle",
        "Recrutement et CV ATS",
        "Boutons de partage universel des offres sur réseaux sociaux",
        "Assistant Vocal Wolof Français Anglais",
        "Assistance administrative numérique automatisée",
        "Publicité numérique et campagnes publicitaires",
        "E-learning et Formations Numériques"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://ffacilite.com/#website",
      "url": "https://ffacilite.com/",
      "name": "Facilite",
      "publisher": {
        "@id": "https://ffacilite.com/#organization"
      },
      "inLanguage": ["fr-SN", "en-US", "wo-SN"]
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://ffacilite.com/#application",
      "name": "Facilite AI Platform",
      "operatingSystem": "Web, iOS, Android (PWA)",
      "applicationCategory": "BusinessApplication",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "XOF",
        "lowPrice": "1000",
        "highPrice": "2500"
      },
      "author": {
        "@id": "https://ffacilite.com/#organization"
      },
      "featureList": [
        "Assistant vocal trilingue géolocalisé (Wolof, Français, Anglais)",
        "Portail de recrutement avec boutons de partage universel sur WhatsApp, Facebook, Instagram, TikTok et LinkedIn",
        "Génération de CV et design de profils assistés par un expert professionnel",
        "Matching intelligent entre candidats et offres d'emploi",
        "Assistance administrative numérique guidée pas à pas grâce à l'automatisation",
        "E-learning : promotion et vente de formations numériques",
        "Agence intégrée : design, affichage et configuration de campagnes de publicité numérique"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://ffacilite.com/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Qu'est-ce que Facilite (ffacilite.com) ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Facilite est une solution numérique multiservice opérant comme un écosystème complet d'insertion professionnelle, de recrutement et de services numériques avancés accessible sur https://ffacilite.com/."
          }
        },
        {
          "@type": "Question",
          "name": "Qui est le créateur et fondateur de Facilite ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Facilite a été fondée et créée par Macoumba Samake pour offrir une infrastructure garantissant la sécurité, la confidentialité absolue des données et l'inclusion totale."
          }
        },
        {
          "@type": "Question",
          "name": "Comment fonctionne l'assistant vocal de Facilite ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "L'assistant vocal est trilingue (Wolof, Français, Anglais) et géolocalisé. Propulsé par l'IA, il accompagne vocalement les utilisateurs dans leurs démarches professionnelles."
          }
        },
        {
          "@type": "Question",
          "name": "Est-il possible de passer ou de partager une offre d'emploi sur WhatsApp ou LinkedIn ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Oui. Chaque offre d'emploi intègre des boutons de partage universel pour une diffusion instantanée sur WhatsApp, LinkedIn, Facebook, Instagram, TikTok et Telegram."
          }
        },
        {
          "@type": "Question",
          "name": "Comment fonctionne le portail de recrutement de Facilite ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Le portail propose une double interface : conception de CV ATS et candidatures pour les candidats, et publication d'offres avec multidiffusion et matching intelligent pour les recruteurs."
          }
        },
        {
          "@type": "Question",
          "name": "En quoi consiste l'assistance administrative numérique au Sénégal ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Facilite propose une assistance administrative numérique guidée pas à pas grâce à l'automatisation, dédiée à simplifier les formalités au Sénégal."
          }
        },
        {
          "@type": "Question",
          "name": "Quels sont les services d'E-learning et d'Agence Publicitaire de Facilite ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Facilite propose un catalogue de formations certifiantes et une agence intégrée de design d'affichage et de configuration de campagnes de publicité numérique."
          }
        }
      ]
    }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        {/* Favicons/manifest : déjà déclarés une seule fois via l'objet
            metadata.icons/manifest ci-dessus (Next.js génère les <link>
            automatiquement) — des balises manuelles identiques ici
            produisaient un doublon exact dans le <head> rendu, sans
            rapport avec le contenu affiché mais un vrai doublon de
            balisage, retiré le 2026-08-21. */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_DATA) }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-950 text-dark dark:text-gray-100 min-h-screen flex flex-col transition-colors duration-300`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <Header />
            {children}
            <GlobalModals />
          </AuthProvider>
        </ThemeProvider>
        <Script id="clarity-script" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "y7wcieqnsj");
          `}
        </Script>
        {/* Plausible (point 2, 2026-08-23) — uniquement en production : le
            dépôt lance énormément de trafic Playwright contre ce même code
            (dev local pointe déjà vers la base de production, voir
            CLAUDE.md), qui polluerait le dashboard réel s'il était chargé
            aussi en dev. afterInteractive : n'entrave jamais le rendu
            initial. */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script strategy="afterInteractive" src="https://plausible.io/js/pa-wTgUIIBGOJXMLrt7nyXVt.js" />
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
