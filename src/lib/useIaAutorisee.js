"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_FEATURE_TREE, isFeatureAllowed, subscribeFeatureFlagsTree } from "@/lib/featureFlags";

/**
 * Vrai si les fonctions IA de la Marketplace (recherche par photo, scan et optimisation à la
 * publication) sont ouvertes à l'utilisateur courant. Piloté par l'interrupteur « feat_marketplace_ia »
 * (Administration → Fonctionnalités) ; l'administrateur y a toujours accès.
 */
export function useIaAutorisee() {
  const { session, isAdmin, isRecruiter } = useAuth();
  const [arbre, setArbre] = useState(DEFAULT_FEATURE_TREE);
  useEffect(() => subscribeFeatureFlagsTree(setArbre), []);
  const role = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  return isFeatureAllowed(arbre, "feat_marketplace_ia", role);
}

export const MESSAGE_IA_EN_PAUSE = "Fonction IA bientôt disponible";
