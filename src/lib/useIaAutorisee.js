"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isFeatureAllowed, subscribeFeatureFlagsTree } from "@/lib/featureFlags";

/**
 * Vrai si les fonctions IA de la Marketplace (recherche par photo, scan et optimisation à la
 * publication) sont ouvertes à l'utilisateur courant. Piloté par l'interrupteur « feat_marketplace_ia »
 * (Administration → Fonctionnalités) ; l'administrateur y a toujours accès.
 */
export function useIaAutorisee() {
  const { session, isAdmin, isRecruiter } = useAuth();
  // null tant que l'interrupteur n'a pas été lu côté serveur : l'arbre par défaut autorise l'IA, ce qui laissait une
  // photo ajoutée trop tôt déclencher un scan aussitôt refusé (403). Fermé d'abord, ouvert seulement si c'est confirmé.
  const [arbre, setArbre] = useState(null);
  useEffect(() => subscribeFeatureFlagsTree(setArbre), []);
  const role = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  return arbre !== null && isFeatureAllowed(arbre, "feat_marketplace_ia", role);
}

export const MESSAGE_IA_EN_PAUSE = "Fonction IA bientôt disponible";
