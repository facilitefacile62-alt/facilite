import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import AIAssistantModal from "@/components/AIAssistantModal";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  twitter: {
    card: "summary_large_image",
    title: "Facilite - Création de CV & Offres d'emploi",
    description: DEFAULT_DESCRIPTION,
    images: ["/logo.jpeg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} bg-white dark:bg-gray-950 text-dark dark:text-gray-100 min-h-screen flex flex-col transition-colors duration-300`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          {children}
          <AIAssistantModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
