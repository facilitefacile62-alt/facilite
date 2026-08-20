import { canonicalMetadata } from "@/lib/staticPageMetadata";
import OffresClient from "./OffresClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : OffresClient
// reste intégralement inchangé. La liste elle-même n'a qu'une seule URL
// canonique — les pages individuelles ont déjà la leur (offres/[id]/page.js).
export const metadata = canonicalMetadata("/offres");

export default function Page() {
  return <OffresClient />;
}
