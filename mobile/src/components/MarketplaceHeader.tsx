import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import BasculePlateforme from '@/components/BasculePlateforme';
import PanneauNotifications from '@/components/PanneauNotifications';
import PastilleCompteur from '@/components/PastilleCompteur';
import { useCompteursNonLus } from '@/lib/useCompteursNonLus';

// En-tête de la plateforme Marketplace (maquettes 15, 16, 17, 28 à 32, 36) :
// bande #e3dbcc, « Marketplace » en bleu, cloche avec pastille réelle,
// loupe dans sa pastille grise, menu.
//
// Les notifications ne sont pas propres à une plateforme : le panneau est
// le même que côté Facilité, il lit la même table.
const FOND = '#e3dbcc';
const BLEU = '#2563EB';

export default function MarketplaceHeader() {
  const router = useRouter();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const compteurs = useCompteursNonLus();

  return (
    <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: FOND }}>
      {/* Logo boutique dans son disque bleu pâle + « Locaux » en bleu. */}
      <Pressable onPress={() => router.navigate('/marketplace')} accessibilityLabel="Accueil Locaux" className="flex-row items-center gap-2">
        <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#DCE8FD' }}>
          <Ionicons name="storefront" size={18} color={BLEU} />
        </View>
        <Text className="text-[19px] font-black" style={{ color: BLEU, letterSpacing: -0.3 }}>
          Locaux
        </Text>
      </Pressable>
      {/* Bascule FIXE au milieu de l'en-tête. */}
      <View className="flex-1 items-center">
        <BasculePlateforme plateforme="locaux" />
      </View>
      <Pressable onPress={() => setNotifsOuvertes(true)} accessibilityLabel="Notifications" hitSlop={8}>
        <View>
          <Ionicons name="notifications-outline" size={20} color="#1A1A1A" />
          <PastilleCompteur valeur={compteurs.notifications} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => router.push('/marketplace/recherche')}
        accessibilityLabel="Rechercher"
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
        <Ionicons name="search" size={18} color="#1A1A1A" />
      </Pressable>
      <Pressable onPress={() => router.push('/marketplace/menu' as Href)} accessibilityLabel="Menu" hitSlop={8}>
        <Ionicons name="menu" size={22} color="#1A1A1A" />
      </Pressable>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
    </View>
  );
}
