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

  const activer = useCallback(async (): Promise<EtatLocalisation> => {
    setEtat('recherche');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEtat('refusee');
        return 'refusee';
      }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      setEtat('active');
      return 'active';
    } catch {
      setEtat('erreur');
      return 'erreur';
    }
  }, []);

  const desactiver = useCallback(() => {
    setPosition(null);
    setEtat('inactive');
  }, []);

  return { etat, position, activer, desactiver };
}
