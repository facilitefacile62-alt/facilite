import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CarteOffre from '@/components/CarteOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import StoryViewer from '@/components/StoryViewer';
import { useAuth } from '@/context/AuthContext';
import { surRemontee } from '@/lib/remonterFil';
import { useStoriesVues } from '@/lib/storiesVues';
import { chargerStories, type Story } from '@/lib/stories';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles } from '@/lib/useOffresReelles';

// Accueil / fil d'actualité — maquette « Accueil » (01).
//
// L'écran était rendu en thème sombre (#0B0E14, cartes #111622) alors que
// la maquette le montre sur le fond crème #F2F0EA avec des cartes blanches,
// nom d'entreprise en bleu et texte noir. Tout le reste de la logique
// (pagination, tirer pour actualiser, score de matching) est inchangé.
//
// La bannière verte « MARKETPLACE — Achetez et vendez près de chez vous »
// a été retirée du fil : elle n'est sur aucune maquette, et la plateforme
// Marketplace reste atteignable par le menu de l'en-tête, comme le prévoit
// la charte §3 et comme le montre la maquette « Menu profil » (10).
const FOND_PAGE = '#F2F0EA';
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const BLEU = '#2563EB';
const TEXTE = '#1A1A1A';
const TEXTE_DOUX = 'rgba(0,0,0,0.5)';

// Offres chargées par page : la base en compte plus d'une centaine (134 le
// 23/09/2026) — sans pagination, l'Accueil n'en montrait que les 30 plus
// récentes, sans aucun moyen d'atteindre les autres (constaté par
// l'utilisateur : "je ne vois pas les offres du site").
const PAS_PAGINATION = 30;

