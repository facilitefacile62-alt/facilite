import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import { chargerBoutiquesCarte, type BoutiqueCarte } from '@/lib/boutiquesCarte';
import type { Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';

// Mini carte (≈ 160 px) en haut du fil Marketplace, ouverte par « Mini carte »
// de la ligne « Autour de moi » : quelques boutiques, « N boutiques autour de
// vous », ✕ pour fermer, bouton vert « Pleine carte ». N est le vrai nombre de
// boutiques actives chargées.
const VERT = '#10B981';
const BLEU = '#2563EB';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

export default function MiniCarteBoutiques({ onFermer, onPleineCarte }: { onFermer: () => void; onPleineCarte: () => void }) {
  const { position, activer } = useLocalisation();
  const [boutiques, setBoutiques] = useState<BoutiqueCarte[] | null>(null);

  useEffect(() => {
    activer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let annule = false;
    chargerBoutiquesCarte(position)
      .then((b) => {
        if (!annule) setBoutiques(b);
      })
      .catch(() => {
        if (!annule) setBoutiques([]);
      });
    return () => {
      annule = true;
    };
  }, [position]);

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const liste: MarqueurCarte[] = (boutiques ?? []).map((b) => ({
      id: b.id,
      lat: b.latitude,
      lng: b.longitude,
      couleur: VERT,
      rayon: 8,
      libelle: b.nom,
    }));
    if (position) liste.push({ id: 'moi', lat: position.latitude, lng: position.longitude, couleur: BLEU, rayon: 8, halo: true });
    return liste;
  }, [boutiques, position]);

  const origine = position ?? DAKAR;
  const n = boutiques?.length ?? 0;

  return (
    <View className="mx-4 mt-3 overflow-hidden" style={{ height: 160, borderRadius: 22, backgroundColor: '#1b2330' }}>
      <CarteLeaflet
        centre={{ lat: origine.latitude, lng: origine.longitude }}
        zoom={13}
        marqueurs={marqueurs}
        sombre
        ajuster
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className="absolute flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ top: 10, left: 10, backgroundColor: 'rgba(20,24,33,0.88)' }}>
        <View className="rounded-full" style={{ width: 7, height: 7, backgroundColor: VERT }} />
        <Text className="text-[12px] font-black text-white">
          {boutiques === null ? 'Chargement…' : `${n} ${n > 1 ? 'boutiques' : 'boutique'} autour de vous`}
        </Text>
      </View>
      <Pressable
        onPress={onFermer}
        accessibilityLabel="Fermer la mini carte"
        className="absolute items-center justify-center rounded-full"
        style={{ top: 6, right: 6, width: 44, height: 44 }}>
        <View className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: 'rgba(20,24,33,0.88)' }}>
          <Ionicons name="close" size={16} color="#fff" />
        </View>
      </Pressable>
      <Pressable
        onPress={onPleineCarte}
        accessibilityRole="button"
        className="absolute flex-row items-center gap-1.5 rounded-full"
        style={{ right: 10, bottom: 10, height: 40, paddingHorizontal: 16, backgroundColor: VERT }}>
        <Ionicons name="scan-outline" size={15} color="#fff" />
        <Text className="text-[13.5px] font-black text-white">Pleine carte</Text>
      </Pressable>
    </View>
  );
}
