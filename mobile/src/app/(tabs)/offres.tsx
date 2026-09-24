import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import OfferMediaView from '@/components/OfferMediaView';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { useOffresReelles, type OffreReelle } from '@/lib/useOffresReelles';
import { supabase } from '@/lib/supabase';

type Filtre = 'disponibles' | 'expirees';
const PAS_PAGINATION = 15;

export default function OffresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const { offres, erreur } = useOffresReelles(limite);
  const candidateMatchScores = useCandidateMatchScores(user?.id);
  const [filtre, setFiltre] = useState<Filtre>('disponibles');
  const [totalDisponibles, setTotalDisponibles] = useState<number | null>(null);

  useEffect(() => {
    let annule = false;
    supabase
      .from('job_offers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => {
        if (!annule) setTotalDisponibles(count ?? null);
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0E14' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FaciliteHeader dark={true} />

        {offres === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#38BDF8" size="large" />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 12 }}>
              Chargement des opportunités…
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtre === 'disponibles' ? offres : []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            ListHeaderComponent={
              <View style={{ marginBottom: 12, marginTop: 10 }}>
                <LinearGradient
                  colors={['#0d3b34', '#0f4f42']}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(110,231,201,0.2)',
                    position: 'relative',
                  }}>
                  <View
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="briefcase" size={18} color="#6EE7C9" />
                  </View>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: '#6EE7C9' }}>
                    CATALOGUE DES EMPLOIS
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4, maxWidth: '80%' }}>
                    Offres d&apos;Emploi Disponibles
                  </Text>
                  <Text style={{ color: '#D8F3EA', fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: '88%' }}>
                    Explorez toutes les opportunités publiées au Sénégal et postulez directement.
                  </Text>
                </LinearGradient>

                {/* Bouton Recherche Rapide */}
                <Pressable
                  onPress={() => router.push('/recherche')}
                  style={{
                    backgroundColor: '#6EE7C9',
                    borderRadius: 9999,
                    paddingVertical: 12,
                    alignItems: 'center',
                    marginTop: 10,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  <Ionicons name="search" size={17} color="#0D3B34" />
                  <Text style={{ color: '#0D3B34', fontSize: 13.5, fontWeight: '800' }}>Rechercher une offre</Text>
                </Pressable>

                {/* Filtres Disponibles / Expirées */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <Pressable
                    onPress={() => setFiltre('disponibles')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      padding: 10,
                      backgroundColor: filtre === 'disponibles' ? '#161B26' : 'rgba(255,255,255,0.03)',
                      borderWidth: 1,
                      borderColor: filtre === 'disponibles' ? '#2563EB' : 'rgba(255,255,255,0.08)',
                    }}>
                    <Ionicons name="sparkles" size={15} color="#34D399" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>Disponibles</Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: '#34D399',
                        backgroundColor: 'rgba(52,211,153,0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                      }}>
                      {totalDisponibles ?? '—'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFiltre('expirees')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      padding: 10,
                      backgroundColor: filtre === 'expirees' ? '#161B26' : 'rgba(255,255,255,0.03)',
                      borderWidth: 1,
                      borderColor: filtre === 'expirees' ? '#EF4444' : 'rgba(255,255,255,0.08)',
                    }}>
                    <Ionicons name="time-outline" size={15} color="#F87171" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>Clôturées</Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: '#F87171',
                        backgroundColor: 'rgba(248,113,113,0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                      }}>
                      0
                    </Text>
                  </Pressable>
                </View>
              </View>
            }
            ListEmptyComponent={
              filtre === 'expirees' ? (
                <View
                  style={{
                    backgroundColor: '#111622',
                    borderRadius: 18,
                    padding: 32,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#1E2638',
                  }}>
                  <Ionicons name="hourglass-outline" size={36} color="rgba(255,255,255,0.3)" />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 10 }}>
                    Aucune offre expirée pour le moment
                  </Text>
                  <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 4, maxWidth: '85%' }}>
                    Toutes les opportunités sont actuellement actives et prêtes pour vos candidatures !
                  </Text>
                  <Pressable
                    onPress={() => setFiltre('disponibles')}
                    style={{
                      marginTop: 14,
                      backgroundColor: '#34D399',
                      borderRadius: 9999,
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                    }}>
                    <Text style={{ color: '#0D3B34', fontSize: 12.5, fontWeight: '800' }}>⚡ Voir les offres disponibles</Text>
                  </Pressable>
                </View>
              ) : erreur ? (
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 24 }}>
                  Impossible de charger les offres pour le moment.
                </Text>
              ) : (
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 24 }}>
                  Aucune offre active pour l&apos;instant.
                </Text>
              )
            }
            renderItem={({ item }) => (
              <CarteOffreDetaillee offre={item} matchScore={candidateMatchScores?.[item.id] ?? null} />
            )}
            ListFooterComponent={
              filtre === 'disponibles' && offres.length > 0 && totalDisponibles !== null ? (
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  {offres.length < totalDisponibles && (
                    <Pressable
                      onPress={() => setLimite((n) => n + PAS_PAGINATION)}
                      style={{
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                        backgroundColor: '#161B26',
                        borderRadius: 9999,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                      }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>↓ Voir plus d&apos;offres</Text>
                    </Pressable>
                  )}
                  <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                    {offres.length} offre{offres.length > 1 ? 's' : ''} affichée{offres.length > 1 ? 's' : ''} sur{' '}
                    {totalDisponibles}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function CarteOffreDetaillee({ offre, matchScore }: { offre: OffreReelle; matchScore: number | null }) {
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
        message: `Découvrez cette offre d'emploi sur Facilité :\n${offre.titre} chez ${offre.entreprise} (${offre.localisation})\n\nPostulez ici : ${url}`,
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
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E2638',
      }}>
      {/* 1. Logo & Entreprise */}
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

      {/* 2. Badge Matching IA */}
      {matchScore !== null && (
        <View style={{ marginTop: 10 }}>
          <BadgeMatchingOffre score={matchScore} />
        </View>
      )}

      {/* 3. Titre & Infos */}
      <Text style={{ fontSize: 16.5, fontWeight: '800', color: '#F8FAFC', lineHeight: 22, marginTop: 10 }}>
        {offre.titre}
      </Text>
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

      {/* 4. Description avec voir plus */}
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

      {/* 5. Affiche réelle de l'offre */}
      <OfferMediaView
        media={offre.rawImage || offre.posterUri}
        dark={true}
        onPress={() => router.push(`/offre/${offre.id}`)}
      />

      {/* 6. Footer Candidats */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 2 }}>
        <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.45)" />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' }}>
          {offre.viewCount && offre.viewCount > 0 ? `${offre.viewCount} personnes intéressées` : '0 personne a postulé'}
        </Text>
      </View>

      {/* 7. Barre d'actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
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
