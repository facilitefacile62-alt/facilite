import { canonicalMetadata } from "@/lib/staticPageMetadata";
import OffresClient from "../offres/OffresClient";

// Même patron que /offres (page.js) : wrapper serveur pur, OffresClient
// filtré côté requête sur listing_type="concours" au lieu d'une détection
// de texte tapé dans la recherche.
export const metadata = canonicalMetadata("/concours");

export default function Page() {
  return <OffresClient listingType="concours" />;
}
