import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CarteOffre from '@/components/CarteOffre';
import BoutonAssistantVocal from '@/components/BoutonAssistantVocal';
import FaciliteHeader from '@/components/FaciliteHeader';
import { useAuth } from '@/context/AuthContext';
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

const STORIES_CV = [
  { id: 'moderne', label: 'Moderne', template: 'modern', image: 'https://ffacilite.com/affiche_cv_pro.jpg', gradient: ['#38BDF8', '#2563EB'] },
  { id: 'minimaliste', label: 'Minimaliste', template: 'minimalist', image: 'https://ffacilite.com/affiche_cv_pro.jpg', gradient: ['#34D399', '#059669'] },
  { id: 'classique', label: 'Classique', template: 'classic', image: 'https://ffacilite.com/affiche_cv_pro.jpg', gradient: ['#A78BFA', '#7C3AED'] },
  { id: 'canadien', label: 'Canadien', template: 'canadian', image: 'https://ffacilite.com/affiche_cv_pro.jpg', gradient: ['#F87171', '#DC2626'] },
];

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
        <FaciliteHeader />

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
            data={offres}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshing={rafraichissement}
            onRefresh={rechargerFlux}
            onEndReached={chargerPlus}
            onEndReachedThreshold={0.6}
            removeClippedSubviews={false}
            ListHeaderComponent={
              // Modèles de CV, en tête de fil comme sur la maquette : carte
              // blanche, pastilles rondes à anneau coloré, libellés bleus.
              <View
                style={{
                  backgroundColor: CARTE,
                  marginHorizontal: 12,
                  marginTop: 10,
                  marginBottom: 12,
                  borderRadius: 18,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: BORDURE,
                }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                  {STORIES_CV.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => router.push({ pathname: '/web/[cle]', params: { cle: 'creer-cv', template: s.template } })}
                      style={{ alignItems: 'center', gap: 6 }}>
                      <LinearGradient
                        colors={s.gradient as [string, string]}
                        style={{ width: 62, height: 62, borderRadius: 31, padding: 2.5, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                          <Image
                            source={{ uri: s.image }}
                            alt={`Modèle de CV ${s.label}`}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        </View>
                      </LinearGradient>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: BLEU }}>{s.label}</Text>
                    </Pressable>
                  ))}
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

        <BoutonAssistantVocal />
      </SafeAreaView>
    </View>
  );
}
