import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/staticPageMetadata";
import { orangeMoneyActif } from "@/lib/orangeMoneyActif";
import PremiumClient from "./PremiumClient";

// Lit ORANGE_MONEY_ENABLED à chaque requête (et non figé au moment du build).
export const dynamic = "force-dynamic";

export const metadata = {
  ...canonicalMetadata("/premium"),
  title: "Facilité Premium",
  description: "Passez à Facilité Premium et débloquez les fonctionnalités avancées de la plateforme.",
};

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <PremiumClient orangeActif={orangeMoneyActif()} />
    </Suspense>
  );
}
