import { canonicalMetadata } from "@/lib/staticPageMetadata";

export const metadata = {
  ...canonicalMetadata("/telecharger-android"),
  title: "Télécharger Facilité APK pour Android (Canal Direct)",
  description: "Téléchargez directement l'application Facilité pour Android au format APK. Installation rapide, canal officiel et sécurisé.",
};

export default function TelechargerAndroidLayout({ children }) {
  return children;
}
