import { notFound } from "next/navigation";
import TestGoogle3D from "@/components/TestGoogle3D";
import { carte3dActive } from "@/lib/carte3d";

// Page de TEST (cachée) : vérifie une seule fois si Google Photorealistic 3D Tiles couvre Dakar. Même interrupteur que la carte 3D (404 sinon), jamais indexée, aucun lien depuis le site.
export const metadata = {
  title: "Test 3D Google (prototype)",
  robots: { index: false, follow: false },
};

export default function PageTestGoogle3D() {
  if (!carte3dActive()) notFound();
  return <TestGoogle3D />;
}
