import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import {
  annulerCommande,
  chargerMesCommandesAcheteur,
  couleurStatut,
  dateCourte,
  LIBELLES_PAIEMENT,
  LIBELLES_STATUT,
  type MaCommande,
} from '@/lib/commandes';
import { prixLisible } from '@/lib/marketplace';

// « Mes commandes » (acheteur). Le suivi détaillé (position, confirmation de
// réception) vit dans l'écran dédié /marketplace/suivi/[id] (maquettes
// « Suivi de livraison » / « Suivi — Livraison déclarée »).
const VERT_PROFOND = '#0d3b34';

function CarteCommande({
  commande,
  occupee,
  onSuivre,
  onAnnuler,
}: {
  commande: MaCommande;
  occupee: boolean;
  onSuivre: () => void;
  onAnnuler: () => void;
}) {
  const statut = couleurStatut(commande.statut);
  const peutAnnuler = commande.statut === 'en_attente_livreur' || commande.statut === 'assignee';
  const peutSuivre = ['assignee', 'recuperee', 'en_livraison', 'livree_declaree', 'livree'].includes(commande.statut);

  return (
    <View className="bg-white rounded-2xl border border-black/[0.06] p-3.5 gap-2.5">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[14px] font-bold text-[#1A1A1A]" numberOfLines={2}>
          {commande.item?.titre ?? 'Article'}
        </Text>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statut.fond }}>
          <Text className="text-[11px] font-bold" style={{ color: statut.texte }}>
            {LIBELLES_STATUT[commande.statut]}
          </Text>
        </View>
      </View>

      <Text className="text-[13px] text-gray-700">
        {commande.quantite} × {prixLisible(commande.prix_unitaire_xof)} FCFA ·{' '}
        <Text className="font-extrabold" style={{ color: VERT_PROFOND }}>
          {prixLisible(commande.prix_total_xof)} FCFA
        </Text>
      </Text>
      <Text className="text-[12px] text-gray-500">
        {LIBELLES_PAIEMENT[commande.moyen_paiement]} · {dateCourte(commande.created_at)}
      </Text>
      <Text className="text-[12px] text-gray-500" numberOfLines={2}>
        Livraison : {commande.livraison_adresse}
      </Text>

      {peutSuivre && (
        <Pressable
          onPress={onSuivre}
          className="flex-row items-center justify-center gap-2 rounded-xl py-2.5"
          style={{ backgroundColor: commande.statut === 'livree_declaree' ? '#B45309' : VERT_PROFOND }}>
          <Ionicons name={commande.statut === 'livree' ? 'checkmark-circle-outline' : 'navigate-outline'} size={16} color="#fff" />
          <Text className="text-white text-[13px] font-bold">
            {commande.statut === 'livree_declaree' ? 'Confirmer la réception' : commande.statut === 'livree' ? 'Voir le suivi' : 'Suivre la livraison'}
          </Text>
        </Pressable>
      )}

      {peutAnnuler && (
        <Pressable onPress={onAnnuler} disabled={occupee} hitSlop={6} className="self-start py-1 disabled:opacity-60">
          {occupee ? <ActivityIndicator color={VERT_PROFOND} /> : <Text className="text-[12.5px] font-bold text-red-600">Annuler la commande</Text>}
        </Pressable>
      )}
    </View>
  );
}

export default function MesCommandesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [commandes, setCommandes] = useState<MaCommande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [occupee, setOccupee] = useState<string | null>(null);

  const userId = user?.id;
  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      setCommandes(await chargerMesCommandesAcheteur(userId));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de charger vos commandes.');
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [userId]);

  // Recharge à chaque retour sur l'écran (commande envoyée depuis une fiche
  // article, livraison confirmée, etc.), pas seulement au premier affichage.
  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  function demanderAnnulation(commande: MaCommande) {
    Alert.alert('Annuler cette commande ?', "L'article ne sera plus réservé pour vous.", [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          setOccupee(commande.id);
          try {
            await annulerCommande(commande.id);
            await recharger();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Annulation impossible.');
          } finally {
            setOccupee(null);
          }
        },
      },
    ]);
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={retour}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[18px] font-black text-[#1A1A1A]">Mes commandes</Text>
        </View>

        {!user?.id ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour suivre vos commandes.</Text>
            <Pressable onPress={() => router.push('/login')} className="rounded-2xl px-6 py-3" style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[14px] font-bold">Se connecter</Text>
            </Pressable>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={commandes}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={rafraichissement}
                onRefresh={() => {
                  setRafraichissement(true);
                  recharger();
                }}
                tintColor="#10B981"
              />
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-16 gap-3">
                <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                <Text className="text-[14px] font-bold text-[#1A1A1A]">Aucune commande pour l&apos;instant</Text>
                <Text className="text-[12.5px] text-gray-500 text-center px-8">
                  Quand vous commandez un article, son suivi apparaît ici.
                </Text>
                <Pressable onPress={() => router.replace('/marketplace')} className="rounded-2xl px-5 py-2.5 mt-2" style={{ backgroundColor: VERT_PROFOND }}>
                  <Text className="text-white text-[13px] font-bold">Voir les articles</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <CarteCommande
                commande={item}
                occupee={occupee === item.id}
                onSuivre={() => router.push(`/marketplace/suivi/${item.id}` as Href)}
                onAnnuler={() => demanderAnnulation(item)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
