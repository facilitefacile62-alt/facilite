import { contientTousLesMots } from '@/lib/texte';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteLeaflet, { type CommandesCarte, type MarqueurCarte, type PopupBoutique } from '@/components/CarteLeaflet';
import { chargerBoutiquesCarte, type BoutiqueCarte } from '@/lib/boutiquesCarte';
import { chargerArticles, distanceLisible, prixLisible, type ArticleMarketplace, type Position } from '@/lib/marketplace';
import { dataUriAvatarBoutique, svgAvatarBoutique } from '@/lib/avatarBoutique';
import { SvgXml } from 'react-native-svg';
import { calculerItineraire, type Itineraire } from '@/lib/itineraire';
import { useLocalisation } from '@/lib/useLocalisation';
import { useMarketplaceArticles } from '@/lib/useMarketplaceArticles';

// « Marketplace — Autour de moi » (maquette 21) : carte sombre plein écran
// avec les boutiques, « Vous êtes ici », recherche, commandes de carte à
// droite, et en bas un carrousel Boutiques / Articles.
//
// Refonte du 18/10/2026 : la carte reprend le design de la carte « Locaux » du site (avatars Bitmoji
// dans un anneau avec la pastille « ● Nom · Quartier », filtres Toutes / Les plus visités / En stock
// (LIVE) / Autour de moi, boutons ronds, pastille bleue « … est ouvert à … », carrousel d'avatars).
// Un tap sur une boutique la FIXE : les autres boutiques disparaissent de la carte tant que son aperçu
// est ouvert, et reviennent à sa fermeture.
// Non reproduit, car sans donnée réelle : la météo à côté de la ville (« ☾ 30°C » est une valeur écrite
// en dur sur le site) ; « Les plus visités » reprend la règle du site (la première moitié des boutiques,
// triées par proximité) faute de compteur de visites ; « est ouvert à » est le texte du site, sans
// calcul d'horaires. Le compteur « N membres & boutiques » est le vrai nombre de boutiques affichées.
const VERT = '#10B981';
const BLEU = '#2563EB';
const CREME_RECHERCHE = '#EAE3D2';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

type Onglet = 'boutiques' | 'articles';
type Filtre = 'tous' | 'populaires' | 'live';

// Avatars de repli quand la boutique n'a pas encore créé son Bitmoji (mêmes emojis que le site).
const EMOJIS_REPLI = ['👩🏾‍🦱', '👨🏾‍💼', '👩🏾‍💼', '🧑🏾‍💻', '🧕🏾', '🧢'];

