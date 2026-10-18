import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteLeaflet, { type CommandesCarte, type MarqueurCarte } from '@/components/CarteLeaflet';
import { chargerOffresParVille, type GroupeVille, type ResultatAutour } from '@/lib/offresParVille';
import type { Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';

// « Autour de moi » de Facilité — pas celui de Locaux : ici la carte montre OÙ
// RECRUTENT LES ENTREPRISES. Un rond par ville avec son nombre d'offres ;
// un appui ouvre la liste des offres de cette ville (entreprise + poste).
// Les positions sont celles du CENTRE de chaque ville (les offres n'ont pas de
// GPS précis) et l'écran le dit. Les offres qui ne citent aucune ville connue
// (« Sénégal ») sont comptées à part.
// Refonte du 18/10/2026 : même présentation que la carte Locaux (carte sombre plein écran, ronds à
// pastille, carrousel de villes en bas), sans regroupement.
const BLEU = '#2563EB';
const VERT = '#10B981';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

const libelleOffres = (n: number) => `${n} offre${n > 1 ? 's' : ''}`;

export default function AutourFaciliteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { position, activer } = useLocalisation();
  const [resultat, setResultat] = useState<ResultatAutour | null>(null);
  const [erreur, setErreur] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [carte, setCarte] = useState<CommandesCarte | null>(null);

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
      couleur: BLEU,
      libelle: g.ville,
      avatar: {
        emoji: String(g.offres.length),
        bordure: selection === g.ville ? '#F59E0B' : BLEU,
        sous: libelleOffres(g.offres.length),
        selectionne: selection === g.ville,
        actif: true,
      },
    }));
    if (position) {
      liste.push({ id: 'moi', lat: position.latitude, lng: position.longitude, couleur: BLEU, halo: true, libelle: 'Vous êtes ici', avatar: { emoji: '🧑🏾', bordure: '#1877F2', moi: true } });
    }
    return liste;
  }, [groupes, selection, position]);

  const origine = position ?? DAKAR;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;

  const choisirVille = (ville: string) => {
    setSelection(ville);
    const g = groupes.find((x) => x.ville === ville);
    if (g) carte?.centrer(g.lat, g.lng, 10, 0.1);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#1b2330' }}>
      <CarteLeaflet
        centre={{ lat: origine.latitude, lng: origine.longitude }}
        zoom={7}
        sombre
        marqueurs={marqueurs}
        ajuster={!selection}
        commandes={setCarte}
        onMarqueur={(id) => {
          if (id === 'moi') return;
          choisirVille(id);
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 14 }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: VERT }}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[17px] font-black text-white">Autour de moi</Text>
            <View className="flex-row items-center gap-1.5">
              <View className="rounded-full" style={{ width: 7, height: 7, backgroundColor: VERT }} />
              <Text className="text-[12px] font-semibold" style={{ color: '#6EE7C9' }} numberOfLines={1}>
                {resultat === null
                  ? erreur
                    ? 'Impossible de charger les offres.'
                    : 'Chargement…'
                  : `${totalEntreprises} entreprise${totalEntreprises > 1 ? 's' : ''} recrutent · ${libelleOffres(totalOffres)} · ${groupes.length} ville${groupes.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {resultat === null && !erreur ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
        {courant ? (
          <View className="rounded-[20px]" style={{ backgroundColor: '#fff', maxHeight: 250 }}>
            <View className="flex-row items-center justify-between px-4 pt-3 pb-1">
              <View className="flex-1 min-w-0">
                <Text className="text-[15px] font-black text-[#1A1A1A]" numberOfLines={1}>{courant.ville}</Text>
                <Text className="text-[12.5px] font-bold" style={{ color: BLEU }}>
                  {libelleOffres(courant.offres.length)} · {courant.entreprises} entreprise{courant.entreprises > 1 ? 's' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelection(null)}
                accessibilityLabel="Fermer la liste"
                hitSlop={8}
                className="items-center justify-center rounded-full"
                style={{ width: 30, height: 30, backgroundColor: '#EFEDE7' }}>
                <Ionicons name="close" size={16} color="#1A1A1A" />
              </Pressable>
            </View>
            <ScrollView nestedScrollEnabled contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, gap: 6 }}>
              {courant.offres.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/offre/${item.id}` as Href)}
                  className="flex-row items-center gap-3 px-3 py-2.5"
                  style={{ borderRadius: 14, backgroundColor: '#F4F2EC' }}>
                  <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#E6EEFD' }}>
                    <Ionicons name="business-outline" size={17} color={BLEU} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[12.5px] font-extrabold" style={{ color: BLEU }} numberOfLines={1}>{item.entreprise}</Text>
                    <Text className="text-[13px] font-bold text-[#1A1A1A]" numberOfLines={1}>{item.titre}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="self-center flex-row items-center gap-2 rounded-full" style={{ backgroundColor: 'rgba(24,119,242,0.96)', paddingHorizontal: 16, paddingVertical: 9, maxWidth: '100%' }}>
          <Ionicons name="briefcase" size={13} color="#fff" />
          <Text className="text-[12px] font-extrabold text-white" numberOfLines={1}>
            {courant
              ? `${courant.entreprises} entreprise${courant.entreprises > 1 ? 's' : ''} recrute${courant.entreprises > 1 ? 'nt' : ''} à ${courant.ville}`
              : resultat && resultat.sansVille > 0
                ? `${libelleOffres(resultat.sansVille)} ouverte${resultat.sansVille > 1 ? 's' : ''} sur tout le Sénégal`
                : 'Position approximative : le centre de chaque ville'}
          </Text>
        </View>

        <View className="rounded-[22px] py-3" style={{ backgroundColor: 'rgba(20,24,33,0.92)', minHeight: 108 }}>
          {groupes.length === 0 ? (
            <Text className="text-center text-[12.5px] py-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {resultat === null ? 'Chargement…' : 'Aucune offre à afficher.'}
            </Text>
          ) : (
            <FlatList
              horizontal
              data={groupes}
              keyExtractor={(g) => g.ville}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => {
                const actif = selection === item.ville;
                return (
                  <Pressable onPress={() => choisirVille(item.ville)} className="items-center" style={{ width: 76 }}>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: actif ? 64 : 56, height: actif ? 64 : 56, backgroundColor: BLEU, borderWidth: actif ? 3 : 2, borderColor: actif ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                      <Text className="text-[20px] font-black text-white">{item.offres.length}</Text>
                    </View>
                    <Text className="text-[11.5px] font-bold text-white mt-1.5 text-center" numberOfLines={1}>{item.ville}</Text>
                    <Text className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)' }} numberOfLines={1}>{libelleOffres(item.offres.length)}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
