import { useFonctionnalite } from '@/lib/featureFlags';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';

// Bouton « + » de Locaux (maquettes 05 et 06), affiché UNIQUEMENT sur le fil Marketplace (jamais sur un article,
// la boutique, Publier, la carte, la recherche, les messages ni le profil — il n'est monté que par cet écran).
// Ouvert : voile blanc léger et une pilule « Trouver un livreur » (rond orange #F97316, 🛵) → page « Trouver un livreur ».
// « Trouver un livreur » dépend de l'interrupteur nav_marketplace_livreur (en pause pour le public) : sans lui, le
// « + » n'aurait aucune action, il n'est donc pas affiché.
export default function BoutonPlusLocaux() {
  const router = useRouter();
  const livreurOuvert = useFonctionnalite('nav_marketplace_livreur');
  const [ouvert, setOuvert] = useState(false);
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(rotation, { toValue: ouvert ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [ouvert, rotation]);

  if (!livreurOuvert) return null;

  return (
    <>
      {ouvert ? (
        <Pressable
          onPress={() => setOuvert(false)}
          accessibilityLabel="Fermer le menu des actions"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 20, elevation: 10 }}
        />
      ) : null}

      <View style={{ position: 'absolute', right: 16, bottom: 16, alignItems: 'flex-end', gap: 12, zIndex: 30, elevation: 12, pointerEvents: 'box-none' }}>
        {ouvert ? (
          <Pressable
            onPress={() => {
              setOuvert(false);
              router.push('/marketplace/trouver-livreur' as Href);
            }}
            accessibilityRole="button"
            accessibilityLabel="Trouver un livreur"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 30, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>Trouver un livreur</Text>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🛵</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setOuvert((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: ouvert }}
          accessibilityLabel={ouvert ? 'Fermer le menu des actions' : 'Ouvrir le menu des actions'}
          style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', boxShadow: '0 6px 16px rgba(15,118,110,0.45)' }}>
          <LinearGradient colors={['#34D399', '#0F766E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
              <Ionicons name="add" size={32} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}
