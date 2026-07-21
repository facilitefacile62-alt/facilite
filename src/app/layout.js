import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Facilite - Création de CV",
  description: "Facilite est votre allié de confiance pour concevoir des CV percutants et professionnels.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${inter.variable} scroll-smooth`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className={`${inter.className} bg-white text-dark min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
