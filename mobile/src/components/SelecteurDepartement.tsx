import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEPARTEMENTS_SENEGAL } from '@/lib/vendeur';

// Sélecteur du département (ville) d'une boutique — mêmes 45 départements que
// le site (DEPARTEMENTS_SENEGAL, MarketplaceClient.jsx). Réutilisé par la
// création et la modification de boutique.
export default function SelecteurDepartement({
  valeur,
  onChoisir,
}: {
  valeur: string | null;
  onChoisir: (departement: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return DEPARTEMENTS_SENEGAL;
    return DEPARTEMENTS_SENEGAL.filter((d) => d.toLowerCase().includes(q));
  }, [recherche]);

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        className="flex-row items-center justify-between border border-gray-300 rounded-xl px-3.5 py-3">
        <Text className={`text-[14px] ${valeur ? 'text-[#1A1A1A] font-semibold' : 'text-gray-400'}`}>
          {valeur || 'Choisir un département'}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </Pressable>

      <Modal visible={ouvert} animationType="slide" onRequestClose={() => setOuvert(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center gap-2.5 px-4 py-3 border-b border-black/[0.06]">
            <Pressable onPress={() => setOuvert(false)} hitSlop={10} accessibilityLabel="Fermer">
              <Ionicons name="close" size={22} color="#1A1A1A" />
            </Pressable>
            <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Département</Text>
          </View>
          <View className="px-4 pt-3">
            <TextInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher…"
              placeholderTextColor="#9CA3AF"
              className="bg-[#F2F0EA] rounded-full px-4 py-2.5 text-[14px] text-[#1A1A1A]"
            />
          </View>
          <FlatList
            data={filtres}
            keyExtractor={(d) => d}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChoisir(item);
                  setRecherche('');
                  setOuvert(false);
                }}
                className="flex-row items-center justify-between py-3 border-b border-black/[0.05]">
                <Text className="text-[14.5px] text-[#1A1A1A]">{item}</Text>
                {valeur === item && <Ionicons name="checkmark" size={18} color="#10B981" />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
