import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';
import {
  IconChevronBas,
  IconChevronGauche,
  IconDocument,
  IconEtincelle,
  IconHorloge,
  IconImporter,
  IconPhoto,
} from '@/components/facilite-icons';

// Reproduction de design_handoff_facilite/pages/02-extracteur.html.
// `detailsOpen` = sc-if "{{ detailsOpen }}", `extracteurStepSelect` /
// `extracteurStepImage` / `extracteurStepText` du handoff sont fusionnés en
// un seul état `etape` (une seule vraie à la fois, plus simple à maintenir
// que 3 booléens indépendants). L'analyse IA elle-même (scan de l'annonce)
// n'est pas câblée à un service — hors périmètre de cette passe, qui porte
// sur la mise en page et la navigation ; le bouton d'analyse le signale
// clairement plutôt que de simuler un faux résultat.
type Etape = 'select' | 'image' | 'text';

export default function ExtracteurScreen() {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [etape, setEtape] = useState<Etape>('select');
  const [texteAnnonce, setTexteAnnonce] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function choisirPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder à vos photos pour importer l'annonce.");
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!resultat.canceled && resultat.assets[0]) {
      setPhotoUri(resultat.assets[0].uri);
    }
  }

  function analyser() {
    Alert.alert('Analyse IA', "L'extraction automatique de l'annonce arrive dans une prochaine mise à jour.");
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader ecranActif="extracteur" />

        <ScrollView className="flex-1 px-3 pt-3.5" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.replace('/')} className="flex-row items-center gap-2 pb-3.5">
            <IconChevronGauche />
            <Text className="text-blue-600 text-[13.5px] font-semibold">Retour à l&apos;accueil</Text>
          </Pressable>

          <LinearGradient colors={['#0d3b34', '#0f4f42']} className="rounded-2xl p-4">
            <View className="flex-row items-center gap-2">
              <IconEtincelle />
              <Text className="text-[11px] font-bold tracking-wide text-[#6ee7c9]">
                ASSISTANT CANDIDATURE IA — POSTULATION EXPRESS
              </Text>
            </View>
            <Text className="text-white text-[15.5px] font-extrabold mt-1.5 leading-5">
              Scanner d&apos;Annonces &amp; Candidature Directe
            </Text>

            <Pressable
              onPress={() => setDetailsOpen((v) => !v)}
              className="self-start flex-row items-center gap-1.5 bg-white/[0.14] rounded-full px-3.5 py-2 mt-3">
              <IconHorloge />
              <Text className="text-white text-[12.5px] font-semibold">
                {detailsOpen ? 'Masquer les détails' : 'Comment ça marche ?'}
              </Text>
              <View style={{ transform: [{ rotate: detailsOpen ? '180deg' : '0deg' }] }}>
                <IconChevronBas />
              </View>
            </Pressable>

            {detailsOpen && (
              <>
                <Text className="text-[#d8f3ea] text-[12.5px] leading-5 mt-3.5">
                  Importez une photo d&apos;affiche ou collez le texte d&apos;une offre. L&apos;IA extrait
                  automatiquement les coordonnées certifiées (Email, WhatsApp, Lien externe), vous présente
                  l&apos;écran de revue avant validation et prépare votre candidature instantanée.
                </Text>
                <View className="gap-2 mt-3">
                  <View className="bg-white/10 rounded-[10px] px-3 py-2.5">
                    <Text className="text-white text-[12px] font-semibold">1  Photo ou texte brut</Text>
                  </View>
                  <View className="bg-white/10 rounded-[10px] px-3 py-2.5">
                    <Text className="text-white text-[12px] font-semibold">2  Extraction IA instantanée</Text>
                  </View>
                  <View className="bg-white/10 rounded-[10px] px-3 py-2.5">
                    <Text className="text-white text-[12px] font-semibold">3  Candidature directe en 1 clic</Text>
                  </View>
                </View>
              </>
            )}
          </LinearGradient>

          {etape === 'select' && (
            <View className="bg-white rounded-2xl p-4 mt-3.5 border border-gray-200 shadow-xs">
              <Text className="text-[11.5px] font-bold tracking-wide text-black/55">
                CHOISISSEZ VOTRE MÉTHODE D&apos;IMPORTATION :
              </Text>
              <View className="flex-row gap-2.5 mt-3">
                <View className="flex-1 border border-black/10 rounded-2xl p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="w-[34px] h-[34px] rounded-[10px] bg-[#d7f2ea] items-center justify-center">
                      <IconPhoto />
                    </View>
                    <Text className="text-[10px] font-bold text-emerald-500 bg-[#d7f2ea] px-2 py-0.5 rounded-full">
                      Image
                    </Text>
                  </View>
                  <Text className="text-[13.5px] font-bold mt-2.5">1. Photo d&apos;annonce</Text>
                  <Text className="text-[11.5px] text-black/50 mt-1 leading-4">
                    Importer une capture d&apos;écran, JPEG ou PNG
                  </Text>
                  <Pressable
                    onPress={() => setEtape('image')}
                    className="border-t border-black/[0.07] mt-3 pt-2.5 flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-bold text-emerald-500">Choisir</Text>
                    <Text className="text-emerald-500 text-[14px]">→</Text>
                  </Pressable>
                </View>

                <View className="flex-1 border border-black/10 rounded-2xl p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="w-[34px] h-[34px] rounded-[10px] bg-emerald-500 items-center justify-center">
                      <IconDocument />
                    </View>
                    <Text className="text-[10px] font-bold text-emerald-500 bg-[#d7f2ea] px-2 py-0.5 rounded-full">
                      Texte
                    </Text>
                  </View>
                  <Text className="text-[13.5px] font-bold mt-2.5">2. Examinateur</Text>
                  <Text className="text-[11.5px] text-black/50 mt-1 leading-4">
                    Coller un texte reçu (WhatsApp, SMS, Mail)
                  </Text>
                  <Pressable
                    onPress={() => setEtape('text')}
                    className="border-t border-black/[0.07] mt-3 pt-2.5 flex-row items-center justify-between">
                    <Text className="text-[12.5px] font-bold text-emerald-500">Choisir</Text>
                    <Text className="text-emerald-500 text-[14px]">→</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {etape === 'image' && (
            <View className="bg-white border-[1.5px] border-emerald-500 rounded-2xl p-4 mt-3.5">
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setEtape('select')} className="flex-row items-center gap-1.5">
                  <IconChevronGauche size={13} />
                  <Text className="text-blue-600 text-[12.5px] font-semibold">Changer de mode</Text>
                </Pressable>
                <Text className="text-[12.5px] font-bold text-[#1A1A1A]">📷 Photo de l&apos;annonce</Text>
              </View>

              <Pressable
                onPress={choisirPhoto}
                className="mt-3.5 border-[1.6px] border-dashed border-emerald-500 rounded-2xl py-7 px-4 items-center gap-2.5">
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    alt="Photo importée de l'annonce"
                    className="w-full h-40 rounded-xl"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <View className="w-11 h-11 rounded-xl bg-[#d7f2ea] items-center justify-center">
                      <IconImporter />
                    </View>
                    <Text className="text-[13.5px] font-bold text-[#1A1A1A] text-center">
                      Cliquez pour importer la photo de l&apos;annonce
                    </Text>
                    <Text className="text-[11px] font-semibold text-amber-500">PNG, JPG, JPEG acceptés</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={analyser} className="mt-3.5 bg-[#8fd9c4] rounded-full py-3.5 items-center">
                <Text className="text-white text-[13.5px] font-bold">🔍 Analyser la photo de l&apos;annonce</Text>
              </Pressable>
            </View>
          )}

          {etape === 'text' && (
            <View className="bg-white border-[1.5px] border-emerald-500 rounded-2xl p-4 mt-3.5">
              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setEtape('select')} className="flex-row items-center gap-1.5">
                  <IconChevronGauche size={13} />
                  <Text className="text-blue-600 text-[12.5px] font-semibold">Changer de mode</Text>
                </Pressable>
                <Text className="text-[12.5px] font-bold text-[#1A1A1A]">📄 Examinateur de texte</Text>
              </View>

              <Text className="text-[12.5px] font-semibold text-[#1A1A1A] mt-3.5">
                Collez le texte brut de l&apos;offre (reçu sur WhatsApp, SMS ou e-mail) :
              </Text>
              <TextInput
                value={texteAnnonce}
                onChangeText={setTexteAnnonce}
                placeholder="Collez votre annonce ici (ex: Recrutement Comptable CDI à Dakar, contact@entreprise.sn / 77 123 45 67...)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                multiline
                textAlignVertical="top"
                className="mt-2.5 border-[1.6px] border-emerald-500 rounded-xl p-3 text-[13px] text-[#1A1A1A] min-h-[90px]"
              />
              <Pressable onPress={analyser} className="mt-3.5 bg-[#8fd9c4] rounded-full py-3.5 items-center">
                <Text className="text-white text-[13.5px] font-bold">🔍 Examiner et classer l&apos;annonce</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
