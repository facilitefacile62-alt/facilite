import AsyncStorage from "@react-native-async-storage/async-storage";

// Persistance du dernier univers utilisé (Facilité / Facilité Business) —
// implémentation mobile (AsyncStorage), distincte et volontairement
// séparée de l'équivalent web (src/lib/userMode.js, localStorage) : deux
// codebases différentes, pas de logique partagée entre elles.
//
// N'impose jamais de choix — l'app atterrit toujours sur l'onglet Accueil
// (emploi/CV) par défaut. Cette valeur sert uniquement à préparer un futur
// écran/onglet Facilité Business natif : pour l'instant, "Ma boutique"
// (PanneauMenuProfil.tsx) est le seul point d'entrée business et reste une
// WebView (mobile/src/app/web/[cle].tsx) — aucun écran natif ne lit encore
// cette valeur pour choisir son point de départ.
const CLE_USER_MODE = "facilite_user_mode";

export type UserMode = "facilite" | "business";

export async function obtenirUserMode(): Promise<UserMode> {
  try {
    const valeur = await AsyncStorage.getItem(CLE_USER_MODE);
    return valeur === "business" ? "business" : "facilite";
  } catch {
    // Stockage indisponible : dégrade silencieusement vers le défaut.
    return "facilite";
  }
}

export async function definirUserMode(mode: UserMode): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_USER_MODE, mode === "business" ? "business" : "facilite");
  } catch {
    // Best-effort : un échec d'écriture ne doit jamais bloquer la navigation.
  }
}
