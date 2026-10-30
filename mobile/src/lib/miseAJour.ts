import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { lireConfigMaj, miseAJourDisponible, type ConfigMaj, type InfoMaj, type Plateforme } from '@/lib/miseAJourLogique';
import { SITE_URL } from '@/lib/webEcrans';

// Mises à jour de l'application : la version annoncée par le site (app-version.json) est comparée à la version installée. Aucune dépendance native
// ajoutée (expo-constants lit la version de app.json). Rien d'inquiétant en cas d'échec réseau : pas de mise à jour affichée.
const CLE_IGNOREE = 'FACILITE_MAJ_IGNOREE_V1';
const VALIDITE_MS = 30 * 60_000;
let memoire: { le: number; config: ConfigMaj | null } | null = null;

const plateforme = (): Plateforme => (Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web');
export const versionInstallee = (): string => String(Constants.expoConfig?.version ?? '0.0.0');

async function lireConfig(): Promise<ConfigMaj | null> {
  if (memoire && Date.now() - memoire.le < VALIDITE_MS) return memoire.config;
  try {
    const r = await fetch(`${SITE_URL}/app-version.json`, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000) });
    const config = r.ok ? lireConfigMaj(await r.json()) : null;
    memoire = { le: Date.now(), config };
    return config;
  } catch {
    return null;
  }
}

/**
 * `disponible` : la mise à jour (version + adresse) ou null. `masquee` : l'utilisateur a fermé le bandeau pour CETTE version (la tuile du menu, elle,
 * reste active). `ouvrir()` mène au Play Store, à l'App Store ou à la page de l'APK.
 * Essai en développement : EXPO_PUBLIC_MAJ_DEMO=1 simule une mise à jour (jamais dans une version publiée).
 */
export function useMiseAJour(): { disponible: InfoMaj | null; masquee: boolean; ignorer: () => void; ouvrir: () => void } {
  const [disponible, setDisponible] = useState<InfoMaj | null>(null);
  const [ignoree, setIgnoree] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    if (__DEV__ && process.env.EXPO_PUBLIC_MAJ_DEMO === '1') {
      setDisponible({ version: '9.9.9', url: `${SITE_URL}/telecharger-android` });
      return;
    }
    lireConfig().then((c) => {
      if (!annule) setDisponible(miseAJourDisponible(versionInstallee(), c, plateforme()));
    });
    AsyncStorage.getItem(CLE_IGNOREE)
      .then((v) => {
        if (!annule) setIgnoree(v);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  const ignorer = useCallback(() => {
    if (!disponible) return;
    setIgnoree(disponible.version);
    AsyncStorage.setItem(CLE_IGNOREE, disponible.version).catch(() => {});
  }, [disponible]);

  const ouvrir = useCallback(() => {
    if (!disponible) return;
    Linking.openURL(disponible.url).catch(() => Alert.alert('Mise à jour', "Impossible d'ouvrir la page de téléchargement."));
  }, [disponible]);

  return { disponible, masquee: Boolean(disponible && ignoree === disponible.version), ignorer, ouvrir };
}
