import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chargerCommandesBoutique, couleurStatut, dateCourte, LIBELLES_PAIEMENT, LIBELLES_STATUT, type MaCommande } from '@/lib/commandes';
import { prixLisible } from '@/lib/marketplace';

// Commandes reçues (maquette « Vendeur — Commandes reçues ») : écran dédié,
// lecture seule (les actions de livraison appartiennent au livreur, le
// vendeur suit juste l'avancement).
function CarteCommandeVendeur({ commande }: { commande: MaCommande }) {
  const statut = couleurStatut(commande.statut);
  return (
    <View className="bg-white rounded-2xl border border-black/[0.06] p-3.5 gap-1.5">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[14px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {commande.livraison_nom}
        </Text>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statut.fond }}>
          <Text className="text-[11px] font-bold" style={{ color: statut.texte }}>
            {LIBELLES_STATUT[commande.statut]}
          </Text>
        </View>
      </View>
      <Text className="text-[12.5px] text-gray-600" numberOfLines={1}>
        {commande.item?.titre ?? 'Article'} · ×{commande.quantite}
      </Text>
      <Text className="text-[12px] text-gray-500">
        {dateCourte(commande.created_at)} · {prixLisible(commande.prix_total_xof)} FCFA · {LIBELLES_PAIEMENT[commande.moyen_paiement]}
      </Text>
    </View>
  );
}

export default function CommandesRecuesScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [commandes, setCommandes] = useState<MaCommande[]>([]);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    if (!storeId) return;
    try {
      setCommandes(await chargerCommandesBoutique(storeId));
    } finally {
      setChargement(false);
    }
  }, [storeId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white items-center justify-center border border-black/[0.06]">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A]">Commandes reçues</Text>
        </View>

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={commandes}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center pt-16 gap-2">
                <Ionicons name="receipt-outline" size={36} color="#9CA3AF" />
                <Text className="text-[13.5px] text-gray-500 text-center px-6">Aucune commande reçue pour l&apos;instant.</Text>
              </View>
            }
            renderItem={({ item }) => <CarteCommandeVendeur commande={item} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
