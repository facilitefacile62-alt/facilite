import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

// Mémoire du téléphone pour les images PUBLIQUES (cache disque d'expo-image) et pour la liste des offres (AsyncStorage).
// Les fichiers privés (CV, pièces jointes, scans, avatars et couvertures signés) ne vont jamais sur le disque : voir cachePolicy="memory" / "none".

/** Taille maximale du cache d'images sur le disque. Effective sur iOS ; sur Android le cache de Glide a sa propre taille par défaut. */
export const TAILLE_MAX_CACHE_OCTETS = 200 * 1024 * 1024;

/** Préfixe des clés de copies de listes (voir cacheListeLogique.ts). */
export const PREFIXE_COPIES_LISTES = 'FACILITE_OFFRES_V1_';

/** À appeler une fois au démarrage. Sans effet (et sans erreur) là où la plateforme ne le permet pas. */
export function configurerCacheImages(): void {
  try {
    Image.configureCache({ maxDiskSize: TAILLE_MAX_CACHE_OCTETS });
  } catch {
    // Plateforme sans réglage de cache : la valeur par défaut s'applique.
  }
}

/** « Vider le cache » : images sur le disque et en mémoire, copies des listes. Ne touche ni au compte, ni aux brouillons, ni aux préférences. */
export async function viderCache(): Promise<boolean> {
  let ok = true;
  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  } catch {
    ok = false;
  }
  try {
    const cles = (await AsyncStorage.getAllKeys()).filter((c) => c.startsWith(PREFIXE_COPIES_LISTES));
    if (cles.length) await AsyncStorage.multiRemove(cles);
  } catch {
    ok = false;
  }
  return ok;
}
