import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { compterMessagesNonLus, compterNotificationsNonLues } from '@/lib/notifications';

// Compteurs des pastilles rouges (charte §1.4).
//
// Deux contraintes ont dicté cette forme :
// 1. L'en-tête et la barre du bas sont montés ensemble sur presque tous les
//    écrans : sans mise en commun, chaque navigation déclencherait deux fois
//    les mêmes requêtes. D'où le cache de module (valeur + requête en vol
//    partagée) avec une courte durée de vie — un compteur n'a pas besoin
//    d'être à la seconde près.
// 2. La barre du bas est rendue à la racine, à CÔTÉ du <Stack/>, donc hors
//    de tout contexte de navigation : `useFocusEffect` y lèverait une
//    erreur. On se raccroche donc à `usePathname()`, qui lit le store
//    d'expo-router et fonctionne partout — changer d'écran rafraîchit.

export type Compteurs = { notifications: number; messages: number };

const VIDE: Compteurs = { notifications: 0, messages: 0 };
const DUREE_CACHE_MS = 30_000;

let cache: Compteurs = VIDE;
let cacheLe = 0;
let enVol: Promise<Compteurs> | null = null;
const abonnes = new Set<(c: Compteurs) => void>();

async function relire(userId: string): Promise<Compteurs> {
  // Un compteur indisponible (réseau, session expirée) vaut 0 : une pastille
  // est une information en plus, jamais un motif de faire échouer un écran.
  const [notifications, messages] = await Promise.all([
    compterNotificationsNonLues().catch(() => 0),
    compterMessagesNonLus(userId).catch(() => 0),
  ]);
  return { notifications, messages };
}

function obtenir(userId: string): Promise<Compteurs> {
  if (Date.now() - cacheLe < DUREE_CACHE_MS) return Promise.resolve(cache);
  if (enVol) return enVol;
  enVol = relire(userId)
    .then((c) => {
      cache = c;
      cacheLe = Date.now();
      abonnes.forEach((f) => f(c));
      return c;
    })
    .finally(() => {
      enVol = null;
    });
  return enVol;
}

/** À appeler après une action qui change les compteurs (fil lu, notification lue). */
export function invaliderCompteurs(): void {
  cacheLe = 0;
}

export function useCompteursNonLus(): Compteurs {
  const { user } = useAuth();
  const userId = user?.id;
  const chemin = usePathname();
  const [compteurs, setCompteurs] = useState<Compteurs>(cache);

  useEffect(() => {
    // Déconnexion : on vide le cache partagé, mais sans setState ici — le
    // rendu renvoie VIDE directement plus bas (un setState synchrone dans
    // un effet déclenche des rendus en cascade).
    if (!userId) {
      cache = VIDE;
      cacheLe = 0;
      return;
    }
    let monte = true;
    const majSiMonte = (c: Compteurs) => {
      if (monte) setCompteurs(c);
    };
    abonnes.add(majSiMonte);
    obtenir(userId).then(majSiMonte).catch(() => {});
    return () => {
      monte = false;
      abonnes.delete(majSiMonte);
    };
  }, [userId, chemin]);

  return userId ? compteurs : VIDE;
}
