import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { RUBRIQUES, type Rubrique } from '@/lib/rubriquesCvLogique';

// Écran d'une rubrique du CV (langues, expériences, formation, compétences, centres d'intérêt), en LECTURE SEULE : ces informations viennent d'un CV
// scanné ou importé. Pour quelqu'un qui n'a pas encore de CV : une phrase simple et UN SEUL gros bouton. Sinon : le contenu, un bouton pour
// mettre à jour avec un nouveau CV (qui demande toujours confirmation avant de remplacer) et un lien pour retrouver une ancienne version.
const SCANNER = '/mon-profil/scanner-document' as Href;
const VERSIONS = '/mon-profil/versions-cv' as Href;

export default function EcranRubriqueCv({ titre, cle, vide, children }: { titre: string; cle: Rubrique; vide: boolean; children?: ReactNode }) {
  const router = useRouter();
  const rubrique = RUBRIQUES.find((r) => r.cle === cle);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre={titre} />
        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          {vide ? (
            <View className="items-center" style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 22 }}>
              <Ionicons name="document-text-outline" size={36} color="rgba(0,0,0,0.3)" />
              <Text className="text-[17px] font-black text-center text-[#1A1A1A] mt-3">Vous n&apos;avez pas encore de CV.</Text>
              <Text className="text-[14.5px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.6)' }}>
                Ajoutez-le : vos {rubrique?.pluriel ?? 'informations'} se remplissent toutes seules.
              </Text>
              <Pressable
                onPress={() => router.push(SCANNER)}
                accessibilityRole="button"
                className="items-center justify-center mt-5 self-stretch"
                style={{ minHeight: 56, borderRadius: 16, backgroundColor: '#10B981' }}>
                <Text className="text-[16px] font-extrabold text-white">Créer ou importer mon CV</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 14 }}>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="document-text-outline" size={18} color="#10B981" />
                  <Text className="flex-1 text-[14px] font-bold text-[#1A1A1A]">Ces informations viennent de votre CV.</Text>
                </View>
                <Pressable
                  onPress={() => router.push(SCANNER)}
                  accessibilityRole="button"
                  className="items-center justify-center mt-3"
                  style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#F2F0EA', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                  <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Mettre à jour avec un nouveau CV</Text>
                </Pressable>
              </View>
              {children}
              <Pressable onPress={() => router.push(VERSIONS)} accessibilityRole="link" className="items-center justify-center mt-2" style={{ minHeight: 48 }}>
                <Text className="text-[14px] font-bold" style={{ color: '#2563EB' }}>Retrouver une ancienne version</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
