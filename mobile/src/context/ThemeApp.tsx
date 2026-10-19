import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { estSombre, fixerSombre } from '@/components/themeSombre';
import { ecrireTheme, lireTheme, type ThemeChoisi } from '@/lib/preferencesConnexion';

// Thème de l'application : clair, sombre, ou automatique (suit celui du téléphone). Le choix est mémorisé ; le mode
// effectif est posé dans le module themeSombre AVANT d'afficher quoi que ce soit, puis l'arbre d'écrans est recréé
// (clé) à chaque changement pour que tous les éléments reprennent leurs couleurs.
function calculerSombre(theme: ThemeChoisi): boolean {
  return theme === 'sombre' || (theme === 'auto' && Appearance.getColorScheme() === 'dark');
}

type Contexte = { theme: ThemeChoisi; sombre: boolean; appliquer: (t: ThemeChoisi) => Promise<void>; cle: number };

const ContexteTheme = createContext<Contexte>({ theme: 'clair', sombre: false, appliquer: async () => {}, cle: 0 });

export function ThemeAppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoisi | null>(null);
  const [cle, setCle] = useState(0);

  useEffect(() => {
    lireTheme().then((t) => {
      fixerSombre(calculerSombre(t));
      setTheme(t);
    });
  }, []);

  // Automatique : suit le téléphone quand il passe du clair au sombre.
  useEffect(() => {
    if (theme !== 'auto') return;
    const abonnement = Appearance.addChangeListener(({ colorScheme }) => {
      const sombre = colorScheme === 'dark';
      if (sombre !== estSombre()) {
        fixerSombre(sombre);
        setCle((c) => c + 1);
      }
    });
    return () => abonnement.remove();
  }, [theme]);

  const appliquer = useCallback(async (t: ThemeChoisi) => {
    await ecrireTheme(t);
    fixerSombre(calculerSombre(t));
    setTheme(t);
    setCle((c) => c + 1);
  }, []);

  const valeur = useMemo<Contexte>(
    () => ({ theme: theme ?? 'clair', sombre: estSombre(), appliquer, cle }),
    // `cle` change à chaque bascule : il force aussi la mise à jour de `sombre`.
    [theme, appliquer, cle]
  );

  if (theme === null) return null; // lecture du choix mémorisé : un instant, avant le premier affichage
  return <ContexteTheme.Provider value={valeur}>{children}</ContexteTheme.Provider>;
}

/** Recrée l'arbre d'écrans à chaque changement de thème, pour que tous les éléments reprennent leurs couleurs. */
export function ThemeFrontiere({ children }: { children: ReactNode }) {
  const { cle } = useContext(ContexteTheme);
  return <Fragment key={cle}>{children}</Fragment>;
}

export const useThemeApp = () => useContext(ContexteTheme);
