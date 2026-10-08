import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import FaciliteBottomBar from '@/components/FaciliteBottomBar';
import { AuthProvider, useAuth } from '@/context/AuthContext';

import '../global.css';

SplashScreen.preventAutoHideAsync();

/**
 * Garde d'authentification — redirige entre le groupe (auth) (login,
 * register, verifiez-votre-email) et le groupe (tabs) (contenu réel de
 * l'app) selon la présence d'une session. Doit vivre SOUS AuthProvider
 * (useAuth) et AU-DESSUS de <Slot /> (elle ne rend rien elle-même, elle
 * laisse juste passer les enfants une fois la redirection décidée).
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const dansGroupeAuth = segments[0] === '(auth)';
    if (!session && !dansGroupeAuth) {
      router.replace('/login');
    } else if (session && dansGroupeAuth) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  return children;
}

/**
 * Barre du bas de Facilité pour les écrans poussés PAR-DESSUS les onglets
 * (fiche offre, chat, recherche, fonctionnalités, mon-profil...). La charte
 * §1.1 la veut visible partout ; ces écrans vivent hors du groupe (tabs),
 * qui rend déjà la sienne, d'où ce second point de rendu.
 *
 * Exclus : (auth) et onboarding (aucune barre sur les maquettes 23-27,
 * 43-45, 57-58), (tabs) (sa propre barre) et marketplace (la barre de
 * l'autre plateforme, règle §1.3 — ne jamais mélanger les deux).
 */
function BarreFaciliteHorsOnglets() {
  const segments = useSegments();
  const racine = segments[0];
  if (racine === undefined) return null;
  if (racine === '(auth)' || racine === '(tabs)' || racine === 'marketplace' || racine === 'onboarding') return null;
  return <FaciliteBottomBar />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* DefaultTheme (jamais DarkTheme) : toute l'app est pensée en thème
          clair, aucun écran du design ne prévoit de mode sombre. Suivre
          colorScheme rendait la navigation quasi noire par défaut sur un
          téléphone en mode sombre système — trouvé le 13/09/2026. */}
      <ThemeProvider value={DefaultTheme}>
        <AnimatedSplashOverlay />
        <AuthGate>
          {/* Stack (pas Slot) requis à partir de ce point : les écrans
              poussés hors des onglets (offre/[id], chat/[id]...) ont besoin
              d'une navigation native (retour, geste de balayage, transition)
              par-dessus (auth)/(tabs). headerShown:false partout — chaque
              écran construit son propre en-tête, comme le reste de l'app.
              contentStyle : couleur de fond de secours pendant les
              transitions/le chargement d'un écran, avant que son propre
              contenu ne s'affiche — évite un flash noir. */}
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F2F0EA' } }} />
            </View>
            <BarreFaciliteHorsOnglets />
          </View>
        </AuthGate>
      </ThemeProvider>
    </AuthProvider>
  );
}
