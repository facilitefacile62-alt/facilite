/* eslint-disable @next/next/no-img-element */
"use client";

// Filigrane Facilite affiché par-dessus les affiches d'offres (image déjà
// stockée telle quelle en base, jamais modifiée) — même principe que la
// bande "EN SAVOIR PLUS SUR www.xalaattv.net" vue sur les posts Facebook de
// référence, mais purement visuel côté app : n'affecte pas le fichier
// original, donc rien à traiter côté serveur/upload.
export default function OfferImageWatermark() {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-xs pointer-events-none select-none">
      <img src="/logo.jpeg" alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
      <span className="text-white text-[11px] font-bold tracking-wide">ffacilite.com</span>
    </div>
  );
}
