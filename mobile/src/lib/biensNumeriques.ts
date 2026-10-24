import { Platform } from 'react-native';

import { achatNumeriqueAutorise, cleWebBloquee, marqueurAgentUtilisateur } from '@/lib/biensNumeriquesLogique';

// Valeurs propres à l'appareil (voir biensNumeriquesLogique.ts pour la règle).
export const achatsNumeriquesAutorises = achatNumeriqueAutorise(Platform.OS);
export const agentUtilisateurApp = marqueurAgentUtilisateur(Platform.OS);
export const pageWebBloquee = (cle: string | undefined): boolean => cleWebBloquee(cle, Platform.OS);