export default function AccueilScreen() {
  const { user } = useAuth();
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const { offres, erreur, recharger } = useOffresReelles(limite);
  const [rafraichissement, setRafraichissement] = useState(false);
  const candidateMatchScores = useCandidateMatchScores(user?.id);
  const router = useRouter();
  const listeRef = useRef<FlatList>(null);
  // Flèche rouge du bouton « + » : remonte en haut du fil par un défilement doux.
  useEffect(() => surRemontee(() => listeRef.current?.scrollToOffset({ offset: 0, animated: true })), []);

  // Stories gérées depuis l'admin du site (table stories). Tant qu'il n'y en a
  // aucune, le carrousel des modèles de CV reste affiché.
  const [stories, setStories] = useState<Story[]>([]);
  const [storyOuverte, setStoryOuverte] = useState<number | null>(null);
  const vues = useStoriesVues();
  // Quand le fil a défilé au-delà de la rangée, les stories NON VUES passent en petits cercles près du logo.
  const [rangeeHors, setRangeeHors] = useState(false);
  // La rangée met les stories NON VUES en premier. L'ordre est recalculé quand le lecteur est fermé, jamais pendant
  // qu'il est ouvert (une story qui passe en « vue » ne doit pas changer de place sous le lecteur).
  const [rangee, setRangee] = useState<Story[]>([]);
  useEffect(() => {
    if (storyOuverte !== null) return;
    const ordonnee = [...stories.filter((s) => !vues.has(s.id)), ...stories.filter((s) => vues.has(s.id))];
    queueMicrotask(() => setRangee(ordonnee));
  }, [stories, vues, storyOuverte]);
  const nonVues = rangee.map((s, index) => ({ id: s.id, imageUrl: s.imageUrl, titre: s.titre, index })).filter((s) => !vues.has(s.id));
  useEffect(() => {
    let annule = false;
    chargerStories().then((liste) => {
      if (!annule) setStories(liste);
    });
    return () => {
      annule = true;
    };
  }, []);

  // Une page pleine (autant d'offres que demandées) signale qu'il peut en
  // rester : on n'en redemande qu'une fois la page précédente arrivée, ce qui
  // évite les demandes en rafale quand onEndReached se déclenche plusieurs fois.
  const peutChargerPlus = offres !== null && offres.length >= limite;
  const chargerPlus = () => {
    if (peutChargerPlus) setLimite((n) => n + PAS_PAGINATION);
  };

  // Tirer pour actualiser relit VRAIMENT la base (l'ancien code appelait
  // setLimite((n) => n), un no-op : rien n'était rechargé). Le voyant s'arrête
  // dès qu'une nouvelle réponse (offres ou erreur) est arrivée.
  const rechargerFlux = () => {
    setRafraichissement(true);
    recharger();
  };
  useEffect(() => {
    // setState différé : corps d'un effet, pas un callback d'un système externe.
    queueMicrotask(() => setRafraichissement(false));
  }, [offres, erreur]);

  return (
    <View style={{ flex: 1, backgroundColor: FOND_PAGE }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FaciliteHeader petitesStories={rangeeHors ? nonVues : []} onStory={() => setStoryOuverte(nonVues[0]?.index ?? 0)} />

        {offres === null && !erreur ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={BLEU} size="large" />
            <Text style={{ fontSize: 13, color: TEXTE_DOUX, fontWeight: '600', marginTop: 12 }}>
              Chargement des offres en direct…
            </Text>
          </View>
        ) : offres === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="cloud-offline-outline" size={36} color="rgba(0,0,0,0.3)" />
            <Text style={{ fontSize: 13.5, color: TEXTE_DOUX, fontWeight: '500', marginTop: 12, textAlign: 'center' }}>
              Impossible de charger les offres pour le moment.
            </Text>
            <Pressable
              onPress={rechargerFlux}
              style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, backgroundColor: BLEU }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listeRef}
            data={offres}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshing={rafraichissement}
            onRefresh={rechargerFlux}
            onScroll={(e) => {
              const dehors = e.nativeEvent.contentOffset.y > 120;
              setRangeeHors((v) => (v === dehors ? v : dehors));
            }}
            scrollEventThrottle={32}
            onEndReached={chargerPlus}
            onEndReachedThreshold={0.6}
            removeClippedSubviews={false}
            ListHeaderComponent={
              // Rangée des stories (maquette 08) : cercles avec photo, anneau VERT tant que la story n'est pas vue,
              // GRIS une fois vue ; pas de « Ma story » ni d'« Ajouter une story ». Elle disparaît au défilement
              // (les non vues passent près du logo, voir l'en-tête).
              rangee.length === 0 ? null : <View style={{ marginHorizontal: 0, marginTop: 6, marginBottom: 6, paddingVertical: 6 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 14 }}>
                  {rangee.map((st, i) => {
                    const vue = vues.has(st.id);
                    return (
                      <Pressable key={st.id} onPress={() => setStoryOuverte(i)} accessibilityLabel={`Story : ${st.titre}`} style={{ alignItems: 'center', gap: 6, width: 70 }}>
                        <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: vue ? '#C4C4C4' : '#10E688', padding: 2, backgroundColor: 'transparent' }}>
                          <View style={{ flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                            <Image source={{ uri: st.imageUrl }} alt={st.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          </View>
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '600', color: '#374151' }}>{st.titre}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              <View
                style={{
                  backgroundColor: CARTE,
                  marginHorizontal: 12,
                  borderRadius: 18,
                  padding: 32,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: BORDURE,
                }}>
                <Ionicons name="briefcase-outline" size={36} color="rgba(0,0,0,0.25)" />
                <Text style={{ fontSize: 13, color: TEXTE_DOUX, fontWeight: '600', marginTop: 8 }}>
                  Aucune offre active pour l&apos;instant.
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => <CarteOffre offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />}
            ListFooterComponent={
              offres.length > 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 }}>
                  {peutChargerPlus ? (
                    <>
                      <ActivityIndicator color={BLEU} size="small" />
                      <Text style={{ color: TEXTE_DOUX, fontSize: 12, fontWeight: '600' }}>Chargement de nouvelles offres…</Text>
                    </>
                  ) : (
                    <Text style={{ color: TEXTE_DOUX, fontSize: 12, fontWeight: '600' }}>
                      {offres.length} offre{offres.length > 1 ? 's' : ''} disponible{offres.length > 1 ? 's' : ''} en direct
                    </Text>
                  )}
                </View>
              ) : null
            }
          />
        )}

      </SafeAreaView>

      {storyOuverte !== null && rangee.length > 0 ? (
        <StoryViewer stories={rangee} debut={storyOuverte} onFermer={() => setStoryOuverte(null)} />
      ) : null}
    </View>
  );
}
