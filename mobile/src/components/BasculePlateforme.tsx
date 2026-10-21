import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { definirUserMode } from '@/lib/userMode';

// Interrupteur Facilité ⇄ Locaux des en-têtes (maquettes du 20/10/2026) : pilule de 64 × 30 px, fond brun #6E4A36, rond de
// 24 px qui glisse, AUCUN texte — seulement les deux logos : la clé à gauche (Facilité), la boutique à droite (Locaux).
// Il est présent sur tous les en-têtes des deux plateformes et ne disparaît jamais.
// Un appui sur « Locaux » ouvre le fil de Locaux ; un appui sur « Facilité » ouvre l'accueil de Facilité. Le choix est
// aussi mémorisé (la réouverture de l'application revient sur la dernière plateforme utilisée).
const LARGEUR = 64;
const HAUTEUR = 30;
const ROND = 24;
const MARGE = 3;
const FOND = '#6E4A36';

export type Plateforme = 'facilite' | 'locaux';

export default function BasculePlateforme({ plateforme }: { plateforme: Plateforme }) {
  const router = useRouter();
  const arrivee = LARGEUR - ROND - MARGE;
  const [position] = useState(() => new Animated.Value(plateforme === 'locaux' ? arrivee : MARGE));
  const [enRoute, setEnRoute] = useState(false);

  const basculer = () => {
    if (enRoute) return;
    setEnRoute(true);
    const cible: Plateforme = plateforme === 'facilite' ? 'locaux' : 'facilite';
    definirUserMode(cible === 'locaux' ? 'business' : 'facilite').catch(() => {});
    Animated.timing(position, { toValue: cible === 'locaux' ? arrivee : MARGE, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      router.navigate(cible === 'locaux' ? '/marketplace' : '/');
      setEnRoute(false);
    });
  };

  const surLocaux = plateforme === 'locaux';
  return (
    <Pressable
      onPress={basculer}
      accessibilityRole="switch"
      accessibilityState={{ checked: surLocaux }}
      accessibilityLabel={surLocaux ? 'Basculer vers Facilité' : 'Basculer vers Locaux'}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{ width: LARGEUR, height: HAUTEUR, borderRadius: HAUTEUR / 2, backgroundColor: FOND }}>
      {/* Les deux logos restent visibles de part et d'autre ; le rond passe par-dessus celui de la plateforme active. */}
      <View style={{ position: 'absolute', left: 8, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Ionicons name="key" size={13} color="rgba(255,255,255,0.55)" />
      </View>
      <View style={{ position: 'absolute', right: 8, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Ionicons name="storefront" size={13} color="rgba(255,255,255,0.55)" />
      </View>
      <Animated.View
        style={{
          position: 'absolute',
          top: (HAUTEUR - ROND) / 2,
          left: position,
          width: ROND,
          height: ROND,
          borderRadius: ROND / 2,
          backgroundColor: surLocaux ? '#FFFFFF' : '#1A1210',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}>
        {surLocaux ? <Ionicons name="storefront" size={13} color="#2563EB" /> : <Ionicons name="key" size={13} color="#FFFFFF" />}
      </Animated.View>
    </Pressable>
  );
}
