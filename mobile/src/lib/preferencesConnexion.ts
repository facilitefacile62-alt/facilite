import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';

// Préférences locales du parcours de connexion (spécification « Connexion »
// du 12/10/2026). Tout reste sur l'appareil : aucun champ en base.

// ---- Langue de l'application (écran 02) -------------------------------
// Seules des langues internationales parlées en Afrique ; pas de wolof pour
// le moment (prévu plus tard).
export type CodeLangue = 'fr' | 'en' | 'es' | 'pt' | 'ar';
export const LANGUES: { code: CodeLangue; natif: string; francais: string }[] = [
  { code: 'fr', natif: 'Français', francais: '(langue de l\'appareil)' },
  { code: 'en', natif: 'English', francais: 'Anglais' },
  { code: 'es', natif: 'Español', francais: 'Espagnol' },
  { code: 'pt', natif: 'Português', francais: 'Portugais' },
  { code: 'ar', natif: 'العربية', francais: 'Arabe' },
];
const CLE_LANGUE = 'FACILITE_LANGUE';

export async function lireLangue(): Promise<CodeLangue> {
  try {
    const v = await AsyncStorage.getItem(CLE_LANGUE);
    return LANGUES.some((l) => l.code === v) ? (v as CodeLangue) : 'fr';
  } catch {
    return 'fr';
  }
}

export async function ecrireLangue(code: CodeLangue): Promise<void> {
  await AsyncStorage.setItem(CLE_LANGUE, code).catch(() => {});
}

export function libelleLangue(code: CodeLangue): string {
  return LANGUES.find((l) => l.code === code)?.natif ?? 'Français';
}

// ---- Thème (Paramètres > Apparence) -----------------------------------
// Le choix est mémorisé. Seul le rendu clair existe aujourd'hui : « Auto » et « Sombre » sont enregistrés et signalés
// comme à venir, l'application reste claire.
export type ThemeChoisi = 'clair' | 'auto' | 'sombre';
const CLE_THEME = 'FACILITE_THEME';

export async function lireTheme(): Promise<ThemeChoisi> {
  try {
    const v = await AsyncStorage.getItem(CLE_THEME);
    return v === 'auto' || v === 'sombre' ? v : 'clair';
  } catch {
    return 'clair';
  }
}

export async function ecrireTheme(theme: ThemeChoisi): Promise<void> {
  await AsyncStorage.setItem(CLE_THEME, theme).catch(() => {});
}

// ---- Premier lancement (écran 01) -------------------------------------
const CLE_BIENVENUE = 'FACILITE_BIENVENUE_VUE';

export async function bienvenueDejaVue(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE_BIENVENUE)) === '1';
  } catch {
    return true; // en cas de doute, ne pas bloquer la connexion
  }
}

export async function marquerBienvenueVue(): Promise<void> {
  await AsyncStorage.setItem(CLE_BIENVENUE, '1').catch(() => {});
}

// ---- « Enregistre tes informations de connexion » ---------------------
// Décochée : la session n'est pas gardée, l'app redemande la connexion à la
// réouverture suivante.
const CLE_GARDER = 'FACILITE_GARDER_SESSION';
let connexionCeTour = false;

export async function memoriserGarderSession(garder: boolean): Promise<void> {
  connexionCeTour = true;
  await AsyncStorage.setItem(CLE_GARDER, garder ? '1' : '0').catch(() => {});
}

/** Vrai si une session héritée d'un lancement précédent doit être fermée. */
export async function sessionAFermerAuDemarrage(): Promise<boolean> {
  if (connexionCeTour) return false;
  try {
    return (await AsyncStorage.getItem(CLE_GARDER)) === '0';
  } catch {
    return false;
  }
}

// ---- Pages « Nom et prénom » (07 et 13) : une seule fois --------------
const cleNom = (userId: string) => `FACILITE_NOM_CONFIRME_${userId}`;

export async function nomDejaConfirme(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(cleNom(userId))) === '1';
  } catch {
    return true;
  }
}

export async function marquerNomConfirme(userId: string): Promise<void> {
  await AsyncStorage.setItem(cleNom(userId), '1').catch(() => {});
}

// ---- Étape « Crée un mot de passe » : proposée une fois par compte, reprise là où la personne l'a quittée ----
const cleMotDePasse = (userId: string) => `FACILITE_MDP_ETAPE_VUE_${userId}`;

export async function etapeMotDePasseVue(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(cleMotDePasse(userId))) === '1';
  } catch {
    return true;
  }
}

export async function marquerEtapeMotDePasseVue(userId: string): Promise<void> {
  await AsyncStorage.setItem(cleMotDePasse(userId), '1').catch(() => {});
}

function majuscule(mot: string): string {
  return mot ? mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase() : '';
}

/**
 * Prénom et nom proposés à partir du compte (écran 13) : ceux fournis par
 * Google s'ils existent, sinon déduits de l'adresse e-mail (séparateurs « . »
 * « _ » « - »). Un compte créé par téléphone n'a ni e-mail ni nom : champs
 * vides (écran 07). Une adresse sans séparateur ne peut pas être découpée :
 * tout va dans le prénom.
 */
export function nomPropose(user: User | null | undefined): { prenom: string; nom: string; depuisCompte: boolean } {
  if (!user) return { prenom: '', nom: '', depuisCompte: false };
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const donne = typeof meta.given_name === 'string' ? meta.given_name.trim() : '';
  const famille = typeof meta.family_name === 'string' ? meta.family_name.trim() : '';
  if (donne || famille) return { prenom: donne, nom: famille, depuisCompte: true };

  const complet = [meta.full_name, meta.name].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  if (complet) {
    const mots = complet.trim().split(/\s+/);
    return { prenom: mots[0], nom: mots.slice(1).join(' '), depuisCompte: true };
  }

  const local = (user.email ?? '').split('@')[0] ?? '';
  if (!local) return { prenom: '', nom: '', depuisCompte: false };
  const morceaux = local.split(/[._\-+\d]+/).filter(Boolean);
  return {
    prenom: majuscule(morceaux[0] ?? ''),
    nom: majuscule(morceaux.slice(1).join(' ')),
    depuisCompte: true,
  };
}
