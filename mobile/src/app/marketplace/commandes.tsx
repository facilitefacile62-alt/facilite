import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import {
  annulerCommande,
  chargerMesCommandesAcheteur,
  confirmerReceptionCommande,
  jourMois,
  pastilleAcheteur,
  premierePhoto,
  refCommande,
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
  onConfirmer,
  onAnnuler,
}: {
  commande: MaCommande;
  occupee: boolean;
  onSuivre: () => void;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const pastille = pastilleAcheteur(commande.statut);
  const photo = premierePhoto(commande.item?.photos);
  const peutAnnuler = commande.statut === 'en_attente_livreur' || commande.statut === 'assignee';
  const suivable = ['assignee', 'recuperee', 'en_livraison'].includes(commande.statut);

  return (
    <View className="bg-white rounded-[20px] p-3.5 gap-3">
      <View className="flex-row gap-3">
        <View className="rounded-[14px] overflow-hidden items-center justify-center" style={{ width: 56, height: 56, backgroundColor: '#E8E4DA' }}>
          {photo ? (
            <Image source={{ uri: photo }} alt={commande.item?.titre ?? 'Article'} style={{ width: 56, height: 56 }} contentFit="cover" />
          ) : (
            <Ionicons name="image-outline" size={20} color="rgba(0,0,0,0.25)" />
          )}
        </View>
        <View className="flex-1 min-w-0 gap-0.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[12.5px] flex-1" style={{ color: 'rgba(0,0,0,0.45)' }} numberOfLines={1}>
              {refCommande(commande.id)} · {jourMois(commande.created_at)}
            </Text>
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: pastille.fond }}>
              <Text className="text-[11.5px] font-extrabold" style={{ color: pastille.texte }}>{pastille.libelle}</Text>
            </View>
          </View>
          <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={2}>
            {commande.item?.titre ?? 'Article'}
          </Text>
          <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>
            {commande.store?.nom ?? 'Boutique'} · {prixLisible(commande.prix_total_xof)} FCFA
          </Text>
        </View>
      </View>

      {suivable && (
        <Pressable
          onPress={onSuivre}
          className="items-center justify-center rounded-[14px]"
          style={{ height: 50, backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399' }}>
          <Text className="text-[15px] font-black text-[#1A1A1A]">Suivre la livraison</Text>
        </Pressable>
      )}

      {commande.statut === 'livree_declaree' && (
        <Pressable
          onPress={onConfirmer}
          disabled={occupee}
          className="items-center justify-center rounded-[14px] disabled:opacity-60"
          style={{ height: 50, backgroundColor: '#10B981' }}>
          {occupee ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Confirmer la réception</Text>}
        </Pressable>
      )}

      {peutAnnuler && (
        <Pressable onPress={onAnnuler} disabled={occupee} hitSlop={6} className="self-start py-0.5 disabled:opacity-60">
          <Text className="text-[12.5px] font-bold text-red-600">Annuler la commande</Text>
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

  function demanderConfirmation(commande: MaCommande) {
    Alert.alert('Colis reçu ?', 'Confirmez uniquement si vous avez bien reçu votre article.', [
      { text: 'Pas encore', style: 'cancel' },
      {
        text: 'Oui, reçu',
        onPress: async () => {
          setOccupee(commande.id);
          try {
            await confirmerReceptionCommande(commande.id);
            await recharger();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Confirmation impossible.');
          } finally {
            setOccupee(null);
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes commandes" />

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
                onConfirmer={() => demanderConfirmation(item)}
                onAnnuler={() => demanderAnnulation(item)}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
