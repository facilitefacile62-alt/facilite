import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import { creerBoutique, enregistrerIdentiteVendeur } from '@/lib/vendeur';
import { useLocalisation } from '@/lib/useLocalisation';
import type { Position } from '@/lib/marketplace';

// Onboarding — Infos vendeur (maquette « Onboarding — Infos vendeur ») :
// identité et boutique réunies en un seul écran, à la différence du parcours
// « Devenir Vendeur » en 2 étapes utilisé plus tard depuis le profil.
const VERT_PROFOND = '#0d3b34';

export default function OnboardingInfosVendeurScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { activer } = useLocalisation();
  const connu = (profile?.full_name as string | undefined) ?? '';

  const [prenom, setPrenom] = useState(connu.split(' ')[0] ?? '');
  const [nom, setNom] = useState(connu.split(' ').slice(1).join(' '));
  const [whatsapp, setWhatsapp] = useState((profile?.phone as string | undefined) ?? '');
  const [nomBoutique, setNomBoutique] = useState('');
  const [ville, setVille] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [relevePosition, setRelevePosition] = useState<'aucun' | 'en_cours' | 'ok' | 'echec'>('aucun');
  const [enregistrement, setEnregistrement] = useState(false);

  async function releverPosition() {
    setRelevePosition('en_cours');
    const { position: releve } = await activer().catch(() => ({ position: null }));
    setPosition(releve);
    setRelevePosition(releve ? 'ok' : 'echec');
  }

  async function creer() {
    if (!user?.id) return;
    if (!prenom.trim() || !nom.trim() || !whatsapp.trim() || !nomBoutique.trim()) {
      Alert.alert('Informations manquantes', 'Prénom, nom, WhatsApp et nom de la boutique sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrerIdentiteVendeur(user.id, { prenom, nom, telephone: whatsapp, email: '' });
      await creerBoutique(user.id, { nom: nomBoutique, ville, quartier: null, telephoneWhatsapp: whatsapp, position });
      router.replace('/marketplace/vendre');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer votre boutique.');
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerClassName="px-6 pt-10 pb-10 gap-3.5" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text className="text-[19px] font-black text-[#1A1A1A] text-center mb-2">Vos informations vendeur</Text>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Prénom</Text>
            <TextInput value={prenom} onChangeText={setPrenom} placeholder="Ex. Moussa" placeholderTextColor="#9CA3AF" className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]" />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom</Text>
            <TextInput value={nom} onChangeText={setNom} placeholder="Ex. Diop" placeholderTextColor="#9CA3AF" className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]" />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Téléphone (WhatsApp)</Text>
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="+221 77 000 00 00"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
            />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom de la boutique</Text>
            <TextInput value={nomBoutique} onChangeText={setNomBoutique} placeholder="Ex. Boutique Awa" placeholderTextColor="#9CA3AF" className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]" />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Ville</Text>
            <SelecteurDepartement valeur={ville} onChoisir={setVille} />
          </View>

          <Pressable
            onPress={releverPosition}
            disabled={relevePosition === 'en_cours'}
            className="flex-row items-center gap-3 rounded-2xl border border-gray-300 px-3.5 py-3 disabled:opacity-60">
            {relevePosition === 'en_cours' ? <ActivityIndicator color={VERT_PROFOND} /> : <Ionicons name="location-outline" size={20} color={VERT_PROFOND} />}
            <Text className="flex-1 text-[13.5px] font-semibold text-[#1A1A1A]">
              {relevePosition === 'ok' ? 'Position relevée' : relevePosition === 'echec' ? 'Position indisponible, réessayez' : 'Relever ma position actuelle'}
            </Text>
          </Pressable>

          <Pressable
            onPress={creer}
            disabled={enregistrement}
            className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
            style={{ backgroundColor: VERT_PROFOND }}>
            {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Créer ma boutique et continuer</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
