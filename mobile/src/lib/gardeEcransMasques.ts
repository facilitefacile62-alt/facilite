import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { interrupteursEcran } from '@/lib/ecransMasquesLogique';
import { useFonctionnalites } from '@/lib/featureFlags';

/**
 * Garde GLOBALE des écrans masqués : quelle que soit la façon d'y arriver (bouton, raccourci, lien profond, notification), un écran dont un interrupteur est
 * fermé renvoie à l'accueil. Un administrateur voit tout (voulu). Les écrans toujours accessibles ne sont pas concernés.
 */
export function useGardeEcransMasques(): void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const autorise = useFonctionnalites();
  const requis = interrupteursEcran(pathname, params);
  const accessible = autorise(requis.length ? requis : undefined);

  useEffect(() => {
    if (!accessible) router.replace('/');
  }, [accessible, router]);
}

/** Vrai si cet écran est accessible (pour ne rien afficher le temps de la redirection). */
export function useEcranAccessible(): boolean {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const autorise = useFonctionnalites();
  const requis = interrupteursEcran(pathname, params);
  return autorise(requis.length ? requis : undefined);
}
