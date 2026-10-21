import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { supabase } from '@/lib/supabase';
import { chargerPositionVoyage, chargerVoyagesParIds, type InfoVoyage } from '@/lib/voyages';

// Suivi en direct du chauffeur (passager dont la réservation est ACCEPTÉE, voyage en route).
// La position arrive par Realtime sur voyages_positions : la RLS ne diffuse qu'au chauffeur et
// aux passagers acceptés de CE voyage. Un rechargement toutes les 15 s reste en secours si la
// connexion temps réel est coupée.
const RAFRAICHISSEMENT_AUTO_MS = 15000;

export default function SuiviVoyageScreen() {
  const { voyageId } = useLocalSearchParams<{ voyageId: string }>();
  const [voyage, setVoyage] = useState<InfoVoyage | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [majLe, setMajLe] = useState<string | null>(null);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    chargerVoyagesParIds([voyageId])
      .then((m) => !annule && setVoyage(m[voyageId] ?? null))
      .catch(() => {});
    const lire = () =>
      chargerPositionVoyage(voyageId)
        .then((p) => {
          if (!annule && p) {
            setPosition({ lat: p.lat, lng: p.lng });
            setMajLe(p.maj_le);
          }
        })
        .catch(() => {});
    lire();
    const minuteur = setInterval(lire, RAFRAICHISSEMENT_AUTO_MS);
    const canal = supabase
      .channel(`suivi-voyage-${voyageId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voyages_positions', filter: `voyage_id=eq.${voyageId}` }, (payload) => {
        const p = payload.new as { lat?: number; lng?: number; maj_le?: string };
        if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
          setPosition({ lat: p.lat, lng: p.lng });
          setMajLe(p.maj_le ?? null);
        }
      })
      .subscribe();
    return () => {
      annule = true;
      clearInterval(minuteur);
      supabase.removeChannel(canal);
    };
  }, [voyageId]);

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const m: MarqueurCarte[] = [];
    if (voyage) {
      m.push({ id: 'A', lat: voyage.depart_lat, lng: voyage.depart_lng, couleur: '#10B981', libelle: `A · ${voyage.depart_libelle}` });
      m.push({ id: 'B', lat: voyage.destination_lat, lng: voyage.destination_lng, couleur: '#EF4444', libelle: `B · ${voyage.destination_libelle}` });
    }
    if (position) m.push({ id: 'chauffeur', lat: position.lat, lng: position.lng, couleur: '#2563EB', rayon: 10, halo: true, libelle: 'Chauffeur' });
    return m;
  }, [voyage, position]);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <EnteteMarketplace titre="Suivi du chauffeur" sousTitre={voyage ? `${voyage.depart_libelle} → ${voyage.destination_libelle}` : undefined} />
      <View className="px-4 py-2">
        <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.6)' }}>
          {position ? `Position reçue${majLe ? ` à ${new Date(majLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}` : 'En attente de la position du chauffeur…'}
        </Text>
      </View>
      <View className="flex-1 mx-4 mb-4 overflow-hidden" style={{ borderRadius: 20, backgroundColor: '#E8E4DA' }}>
        <CarteLeaflet
          centre={{ lat: position?.lat ?? voyage?.depart_lat ?? 14.72, lng: position?.lng ?? voyage?.depart_lng ?? -17.3 }}
          zoom={13}
          marqueurs={marqueurs}
          ajuster
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
    </View>
  );
}
