import AsyncStorage from '@react-native-async-storage/async-storage';

// Historique de recherche Marketplace, local à l'appareil (comme l'historique
// du navigateur sur le site) — jamais envoyé au serveur, 6 termes au plus.
const CLE = 'facilite_marketplace_recherches';
const MAX = 6;

export async function lireHistoriqueRecherche(): Promise<string[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export async function memoriserRecherche(terme: string): Promise<void> {
  const propre = terme.trim();
  if (!propre) return;
  try {
    const actuel = await lireHistoriqueRecherche();
    const sans = actuel.filter((t) => t.toLowerCase() !== propre.toLowerCase());
    await AsyncStorage.setItem(CLE, JSON.stringify([propre, ...sans].slice(0, MAX)));
  } catch {
    // Best-effort : un échec d'écriture ne doit jamais bloquer la recherche.
  }
}
