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
  const autoriseParInterrupteur = Boolean(session) && isFeatureAllowed(arbre, ID_INTERRUPTEUR_AIDE, role);

  // AIDE_IDS_AUTORISES n'existe que côté serveur : pour une personne que l'interrupteur laisse dehors, on demande
  // au serveur (un booléen). Réponse gardée 10 minutes dans sessionStorage pour ne pas la redemander à chaque page.
  const [autoriseParServeur, setAutoriseParServeur] = useState(false);
  const idPersonne = session?.user?.id;
  const jeton = session?.access_token;
  useEffect(() => {
    if (!idPersonne || !jeton || autoriseParInterrupteur) {
      setAutoriseParServeur(false);
      return undefined;
    }
    let annule = false;
    const cle = `aide-acces:${idPersonne}`;
    try {
      const gardee = JSON.parse(sessionStorage.getItem(cle) || "null");
      if (gardee && Date.now() - gardee.le < 600000) {
        setAutoriseParServeur(gardee.ouvert === true);
        return undefined;
      }
    } catch {
      /* stockage indisponible : on demande au serveur */
    }
    fetch("/api/aide/acces", { headers: { Authorization: `Bearer ${jeton}` } })
      .then((r) => (r.ok ? r.json() : { ouvert: false }))
      .then((j) => {
        if (annule) return;
        setAutoriseParServeur(j.ouvert === true);
        try {
          sessionStorage.setItem(cle, JSON.stringify({ ouvert: j.ouvert === true, le: Date.now() }));
        } catch {
          /* sans conséquence */
        }
      })
      .catch(() => !annule && setAutoriseParServeur(false));
    return () => {
      annule = true;
    };
  }, [idPersonne, jeton, autoriseParInterrupteur]);

  const autorise = autoriseParInterrupteur || autoriseParServeur;

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
      {ouvert ? <AidePanneau session={session} onFermer={() => setOuvert(false)} arbre={arbre} role={role} /> : null}
    </>
  );
}
