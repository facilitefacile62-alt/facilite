import { Platform } from 'react-native';

import { ID_INTERRUPTEUR_PAIEMENTS, achatNumeriqueAutorise, cleWebBloquee, marqueurAgentUtilisateur, navigationWebBloquee } from '@/lib/biensNumeriquesLogique';
import { useFonctionnalite } from '@/lib/featureFlags';

// Valeurs propres à l'appareil (voir biensNumeriquesLogique.ts pour la règle).
export const agentUtilisateurApp = marqueurAgentUtilisateur(Platform.OS);

/** Les achats de biens numériques sont-ils autorisés ? Jamais sur iPhone ; sur Android seulement si l'interrupteur serveur est ouvert (suit les changements en direct). */
export function usePaiementsAutorises(): boolean {
  return achatNumeriqueAutorise(Platform.OS, useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS));
}

/** Fonction qui dit si un lien suivi dans une page du site est une page de paiement à refuser (achat non autorisé). */
export function useNavigationWebBloquee(): (url: string) => boolean {
  const ouvert = useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS);
  return (url) => navigationWebBloquee(url, Platform.OS, ouvert);
}

/** Cette page du site (Premium, formation, facturation) est-elle bloquée dans l'application ? */
export function usePageWebBloquee(cle: string | undefined): boolean {
  return cleWebBloquee(cle, Platform.OS, useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS));
}
