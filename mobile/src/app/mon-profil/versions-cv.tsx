import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import GrosBoutonsChoix from '@/components/GrosBoutonsChoix';
import { useAuth } from '@/context/AuthContext';
import { listerVersionsCv, restaurerVersionCv } from '@/lib/rubriquesCv';
import { dateHeureFr, resumeVersion, titreMotifVersion, type VersionCv } from '@/lib/rubriquesCvLogique';

// Anciennes versions des rubriques du CV (langues, expériences, formation, compétences, centres d'intérêt) : une copie est prise AVANT chaque
// remplacement par un nouveau CV. « Récupérer » demande toujours confirmation (deux gros boutons) ; l'état actuel est lui aussi gardé, donc le retour
// en arrière peut à son tour être annulé. Les 10 plus récentes sont conservées.
export default function VersionsCvScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [versions, setVersions] = useState<VersionCv[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [choisie, setChoisie] = useState<VersionCv | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    let annule = false;
    listerVersionsCv()
      .then((v) => {
        if (!annule) setVersions(v);
      })
      .catch(() => {
        if (!annule) setErreur('Impossible de charger les anciennes versions pour le moment.');
      });
    return () => {
      annule = true;
    };
  }, []);

  async function recuperer() {
    if (!choisie) return;
    setEnCours(true);
    setErreur('');
    try {
      await restaurerVersionCv(choisie.id);
      await refreshProfile();
      setFait(true);
      setChoisie(null);
    } catch {
      setErreur("Cette version n'a pas pu être récupérée. Réessayez dans un instant.");
      setChoisie(null);
    } finally {
      setEnCours(false);
    }
  }

  if (choisie) {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <SafeAreaView className="flex-1" edges={['top']}>
          <EnteteRubrique titre="Anciennes versions" />
          <GrosBoutonsChoix
            question="Revenir à cette version ?"
            details={[dateHeureFr(choisie.creeLe), resumeVersion(choisie), 'Vos informations actuelles seront gardées dans la liste.']}
            oui="Oui, revenir à cette version"
            non="Non, garder mes informations"
            occupe={enCours}
            onOui={recuperer}
            onNon={() => setChoisie(null)}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Anciennes versions" />
        <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
          {fait ? (
            <View className="mb-3" style={{ backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12 }}>
              <Text className="text-[14px] font-bold" style={{ color: '#047857' }}>C&apos;est fait : vos anciennes informations sont revenues.</Text>
            </View>
          ) : null}
          {erreur ? (
            <View className="mb-3" style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12 }}>
              <Text className="text-[14px] font-bold" style={{ color: '#B91C1C' }}>{erreur}</Text>
            </View>
          ) : null}

          {versions === null && !erreur ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" />
          ) : versions && versions.length === 0 ? (
            <View className="items-center py-12 px-6">
              <Ionicons name="time-outline" size={34} color="rgba(0,0,0,0.3)" />
              <Text className="text-[15px] text-center mt-3" style={{ color: 'rgba(0,0,0,0.55)' }}>Aucune ancienne version pour le moment.</Text>
              <Text className="text-[13.5px] text-center mt-1.5" style={{ color: 'rgba(0,0,0,0.45)' }}>Une copie est gardée chaque fois qu&apos;un nouveau CV remplace vos informations.</Text>
            </View>
          ) : (
            (versions ?? []).map((v) => (
              <View key={v.id} className="mb-3" style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 14 }}>
                <Text className="text-[15px] font-black text-[#1A1A1A]">{dateHeureFr(v.creeLe)}</Text>
                <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>{titreMotifVersion(v.motif)}</Text>
                <Text className="text-[14px] mt-2 text-[#1A1A1A]">{resumeVersion(v)}</Text>
                <Pressable
                  onPress={() => {
                    setFait(false);
                    setChoisie(v);
                  }}
                  accessibilityRole="button"
                  className="items-center justify-center mt-3"
                  style={{ minHeight: 50, borderRadius: 14, backgroundColor: '#F2F0EA', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                  <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Récupérer cette version</Text>
                </Pressable>
              </View>
            ))
          )}

          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/mon-profil/a-propos'))} className="items-center justify-center mt-2" style={{ minHeight: 48 }}>
            <Text className="text-[14px] font-bold" style={{ color: '#2563EB' }}>Retour</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
