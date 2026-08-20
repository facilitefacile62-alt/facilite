import { canonicalMetadata } from "@/lib/staticPageMetadata";
import BoiteAIdeesClient from "./BoiteAIdeesClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : BoiteAIdeesClient
// reste intégralement inchangé.
export const metadata = canonicalMetadata("/boite-a-idees");

export default function Page() {
  return <BoiteAIdeesClient />;
}
