"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeFeatureFlagsTree, isFeatureAllowed, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";
import AideOrbe from "./AideOrbe";

const AidePanneau = dynamic(() => import("./AidePanneau"), { ssr: false });

// Point d'entrée UNIQUE de l'aide : l'orbe ouvre le panneau « Aide » (questions fréquentes, assistant, équipe).
// Derrière l'interrupteur feat_aide_unifiee (coupé par défaut). Remplace l'ancien Assistant vocal du site,
// dont le code reste en place mais masqué (voir VoiceAssistant.jsx et BoutonFlottantFacilite.jsx).
const MASQUE_SUR = ["/admin", "/login", "/register", "/forgot-password", "/auth", "/verifiez-votre-email", "/bienvenue"];
export const ID_INTERRUPTEUR_AIDE = "feat_aide_unifiee";

export default function AideUnifiee() {
  const pathname = usePathname() || "";
  const { session, isAdmin, isRecruiter } = useAuth();
  const [arbre, setArbre] = useState(DEFAULT_FEATURE_TREE);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => subscribeFeatureFlagsTree(setArbre), []);

  const role = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const autorise = Boolean(session) && isFeatureAllowed(arbre, ID_INTERRUPTEUR_AIDE, role);

  // Les autres composants (menu « + », anciens raccourcis) peuvent demander l'ouverture par un évènement window.
  useEffect(() => {
    const surDemande = () => setOuvert(true);
    window.addEventListener("facilite:aide", surDemande);
    return () => window.removeEventListener("facilite:aide", surDemande);
  }, []);

  if (!autorise) return null;
  if (MASQUE_SUR.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      <div className="fixed bottom-32 right-[5.75rem] sm:right-[7.5rem] z-[998]">
        <AideOrbe ouvert={ouvert} onClick={() => setOuvert((o) => !o)} />
      </div>
      {ouvert ? <AidePanneau session={session} onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}
