import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Même projet Supabase que le site web (src/lib/supabase.js), même URL et
// même clé anon — mais un client différent : createBrowserClient (utilisé
// côté web) stocke la session dans des cookies pour que le middleware
// Next.js la valide côté serveur, ce qui n'existe pas ici. React Native n'a
// ni cookies ni localStorage : la session est donc persistée dans
// AsyncStorage, configuration standard Supabase+Expo.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquantes — voir mobile/.env (non commité).'
  );
}

// Ce projet exporte aussi une cible web (aperçu navigateur pratique en dev,
// app.json -> web.output: "static"). Le rendu statique de cette cible
// s'exécute dans Node, SANS `window` — AsyncStorage.getItem() y plante
// (constaté : `ReferenceError: window is not defined` pendant
// `expo export --platform web`, tout l'écran d'accueil devenait
// injoignable). `Platform.OS === "web"` reste vrai aussi bien dans un vrai
// navigateur que pendant ce pré-rendu Node : seul `typeof window` distingue
// les deux, d'où cet adaptateur de stockage qui se neutralise proprement
// hors navigateur au lieu de plancher sur AsyncStorage (pensé pour du
// natif, pas pour du Node côté serveur).
const storageWeb = {
  getItem: async (cle: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(cle)),
  setItem: async (cle: string, valeur: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(cle, valeur);
  },
  removeItem: async (cle: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(cle);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: Platform.OS === 'web' ? storageWeb : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Pas de redirection par URL de navigateur sur mobile : le flux OAuth
    // passe par expo-auth-session, qui gère lui-même le retour dans l'app.
    detectSessionInUrl: false,
  },
});
