import { canonicalMetadata } from "@/lib/staticPageMetadata";
import RecrutementSpontaneClient from "./RecrutementSpontaneClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) :
// RecrutementSpontaneClient reste intégralement inchangé.
export const metadata = canonicalMetadata("/recrutement-spontane");

export default function Page() {
  return <RecrutementSpontaneClient />;
}
