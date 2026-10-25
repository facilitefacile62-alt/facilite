import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

// Fenêtre pour changer un numéro (numéro d'appel ou WhatsApp) : un champ, deux gros boutons. Aucune confirmation par code n'est demandée (décision du propriétaire) ;
// la base refuse seulement un numéro déjà utilisé par un autre compte, et le message d'erreur est affiché tel quel.
type Props = {
  visible: boolean;
  titre: string;
  aide: string;
  valeurInitiale: string;
  enCours: boolean;
  erreur: string;
  onEnregistrer: (valeur: string) => void;
  onFermer: () => void;
};

export default function ModifierNumeroModal(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onFermer}>
      {/* Le contenu est recréé à chaque ouverture : le champ repart toujours du numéro enregistré. */}
      {props.visible ? <Contenu {...props} /> : null}
    </Modal>
  );
}

function Contenu({
  titre,
  aide,
  valeurInitiale,
  enCours,
  erreur,
  onEnregistrer,
  onFermer,
}: Props) {
  const [valeur, setValeur] = useState(valeurInitiale);

  return (
    <>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <ScrollView className="bg-white" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }} contentContainerClassName="p-5 gap-3" keyboardShouldPersistTaps="handled">
          <Text className="text-[22px] font-black text-[#1A1A1A]">{titre}</Text>
          <Text className="text-[14.5px] leading-[21px]" style={{ color: 'rgba(0,0,0,0.65)' }}>{aide}</Text>
          <TextInput
            value={valeur}
            onChangeText={setValeur}
            keyboardType="phone-pad"
            placeholder="+221 77 000 00 00"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoFocus
            className="text-[18px] font-bold rounded-[14px] px-4"
            style={{ minHeight: 60, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)' }}
          />
          {erreur ? (
            <Text accessibilityRole="alert" className="text-[14px] font-bold rounded-[12px] p-3" style={{ color: '#991B1B', backgroundColor: '#FEE2E2' }}>
              {erreur}
            </Text>
          ) : null}
          <Pressable onPress={() => onEnregistrer(valeur)} disabled={enCours} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 60, borderRadius: 18, backgroundColor: '#10B981', opacity: enCours ? 0.6 : 1 }}>
            {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[17px] font-black text-white">Enregistrer</Text>}
          </Pressable>
          <Pressable onPress={onFermer} accessibilityRole="button" className="items-center justify-center bg-white" style={{ minHeight: 60, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)' }}>
            <Text className="text-[17px] font-black text-[#1A1A1A]">Annuler</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}
