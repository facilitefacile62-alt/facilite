import { canonicalMetadata } from "@/lib/staticPageMetadata";
import MarketplaceClient from "./MarketplaceClient";

export const metadata = canonicalMetadata("/marketplace", {
  title: "Marketplace — Petites Annonces & Ventes à Dakar & Sénégal | Facilité",
  description: "Découvrez la sélection du jour sur Facilité Marketplace : téléphones, véhicules, immobilier, mode et services à Dakar, Thiès et partout au Sénégal.",
});

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
