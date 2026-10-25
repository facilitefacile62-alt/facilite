import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/staticPageMetadata";
import { orangeMoneyActif } from "@/lib/orangeMoneyActif";
import AchatCvClient from "./AchatCvClient";

// Lit ORANGE_MONEY_ENABLED à chaque requête (et non figé au moment du build).
export const dynamic = "force-dynamic";

export const metadata = {
  ...canonicalMetadata("/achat-cv"),
  title: "Achat de CV",
  description: "Achetez un modèle de CV prêt à remplir : aperçu protégé, paiement Orange Money.",
};

export default function AchatCvPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F2F0EA] dark:bg-gray-950">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <AchatCvClient orangeActif={orangeMoneyActif()} />
    </Suspense>
  );
}
