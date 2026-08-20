import { canonicalMetadata } from "@/lib/staticPageMetadata";
import HomeClient from "./HomeClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : HomeClient
// reste intégralement inchangé. Page statique, pas de fetch par instance
// nécessaire pour la balise canonical — export const metadata suffit.
export const metadata = canonicalMetadata("/");

export default function Page() {
  return <HomeClient />;
}
