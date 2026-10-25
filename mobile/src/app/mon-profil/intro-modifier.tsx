import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import SelecteurPays from '@/components/SelecteurPays';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Modifier l'Intro (bouton « Modifier mon profil Intro » de l'écran Intro) : phrase d'accroche, bio, prénom et nom, titre professionnel, ville,
// pays et téléphone — exactement les rubriques de l'Intro. Rien d'autre : le lieu, le quartier, la ville d'origine, le niveau d'études et le
// genre se changent dans « Informations personnelles ».
const BORDURE = '#0B3D2A';

function texte(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function Champ({ etiquette, aide, enfants }: { etiquette: string; aide?: string; enfants: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="text-[13px] font-extrabold text-[#1A1A1A] mb-1.5">{etiquette}</Text>
      {enfants}
      {aide ? <Text className="text-[12px] mt-1" style={{ color: 'rgba(0,0,0,0.45)' }}>{aide}</Text> : null}
    </View>
  );
}

const styleChamp = { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: BORDURE, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: '#1A1A1A' } as const;

export default function ProfilIntroModifierScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [accroche, setAccroche] = useState(texte(profile?.accroche));
  const [bio, setBio] = useState(texte(profile?.bio));
  const [nom, setNom] = useState(texte(profile?.full_name));
  const [titre, setTitre] = useState(texte(profile?.headline));
  const [ville, setVille] = useState(texte(profile?.city) || texte(profile?.location));
  const [pays, setPays] = useState(texte(profile?.country));
  const [telephone, setTelephone] = useState(texte(profile?.phone));
  const [enCours, setEnCours] = useState(false);

  async function enregistrer() {
    if (!user?.id) return;
    if (!nom.trim()) {
      Alert.alert('Nom', 'Écrivez votre prénom et votre nom.');
      return;
    }
    setEnCours(true);
    try {
      await enregistrerChampsProfil(user.id, {
        accroche: accroche.trim() || null,
        bio: bio.trim(),
        full_name: nom.trim(),
        headline: titre.trim(),
        city: ville.trim(),
        country: pays.trim(),
        phone: telephone.trim(),
      });
      await refreshProfile();
      router.back();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Modifier l'intro" />
        <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Champ
            etiquette="Phrase d'accroche"
            aide={`${accroche.length} / 160 · une phrase courte qui vous présente`}
            enfants={<TextInput value={accroche} onChangeText={setAccroche} maxLength={160} multiline placeholder="Ex : Comptable rigoureuse, je cherche un poste à Dakar" placeholderTextColor="rgba(0,0,0,0.35)" style={[styleChamp, { paddingTop: 12, textAlignVertical: 'top' }]} />}
          />
          <Champ
            etiquette="Bio"
            enfants={<TextInput value={bio} onChangeText={setBio} multiline numberOfLines={5} placeholder="Parlez de votre parcours" placeholderTextColor="rgba(0,0,0,0.35)" style={[styleChamp, { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }]} />}
          />
          <Champ etiquette="Prénom et nom" enfants={<TextInput value={nom} onChangeText={setNom} autoCapitalize="words" style={styleChamp} />} />
          <Champ etiquette="Titre professionnel" enfants={<TextInput value={titre} onChangeText={setTitre} placeholder="Ex : Comptable" placeholderTextColor="rgba(0,0,0,0.35)" style={styleChamp} />} />
          <Champ etiquette="Ville actuelle" enfants={<TextInput value={ville} onChangeText={setVille} autoCapitalize="words" style={styleChamp} />} />
          <Champ etiquette="Pays" enfants={<SelecteurPays valeur={pays} onChange={setPays} />} />
          <Champ etiquette="Téléphone" enfants={<TextInput value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" style={styleChamp} />} />

          <View className="flex-row gap-3 mt-6">
            <Pressable onPress={() => router.back()} accessibilityRole="button" className="flex-1 items-center justify-center bg-white" style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
              <Text className="text-[14px] font-black text-[#1A1A1A]">Annuler</Text>
            </Pressable>
            <Pressable onPress={enregistrer} disabled={enCours} accessibilityRole="button" className="flex-1 items-center justify-center" style={{ minHeight: 50, borderRadius: 14, backgroundColor: '#10B981', opacity: enCours ? 0.6 : 1 }}>
              {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-black text-white">Enregistrer</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
