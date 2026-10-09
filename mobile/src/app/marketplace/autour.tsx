import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteLeaflet, { type CommandesCarte, type MarqueurCarte } from '@/components/CarteLeaflet';
import { chargerBoutiquesCarte, type BoutiqueCarte } from '@/lib/boutiquesCarte';
import { distanceLisible, prixLisible, type ArticleMarketplace, type Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';
import { useMarketplaceArticles } from '@/lib/useMarketplaceArticles';

// « Marketplace — Autour de moi » (maquette 21) : carte sombre plein écran
// avec les boutiques, « Vous êtes ici », recherche, commandes de carte à
// droite, et en bas un carrousel Boutiques / Articles.
//
// Ce que la maquette montre et que l'on ne reproduit pas, faute de donnée :
// - la météo à côté de la ville (« ☾ 30°C ») : aucune source météo n'existe ;
// - le filtre « Les plus visités » : aucun compteur de visites par boutique ;
// - le bandeau « … est ouvert à Dakar » : il suppose un calcul d'ouverture à
//   l'instant T que les boutiques de produits n'ont pas (pas d'horaires).
// Le compteur « N membres & boutiques » est, lui, le vrai nombre de boutiques
// actives affichées.
const VERT = '#10B981';
const BLEU = '#2563EB';
const CREME_RECHERCHE = '#EAE3D2';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

type Onglet = 'boutiques' | 'articles';

export default function AutourDeMoiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { etat, position, activer } = useLocalisation();
  const [boutiques, setBoutiques] = useState<BoutiqueCarte[] | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('boutiques');
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState<string | null>(null);
  // Commandes impératives de la carte (recentrer, zoom) : en état plutôt qu'en
  // ref, pour pouvoir les lire dans les gestionnaires posés pendant le rendu.
  const [carte, setCarte] = useState<CommandesCarte | null>(null);
  const { articles } = useMarketplaceArticles(null, recherche, position);

  // La position est demandée à l'ouverture : l'écran n'a pas de sens sans elle.
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

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!boutiques) return [];
    if (!q) return boutiques;
    return boutiques.filter((b) => `${b.nom} ${b.quartier ?? ''} ${b.ville ?? ''}`.toLowerCase().includes(q));
  }, [boutiques, recherche]);

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const liste: MarqueurCarte[] = visibles.map((b) => ({
      id: b.id,
      lat: b.latitude,
      lng: b.longitude,
      couleur: selection === b.id ? '#F59E0B' : VERT,
      rayon: selection === b.id ? 12 : 9,
      libelle: b.nom,
    }));
    if (position) {
      liste.push({ id: 'moi', lat: position.latitude, lng: position.longitude, couleur: BLEU, rayon: 9, halo: true, libelle: 'Vous êtes ici' });
    }
    return liste;
  }, [visibles, position, selection]);

  const origine = position ?? DAKAR;
  const centre = { lat: origine.latitude, lng: origine.longitude };

  const choisirBoutique = useCallback(
    (id: string) => {
      if (id === 'moi') return;
      setSelection(id);
      const b = boutiques?.find((x) => x.id === id);
      if (b) carte?.centrer(b.latitude, b.longitude, 15);
    },
    [boutiques, carte]
  );

  const lancerRecherche = () => setRecherche(saisie);

  return (
    <View className="flex-1" style={{ backgroundColor: '#1b2330' }}>
      <CarteLeaflet
        centre={centre}
        zoom={13}
        marqueurs={marqueurs}
        sombre
        ajuster={!selection}
        onMarqueur={choisirBoutique}
        commandes={setCarte}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* En-tête : titre, nombre réel de boutiques, fermeture */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 14, gap: 10 }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: VERT }}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[17px] font-black text-white">Autour de moi</Text>
            <View className="flex-row items-center gap-1.5">
              <View className="rounded-full" style={{ width: 7, height: 7, backgroundColor: VERT }} />
              <Text className="text-[12px] font-semibold" style={{ color: '#6EE7C9' }}>
                {boutiques === null ? 'Chargement…' : `${boutiques.length} ${boutiques.length > 1 ? 'membres & boutiques' : 'membre & boutique'}`}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace'))}
            accessibilityLabel="Fermer"
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2 rounded-[18px] pl-4 pr-1.5" style={{ height: 52, backgroundColor: CREME_RECHERCHE }}>
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            onSubmitEditing={lancerRecherche}
            returnKeyType="search"
            placeholder="Rechercher un article, une boutique..."
            placeholderTextColor="rgba(0,0,0,0.45)"
            className="flex-1 text-[13.5px] text-[#1A1A1A]"
          />
          <Pressable
            onPress={lancerRecherche}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-[14px]"
            style={{ height: 40, paddingHorizontal: 14, backgroundColor: VERT }}>
            <Ionicons name="search" size={15} color="#fff" />
            <Text className="text-white text-[13.5px] font-black">Rechercher</Text>
          </Pressable>
        </View>

        {etat === 'refusee' || etat === 'erreur' ? (
          <Pressable onPress={() => activer()} className="self-start rounded-full px-3.5 py-2" style={{ backgroundColor: '#fff' }}>
            <Text className="text-[12px] font-bold text-[#1A1A1A]">📍 Activer ma position pour voir les boutiques proches</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Commandes de carte */}
      <View style={{ position: 'absolute', right: 14, top: insets.top + 150, gap: 10 }}>
        {[
          { icone: 'locate' as const, nom: 'Recentrer', action: () => position && carte?.centrer(position.latitude, position.longitude, 15), couleur: BLEU },
          { icone: 'add' as const, nom: 'Zoom avant', action: () => carte?.zoomer(1), couleur: '#fff' },
          { icone: 'remove' as const, nom: 'Zoom arrière', action: () => carte?.zoomer(-1), couleur: '#fff' },
        ].map((c) => (
          <Pressable
            key={c.nom}
            onPress={c.action}
            accessibilityLabel={c.nom}
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: 'rgba(20,24,33,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Ionicons name={c.icone} size={20} color={c.couleur} />
          </Pressable>
        ))}
      </View>

      {/* Bas : onglets Boutiques / Articles, puis le carrousel */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
        <View className="flex-row self-center rounded-full p-1" style={{ backgroundColor: 'rgba(20,24,33,0.9)' }}>
          {(['boutiques', 'articles'] as const).map((o) => {
            const actif = onglet === o;
            return (
              <Pressable
                key={o}
                onPress={() => setOnglet(o)}
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                className="rounded-full items-center justify-center"
                style={{ height: 38, paddingHorizontal: 22, backgroundColor: actif ? '#fff' : 'transparent' }}>
                <Text className="text-[13.5px] font-black" style={{ color: actif ? '#1A1A1A' : 'rgba(255,255,255,0.75)' }}>
                  {o === 'boutiques' ? 'Boutiques' : 'Articles'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="rounded-[22px] py-3" style={{ backgroundColor: 'rgba(20,24,33,0.92)', minHeight: 128 }}>
          {onglet === 'boutiques' ? (
            boutiques === null ? (
              <View className="py-8"><ActivityIndicator color={VERT} /></View>
            ) : visibles.length === 0 ? (
              <Text className="text-center text-[12.5px] py-9" style={{ color: 'rgba(255,255,255,0.6)' }}>Aucune boutique ne correspond.</Text>
            ) : (
              <FlatList
                horizontal
                data={visibles}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
                renderItem={({ item }) => {
                  const actif = selection === item.id;
                  const distance = distanceLisible(item.distanceKm);
                  return (
                    <Pressable onPress={() => choisirBoutique(item.id)} className="items-center" style={{ width: 84 }}>
                      <View
                        className="items-center justify-center rounded-full"
                        style={{ width: 66, height: 66, backgroundColor: '#E4DED2', borderWidth: 3, borderColor: actif ? '#F59E0B' : VERT }}>
                        <Text className="text-[22px] font-black text-[#1A1A1A]">{item.nom.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text className="text-[11.5px] font-bold text-white mt-1.5 text-center" numberOfLines={1}>{item.nom}</Text>
                      <Text className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)' }} numberOfLines={1}>
                        {distance ?? item.quartier ?? item.ville ?? ''}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )
          ) : articles === null ? (
            <View className="py-8"><ActivityIndicator color={VERT} /></View>
          ) : articles.length === 0 ? (
            <Text className="text-center text-[12.5px] py-9" style={{ color: 'rgba(255,255,255,0.6)' }}>Aucun article à proximité.</Text>
          ) : (
            <FlatList
              horizontal
              data={articles.slice(0, 20)}
              keyExtractor={(a) => a.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }: { item: ArticleMarketplace }) => (
                <Pressable onPress={() => router.push(`/marketplace/${item.id}` as Href)} style={{ width: 104 }}>
                  <View className="rounded-[14px] overflow-hidden items-center justify-center" style={{ width: 104, height: 70, backgroundColor: '#E4DED2' }}>
                    {item.photos[0] ? (
                      <Image source={{ uri: item.photos[0] }} alt={item.titre} style={{ width: 104, height: 70 }} contentFit="cover" />
                    ) : (
                      <Ionicons name="image-outline" size={20} color="rgba(0,0,0,0.3)" />
                    )}
                  </View>
                  <Text className="text-[11.5px] font-bold text-white mt-1.5" numberOfLines={1}>{item.titre}</Text>
                  <Text className="text-[11px] font-black" style={{ color: '#FBBF24' }}>{prixLisible(item.prixXof)} FCFA</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}
