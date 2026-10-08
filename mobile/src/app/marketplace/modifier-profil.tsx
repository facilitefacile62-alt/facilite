import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Modifier le profil (visiteur), maquette « Marketplace — Modifier profil
// visiteur » : juste prénom et nom, à la différence du profil vendeur
// (boutique, WhatsApp, position…).
const VERT_PROFOND = '#0d3b34';

function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

export default function ModifierProfilVisiteurScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const connu = decouperNom(profile?.full_name as string | undefined);
  const [prenom, setPrenom] = useState(connu.prenom);
  const [nom, setNom] = useState(connu.nom);
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer() {
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
      await refreshProfile();
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white items-center justify-center">
            <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A]">Modifier le profil</Text>
        </View>

        <View className="px-5 pt-2 gap-3.5">
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Prénom</Text>
            <TextInput
              value={prenom}
              onChangeText={setPrenom}
              placeholder="Votre prénom"
              placeholderTextColor="#9CA3AF"
              className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
            />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom</Text>
            <TextInput
              value={nom}
              onChangeText={setNom}
              placeholder="Votre nom"
              placeholderTextColor="#9CA3AF"
              className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <Pressable
            onPress={enregistrer}
            disabled={enregistrement}
            className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
            style={{ backgroundColor: VERT_PROFOND }}>
            {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Enregistrer</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
