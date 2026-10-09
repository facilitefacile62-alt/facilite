import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import SelecteurDepartement from '@/components/SelecteurDepartement';
import { modifierBoutique } from '@/lib/vendeur';
import EnteteMarketplace from '@/components/EnteteMarketplace';

const VERT_PROFOND = '#0d3b34';

export default function ModifierBoutiqueScreen() {
  const params = useLocalSearchParams<{ storeId: string; nom: string; quartier: string; ville: string; whatsapp: string }>();
  const router = useRouter();

  const [nom, setNom] = useState(params.nom || '');
  const [ville, setVille] = useState<string | null>(params.ville || null);
  const [quartier, setQuartier] = useState(params.quartier || '');
  const [whatsapp, setWhatsapp] = useState(params.whatsapp || '');
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer() {
    if (!params.storeId) return;
    if (!nom.trim()) {
      Alert.alert('Nom manquant', 'Donnez un nom à votre boutique.');
      return;
    }
    setEnregistrement(true);
    try {
      await modifierBoutique(params.storeId, { nom, ville, quartier, telephoneWhatsapp: whatsapp });
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Modifier ma boutique" />

        <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom de la boutique</Text>
            <TextInput
              value={nom}
              onChangeText={setNom}
              placeholder="Ex. Boutique Awa"
              placeholderTextColor="#9CA3AF"
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Département</Text>
            <SelecteurDepartement valeur={ville} onChoisir={setVille} />
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Quartier (facultatif)</Text>
            <TextInput
              value={quartier}
              onChangeText={setQuartier}
              placeholder="Ex. Plateau"
              placeholderTextColor="#9CA3AF"
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">WhatsApp (facultatif)</Text>
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="77 123 45 67"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <Pressable
            onPress={enregistrer}
            disabled={enregistrement}
            className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
            style={{ backgroundColor: VERT_PROFOND }}>
            {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Enregistrer</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}