export default function AutourDeMoiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { etat, position, activer } = useLocalisation();
  const [boutiques, setBoutiques] = useState<BoutiqueCarte[] | null>(null);
  // Onglet de départ choisi par la ligne « Autour de moi » (Articles proches / Pleine carte).
  const { onglet: ongletParam, boutique: boutiqueParam, route: routeParam } = useLocalSearchParams<{ onglet?: string; boutique?: string; route?: string }>();
  const [onglet, setOnglet] = useState<Onglet>(ongletParam === 'articles' ? 'articles' : 'boutiques');
  // Un nouvel appui sur « Articles proches » / « Pleine carte » change le paramètre : on suit.
  const [paramVu, setParamVu] = useState(ongletParam);
  if (ongletParam !== paramVu) {
    setParamVu(ongletParam);
    if (ongletParam === 'articles' || ongletParam === 'boutiques') setOnglet(ongletParam);
  }
  const [filtre, setFiltre] = useState<Filtre>('tous');
  // Carte sombre (défaut) ou claire : bouton lune des commandes de carte.
  const [sombre, setSombre] = useState(true);
  const champRecherche = useRef<TextInput>(null);
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

  // Recherche d'un produit : photo du premier article trouvé de chaque boutique (affichée sur son rond).
  const photosRecherche = useMemo(() => {
    const m = new Map<string, string>();
    if (!recherche.trim()) return m;
    (articles ?? []).forEach((a) => {
      if (a.boutiqueId && !m.has(a.boutiqueId)) m.set(a.boutiqueId, a.photos[0] ?? '');
    });
    return m;
  }, [articles, recherche]);

  const visibles = useMemo(() => {
    const q = recherche.trim();
    if (!boutiques) return [];
    // Mêmes règles que la carte du site : « Les plus visités » = la première moitié (au moins 3) ;
    // « En stock (LIVE) » = les boutiques qui ont au moins un article en stock.
    let base = boutiques;
    if (filtre === 'live') base = boutiques.filter((b) => b.enStock);
    else if (filtre === 'populaires') base = boutiques.slice(0, Math.max(3, Math.ceil(boutiques.length / 2)));
    if (!q) return base;
    // Une boutique reste visible si son nom OU l'un de ses articles correspond à la recherche.
    return base.filter((b) => contientTousLesMots(`${b.nom} ${b.quartier ?? ''} ${b.ville ?? ''}`, q) || photosRecherche.has(b.id));
  }, [boutiques, recherche, filtre, photosRecherche]);

  // Avatar de chaque boutique : son Bitmoji (DiceBear, calculé sur l'appareil) ou, à défaut, un emoji.
  const avatars = useMemo(() => {
    const m = new Map<string, { uri?: string; xml?: string; emoji: string }>();
    (boutiques ?? []).forEach((b, i) => {
      let uri: string | undefined;
      let xml: string | undefined;
      if (b.avatarConfig) {
        try {
          uri = dataUriAvatarBoutique(b.avatarConfig, 104);
          xml = svgAvatarBoutique(b.avatarConfig, 104);
        } catch {
          uri = undefined;
        }
      }
      m.set(b.id, { uri, xml, emoji: EMOJIS_REPLI[i % EMOJIS_REPLI.length] });
    });
    return m;
  }, [boutiques]);

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const liste: MarqueurCarte[] = visibles.map((b) => ({
      id: b.id,
      lat: b.latitude,
      lng: b.longitude,
      couleur: VERT,
      libelle: b.nom,
      avatar: {
        uri: avatars.get(b.id)?.uri,
        photo: photosRecherche.get(b.id) || undefined,
        emoji: avatars.get(b.id)?.emoji,
        bordure: b.verifie ? BLEU : VERT,
        sous: b.quartier || b.ville || 'Dakar',
        selectionne: selection === b.id,
        actif: b.enStock,
      },
    }));
    if (position) {
      liste.push({
        id: 'moi',
        lat: position.latitude,
        lng: position.longitude,
        couleur: BLEU,
        halo: true,
        libelle: 'Vous êtes ici',
        avatar: { emoji: '🧑🏾', bordure: '#1877F2', moi: true },
      });
    }
    return liste;
  }, [visibles, position, selection, avatars, photosRecherche]);

  const origine = position ?? DAKAR;
  const centre = { lat: origine.latitude, lng: origine.longitude };

  const choisirBoutique = useCallback(
    (id: string, zoom = 15) => {
      if (id === 'moi') return;
      setSelection(id);
      const b = boutiques?.find((x) => x.id === id);
      // Remonte la boutique à l'écran : l'aperçu de ses articles occupe le bas et la cacherait.
      if (b) carte?.centrer(b.latitude, b.longitude, zoom, -0.07);
    },
    [boutiques, carte]
  );

  // Arrivée depuis « M'y rendre » d'un article : la boutique est sélectionnée dès que les boutiques sont chargées.
  const boutiqueOuverte = useRef<string | null>(null);
  useEffect(() => {
    if (!boutiqueParam || !boutiques || !carte || boutiqueOuverte.current === boutiqueParam) return;
    if (!boutiques.some((b) => b.id === boutiqueParam)) return;
    boutiqueOuverte.current = boutiqueParam;
    // Avec « M'y rendre », la carte se cadre sur le trajet (voir plus bas) : pas de recentrage sur la boutique seule.
    queueMicrotask(() => (routeParam ? setSelection(boutiqueParam) : choisirBoutique(boutiqueParam, 16)));
  }, [boutiqueParam, routeParam, boutiques, carte, choisirBoutique]);

  // Trajet de « M'y rendre » : ligne bleue de ma position à la boutique, avec distance et durée.
  const [trajet, setTrajet] = useState<Itineraire | null>(null);
  const trajetCalcule = useRef<string | null>(null);
  useEffect(() => {
    if (!routeParam || !boutiqueParam || !position || !boutiques || trajetCalcule.current === boutiqueParam) return;
    const b = boutiques.find((x) => x.id === boutiqueParam);
    if (!b) return;
    trajetCalcule.current = boutiqueParam;
    calculerItineraire(position, { latitude: b.latitude, longitude: b.longitude }).then(setTrajet);
  }, [routeParam, boutiqueParam, position, boutiques]);

  // Un appui sélectionne la boutique et ouvre l'aperçu fixe ; un second appui
  // sur la même boutique dans les 320 ms (pastille de la carte, carrousel ou
  // nom dans l'aperçu) ouvre la page de la boutique.
  const dernierAppui = useRef<{ id: string; t: number } | null>(null);
  const toucherBoutique = useCallback(
    (id: string) => {
      if (id === 'moi') return;
      const maintenant = Date.now();
      const precedent = dernierAppui.current;
      if (precedent && precedent.id === id && maintenant - precedent.t < 320) {
        dernierAppui.current = null;
        router.push(`/marketplace/boutique/${id}` as Href);
        return;
      }
      dernierAppui.current = { id, t: maintenant };
      choisirBoutique(id);
    },
    [choisirBoutique, router]
  );

  // Appui sur la carte : une boutique, ou une pastille de groupe (« groupe:id1,id2 »,
  // seulement pour des boutiques situées exactement au même endroit).
  const surMarqueur = useCallback(
    (id: string) => {
      if (id === 'fermer') {
        setSelection(null);
        return;
      }
      if (id === 'boutique') {
        if (selection) router.push(`/marketplace/boutique/${selection}` as Href);
        return;
      }
      if (id.startsWith('article:')) {
        router.push(`/marketplace/${id.slice(8)}` as Href);
        return;
      }
      if (id.startsWith('groupe:')) {
        const premier = id.slice(7).split(',')[0];
        if (premier) choisirBoutique(premier, 18);
        return;
      }
      toucherBoutique(id);
    },
    [choisirBoutique, toucherBoutique, router, selection]
  );

  // Articles de la boutique sélectionnée, pour l'aperçu fixe.
  const [articlesSel, setArticlesSel] = useState<{ id: string; liste: ArticleMarketplace[] } | null>(null);
  useEffect(() => {
    if (!selection) return;
    let annule = false;
    chargerArticles({ boutiqueId: selection, limite: 20 })
      .then((liste) => {
        if (!annule) setArticlesSel({ id: selection, liste });
      })
      .catch(() => {
        if (!annule) setArticlesSel({ id: selection, liste: [] });
      });
    return () => {
      annule = true;
    };
  }, [selection]);
  const boutiqueSel = selection ? boutiques?.find((b) => b.id === selection) ?? null : null;

  // Bulle d'aperçu posée au-dessus du rond de la boutique fixée (même présentation que sur le site).
  const popup = useMemo<PopupBoutique | null>(() => {
    if (!boutiqueSel) return null;
    return {
      cle: boutiqueSel.id,
      lat: boutiqueSel.latitude,
      lng: boutiqueSel.longitude,
      titre: boutiqueSel.nom,
      sous: boutiqueSel.quartier || boutiqueSel.ville || 'Sénégal',
      articles:
        articlesSel?.id === boutiqueSel.id
          ? articlesSel.liste.map((a) => ({ id: a.id, titre: a.titre, prix: `${prixLisible(a.prixXof)} F`, photo: a.photos[0] }))
          : null,
    };
  }, [boutiqueSel, articlesSel]);

  const lancerRecherche = () => setRecherche(saisie);

  return (
    <View className="flex-1" style={{ backgroundColor: '#1b2330' }}>
      <CarteLeaflet
        centre={centre}
        zoom={13}
        marqueurs={marqueurs}
        sombre={sombre}
        ajuster={!selection}
        focus={selection}
        popup={popup}
        trajet={trajet ? { points: trajet.points, approximatif: trajet.approximatif } : null}
        onMarqueur={surMarqueur}
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
            ref={champRecherche}
            value={saisie}
            onChangeText={setSaisie}
            onSubmitEditing={lancerRecherche}
            returnKeyType="search"
            placeholder="Rechercher un article, une boutique..."
            placeholderTextColor="rgba(0,0,0,0.45)"
            className="flex-1 text-[13.5px] text-[#1A1A1A]"
          />
          {/* Recherche par photo : retirée de l'application pour le moment (fonctions IA en pause). */}
          <Pressable
            onPress={lancerRecherche}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-[14px]"
            style={{ height: 40, paddingHorizontal: 14, backgroundColor: VERT }}>
            <Ionicons name="search" size={15} color="#fff" />
            <Text className="text-white text-[13.5px] font-black">Rechercher</Text>
          </Pressable>
        </View>

        {/* Filtres, comme sur le site : Toutes les boutiques · Les plus visités · En stock (LIVE) · Autour de moi */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 14 }}>
          {([
            { id: 'tous', libelle: 'Toutes les boutiques', icone: 'compass' as const, couleur: BLEU },
            { id: 'populaires', libelle: 'Les plus visités', icone: 'trophy' as const, couleur: '#F59E0B' },
            { id: 'live', libelle: 'En stock (LIVE)', icone: null, couleur: VERT },
          ] as const).map((f) => {
            const actif = filtre === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  setFiltre(f.id);
                  setSelection(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                className="flex-row items-center gap-1.5 rounded-full"
                style={{
                  height: 38,
                  paddingHorizontal: 14,
                  backgroundColor: actif ? '#fff' : 'rgba(20,24,33,0.92)',
                  borderWidth: actif ? 0 : 1,
                  borderColor: 'rgba(75,85,99,0.8)',
                }}>
                {f.icone ? (
                  <Ionicons name={f.icone} size={14} color={f.couleur} />
                ) : (
                  <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: f.couleur }} />
                )}
                <Text className="text-[12.5px] font-black" style={{ color: actif ? '#1A1A1A' : '#fff' }}>{f.libelle}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => position && carte?.centrer(position.latitude, position.longitude, 15)}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-full"
            style={{ height: 38, paddingHorizontal: 14, backgroundColor: 'rgba(20,24,33,0.92)', borderWidth: 1, borderColor: 'rgba(75,85,99,0.8)' }}>
            <Ionicons name="locate" size={14} color="#34D399" />
            <Text className="text-[12.5px] font-black text-white">Autour de moi</Text>
          </Pressable>
        </ScrollView>

        {etat === 'refusee' || etat === 'erreur' ? (
          <Pressable onPress={() => activer()} className="self-start rounded-full px-3.5 py-2" style={{ backgroundColor: '#fff' }}>
            <Text className="text-[12px] font-bold text-[#1A1A1A]">📍 Activer ma position pour voir les boutiques proches</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Commandes de carte */}
      <View style={{ position: 'absolute', right: 14, top: insets.top + 196, gap: 10 }}>
        {[
          { icone: 'locate' as const, nom: 'Recentrer', action: () => position && carte?.centrer(position.latitude, position.longitude, 15), couleur: BLEU },
          { icone: (sombre ? 'moon' : 'sunny') as 'moon' | 'sunny', nom: sombre ? 'Carte claire' : 'Carte sombre', action: () => setSombre((v) => !v), couleur: '#FBBF24' },
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
        {/* Trajet « M'y rendre » : distance et durée réelles (ligne droite signalée comme approximative) */}
        {trajet ? (
          <View className="self-center flex-row items-center gap-2 rounded-full bg-white" style={{ paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
            <Ionicons name={trajet.profil === 'pieton' ? 'walk' : 'car'} size={16} color="#0284C7" />
            <Text className="text-[12.5px] font-extrabold text-[#1A1A1A]">
              {trajet.approximatif ? 'À vol d’oiseau · ' : ''}
              {trajet.distanceKm.toLocaleString('fr-FR')} km{trajet.dureeMin != null ? ` · ${trajet.dureeMin} min` : ''}
            </Text>
            <Pressable onPress={() => setTrajet(null)} accessibilityLabel="Effacer le trajet" hitSlop={8} className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: '#EFEDE7' }}>
              <Ionicons name="close" size={15} color="#1A1A1A" />
            </Pressable>
          </View>
        ) : null}
        {/* Pastille d'information (texte du site) */}
        <View className="self-center flex-row items-center gap-2 rounded-full" style={{ backgroundColor: 'rgba(24,119,242,0.96)', paddingHorizontal: 16, paddingVertical: 9, maxWidth: '100%' }}>
          <Ionicons name="storefront" size={13} color="#fff" />
          <Text className="text-[12px] font-extrabold text-white" numberOfLines={1}>
            {boutiqueSel
              ? `${boutiqueSel.nom} est ouvert à ${boutiqueSel.quartier || 'Dakar'}`
              : `${visibles.length} boutique${visibles.length > 1 ? 's' : ''} vérifiée${visibles.length > 1 ? 's' : ''} prête${visibles.length > 1 ? 's' : ''} à vous servir au Sénégal`}
          </Text>
        </View>
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
                    <Pressable onPress={() => toucherBoutique(item.id)} className="items-center" style={{ width: 76 }}>
                      <View
                        className="items-center justify-center rounded-full overflow-hidden"
                        style={{ width: actif ? 64 : 56, height: actif ? 64 : 56, backgroundColor: '#111827', borderWidth: actif ? 3 : 2, borderColor: actif ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                        {photosRecherche.get(item.id) ? (
                          <Image source={{ uri: photosRecherche.get(item.id) }} alt={item.nom} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : avatars.get(item.id)?.xml ? (
                          <SvgXml xml={avatars.get(item.id)!.xml!} width="100%" height="100%" />
                        ) : (
                          <Text className="text-[24px]">{avatars.get(item.id)?.emoji ?? '🏪'}</Text>
                        )}
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
