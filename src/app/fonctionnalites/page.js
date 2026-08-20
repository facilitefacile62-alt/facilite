import { canonicalMetadata } from "@/lib/staticPageMetadata";
import FonctionnalitesClient from "./FonctionnalitesClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) :
// FonctionnalitesClient reste intégralement inchangé.
export const metadata = canonicalMetadata("/fonctionnalites");

export default function Page() {
  return <FonctionnalitesClient />;
}
