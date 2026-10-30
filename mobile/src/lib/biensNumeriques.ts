import { Platform } from 'react-native';

import { ID_INTERRUPTEUR_PAIEMENTS, achatNumeriqueAutorise, cleWebBloquee, marqueurAgentUtilisateur, navigationWebBloquee } from '@/lib/biensNumeriquesLogique';
import { interrupteursPageSite } from '@/lib/ecransMasquesLogique';
import { useFonctionnalite, useFonctionnalites } from '@/lib/featureFlags';

// Valeurs propres à l'appareil (voir biensNumeriquesLogique.ts pour la règle).
export const agentUtilisateurApp = marqueurAgentUtilisateur(Platform.OS);

/** Les achats de biens numériques sont-ils autorisés ? Jamais sur iPhone ; sur Android seulement si l'interrupteur serveur est ouvert (suit les changements en direct). */
export function usePaiementsAutorises(): boolean {
  return achatNumeriqueAutorise(Platform.OS, useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS));
}

/** Fonction qui dit si un lien suivi dans une page du site est à refuser : page de paiement (achat non autorisé) ou outil masqué (Création de CV, Modèles, Fonctionnalités, Boîte à idées, Extracteur). */
export function useNavigationWebBloquee(): (url: string) => boolean {
  const paiementsOuverts = useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS);
  const autorise = useFonctionnalites();
  return (url) => {
    if (navigationWebBloquee(url, Platform.OS, paiementsOuverts)) return true;
    const requis = interrupteursPageSite(url);
    return !autorise(requis.length ? requis : undefined);
  };
}

/** Cette page du site (Premium, formation, facturation) est-elle bloquée dans l'application ? */
export function usePageWebBloquee(cle: string | undefined): boolean {
  return cleWebBloquee(cle, Platform.OS, useFonctionnalite(ID_INTERRUPTEUR_PAIEMENTS));
}
