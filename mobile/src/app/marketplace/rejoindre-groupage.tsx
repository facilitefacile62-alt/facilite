import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import {
  ZONES_GROUPAGE,
  heureLisible,
  rattacherCommandeAGroupage,
  rechercherGroupages,
  type GroupagePropose,
  type ZoneGroupage,
} from '@/lib/groupages';

// « Rejoindre un groupage » (acheteur) — port de RejoindreGroupageModal.jsx
// (web). On donne le lieu où l'on veut être livré (position actuelle ou zone),
// on voit les tournées de livreurs qui vont dans cette direction, on en choisit
// une, et la commande y est rattachée. Le livreur accepte ou refuse ensuite ;
// le prix de la livraison se règle directement avec lui. Les règles (boutique
// près du départ, livraison près de la destination, places) sont revérifiées en
// base : l'écran ne fait que guider.
const VERT = '#10B981';

export default function RejoindreGroupageScreen() {
  const router = useRouter();
  const { commandeId, titre } = useLocalSearchParams<{ commandeId?: string; titre?: string }>();
  const [point, setPoint] = useState<ZoneGroupage | null>(null);
  const [groupages, setGroupages] = useState<GroupagePropose[] | null>(null);
  const [choisi, setChoisi] = useState<GroupagePropose | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Recherche des tournées dès que le lieu de livraison est connu.
  useEffect(() => {
    if (!point) return;
    let annule = false;
    rechercherGroupages(point.lat, point.lng)
      .then((l) => {
        if (annule) return;
        setGroupages(l);
        setChoisi((c) => (c && l.some((g) => g.id === c.id) ? c : null));
      })
      .catch((e: unknown) => {
        if (!annule) Alert.alert('Erreur', e instanceof Error ? e.message : 'Recherche impossible.');
      });
    return () => {
      annule = true;
    };
  }, [point]);

  async function jeSuisLa() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Localisation refusée', 'Autorisez la localisation ou choisissez votre zone dans la liste.');
      return;
    }
    const p = await Location.getCurrentPositionAsync({});
    setPoint({ nom: 'Ma position', lat: p.coords.latitude, lng: p.coords.longitude });
  }

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const m: MarqueurCarte[] = [];
    if (choisi) {
      m.push({ id: 'A', lat: choisi.depart_lat, lng: choisi.depart_lng, couleur: '#10B981', libelle: `A · ${choisi.depart_libelle}` });
      m.push({ id: 'B', lat: choisi.destination_lat, lng: choisi.destination_lng, couleur: '#EF4444', libelle: `B · ${choisi.destination_libelle}` });
    }
    if (point) m.push({ id: 'toi', lat: point.lat, lng: point.lng, couleur: '#2563EB', rayon: 8, halo: true, libelle: 'Toi' });
    return m;
  }, [choisi, point]);

  async function rejoindre() {
    if (!choisi || !point || !commandeId) return;
    setEnCours(true);
    try {
      await rattacherCommandeAGroupage(commandeId, choisi.id, point.lat, point.lng);
      Alert.alert('Demande envoyée', 'Le livreur doit maintenant accepter ta commande : tu seras prévenu.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Impossible de rejoindre', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }

  const rejoignable = !!choisi && choisi.dans_la_zone && choisi.places_restantes > 0;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Rejoindre un groupage" />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-3.5" showsVerticalScrollIndicator={false}>
          <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
            Un livreur fait une tournée vers ta zone : tu rejoins son trajet au lieu de payer une course à part. Indique où tu veux être livré
            {titre ? ` pour « ${titre} »` : ''}.
          </Text>

          <View className="overflow-hidden" style={{ height: 220, borderRadius: 20, backgroundColor: '#E8E4DA' }}>
            <CarteLeaflet
              centre={{ lat: point?.lat ?? 14.72, lng: point?.lng ?? -17.3 }}
              zoom={10}
              marqueurs={marqueurs}
              ajuster
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </View>

          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Mon lieu de livraison</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Pressable onPress={jeSuisLa} className="rounded-full px-3 py-2" style={{ backgroundColor: point?.nom === 'Ma position' ? '#0d3b34' : '#fff', borderWidth: 1, borderColor: point?.nom === 'Ma position' ? '#0d3b34' : '#E5E7EB' }}>
              <Text className="text-[12.5px] font-bold" style={{ color: point?.nom === 'Ma position' ? '#fff' : '#1A1A1A' }}>📍 Je suis là</Text>
            </Pressable>
            {ZONES_GROUPAGE.map((z) => (
              <Pressable key={z.nom} onPress={() => setPoint(z)} className="rounded-full px-3 py-2" style={{ backgroundColor: point?.nom === z.nom ? '#0d3b34' : '#fff', borderWidth: 1, borderColor: point?.nom === z.nom ? '#0d3b34' : '#E5E7EB' }}>
                <Text className="text-[12.5px] font-bold" style={{ color: point?.nom === z.nom ? '#fff' : '#1A1A1A' }}>{z.nom}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {!point ? (
            <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Choisis ton lieu de livraison pour voir les groupages.</Text>
          ) : groupages === null ? (
            <ActivityIndicator color={VERT} />
          ) : groupages.length === 0 ? (
            <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
              Aucun groupage ne va vers cette zone pour l’instant. Ta commande reste disponible pour les livreurs.
            </Text>
          ) : (
            groupages.map((g) => {
              const selection = choisi?.id === g.id;
              const ok = g.dans_la_zone && g.places_restantes > 0;
              return (
                <Pressable key={g.id} onPress={() => setChoisi(g)} className="bg-white rounded-[18px] p-3.5 gap-1" style={{ borderWidth: 2, borderColor: selection ? '#2563EB' : 'transparent' }}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-[14px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>
                      {g.depart_libelle} → {g.destination_libelle}
                    </Text>
                    <Text className="text-[13px] font-black text-[#1A1A1A]">{g.frais_par_livraison_xof.toLocaleString('fr-FR')} FCFA</Text>
                  </View>
                  <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    Départ {heureLisible(g.heure_depart)} · {g.places_restantes} place{g.places_restantes > 1 ? 's' : ''} restante{g.places_restantes > 1 ? 's' : ''}
                    {g.livreur_prenom ? ` · ${g.livreur_prenom}` : ''}
                    {g.type_vehicule ? ` (${g.type_vehicule})` : ''}
                  </Text>
                  <Text className="text-[11.5px] font-black" style={{ color: ok ? '#059669' : '#D97706' }}>
                    {g.places_restantes === 0 ? 'Complet' : g.dans_la_zone ? 'Va dans ta zone ✓' : `Termine à ${String(g.distance_destination_km).replace('.', ',')} km de ton lieu : hors zone`}
                  </Text>
                </Pressable>
              );
            })
          )}

          {choisi && (
            <Pressable onPress={rejoindre} disabled={enCours || !rejoignable} className="items-center justify-center rounded-full disabled:opacity-50" style={{ height: 52, backgroundColor: '#0d3b34' }}>
              {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Rejoindre ce groupage</Text>}
            </Pressable>
          )}

          <Text className="text-[11px]" style={{ color: 'rgba(0,0,0,0.4)' }}>Le prix de la livraison se règle directement avec le livreur à la remise.</Text>
        </ScrollView>
      </View>
    </View>
  );
}
