import { canonicalMetadata } from "@/lib/staticPageMetadata";
import OffresClient from "./OffresClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) : OffresClient
// reste intégralement inchangé. La liste elle-même n'a qu'une seule URL
// canonique — les pages individuelles ont déjà la leur (offres/[id]/page.js).
export const metadata = {
  ...canonicalMetadata("/offres"),
  title: "Offres d'emploi au Sénégal : CDI, CDD et stages",
  description: "Toutes les offres d'emploi, stages et concours au Sénégal : Dakar, Thiès et partout dans le pays. Consultez les offres ouvertes et postulez en ligne.",
};

export default function Page() {
  return <OffresClient />;
}
