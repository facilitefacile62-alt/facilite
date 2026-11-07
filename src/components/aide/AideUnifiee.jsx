"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import useAideAcces from "./useAideAcces";

const AidePanneau = dynamic(() => import("./AidePanneau"), { ssr: false });

// Panneau « Aide » (questions fréquentes, assistant, équipe), derrière l'interrupteur feat_aide_unifiee (coupé par défaut).
// Il s'ouvre depuis l'entrée « Aide » du menu « + » (BoutonFlottantFacilite) par l'évènement window « facilite:aide » :
// il n'y a plus de bouton flottant à part. L'ancien Assistant vocal reste en place mais masqué.
const MASQUE_SUR = ["/admin", "/login", "/register", "/forgot-password", "/auth", "/verifiez-votre-email", "/bienvenue"];

export default function AideUnifiee() {
  const pathname = usePathname() || "";
  const { autorise, arbre, role, session } = useAideAcces();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const surDemande = () => setOuvert(true);
    window.addEventListener("facilite:aide", surDemande);
    return () => window.removeEventListener("facilite:aide", surDemande);
  }, []);

  if (!autorise || !ouvert) return null;
  if (MASQUE_SUR.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return <AidePanneau session={session} onFermer={() => setOuvert(false)} arbre={arbre} role={role} />;
}
