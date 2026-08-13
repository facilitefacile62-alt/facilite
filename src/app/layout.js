import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import AIAssistantModal from "@/components/AIAssistantModal";
import FeatureDisabledModal from "@/components/FeatureDisabledModal";
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
      { url: "/icon.jpeg" },
      { url: "/icon.png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/icon.jpeg" },
      { url: "/apple-icon.png" },
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
      "description": "Solution numérique multiservice d'insertion professionnelle, de recrutement intelligent, d'assistance administrative automatisée et d'agence digitale fondée par Macoumba Samake.",
      "founder": {
        "@type": "Person",
        "name": "Macoumba Samake",
        "jobTitle": "Fondateur & CEO"
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
        "Assistant Vocal Wolof Français Anglais",
        "Automatisation administrative n8n",
        "Publicité Meta Ads et Meta Pixel",
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
        "Assistant vocal trilingue en Wolof, Français et Anglais géolocalisé",
        "Créateur et optimiseur de CV ATS professionnel",
        "Matching intelligent candidats/recruteurs assisté par RAG et pgvector",
        "Accompagnement administratif numérique automatisé",
        "Catalogue de formations e-learning",
        "Gestion et déploiement de campagnes Meta Ads"
      ]
    }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
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
            <AIAssistantModal />
            <FeatureDisabledModal />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
