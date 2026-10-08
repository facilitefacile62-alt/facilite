import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';

// « Profil — À propos » / Intro — maquette 47 : phrase d'accroche,
// informations personnelles & CV, coordonnées de contact, puis le bouton
// bleu « Modifier mon profil Intro ».
//
// Tout vient de `profiles` (bio, full_name, headline, city, country, phone,
// contact_email) et du compte. Une valeur absente s'affiche « Non
// renseigné » — jamais un exemple inventé.
function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export default function ProfilIntroScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const bio = texte(profile?.bio);
  const infos = [
    { libelle: 'NOM COMPLET', valeur: texte(profile?.full_name), bleu: false },
    { libelle: 'TITRE PROFESSIONNEL', valeur: texte(profile?.headline), bleu: false },
    { libelle: 'VILLE ACTUELLE', valeur: texte(profile?.city) ?? texte(profile?.location), bleu: true },
    { libelle: 'PAYS / ORIGINE', valeur: texte(profile?.country), bleu: true },
  ];
  const contacts = [
    { libelle: 'TÉLÉPHONE', valeur: texte(profile?.phone) ?? texte(profile?.contact_phone) },
    { libelle: 'E-MAIL', valeur: texte(profile?.contact_email) ?? user?.email ?? null },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Intro" />

        <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-[#EEF2FF] rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10.5px] font-bold text-[#2563EB] tracking-wider">PHRASE D&apos;ACCROCHE BIO</Text>
              <View className="bg-white rounded-full px-2.5 py-1 flex-row items-center gap-1">
                <Ionicons name="globe-outline" size={10} color="#2563EB" />
                <Text className="text-[10.5px] font-bold text-[#2563EB]">Public</Text>
              </View>
            </View>
            <Text className="text-[13.5px] font-bold text-[#1A1A1A] leading-[20px] mt-2.5">
              {bio ?? "Aucune phrase d'accroche pour le moment."}
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-4 mt-3">
            <Text className="text-[10.5px] font-bold text-black/40 tracking-wider">INFORMATIONS PERSONNELLES &amp; CV</Text>
            {infos.map((l) => (
              <View key={l.libelle} className="mt-3">
                <Text className="text-[10.5px] text-black/40 tracking-wide">{l.libelle}</Text>
                <Text
                  className="text-[14px] font-bold mt-0.5"
                  style={{ color: l.valeur ? (l.bleu ? '#2563EB' : '#1A1A1A') : 'rgba(0,0,0,0.35)' }}>
                  {l.valeur ?? 'Non renseigné'}
                </Text>
              </View>
            ))}
          </View>

          <View className="bg-white rounded-2xl p-4 mt-3">
            <Text className="text-[10.5px] font-bold text-black/40 tracking-wider">COORDONNÉES DE CONTACT</Text>
            {contacts.map((l) => (
              <View key={l.libelle} className="mt-3">
                <Text className="text-[10.5px] text-black/40 tracking-wide">{l.libelle}</Text>
                <Text
                  className="text-[14px] font-bold mt-0.5"
                  style={{ color: l.valeur ? '#1A1A1A' : 'rgba(0,0,0,0.35)' }}>
                  {l.valeur ?? 'Non renseigné'}
                </Text>
              </View>
            ))}
          </View>

          <View className="items-end mt-4">
            <Pressable
              onPress={() => router.push('/mon-profil/infos-perso')}
              className="flex-row items-center gap-2 bg-[#2563EB] rounded-full px-5 py-3">
              <Ionicons name="pencil" size={13} color="#fff" />
              <Text className="text-white text-[13px] font-bold">Modifier mon profil Intro</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
