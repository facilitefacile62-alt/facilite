import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/staticPageMetadata";
import MarketplaceClient from "./MarketplaceClient";

export const metadata = canonicalMetadata("/marketplace", {
  title: "Marketplace — Petites Annonces & Ventes à Dakar & Sénégal | Facilité",
  description: "Découvrez la sélection du jour sur Facilité Marketplace : téléphones, véhicules, immobilier, mode et services à Dakar, Thiès et partout au Sénégal.",
});

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <MarketplaceClient />
    </Suspense>
  );
}
