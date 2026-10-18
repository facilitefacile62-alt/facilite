"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_FEATURE_TREE, isFeatureAllowed, subscribeFeatureFlagsTree } from "@/lib/featureFlags";

/**
 * Vrai si l'interrupteur `id` (Administration → Fonctionnalités) est ouvert pour l'utilisateur courant.
 * Suit les changements en direct ; l'administrateur y a toujours accès.
 */
export function useFonctionAutorisee(id) {
  const { session, isAdmin, isRecruiter } = useAuth();
  const [arbre, setArbre] = useState(DEFAULT_FEATURE_TREE);
  useEffect(() => subscribeFeatureFlagsTree(setArbre), []);
  const role = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  return isFeatureAllowed(arbre, id, role);
}
