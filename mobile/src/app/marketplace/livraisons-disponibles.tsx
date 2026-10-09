import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import BoutonAction from '@/components/BoutonAction';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { distanceLisible, prixLisible, type Position } from '@/lib/marketplace';
import { listerLivraisonsDisponibles, reclamerLivraison, type LivraisonDisponible } from '@/lib/livraison';
import { useLocalisation } from '@/lib/useLocalisation';

// « Livreur — Livraisons disponibles » (maquette 81) : les commandes en
// attente de livreur, triées par distance depuis la position du livreur, avec
// le bouton « Réclamer ». Avant réclamation, seul le point de retrait (la
// boutique) est montré : l'adresse et le téléphone de l'acheteur ne sont
// révélés qu'une fois la livraison réclamée (voir livraisons.tsx).
//
// La position est demandée à l'ouverture de l'écran — le livreur vient de
// choisir d'y entrer — plutôt que derrière un bouton « Relever ma position ».
const VERT = '#10B981';

type Etat = 'localisation' | 'refusee' | 'chargement' | 'pret';

export default function LivraisonsDisponiblesScreen() {
  const { activer } = useLocalisation();
  const [etat, setEtat] = useState<Etat>('localisation');
  const [position, setPosition] = useState<Position | null>(null);
  const [livraisons, setLivraisons] = useState<LivraisonDisponible[]>([]);
  const [occupee, setOccupee] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async (p: Position) => {
    try {
      setLivraisons(await listerLivraisonsDisponibles(p));
      setEtat('pret');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Recherche impossible.');
      setEtat('pret');
    } finally {
      setRafraichissement(false);
    }
  }, []);

  const localiser = useCallback(async () => {
    setEtat('localisation');
    const { position: releve } = await activer().catch(() => ({ position: null }));
    if (!releve) {
      setEtat('refusee');
      return;
    }
    setPosition(releve);
    setEtat('chargement');
    await charger(releve);
  }, [activer, charger]);

  useFocusEffect(
    useCallback(() => {
      localiser();
    }, [localiser])
  );

  async function reclamer(l: LivraisonDisponible) {
    setOccupee(l.id);
    try {
      await reclamerLivraison(l.id);
      if (position) await charger(position);
    } catch (e) {
      Alert.alert('Réclamation impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setOccupee(null);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Livraisons disponibles" sousTitre="Triées par distance" />

        {etat === 'localisation' || etat === 'chargement' ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator color={VERT} />
            <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {etat === 'localisation' ? 'Recherche de votre position…' : 'Recherche des livraisons…'}
            </Text>
          </View>
        ) : etat === 'refusee' ? (
          <View className="flex-1 items-center justify-center px-8 gap-3">
            <Text style={{ fontSize: 36 }}>📍</Text>
            <Text className="text-[14px] font-extrabold text-[#1A1A1A] text-center">Position nécessaire</Text>
            <Text className="text-[12.5px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Autorisez la localisation pour trier les livraisons selon votre distance.
            </Text>
            <View className="w-full mt-1">
              <BoutonAction titre="Réessayer" sousTitre="Relever ma position actuelle" icone="locate-outline" onPress={localiser} />
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerClassName="px-4 pt-4 pb-10 gap-3"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={rafraichissement}
                onRefresh={() => {
                  setRafraichissement(true);
                  if (position) charger(position);
                  else localiser();
                }}
                tintColor={VERT}
              />
            }>
            {livraisons.length === 0 ? (
              <View className="items-center py-12 gap-1.5">
                <Text style={{ fontSize: 34 }}>🛵</Text>
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucune livraison disponible</Text>
                <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Dans un rayon de 15 km autour de vous.</Text>
              </View>
            ) : (
              livraisons.map((l) => {
                const distance = distanceLisible(l.distance_km);
                const [valeur, unite] = (distance ?? '').split(' ');
                const lieu = [l.boutique_nom, l.boutique_quartier].filter(Boolean).join(' → ');
                return (
                  <View key={l.id} className="flex-row items-center gap-3 bg-white rounded-[20px] p-3.5">
                    {distance ? (
                      <View className="items-center" style={{ minWidth: 52 }}>
                        <Text className="text-[17px] font-black" style={{ color: '#047857' }}>{valeur}</Text>
                        <Text className="text-[12px] font-black" style={{ color: '#047857' }}>{unite}</Text>
                        <Text className="text-[10.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>de vous</Text>
                      </View>
                    ) : null}
                    <View className="flex-1 min-w-0 gap-0.5">
                      <Text className="text-[14.5px] font-black text-[#1A1A1A]" numberOfLines={1}>{l.item_titre}</Text>
                      <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>{lieu}</Text>
                      <Text className="text-[13.5px] font-black text-[#1A1A1A]">{prixLisible(l.prix_total_xof)} FCFA</Text>
                    </View>
                    <Pressable
                      onPress={() => reclamer(l)}
                      disabled={occupee === l.id}
                      className="items-center justify-center rounded-[14px] disabled:opacity-60"
                      style={{ minWidth: 92, height: 48, backgroundColor: VERT, paddingHorizontal: 14 }}>
                      {occupee === l.id ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white text-[14px] font-black">Réclamer</Text>}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
