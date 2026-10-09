import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { chargerCommandesBoutique } from '@/lib/commandes';
import { chargerMesArticles, chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { LigneMenu } from '@/components/LigneMenu';

// Tableau de bord (maquette « Vendeur — Tableau de bord ») : le menu de
// gestion de la boutique, séparé de l'aperçu public « Ma boutique ». Les
// rubriques sans fonctionnalité réelle (Boost, Premium, Abonnés, Avis,
// Contact) sont marquées « Bientôt disponible » plutôt que simulées.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

type Ligne = {
  emoji: string;
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
      <View className="flex-1 bg-[#F2F0EA] items-center justify-center">
        <ActivityIndicator color="#10B981" />
      </View>
    );
  }

  const storeId = boutique.id;
  const lignes: Ligne[] = [
    { emoji: '📋', titre: 'Mes annonces', badge: nbArticles, onPress: () => router.push(`/marketplace/vendre/annonces?storeId=${storeId}` as Href) },
    { emoji: '📦', titre: 'Mes commandes', badge: nbCommandes, onPress: () => router.push(`/marketplace/vendre/commandes-recues?storeId=${storeId}` as Href) },
    { emoji: '🛠️', titre: 'Service / métier', onPress: () => router.push('/marketplace/vendre') },
    { emoji: '🏢', titre: 'Établissement', onPress: () => router.push('/marketplace/vendre') },
    { emoji: '🚀', titre: 'Faire profit & Boost', onPress: () => BIENTOT('Faire profit & Boost') },
    { emoji: '👑', titre: 'Premium Marketplace', onPress: () => BIENTOT('Premium Marketplace') },
    { emoji: '👥', titre: 'Abonnés', onPress: () => BIENTOT('Abonnés') },
    { emoji: '⭐', titre: 'Avis', onPress: () => BIENTOT('Avis') },
    { emoji: '❔', titre: 'FAQ', onPress: () => router.push('/web/faq') },
    { emoji: 'ℹ️', titre: 'À propos', onPress: () => router.push('/marketplace/a-propos') },
    { emoji: '☎️', titre: 'Contact', onPress: () => BIENTOT('Contact') },
    { emoji: '⚙️', titre: 'Réglages', onPress: () => router.push('/marketplace/reglages') },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Tableau de bord" />

        <ScrollView contentContainerClassName="px-4 pt-4 pb-10" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-[18px] overflow-hidden">
            {lignes.map((l, i) => (
              <LigneMenu
                key={l.titre}
                emoji={l.emoji}
                titre={l.titre}
                compteur={l.badge}
                derniere={i === lignes.length - 1}
                onPress={l.onPress}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
