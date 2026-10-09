import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CarteOffre from '@/components/CarteOffre';
import FaciliteHeader from '@/components/FaciliteHeader';
import { useAuth } from '@/context/AuthContext';
import { useCandidateMatchScores } from '@/lib/useCandidateMatchScores';
import { compterOffres, useOffresReelles, type EtatOffres } from '@/lib/useOffresReelles';

// Offres — maquette 03 : bandeau vert « Offres d'Emploi Disponibles »,
// bouton « Recherche IA », deux onglets (Offres disponibles / Offres
// expirées, chacun avec son compteur), bandeau « Recrutements en cours »,
// puis les cartes d'offres sur fond crème.
//
// Les deux compteurs et les deux listes sont RÉELS et suivent la règle du
// site (voir useOffresReelles.ts). L'onglet « expirées » affichait avant une
// liste toujours vide et un compteur écrit en dur à 0, alors que 72 offres
// avaient dépassé leur date limite.
const FOND_PAGE = '#F2F0EA';
const VERT = '#10B981';
const PAS_PAGINATION = 15;

export default function OffresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [etat, setEtat] = useState<EtatOffres>('disponibles');
  const [limite, setLimite] = useState(PAS_PAGINATION);
  const { offres, erreur } = useOffresReelles(limite, etat);
  const candidateMatchScores = useCandidateMatchScores(user?.id);
  const [totaux, setTotaux] = useState<Record<EtatOffres, number | null>>({ disponibles: null, expirees: null });

  useEffect(() => {
    let annule = false;
    (['disponibles', 'expirees'] as const).forEach((e) => {
      compterOffres(e).then((n) => {
        if (!annule) setTotaux((t) => ({ ...t, [e]: n }));
      });
    });
    return () => {
      annule = true;
    };
  }, []);

  const total = totaux[etat];
  const choisir = (e: EtatOffres) => {
    setEtat(e);
    setLimite(PAS_PAGINATION);
  };

  return (
    <View style={{ flex: 1, backgroundColor: FOND_PAGE }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FaciliteHeader />

        <FlatList
          data={offres ?? []}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 12, marginTop: 10, gap: 10 }}>
              <LinearGradient
                colors={['#0d3b34', '#0f4f42']}
                style={{ borderRadius: 18, padding: 18, position: 'relative' }}>
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
                  <Ionicons name="briefcase-outline" size={18} color="#9FE9D4" />
                </View>
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: '#6EE7C9' }}>
                  CATALOGUE DES EMPLOIS
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 5, maxWidth: '82%' }}>
                  Offres d&apos;Emploi Disponibles
                </Text>
                <Text style={{ color: '#D8F3EA', fontSize: 12.5, lineHeight: 19, marginTop: 6 }}>
                  Explorez toutes les opportunités publiées par nos recruteurs au Sénégal et postulez en un clic.
                </Text>
              </LinearGradient>

              {/* Maquette : « 🔍 Recherche IA ». Elle ouvre la recherche
                  d'offres existante ; aucune « IA » n'est promise au-delà de
                  ce que cet écran fait réellement. */}
              <Pressable
                onPress={() => router.push('/recherche')}
                accessibilityRole="button"
                style={{
                  backgroundColor: '#6EE7C9',
                  borderRadius: 9999,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                <Ionicons name="search" size={16} color="#0D3B34" />
                <Text style={{ color: '#0D3B34', fontSize: 14, fontWeight: '800' }}>Recherche IA</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <OngletOffres
                  actif={etat === 'disponibles'}
                  libelle={'Offres\ndisponibles'}
                  icone="flash"
                  couleur={VERT}
                  fondCompteur="#D1FAE5"
                  total={totaux.disponibles}
                  onPress={() => choisir('disponibles')}
                />
                <OngletOffres
                  actif={etat === 'expirees'}
                  libelle={'Offres expirées'}
                  icone="hourglass-outline"
                  couleur="#DC2626"
                  fondCompteur="#FEE2E2"
                  total={totaux.expirees}
                  onPress={() => choisir('expirees')}
                />
              </View>

              {etat === 'disponibles' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#D5F0E8',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                  }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0D3B34', flex: 1 }}>
                    Recrutements en cours : postulez rapidement avant clôture !
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            offres === null && !erreur ? (
              <View style={{ alignItems: 'center', marginTop: 32 }}>
                <ActivityIndicator color="#2563EB" size="large" />
                <Text style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', fontWeight: '600', marginTop: 12 }}>
                  Chargement des opportunités…
                </Text>
              </View>
            ) : erreur ? (
              <Text style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', textAlign: 'center', marginTop: 24 }}>
                Impossible de charger les offres pour le moment.
              </Text>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 24, paddingHorizontal: 24 }}>
                <Ionicons name="hourglass-outline" size={34} color="rgba(0,0,0,0.25)" />
                <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#1A1A1A', marginTop: 10, textAlign: 'center' }}>
                  {etat === 'expirees' ? 'Aucune offre expirée pour le moment' : 'Aucune offre disponible pour le moment'}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <CarteOffre
              offre={item}
              matchScore={etat === 'disponibles' ? (candidateMatchScores?.[item.id] ?? null) : null}
              expiree={etat === 'expirees'}
            />
          )}
          ListFooterComponent={
            offres && offres.length > 0 && total !== null ? (
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                {offres.length < total && (
                  <Pressable
                    onPress={() => setLimite((n) => n + PAS_PAGINATION)}
                    style={{
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.1)',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 9999,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                    }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>↓ Voir plus d&apos;offres</Text>
                  </Pressable>
                )}
                <Text style={{ fontSize: 11.5, color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
                  {offres.length} offre{offres.length > 1 ? 's' : ''} affichée{offres.length > 1 ? 's' : ''} sur {total}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </View>
  );
}

function OngletOffres({
  actif,
  libelle,
  icone,
  couleur,
  fondCompteur,
  total,
  onPress,
}: {
  actif: boolean;
  libelle: string;
  icone: keyof typeof Ionicons.glyphMap;
  couleur: string;
  fondCompteur: string;
  total: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: actif }}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: actif ? 1.5 : 1,
        borderColor: actif ? couleur : 'rgba(0,0,0,0.06)',
      }}>
      <Ionicons name={icone} size={16} color={couleur} />
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A1A1A', flex: 1 }}>{libelle}</Text>
      <View style={{ backgroundColor: fondCompteur, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '900', color: couleur === VERT ? '#047857' : '#DC2626' }}>
          {total ?? '—'}
        </Text>
      </View>
    </Pressable>
  );
}
