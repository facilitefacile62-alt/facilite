import { canonicalMetadata } from "@/lib/staticPageMetadata";
import ModelesClient from "./ModelesClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : ModelesClient
// reste intégralement inchangé.
export const metadata = canonicalMetadata("/modeles");

export default function Page() {
  return <ModelesClient />;
}
