import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import OfferMediaView from '@/components/OfferMediaView';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';

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
  const router = useRouter();
  const { user } = useAuth();
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const { offres, erreur, recharger } = useOffresReelles(limite);
  const [rafraichissement, setRafraichissement] = useState(false);
  const candidateMatchScores = useCandidateMatchScores(user?.id);

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
    <View style={{ flex: 1, backgroundColor: '#0B0E14' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FaciliteHeader dark={true} />

        {offres === null && !erreur ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#38BDF8" size="large" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 12 }}>
              Chargement des offres en direct…
            </Text>
          </View>
        ) : offres === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="cloud-offline-outline" size={36} color="rgba(255,255,255,0.4)" />
            <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 12, textAlign: 'center' }}>
              Impossible de charger les offres pour le moment.
            </Text>
            <Pressable
              onPress={rechargerFlux}
              style={{
                marginTop: 16,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 9999,
                backgroundColor: '#2563EB',
              }}>
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
              <View>
                {/* 1. STORIES : MODÈLES CV (Style 1:1 Capture Web) */}
                <View
                  style={{
                    backgroundColor: '#111622',
                    marginHorizontal: 12,
                    marginTop: 10,
                    marginBottom: 12,
                    borderRadius: 18,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: '#1E2638',
                  }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                    {STORIES_CV.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() =>
                          router.push({ pathname: '/web/[cle]', params: { cle: 'creer-cv', template: s.template } })
                        }
                        style={{ alignItems: 'center', gap: 6 }}>
                        <LinearGradient
                          colors={s.gradient as [string, string]}
                          style={{
                            width: 62,
                            height: 62,
                            borderRadius: 31,
                            padding: 2.5,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <View
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 30,
                              overflow: 'hidden',
                              backgroundColor: '#000',
                            }}>
                            <Image
                              source={{ uri: s.image }}
                              alt={`Modèle de CV ${s.label}`}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />
                          </View>
                        </LinearGradient>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#E2E8F0' }}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* 2. BANNIÈRE MARKETPLACE */}
                <Pressable
                  onPress={() => router.push('/marketplace')}
                  style={{ marginHorizontal: 12, marginBottom: 12 }}>
                  <LinearGradient
                    colors={['#0d3b34', '#0f4f42']}
                    style={{
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(110,231,201,0.2)',
                    }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="storefront" size={20} color="#6EE7C9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#6EE7C9', letterSpacing: 0.8 }}>
                        MARKETPLACE
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginTop: 2 }}>
                        Achetez et vendez près de chez vous
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#6EE7C9" />
                  </LinearGradient>
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View
                style={{
                  backgroundColor: '#111622',
                  marginHorizontal: 12,
                  borderRadius: 18,
                  padding: 32,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#1E2638',
                }}>
                <Ionicons name="briefcase-outline" size={36} color="rgba(255,255,255,0.3)" />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 8 }}>
                  Aucune offre active pour l&apos;instant.
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <CarteOffre offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
            ListFooterComponent={
              offres.length > 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 }}>
                  {peutChargerPlus ? (
                    <>
                      <ActivityIndicator color="#38BDF8" size="small" />
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                        Chargement de nouvelles offres…
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                      {offres.length} offre{offres.length > 1 ? 's' : ''} disponible{offres.length > 1 ? 's' : ''} en direct
                    </Text>
                  )}
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function CarteOffre({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
  const router = useRouter();
  const [aime, setAime] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
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
        backgroundColor: '#111622',
        marginHorizontal: 12,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E2638',
      }}>
      {/* 1. EN-TÊTE DE LA CARTE : Logo Entreprise + Nom + Date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {offre.posterUri && !logoErreur ? (
          <Image
            source={{ uri: offre.posterUri }}
            alt={offre.entreprise}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E2638', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            contentFit="cover"
            transition={150}
            onError={() => setLogoErreur(true)}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#1E2638',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{offre.logoInitiales}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }} numberOfLines={1}>
            {offre.entreprise}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>
              {offre.dateFormatee || offre.date}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>·</Text>
            <Ionicons name="globe-outline" size={11} color="rgba(255,255,255,0.45)" />
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
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#F8FAFC', lineHeight: 22, marginTop: 10 }}>
        {offre.titre}
      </Text>

      {/* 4. LOCALISATION, SECTEUR & DATE LIMITE (Style 1:1 Capture Web) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
          {offre.localisation}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
          {offre.sector || 'Opportunité'}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
          {offre.contrat}
        </Text>
        {offre.deadline && (
          <>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</Text>
            <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '800' }}>
              Limite : {new Date(offre.deadline).toLocaleDateString('fr-FR')}
            </Text>
          </>
        )}
      </View>

      {/* 5. DESCRIPTION AVEC VOIR PLUS */}
      {offre.description && (
        <View style={{ marginTop: 8 }}>
          <Text
            numberOfLines={descriptionEtendue ? undefined : 3}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19 }}>
            {offre.description}
          </Text>
          {offre.description.length > 120 && (
            <Pressable
              onPress={() => setDescriptionEtendue(!descriptionEtendue)}
              style={{ marginTop: 4 }}>
              <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                {descriptionEtendue ? 'Voir moins' : '...Voir plus'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 6. GRANDE AFFICHE RÉELLE DE L'OFFRE (Style Capture Web 1:1) */}
      <OfferMediaView
        media={offre.rawImage || offre.posterUri}
        dark={true}
        onPress={() => router.push(`/offre/${offre.id}`)}
      />

      {/* 7. FOOTER CANDIDATS */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 2 }}>
        <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.45)" />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' }}>
          {offre.viewCount && offre.viewCount > 0 ? `${offre.viewCount} personnes intéressées` : '0 personne a postulé'}
        </Text>
      </View>

      {/* 8. BARRE D'ACTIONS COMPLÈTE STYLE LINKEDIN / SAAS */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
        {/* Like */}
        <Pressable
          onPress={() => setAime(!aime)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: aime ? '#EF4444' : '#1E2638',
            backgroundColor: aime ? 'rgba(239,68,68,0.15)' : '#161B26',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={aime ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={aime ? '#EF4444' : '#94A3B8'} />
        </Pressable>

        {/* Partager */}
        <Pressable
          onPress={partager}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#1E2638',
            backgroundColor: '#161B26',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="share-social-outline" size={18} color="#94A3B8" />
        </Pressable>

        {/* Bouton Principal : Postuler sur le site officiel ou via Facilité */}
        <Pressable
          onPress={ouvrirPostuler}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            backgroundColor: '#2563EB',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: 12,
          }}>
          <Ionicons
            name={offre.externalLink ? 'open-outline' : 'paper-plane'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
            {offre.externalLink ? 'Postuler sur le site officiel' : 'Postuler via Facilité'}
          </Text>
        </Pressable>

        {/* Sauvegarder */}
        <Pressable
          onPress={() => setSauvegarde(!sauvegarde)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: sauvegarde ? '#38BDF8' : '#1E2638',
            backgroundColor: sauvegarde ? 'rgba(56,189,248,0.15)' : '#161B26',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons
            name={sauvegarde ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={sauvegarde ? '#38BDF8' : '#94A3B8'}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}
