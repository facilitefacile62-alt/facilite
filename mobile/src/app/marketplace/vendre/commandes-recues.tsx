import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { chargerCommandesBoutique, dateRelativeCourte, pastilleVendeur, type MaCommande } from '@/lib/commandes';
import { prixLisible } from '@/lib/marketplace';
import EnteteMarketplace from '@/components/EnteteMarketplace';

// Commandes reçues (maquette « Vendeur — Commandes reçues ») : écran dédié,
// lecture seule (les actions de livraison appartiennent au livreur, le
// vendeur suit juste l'avancement).
function CarteCommandeVendeur({ commande }: { commande: MaCommande }) {
  const pastille = pastilleVendeur(commande.statut);
  const initiale = (commande.livraison_nom || '?').trim().charAt(0).toUpperCase();
  return (
    <View className="flex-row items-center gap-3 bg-white rounded-[20px] p-3.5">
      <View className="items-center justify-center rounded-full" style={{ width: 46, height: 46, backgroundColor: '#E4DED2' }}>
        <Text className="text-[16px] font-black text-[#1A1A1A]">{initiale}</Text>
      </View>
      <View className="flex-1 min-w-0 gap-0.5">
        <Text className="text-[15px] font-black text-[#1A1A1A]" numberOfLines={1}>{commande.livraison_nom}</Text>
        <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.55)' }} numberOfLines={1}>
          {commande.item?.titre ?? 'Article'} · ×{commande.quantite}
        </Text>
        <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.45)' }}>
          {dateRelativeCourte(commande.created_at)} · {prixLisible(commande.prix_total_xof)} FCFA
        </Text>
      </View>
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: pastille.fond }}>
        <Text className="text-[11.5px] font-extrabold" style={{ color: pastille.texte }}>{pastille.libelle}</Text>
      </View>
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
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Commandes reçues" />

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
      </View>
    </View>
  );
}
