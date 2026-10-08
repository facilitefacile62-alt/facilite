import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  chargerCommande,
  confirmerReceptionCommande,
  dateCourte,
  LIBELLES_STATUT,
  type MaCommande,
  type StatutCommande,
} from '@/lib/commandes';

// Suivi de livraison (maquettes « Suivi de livraison » et « Suivi — Livraison
// déclarée »). Pas de fond de carte (aucun module carte natif installé) : la
// position du livreur s'ouvre dans l'application Plans du téléphone.
const VERT_PROFOND = '#0d3b34';
const ETAPES: StatutCommande[] = ['en_attente_livreur', 'assignee', 'recuperee', 'en_livraison', 'livree_declaree', 'livree'];

export default function SuiviLivraisonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [commande, setCommande] = useState<MaCommande | null | undefined>(undefined);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const recharger = useCallback(async () => {
    if (!id) return;
    try {
      setCommande(await chargerCommande(id));
    } catch {
      setCommande(null);
    } finally {
      setRafraichissement(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  async function confirmer() {
    if (!commande) return;
    setConfirmation(true);
    try {
      await confirmerReceptionCommande(commande.id);
      await recharger();
      Alert.alert('Merci !', 'La commande est marquée comme reçue.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Confirmation impossible.');
    } finally {
      setConfirmation(false);
    }
  }

  function ouvrirCarte() {
    if (!commande?.livreur_position_lat || !commande?.livreur_position_lng) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${commande.livreur_position_lat},${commande.livreur_position_lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Carte', "Impossible d'ouvrir l'application Plans."));
  }

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace/commandes');
  }

  const indexActuel = commande ? ETAPES.indexOf(commande.statut) : -1;
  const positionConnue = Boolean(commande?.livreur_position_lat && commande?.livreur_position_lng);

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="w-9 h-9 rounded-full bg-white items-center justify-center border border-black/[0.06]">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[18px] font-black text-[#1A1A1A]">Suivi de livraison</Text>
        </View>

        {commande === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : commande === null ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Commande introuvable.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-4 pb-10 gap-4"
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
            }>
            <View className="bg-white rounded-2xl border border-black/[0.06] p-4 gap-1">
              <Text className="text-[14.5px] font-bold text-[#1A1A1A]">{commande.item?.titre ?? 'Article'}</Text>
              <Text className="text-[12px] text-gray-500">
                Retrait : {commande.store?.nom ?? 'Boutique'}
                {commande.store?.ville ? ` · ${commande.store.ville}` : ''}
              </Text>
              <Text className="text-[12px] text-gray-500">Commandé le {dateCourte(commande.created_at)}</Text>
            </View>

            {commande.statut === 'annulee' ? (
              <View className="bg-white rounded-2xl border border-black/[0.06] p-4">
                <Text className="text-[13.5px] font-bold text-gray-600">Cette commande a été annulée.</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl border border-black/[0.06] p-4 gap-3">
                {ETAPES.map((etape, i) => {
                  const atteinte = indexActuel >= 0 && i <= indexActuel;
                  return (
                    <View key={etape} className="flex-row items-center gap-3">
                      <View
                        className="w-7 h-7 rounded-full items-center justify-center"
                        style={{ backgroundColor: atteinte ? '#10B981' : '#F2F0EA' }}>
                        <Ionicons name={atteinte ? 'checkmark' : 'ellipse-outline'} size={14} color={atteinte ? '#fff' : '#9CA3AF'} />
                      </View>
                      <Text className={`text-[13px] ${atteinte ? 'font-bold text-[#1A1A1A]' : 'text-gray-400'}`}>
                        {LIBELLES_STATUT[etape]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {commande.statut === 'en_livraison' && (
              <Pressable
                onPress={ouvrirCarte}
                disabled={!positionConnue}
                className="flex-row items-center gap-2 rounded-2xl bg-white border border-black/[0.06] px-4 py-3.5 disabled:opacity-60">
                <Ionicons name="navigate-outline" size={18} color={VERT_PROFOND} />
                <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]">
                  {positionConnue && commande.livreur_position_maj_le
                    ? `Position du livreur reçue à ${dateCourte(commande.livreur_position_maj_le).slice(-5)} · voir sur la carte`
                    : "En attente de la position du livreur"}
                </Text>
              </Pressable>
            )}

            {commande.statut === 'livree_declaree' && (
              <View className="gap-2">
                <Text className="text-[13px] text-amber-700 font-semibold text-center">
                  Le livreur a déclaré cette commande livrée.
                </Text>
                <Pressable
                  onPress={confirmer}
                  disabled={confirmation}
                  className="rounded-2xl py-3.5 items-center disabled:opacity-60"
                  style={{ backgroundColor: VERT_PROFOND }}>
                  {confirmation ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-[14px] font-bold">J&apos;ai bien reçu mon colis</Text>
                  )}
                </Pressable>
              </View>
            )}

            {commande.statut === 'livree' && (
              <View className="items-center gap-2 py-2">
                <Ionicons name="checkmark-circle" size={36} color="#10B981" />
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Commande livrée</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
