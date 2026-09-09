import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type LangueProfil = { id?: string; name: string; level: string };

// Reproduction du contenu réel de 12d-profil-experiences.html : le nom de
// fichier du handoff est décalé d'un cran par rapport à ce qu'il affiche
// (titre "🌐 Langues du profil" + sc-for languageRows) — décision déjà
// actée avec l'utilisateur : suivre le contenu, pas le nom de fichier.
// Données réelles profiles.languages ([{ name, level }], voir
// src/app/profil/page.js côté web) ; "Principal" (mock: l.principal)
// n'existe pas comme champ en base — affiché sur la première langue du
// tableau, simple convention d'affichage plutôt qu'une colonne inventée.
// Ajout/suppression écrivent réellement sur profiles.languages.
export default function ProfilLanguesScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const langues = Array.isArray(profile?.languages) ? (profile.languages as LangueProfil[]) : [];

  const [modalOuvert, setModalOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [niveau, setNiveau] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(nouvelles: LangueProfil[]) {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ languages: nouvelles, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
      return;
    }
    await refreshProfile();
  }

  async function ajouterLangue() {
    if (!nom.trim() || !niveau.trim()) return;
    setEnCours(true);
    await enregistrer([...langues, { id: `lang-${Date.now()}`, name: nom.trim(), level: niveau.trim() }]);
    setEnCours(false);
    setModalOuvert(false);
    setNom('');
    setNiveau('');
  }

  function supprimerLangue(index: number) {
    Alert.alert('Supprimer cette langue ?', langues[index]?.name, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => enregistrer(langues.filter((_, i) => i !== index)) },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-5 py-4">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Langues</Text>
        </View>
        <View className="h-px bg-black/[0.08] mx-5 mb-3.5" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-bold text-[#1A1A1A]">🌐 Langues du profil</Text>
              <Pressable onPress={() => setModalOuvert(true)} className="border border-emerald-500/40 rounded-full px-3 py-1.5">
                <Text className="text-[12px] font-semibold text-emerald-500">+ Ajouter une langue</Text>
              </Pressable>
            </View>

            <View className="gap-2.5 mt-3">
              {langues.length === 0 ? (
                <Text className="text-[12.5px] text-black/40 text-center py-4">
                  Aucune langue enregistrée pour le moment.
                </Text>
              ) : (
                langues.map((l, i) => (
                  <View key={l.id ?? i} className="flex-row items-center gap-3 bg-[#f7faf9] rounded-xl p-3">
                    <View className="w-[30px] h-[30px] rounded-full bg-[#d7f2ea] items-center justify-center">
                      <Text className="text-[14px]">🌐</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[13.5px] font-bold text-[#1A1A1A]">{l.name}</Text>
                        {i === 0 && (
                          <View className="bg-[#d7f2ea] rounded-full px-1.5 py-0.5">
                            <Text className="text-[10px] font-semibold text-emerald-500">Principal</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[12px] text-black/50 mt-0.5">{l.level}</Text>
                    </View>
                    <Pressable onPress={() => supprimerLangue(i)}>
                      <Ionicons name="trash-outline" size={16} color="rgba(0,0,0,0.35)" />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        <Modal visible={modalOuvert} transparent animationType="fade" onRequestClose={() => setModalOuvert(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-6">
            <View className="bg-white rounded-2xl p-5 w-full">
              <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Ajouter une langue</Text>
              <TextInput
                value={nom}
                onChangeText={setNom}
                placeholder="Langue (ex : Wolof)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-3.5 text-[13.5px] text-[#1A1A1A]"
              />
              <TextInput
                value={niveau}
                onChangeText={setNiveau}
                placeholder="Niveau (ex : Courant)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-2.5 text-[13.5px] text-[#1A1A1A]"
              />
              <View className="flex-row gap-2.5 mt-4">
                <Pressable
                  onPress={() => setModalOuvert(false)}
                  className="flex-1 items-center py-3 rounded-full border border-black/10">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={ajouterLangue}
                  disabled={!nom.trim() || !niveau.trim() || enCours}
                  className={`flex-1 items-center py-3 rounded-full ${
                    !nom.trim() || !niveau.trim() ? 'bg-emerald-500/40' : 'bg-emerald-500'
                  }`}>
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
