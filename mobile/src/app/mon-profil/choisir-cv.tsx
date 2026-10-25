import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { listerMesCv, memoriserCvChoisi } from '@/lib/mesCv';
import { cvUtilisable, libelleTypeCv, resumeContenuCv, type CvEnregistre } from '@/lib/mesCvLogique';
import { dateHeureFr } from '@/lib/rubriquesCvLogique';
import type { DonneesExtraites } from '@/lib/scanLogique';

// « Mes CV » : les CV déjà enregistrés sur Facilité (créés sur le site ou importés). Un bouton par CV : « Mettre mon profil à jour avec ce CV » — il mène à
// la MÊME relecture que le scanner, puis aux deux gros boutons de confirmation avant tout remplacement. Les CV qui ne contiennent que l'exemple du
// créateur de CV, ou aucune rubrique, ne sont pas proposés.
type Ligne = { cv: CvEnregistre; donnees: DonneesExtraites };

export default function ChoisirCvScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [ecartes, setEcartes] = useState(0);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    listerMesCv(userId)
      .then((cvs) => {
        if (annule) return;
        const utilisables: Ligne[] = [];
        let exemples = 0;
        for (const cv of cvs) {
          const r = cvUtilisable(cv);
          if (r.ok) utilisables.push({ cv, donnees: r.donnees });
          else if (r.raison === 'exemple') exemples += 1;
        }
        setLignes(utilisables);
        setEcartes(exemples);
      })
      .catch(() => {
        if (!annule) setErreur('Impossible de charger vos CV pour le moment.');
      });
    return () => {
      annule = true;
    };
  }, [userId]);

  function utiliser(l: Ligne) {
    memoriserCvChoisi(l.donnees);
    router.push('/mon-profil/scanner-document?depuis=mes-cv' as Href);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Mes CV" />
        <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
          {erreur ? (
            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12 }}>
              <Text className="text-[14px] font-bold" style={{ color: '#B91C1C' }}>{erreur}</Text>
            </View>
          ) : lignes === null ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#10B981" />
          ) : lignes.length === 0 ? (
            <View className="items-center" style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 22 }}>
              <Ionicons name="document-text-outline" size={36} color="rgba(0,0,0,0.3)" />
              <Text className="text-[17px] font-black text-center text-[#1A1A1A] mt-3">Aucun CV prêt à servir.</Text>
              <Text className="text-[14.5px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.6)' }}>Créez un CV ou importez-en un : il apparaîtra ici.</Text>
              <Pressable
                onPress={() => router.replace('/mon-profil/scanner-document' as Href)}
                accessibilityRole="button"
                className="items-center justify-center mt-5 self-stretch"
                style={{ minHeight: 56, borderRadius: 16, backgroundColor: '#10B981' }}>
                <Text className="text-[16px] font-extrabold text-white">Créer ou importer mon CV</Text>
              </Pressable>
            </View>
          ) : (
            lignes.map((l) => (
              <View key={l.cv.id} className="mb-3" style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 14 }}>
                <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={2}>{l.cv.title || 'CV sans titre'}</Text>
                <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>
                  {libelleTypeCv(l.cv.type)}
                  {l.cv.created_at ? ` · ${dateHeureFr(l.cv.created_at)}` : ''}
                </Text>
                <Text className="text-[14px] mt-2 text-[#1A1A1A]">{resumeContenuCv(l.donnees)}</Text>
                <Pressable
                  onPress={() => utiliser(l)}
                  accessibilityRole="button"
                  className="items-center justify-center mt-3"
                  style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#10B981', paddingHorizontal: 12 }}>
                  <Text className="text-[15px] font-extrabold text-white text-center">Mettre mon profil à jour avec ce CV</Text>
                </Pressable>
              </View>
            ))
          )}

          {ecartes > 0 ? (
            <Text className="text-[12.5px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Les CV qui ne contiennent que l&apos;exemple du créateur ne sont pas proposés.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
