import { notFound } from "next/navigation";
import Carte3DClient from "@/components/Carte3DClient";
import { carte3dActive } from "@/lib/carte3d";

// PROTOTYPE « Carte 3D » de Locaux. Éteint en production (404) tant que NEXT_PUBLIC_CARTE_3D n'est pas « 1 ; ouvert automatiquement sur les aperçus Vercel.
// Aucune donnée de boutique n'est écrite dans cette page : tout est chargé par le navigateur, comme sur la carte 2D actuelle. Jamais indexée.
export const metadata = {
  title: "Carte 3D (prototype)",
  robots: { index: false, follow: false },
};

export default function PageCarte3D() {
  if (!carte3dActive()) notFound();
  return <Carte3DClient />;
}
