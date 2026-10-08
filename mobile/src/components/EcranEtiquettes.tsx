import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil, listeTexte } from '@/lib/profilChamps';

// Écran à étiquettes, partagé par « Compétences » (maquette 52) et
// « Centres d'intérêt » (maquette 53) : les deux maquettes sont identiques
// à l'étiquette près, et les deux colonnes de `profiles` (skills,
// interests) sont de simples tableaux de chaînes.
export default function EcranEtiquettes({
  titre,
  champ,
  libelleAjout,
  placeholder,
}: {
  titre: string;
  champ: 'skills' | 'interests';
  libelleAjout: string;
  placeholder: string;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const etiquettes = listeTexte(profile?.[champ]);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(nouvelles: string[]) {
    if (!user?.id) return;
    try {
      await enregistrerChampsProfil(user.id, { [champ]: nouvelles });
      await refreshProfile();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    }
  }

  async function ajouter() {
    const valeur = saisie.trim();
    if (!valeur) return;
    if (etiquettes.some((e) => e.toLowerCase() === valeur.toLowerCase())) {
      Alert.alert('Déjà présent', `« ${valeur} » est déjà dans la liste.`);
      return;
    }
    setEnCours(true);
    await enregistrer([...etiquettes, valeur]);
    setEnCours(false);
    setModalOuvert(false);
    setSaisie('');
  }

  function supprimer(valeur: string) {
    Alert.alert('Supprimer ?', valeur, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => enregistrer(etiquettes.filter((e) => e !== valeur)) },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre={titre} />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl p-3.5">
            <View className="flex-row flex-wrap gap-2">
              {etiquettes.map((e) => (
                <Pressable
                  key={e}
                  onLongPress={() => supprimer(e)}
                  accessibilityLabel={`${e} — appui long pour supprimer`}
                  className="flex-row items-center gap-1.5 bg-[#F2F0EA] rounded-[10px] px-3 py-2">
                  <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">{e}</Text>
                  <Pressable onPress={() => supprimer(e)} hitSlop={8} accessibilityLabel={`Supprimer ${e}`}>
                    <Ionicons name="close" size={13} color="rgba(0,0,0,0.4)" />
                  </Pressable>
                </Pressable>
              ))}

              <Pressable
                onPress={() => setModalOuvert(true)}
                className="rounded-[10px] px-3 py-2"
                style={{ borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.35)', borderStyle: 'dashed' }}>
                <Text className="text-[12.5px] font-bold text-[#2563EB]">{libelleAjout}</Text>
              </Pressable>
            </View>

            {etiquettes.length === 0 ? (
              <Text className="text-[12.5px] text-black/40 text-center py-4">Rien d&apos;enregistré pour le moment.</Text>
            ) : null}
          </View>
        </ScrollView>

        <Modal visible={modalOuvert} transparent animationType="fade" onRequestClose={() => setModalOuvert(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-6">
            <View className="bg-white rounded-2xl p-5 w-full">
              <Text className="text-[15px] font-extrabold text-[#1A1A1A]">{libelleAjout}</Text>
              <TextInput
                value={saisie}
                onChangeText={setSaisie}
                placeholder={placeholder}
                placeholderTextColor="rgba(0,0,0,0.35)"
                autoFocus
                className="border-[1.5px] border-[#0B3D2A] rounded-[14px] px-3.5 py-3.5 mt-3.5 text-[13.5px] text-[#1A1A1A]"
              />
              <View className="flex-row gap-2.5 mt-4">
                <Pressable
                  onPress={() => setModalOuvert(false)}
                  className="flex-1 items-center py-3 rounded-full border border-black/10">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={ajouter}
                  disabled={!saisie.trim() || enCours}
                  className={`flex-1 items-center py-3 rounded-full ${!saisie.trim() ? 'bg-emerald-500/40' : 'bg-emerald-500'}`}>
                  <Text className="text-[13px] font-bold text-white">Ajouter</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
