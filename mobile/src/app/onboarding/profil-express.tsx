import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Onboarding — Profil express (visiteur), maquette « Onboarding — Profil express ».
const VERT_PROFOND = '#0d3b34';

export default function OnboardingProfilExpressScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const connu = (profile?.full_name as string | undefined) ?? '';
  const [prenom, setPrenom] = useState(connu.split(' ')[0] ?? '');
  const [nom, setNom] = useState(connu.split(' ').slice(1).join(' '));
  const [enregistrement, setEnregistrement] = useState(false);

  async function continuer() {
    if (!user?.id) return;
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: `${prenom.trim()} ${nom.trim()}`.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      router.replace('/marketplace');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer votre profil.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1 justify-center px-6 gap-4" edges={['top', 'bottom']}>
        <Text className="text-[19px] font-black text-[#1A1A1A] text-center">Un dernier détail</Text>
        <Text className="text-[13px] text-gray-500 text-center -mt-2">Comment vous appelez-vous ?</Text>

        <View className="gap-1.5 mt-2">
          <Text className="text-[12.5px] font-bold text-gray-700">Prénom</Text>
          <TextInput
            value={prenom}
            onChangeText={setPrenom}
            placeholder="Ex. Moussa"
            placeholderTextColor="#9CA3AF"
            className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
          />
        </View>
        <View className="gap-1.5">
          <Text className="text-[12.5px] font-bold text-gray-700">Nom</Text>
          <TextInput
            value={nom}
            onChangeText={setNom}
            placeholder="Ex. Diop"
            placeholderTextColor="#9CA3AF"
            className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
          />
        </View>

        <Pressable
          onPress={continuer}
          disabled={enregistrement}
          className="rounded-2xl py-3.5 items-center mt-3 disabled:opacity-60"
          style={{ backgroundColor: VERT_PROFOND }}>
          {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Accéder à la marketplace</Text>}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
