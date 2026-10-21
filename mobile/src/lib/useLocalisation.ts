import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { Position } from '@/lib/marketplace';

// Position de l'utilisateur pour "Autour de moi". La permission n'est demandée
// qu'au toucher du bouton (jamais au chargement de l'écran), et la position
// n'est utilisée que pour trier les articles : rien n'est enregistré.
export type EtatLocalisation = 'inactive' | 'recherche' | 'active' | 'refusee' | 'erreur';

export function useLocalisation() {
  const [etat, setEtat] = useState<EtatLocalisation>('inactive');
  const [position, setPosition] = useState<Position | null>(null);

  // Renvoie la position obtenue (pas seulement l'état) : un appelant qui a
  // besoin de la valeur immédiatement (ex. créer une boutique) ne peut pas se
  // fier à l'état `position` du hook, dont la mise à jour ne sera visible
  // qu'au prochain rendu — jamais dans la même exécution que cet appel.
  const activer = useCallback(async (): Promise<{ etat: EtatLocalisation; position: Position | null }> => {
    setEtat('recherche');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEtat('refusee');
        return { etat: 'refusee', position: null };
      }
      // Dernière position connue d'abord (instantanée) : l'écran peut s'afficher tout de suite, la position
      // précise la remplace dès qu'elle arrive.
      const derniere = await Location.getLastKnownPositionAsync().catch(() => null);
      if (derniere) {
        setPosition({ latitude: derniere.coords.latitude, longitude: derniere.coords.longitude });
        setEtat('active');
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nouvellePosition = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      setPosition(nouvellePosition);
      setEtat('active');
      return { etat: 'active', position: nouvellePosition };
    } catch {
      setEtat('erreur');
      return { etat: 'erreur', position: null };
    }
  }, []);

  const desactiver = useCallback(() => {
    setPosition(null);
    setEtat('inactive');
  }, []);

  return { etat, position, activer, desactiver };
}
