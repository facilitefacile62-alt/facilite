import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FOND_CARTES } from '@/components/CarteMenu';
import MarketplaceHeader from '@/components/MarketplaceHeader';

// Une page par bouton du menu « Ma boutique » (maquettes du 20/10/2026). Les fonctions reportées à la prochaine mise à
// jour (Boost, abonnés, avis, livraison, chat/commentaires, notifications) n'ont encore aucune donnée en base : la page
// l'indique honnêtement, sans chiffres inventés ni réglage factice.
const RUBRIQUES: Record<string, { titre: string; icone: keyof typeof Ionicons.glyphMap; vide: string; detail: string }> = {
  boost: {
    titre: 'Faire profit & Boost',
    icone: 'rocket-outline',
    vide: 'Le Boost arrive dans une prochaine mise à jour',
    detail: 'Vous pourrez bientôt mettre vos articles en avant pour être vus par plus d’acheteurs. Rien n’est facturé pour le moment.',
  },
  abonnes: {
    titre: 'Abonnés',
    icone: 'people-outline',
    vide: 'Aucun abonné pour le moment',
    detail: 'La liste des personnes qui suivent votre boutique apparaîtra ici dans une prochaine mise à jour.',
  },
  avis: {
    titre: 'Avis clients',
    icone: 'star-outline',
    vide: 'Aucun avis pour le moment',
    detail: 'Les avis laissés par vos clients apparaîtront ici dans une prochaine mise à jour.',
  },
  livraison: {
    titre: 'Contact & Livraison',
    icone: 'bicycle-outline',
    vide: 'La livraison arrive dans une prochaine mise à jour',
    detail: 'Les options de contact et de livraison de votre boutique seront réglables ici dans une prochaine mise à jour. En attendant, les clients vous écrivent par la messagerie.',
  },
  chat: {
    titre: 'Désactiver le chat',
    icone: 'chatbubble-outline',
    vide: 'Ce réglage arrive dans une prochaine mise à jour',
    detail: 'Le chat reste actif pour tous vos clients. Vous pourrez bientôt le désactiver depuis cette page.',
  },
  commentaires: {
    titre: 'Désactiver les commentaires',
    icone: 'chatbubbles-outline',
    vide: 'Ce réglage arrive dans une prochaine mise à jour',
    detail: 'Les commentaires restent actifs sur vos articles. Vous pourrez bientôt les désactiver depuis cette page.',
  },
  notifications: {
    titre: 'Gérer les notifications',
    icone: 'notifications-outline',
    vide: 'Ce réglage arrive dans une prochaine mise à jour',
    detail: 'Vous pourrez bientôt choisir les notifications que vous recevez pour votre boutique.',
  },
};

export default function RubriqueBoutiqueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cle } = useLocalSearchParams<{ cle: string }>();
  const rubrique = RUBRIQUES[String(cle)] ?? RUBRIQUES.boost;

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
      <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
        <MarketplaceHeader />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/reglages' as Href))}
            accessibilityLabel="Retour"
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF' }}>
            <Ionicons name="arrow-back" size={19} color="#2563EB" />
          </Pressable>
          <Text className="flex-1 text-center text-[15px] font-black" style={{ marginRight: 44 }} numberOfLines={1}>
            {rubrique.titre}
          </Text>
        </View>
        <View className="mx-4 items-center rounded-[20px] px-6 py-10" style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9D1C1' }}>
          <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#D7F2EA' }}>
            <Ionicons name={rubrique.icone} size={28} color="#059669" />
          </View>
          <Text className="mt-4 text-center text-[16px] font-black" style={{ color: '#1A1A1A' }}>
            {rubrique.vide}
          </Text>
          <Text className="mt-2 text-center text-[13.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
            {rubrique.detail}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
