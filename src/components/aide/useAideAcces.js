"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeFeatureFlagsTree, isFeatureAllowed, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";

export const ID_INTERRUPTEUR_AIDE = "feat_aide_unifiee";

const enCours = new Map(); // une seule demande au serveur par personne, même si deux composants la posent en même temps

function demanderAuServeur(idPersonne, jeton) {
  if (!enCours.has(idPersonne)) {
    enCours.set(
      idPersonne,
      fetch("/api/aide/acces", { headers: { Authorization: `Bearer ${jeton}` } })
        .then((r) => (r.ok ? r.json() : { ouvert: false }))
        .then((j) => j.ouvert === true)
        .catch(() => false)
        .finally(() => setTimeout(() => enCours.delete(idPersonne), 1000))
    );
  }
  return enCours.get(idPersonne);
}

/**
 * Qui voit l'aide : un admin, une personne que l'interrupteur feat_aide_unifiee laisse passer, ou une personne de
 * AIDE_IDS_AUTORISES (liste qui n'existe que côté serveur : on lui demande un booléen, gardé 10 minutes dans sessionStorage).
 * Utilisé par l'entrée de l'aide dans le menu « + » ET par le panneau, pour qu'ils décident toujours pareil.
 * @returns {{autorise: boolean, arbre: Array, role: string, session: object|null}}
 */
export default function useAideAcces() {
  const { session, isAdmin, isRecruiter } = useAuth();
  const [arbre, setArbre] = useState(DEFAULT_FEATURE_TREE);
  const [autoriseParServeur, setAutoriseParServeur] = useState(false);

  useEffect(() => subscribeFeatureFlagsTree(setArbre), []);

  const role = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const autoriseParInterrupteur = Boolean(session) && isFeatureAllowed(arbre, ID_INTERRUPTEUR_AIDE, role);
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
    demanderAuServeur(idPersonne, jeton).then((ouvert) => {
      if (annule) return;
      setAutoriseParServeur(ouvert);
      try {
        sessionStorage.setItem(cle, JSON.stringify({ ouvert, le: Date.now() }));
      } catch {
        /* sans conséquence */
      }
    });
    return () => {
      annule = true;
    };
  }, [idPersonne, jeton, autoriseParInterrupteur]);

  return { autorise: autoriseParInterrupteur || autoriseParServeur, arbre, role, session };
}
