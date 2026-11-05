"use client";
// Chargement différé : MapLibre et la carte 3D ne sont téléchargés que lorsque cette page est ouverte, jamais par les autres pages (SEO inclus).
import dynamic from "next/dynamic";

const Carte3D = dynamic(() => import("@/components/Carte3D"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 flex items-center justify-center bg-[#e8eaee] text-sm font-bold text-gray-600">Chargement de la carte 3D…</div>,
});

export default function Carte3DClient() {
  return <Carte3D />;
}
