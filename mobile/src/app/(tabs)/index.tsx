import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import BoutonAssistantVocal from '@/components/BoutonAssistantVocal';
import FaciliteHeader from '@/components/FaciliteHeader';
import OfferMediaView from '@/components/OfferMediaView';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';

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

function CarteOffre({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  const router = useRouter();
  const [aime, setAime] = useState(false);
  const [descriptionEtendue, setDescriptionEtendue] = useState(false);
  const [logoErreur, setLogoErreur] = useState(false);

  const partager = async () => {
    try {
      const url = `https://ffacilite.com/offres/${offre.id}`;
      await Share.share({
        title: offre.titre,
        message: `Découvrez cette opportunité sur Facilité :\n${offre.titre} chez ${offre.entreprise} (${offre.localisation})\n\nPostulez ici : ${url}`,
        url,
      });
    } catch {}
  };

  const ouvrirPostuler = () => {
    if (offre.externalLink && (offre.externalLink.startsWith('http://') || offre.externalLink.startsWith('https://'))) {
      Linking.openURL(offre.externalLink).catch(() => {
        router.push(`/offre/${offre.id}`);
      });
    } else {
      router.push(`/offre/${offre.id}`);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/offre/${offre.id}`)}
      style={{
        backgroundColor: CARTE,
        marginHorizontal: 12,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDURE,
      }}>
      {/* 1. EN-TÊTE DE LA CARTE : logo entreprise + nom (bleu) + date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {offre.posterUri && !logoErreur ? (
          <Image
            source={{ uri: offre.posterUri }}
            alt={offre.entreprise}
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#E8E4DA' }}
            contentFit="cover"
            transition={150}
            onError={() => setLogoErreur(true)}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#E8E4DA',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: 'rgba(0,0,0,0.55)', fontWeight: '800', fontSize: 14 }}>{offre.logoInitiales}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: BLEU }} numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ fontSize: 11.5, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.dateFormatee || offre.date}</Text>
            <Text style={{ color: 'rgba(0,0,0,0.3)', fontSize: 10 }}>·</Text>
            <Ionicons name="globe-outline" size={11} color="rgba(0,0,0,0.4)" />
          </View>
        </View>
      </View>

      {/* 2. MATCHING IA */}
      {matchScore !== null && (
        <View style={{ marginTop: 10 }}>
          <BadgeMatchingOffre score={matchScore} />
        </View>
      )}

      {/* 3. TITRE DU POSTE */}
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: TEXTE, lineHeight: 22, marginTop: 10 }}>{offre.titre}</Text>

      {/* 4. LOCALISATION, SECTEUR, CONTRAT & DATE LIMITE */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <Ionicons name="briefcase-outline" size={12} color="rgba(0,0,0,0.45)" />
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.localisation}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.sector || 'Opportunité'}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
        <Text style={{ fontSize: 12, color: TEXTE_DOUX, fontWeight: '500' }}>{offre.contrat}</Text>
        {offre.deadline && (
          <>
            <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>·</Text>
            <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '800' }}>
              Limite : {new Date(offre.deadline).toLocaleDateString('fr-FR')}
            </Text>
          </>
        )}
      </View>

      {/* 5. DESCRIPTION AVEC VOIR PLUS */}
      {offre.description && (
        <View style={{ marginTop: 8 }}>
          <Text numberOfLines={descriptionEtendue ? undefined : 3} style={{ fontSize: 13, color: 'rgba(0,0,0,0.78)', lineHeight: 19 }}>
            {offre.description}
          </Text>
          {offre.description.length > 120 && (
            <Pressable onPress={() => setDescriptionEtendue(!descriptionEtendue)} style={{ marginTop: 4 }}>
              <Text style={{ color: BLEU, fontSize: 12, fontWeight: '700' }}>
                {descriptionEtendue ? 'Voir moins' : '...Voir plus'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 6. AFFICHE RÉELLE DE L'OFFRE */}
      <OfferMediaView media={offre.rawImage || offre.posterUri} dark={false} onPress={() => router.push(`/offre/${offre.id}`)} />

      {/* 7. PIED : candidats */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 2 }}>
        <Ionicons name="people-outline" size={14} color="rgba(0,0,0,0.4)" />
        <Text style={{ color: TEXTE_DOUX, fontSize: 12, fontWeight: '600' }}>
          {offre.viewCount && offre.viewCount > 0 ? `${offre.viewCount} personnes intéressées` : '0 personne a postulé'}
        </Text>
      </View>

      {/* 8. ACTIONS — maquette 01 : J'aime, partager, puis le bouton bleu.
          Le signet n'y figure pas (il est sur la fiche offre, maquette 07). */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <Pressable
          onPress={() => setAime(!aime)}
          accessibilityLabel="J'aime"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: aime ? '#EF4444' : 'rgba(0,0,0,0.08)',
            backgroundColor: aime ? 'rgba(239,68,68,0.1)' : '#F5F3EE',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={aime ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={aime ? '#EF4444' : 'rgba(0,0,0,0.55)'} />
        </Pressable>

        <Pressable
          onPress={partager}
          accessibilityLabel="Partager"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.08)',
            backgroundColor: '#F5F3EE',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="share-social-outline" size={18} color="rgba(0,0,0,0.55)" />
        </Pressable>

        <Pressable
          onPress={ouvrirPostuler}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            backgroundColor: BLEU,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: 12,
          }}>
          <Ionicons name={offre.externalLink ? 'open-outline' : 'paper-plane'} size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
            {offre.externalLink ? 'Postuler sur le site officiel' : 'Postuler via Facilité'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
