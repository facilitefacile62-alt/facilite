import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import FaciliteHeader from '@/components/FaciliteHeader';
import { chargerOffresParVille, type GroupeVille, type ResultatAutour } from '@/lib/offresParVille';
import type { Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';

// « Autour de moi » de Facilité — pas celui de Locaux : ici la carte montre OÙ
// RECRUTENT LES ENTREPRISES. Une pastille par ville avec son nombre d'offres ;
// un appui ouvre la liste des offres de cette ville (entreprise + poste).
// Les positions sont celles du CENTRE de chaque ville (les offres n'ont pas de
// GPS précis) et l'écran le dit. Les offres qui ne citent aucune ville connue
// (« Sénégal ») sont comptées à part.
const BLEU = '#2563EB';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

export default function AutourFaciliteScreen() {
  const router = useRouter();
  const { position, activer } = useLocalisation();
  const [resultat, setResultat] = useState<ResultatAutour | null>(null);
  const [erreur, setErreur] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    activer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let annule = false;
    chargerOffresParVille()
      .then((r) => {
        if (!annule) setResultat(r);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, []);

  const groupes = useMemo(() => resultat?.groupes ?? [], [resultat]);
  const courant: GroupeVille | null = groupes.find((g) => g.ville === selection) ?? null;

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const liste: MarqueurCarte[] = groupes.map((g) => ({
      id: g.ville,
      lat: g.lat,
      lng: g.lng,
      couleur: selection === g.ville ? '#F59E0B' : BLEU,
      compteur: g.offres.length,
      libelle: g.ville,
    }));
    if (position) liste.push({ id: 'moi', lat: position.latitude, lng: position.longitude, couleur: '#10B981', rayon: 8, halo: true, libelle: 'Vous êtes ici' });
    return liste;
  }, [groupes, selection, position]);

  const origine = position ?? DAKAR;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        <View className="px-4 pt-3 pb-2">
          <Text className="text-[20px] font-black text-[#1A1A1A]">Autour de moi</Text>
          <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.55)' }}>
            {resultat === null
              ? erreur
                ? 'Impossible de charger les offres.'
                : 'Chargement…'
              : `${totalEntreprises} entreprise${totalEntreprises > 1 ? 's' : ''} recrutent · ${totalOffres} offre${totalOffres > 1 ? 's' : ''} dans ${groupes.length} ville${groupes.length > 1 ? 's' : ''}`}
          </Text>
        </View>

        <View className="mx-4 overflow-hidden" style={{ height: courant ? 250 : 380, borderRadius: 20, backgroundColor: '#1b2330' }}>
          <CarteLeaflet
            centre={{ lat: origine.latitude, lng: origine.longitude }}
            zoom={7}
            sombre
            marqueurs={marqueurs}
            ajuster={!selection}
            onMarqueur={(id) => {
              if (id === 'moi') return;
              setSelection(id);
            }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {resultat === null && !erreur ? (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator color={BLEU} />
            </View>
          ) : null}
        </View>

        <Text className="px-5 mt-2 text-[11px]" style={{ color: 'rgba(0,0,0,0.45)' }}>
          Position approximative : le centre de chaque ville.
          {resultat && resultat.sansVille > 0 ? ` ${resultat.sansVille} offre${resultat.sansVille > 1 ? 's' : ''} ouverte${resultat.sansVille > 1 ? 's' : ''} sur tout le Sénégal (ville non précisée).` : ''}
        </Text>

        {courant ? (
          <View className="flex-1 mt-2">
            <View className="flex-row items-center justify-between px-5 pb-2">
              <Text className="text-[15px] font-black text-[#1A1A1A]">
                {courant.ville} · {courant.offres.length} offre{courant.offres.length > 1 ? 's' : ''} · {courant.entreprises} entreprise{courant.entreprises > 1 ? 's' : ''}
              </Text>
              <Pressable onPress={() => setSelection(null)} accessibilityLabel="Fermer la liste" hitSlop={8}>
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </Pressable>
            </View>
            <FlatList
              data={courant.offres}
              keyExtractor={(o) => o.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push(`/offre/${item.id}` as Href)}
                  className="bg-white flex-row items-center gap-3 px-4 py-3"
                  style={{ borderRadius: 16 }}>
                  <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#E6EEFD' }}>
                    <Ionicons name="business-outline" size={18} color={BLEU} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[13px] font-extrabold" style={{ color: BLEU }} numberOfLines={1}>{item.entreprise}</Text>
                    <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={2}>{item.titre}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
                </Pressable>
              )}
            />
          </View>
        ) : resultat && groupes.length > 0 ? (
          <Text className="text-center text-[13px] mt-4 px-8" style={{ color: 'rgba(0,0,0,0.5)' }}>
            Touche une pastille pour voir les entreprises qui recrutent dans la ville.
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
