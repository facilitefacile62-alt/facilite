import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { chargerCommandesBoutique } from '@/lib/commandes';
import { chargerMesArticles, chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// Tableau de bord (maquette « Vendeur — Tableau de bord ») : le menu de
// gestion de la boutique, séparé de l'aperçu public « Ma boutique ». Les
// rubriques sans fonctionnalité réelle (Boost, Premium, Abonnés, Avis,
// Contact) sont marquées « Bientôt disponible » plutôt que simulées.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

type Ligne = {
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  badge?: number;
  onPress: () => void;
};

export default function TableauDeBordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [nbArticles, setNbArticles] = useState(0);
  const [nbCommandes, setNbCommandes] = useState(0);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    if (!user?.id) return;
    try {
      const liste = await chargerMesBoutiques(user.id);
      const active = liste[0] ?? null;
      setBoutique(active);
      if (active) {
        const [articles, commandes] = await Promise.all([chargerMesArticles(active.id), chargerCommandesBoutique(active.id)]);
        setNbArticles(articles.length);
        setNbCommandes(commandes.length);
      }
    } finally {
      setChargement(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  if (chargement || !boutique) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#10B981" />
      </View>
    );
  }

  const storeId = boutique.id;
  const lignes: Ligne[] = [
    { icone: 'clipboard-outline', titre: 'Mes annonces', badge: nbArticles, onPress: () => router.push(`/marketplace/vendre/annonces?storeId=${storeId}` as Href) },
    { icone: 'cube-outline', titre: 'Mes commandes', badge: nbCommandes, onPress: () => router.push(`/marketplace/vendre/commandes-recues?storeId=${storeId}` as Href) },
    { icone: 'construct-outline', titre: 'Service / métier', onPress: () => router.push('/marketplace/vendre') },
    { icone: 'business-outline', titre: 'Établissement', onPress: () => router.push('/marketplace/vendre') },
    { icone: 'rocket-outline', titre: 'Faire profit & Boost', onPress: () => BIENTOT('Faire profit & Boost') },
    { icone: 'ribbon-outline', titre: 'Premium Marketplace', onPress: () => BIENTOT('Premium Marketplace') },
    { icone: 'people-outline', titre: 'Abonnés', onPress: () => BIENTOT('Abonnés') },
    { icone: 'star-outline', titre: 'Avis', onPress: () => BIENTOT('Avis') },
    { icone: 'help-circle-outline', titre: 'FAQ', onPress: () => router.push('/web/faq') },
    { icone: 'information-circle-outline', titre: 'À propos', onPress: () => router.push('/marketplace/a-propos') },
    { icone: 'call-outline', titre: 'Contact', onPress: () => BIENTOT('Contact') },
    { icone: 'settings-outline', titre: 'Réglages', onPress: () => router.push('/marketplace/reglages') },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white items-center justify-center border border-black/[0.06]">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A]">Tableau de bord</Text>
        </View>

        <ScrollView contentContainerClassName="px-4 pb-10" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl overflow-hidden">
            {lignes.map((l, i) => (
              <Pressable
                key={l.titre}
                onPress={l.onPress}
                className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-black/[0.05]' : ''}`}>
                <View className="w-9 h-9 rounded-xl bg-[#F2F0EA] items-center justify-center">
                  <Ionicons name={l.icone} size={17} color="#1A1A1A" />
                </View>
                <Text className="flex-1 text-[13.5px] font-bold text-[#1A1A1A]">{l.titre}</Text>
                {typeof l.badge === 'number' && l.badge > 0 ? (
                  <View className="rounded-full bg-[#D1FAE5] px-2 py-0.5 mr-1">
                    <Text className="text-[11px] font-black text-[#047857]">{l.badge}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
