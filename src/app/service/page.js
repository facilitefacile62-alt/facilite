import { canonicalMetadata } from "@/lib/staticPageMetadata";
import ServiceClient from "./ServiceClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : ServiceClient
// reste intégralement inchangé, y compris sa propre logique de feature flags.
export const metadata = canonicalMetadata("/service");

export default function Page() {
  return <ServiceClient />;
}
