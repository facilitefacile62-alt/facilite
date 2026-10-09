import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

// Liste déroulante des formulaires du Marketplace (maquettes 19 et 20) :
// champ blanc à bordure fine et chevron, qui ouvre une feuille de choix.
export type OptionListe = { id: string; label: string };

export default function SelecteurListe({
  valeur,
  options,
  placeholder,
  titre,
  onChoisir,
}: {
  valeur: string | null;
  options: OptionListe[];
  placeholder: string;
  titre: string;
  onChoisir: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const { height } = useWindowDimensions();
  const choisi = options.find((o) => o.id === valeur);

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityLabel={titre}
        className="flex-row items-center justify-between bg-white"
        style={{ height: 50, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.14)', paddingHorizontal: 14 }}>
        <Text className="text-[15px]" style={{ color: choisi ? '#1A1A1A' : 'rgba(0,0,0,0.6)' }}>
          {choisi ? choisi.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="rgba(0,0,0,0.55)" />
      </Pressable>

      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <Pressable onPress={() => setOuvert(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.7, paddingBottom: 24 }}>
            <Text className="text-[16px] font-black text-[#1A1A1A] px-5 pt-5 pb-3">{titre}</Text>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    onChoisir(o.id);
                    setOuvert(false);
                  }}
                  className="flex-row items-center justify-between px-5 py-3.5"
                  style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' }}>
                  <Text className="text-[15px]" style={{ fontWeight: o.id === valeur ? '900' : '600', color: '#1A1A1A' }}>
                    {o.label}
                  </Text>
                  {o.id === valeur ? <Ionicons name="checkmark" size={18} color="#10B981" /> : <View />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
