"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { estDansAppPlay } from "@/lib/contextePlay";

// Onglet « Achat de CV » de la barre d'onglets du Profil du site : mène à la page /achat-cv. Masqué dans l'application iOS (règle Apple 3.1.1 :
// aucun accès à un achat de bien numérique) — même détection que les pages de paiement (contextePlay.js).
export default function OngletAchatCv() {
  const masque = useSyncExternalStore(
    () => () => {},
    () => estDansAppPlay(),
    () => false
  );
  if (masque) return null;
  return (
    <Link
      href="/achat-cv"
      className="text-sm font-extrabold pb-2.5 pt-1 transition-all relative whitespace-nowrap cursor-pointer text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
    >
      <span>Achat de CV</span>
    </Link>
  );
}
