import { Suspense } from "react";
import { canonicalMetadata } from "@/lib/staticPageMetadata";
import PremiumClient from "./PremiumClient";

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
      <PremiumClient />
    </Suspense>
  );
}
