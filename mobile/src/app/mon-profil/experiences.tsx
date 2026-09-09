import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type ExperienceProfil = {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startYear?: string;
  isCurrent?: boolean;
};

// Reproduction du contenu réel de 12e-profil-formation.html : le nom de
// fichier du handoff est décalé d'un cran (voir langues.tsx) — ce fichier
// affiche "💼 Expérience professionnelle" + sc-for experienceRows, c'est
// donc bien l'écran Expériences. Pas d'écran "Formation" séparé construit
// dans ce point : aucun fichier du handoff n'en contient réellement le
// contenu (décision actée avec l'utilisateur).
// Données réelles profiles.experiences ([{ title, company, location,
// startYear, isCurrent, ... }], voir src/app/profil/page.js et
// src/app/in/[username]/PublicProfileClient.jsx côté web). employmentType
// et startMonth existent aussi côté web mais ne sont pas demandés dans ce
// formulaire d'ajout mobile, volontairement minimal.
const PALETTE = ['#2563EB', '#10B981', '#7C3AED', '#F59E0B', '#DC2626', '#0EA5E9'];

export default function ProfilExperiencesScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const experiences = Array.isArray(profile?.experiences) ? (profile.experiences as ExperienceProfil[]) : [];

  const [modalOuvert, setModalOuvert] = useState(false);
  const [poste, setPoste] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [ville, setVille] = useState('');
  const [annee, setAnnee] = useState('');
  const [enCoursPoste, setEnCoursPoste] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer(nouvelles: ExperienceProfil[]) {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ experiences: nouvelles, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
      return;
    }
    await refreshProfile();
  }

  async function ajouterExperience() {
    if (!poste.trim() || !entreprise.trim()) return;
    setEnregistrement(true);
    await enregistrer([
      ...experiences,
      {
        id: `exp-${Date.now()}`,
        title: poste.trim(),
        company: entreprise.trim(),
        location: ville.trim() || undefined,
        startYear: annee.trim() || undefined,
        isCurrent: enCoursPoste,
      },
    ]);
    setEnregistrement(false);
    setModalOuvert(false);
    setPoste('');
    setEntreprise('');
    setVille('');
    setAnnee('');
    setEnCoursPoste(false);
  }

  function supprimerExperience(index: number) {
    Alert.alert('Supprimer cette expérience ?', experiences[index]?.title, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => enregistrer(experiences.filter((_, i) => i !== index)) },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-5 py-4">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Expériences professionnelles</Text>
        </View>
        <View className="h-px bg-black/[0.08] mx-5 mb-3.5" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-bold text-[#1A1A1A]">💼 Expérience professionnelle</Text>
              <Pressable onPress={() => setModalOuvert(true)} className="border border-[#2563EB]/35 rounded-full px-3 py-1.5">
                <Text className="text-[12px] font-semibold text-[#2563EB]">+ Ajouter une expérience</Text>
              </Pressable>
            </View>

            <View className="gap-3 mt-3">
              {experiences.length === 0 ? (
                <Text className="text-[12.5px] text-black/40 text-center py-4">
                  Aucune expérience enregistrée pour le moment.
                </Text>
              ) : (
                experiences.map((x, i) => (
                  <View
                    key={x.id ?? i}
                    className={`flex-row items-start gap-3 pb-3 ${
                      i < experiences.length - 1 ? 'border-b border-black/[0.06]' : ''
                    }`}>
                    <View
                      className="w-[34px] h-[34px] rounded-[9px] items-center justify-center"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}>
                      <Text className="text-white text-[12.5px] font-bold">
                        {(x.company || 'EX').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[13.5px] font-bold text-[#1A1A1A]">{x.title}</Text>
                      <Text className="text-[12px] text-black/50 mt-0.5">
                        {x.company}
                        {x.location ? ` • ${x.location}` : ''}
                      </Text>
                      <Text className="text-[11.5px] text-black/40 mt-0.5">
                        {x.startYear ? `${x.startYear} — ` : ''}
                        {x.isCurrent ? 'En cours' : 'Terminé'}
                      </Text>
                    </View>
                    <Pressable onPress={() => supprimerExperience(i)}>
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
              <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Ajouter une expérience</Text>
              <TextInput
                value={poste}
                onChangeText={setPoste}
                placeholder="Poste (ex : Juriste)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-3.5 text-[13.5px] text-[#1A1A1A]"
              />
              <TextInput
                value={entreprise}
                onChangeText={setEntreprise}
                placeholder="Entreprise"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-2.5 text-[13.5px] text-[#1A1A1A]"
              />
              <TextInput
                value={ville}
                onChangeText={setVille}
                placeholder="Ville (optionnel)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-2.5 text-[13.5px] text-[#1A1A1A]"
              />
              <TextInput
                value={annee}
                onChangeText={setAnnee}
                placeholder="Année de début (ex : 2023)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                keyboardType="number-pad"
                className="border border-black/10 rounded-xl px-3.5 py-3 mt-2.5 text-[13.5px] text-[#1A1A1A]"
              />
              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-[13px] font-semibold text-[#1A1A1A]">Poste actuel</Text>
                <Switch value={enCoursPoste} onValueChange={setEnCoursPoste} trackColor={{ true: '#2563EB' }} />
              </View>
              <View className="flex-row gap-2.5 mt-4">
                <Pressable
                  onPress={() => setModalOuvert(false)}
                  className="flex-1 items-center py-3 rounded-full border border-black/10">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={ajouterExperience}
                  disabled={!poste.trim() || !entreprise.trim() || enregistrement}
                  className={`flex-1 items-center py-3 rounded-full ${
                    !poste.trim() || !entreprise.trim() ? 'bg-[#2563EB]/40' : 'bg-[#2563EB]'
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
