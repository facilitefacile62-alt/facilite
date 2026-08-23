import { canonicalMetadata } from "@/lib/staticPageMetadata";
import OffresClient from "../offres/OffresClient";

// Même patron que /offres (page.js) : wrapper serveur pur, OffresClient
// filtré côté requête sur listing_type="formation" au lieu d'une détection
// de texte tapé dans la recherche.
export const metadata = canonicalMetadata("/formations");

export default function Page() {
  return <OffresClient listingType="formation" />;
}
