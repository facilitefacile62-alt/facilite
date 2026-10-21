import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteAjouter, CarteLigne, ListeCartes, TexteVide } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type ExperienceProfil = {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  isCurrent?: boolean;
};

/** Période lisible ("Jan 2021 — Jan 2022" / "2021 — Présent"), comme sur le site (profil/page.js, PublicProfileClient.jsx). */
function periodeLisible(x: ExperienceProfil): string {
  const debut = [x.startMonth, x.startYear].filter(Boolean).join(' ');
  const fin = x.isCurrent ? 'Présent' : [x.endMonth, x.endYear].filter(Boolean).join(' ') || 'Terminé';
  if (!debut) return fin === 'Présent' ? 'Présent' : '';
  return `${debut} — ${fin}`;
}

// Reproduction du contenu réel de 12e-profil-formation.html : le nom de
// fichier du handoff est décalé d'un cran (voir langues.tsx) — ce fichier
// affiche "💼 Expérience professionnelle" + sc-for experienceRows, c'est
// donc bien l'écran Expériences. Pas d'écran "Formation" séparé construit
// dans ce point : aucun fichier du handoff n'en contient réellement le
// contenu (décision actée avec l'utilisateur).
// Données réelles profiles.experiences ([{ title, company, location, startMonth, startYear, endMonth,
// endYear, isCurrent, ... }], voir src/app/profil/page.js et src/app/in/[username]/PublicProfileClient.jsx
// côté web. L'affichage (periodeLisible) lit les 4 champs de date : une expérience créée depuis le site
// n'affichait ici que l'année de début suivie de « Terminé », sans l'année de fin réelle (signalé le
// 25/09/2026). Le formulaire d'ajout mobile reste volontairement minimal (pas de mois, ni employmentType).
const PALETTE = ['#2563EB', '#10B981', '#7C3AED', '#F59E0B', '#DC2626', '#0EA5E9'];

export default function ProfilExperiencesScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const experiences = Array.isArray(profile?.experiences) ? (profile.experiences as ExperienceProfil[]) : [];

  const [modalOuvert, setModalOuvert] = useState(false);
  const [poste, setPoste] = useState('');
  const [entreprise, setEntreprise] = useState('');
  const [ville, setVille] = useState('');
  const [annee, setAnnee] = useState('');
  const [anneeFin, setAnneeFin] = useState('');
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
        endYear: enCoursPoste ? undefined : anneeFin.trim() || undefined,
        isCurrent: enCoursPoste,
      },
    ]);
    setEnregistrement(false);
    setModalOuvert(false);
    setPoste('');
    setEntreprise('');
    setVille('');
    setAnnee('');
    setAnneeFin('');
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
        <EnteteRubrique titre="Expériences professionnelles" />

        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          <ListeCartes>
            {experiences.length === 0 ? <TexteVide texte="Aucune expérience enregistrée pour le moment." /> : null}
            {experiences.map((x, i) => (
              <CarteLigne
                key={x.id ?? i}
                icone="briefcase-outline"
                titre={x.title}
                sous={`${x.company}${x.location ? ` • ${x.location}` : ''} · ${x.isCurrent ? 'En cours' : 'Terminé'}`}
                enfants={
                  periodeLisible(x) ? <Text style={{ fontSize: 11.5, marginTop: 2, color: 'rgba(0,0,0,0.4)' }}>{periodeLisible(x)}</Text> : null
                }
                droite={
                  <Pressable onPress={() => supprimerExperience(i)} hitSlop={8} accessibilityLabel="Supprimer cette expérience">
                    <Ionicons name="trash-outline" size={17} color="rgba(0,0,0,0.35)" />
                  </Pressable>
                }
              />
            ))}
            <CarteAjouter libelle="Ajouter une expérience" onPress={() => setModalOuvert(true)} />
          </ListeCartes>
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
              {!enCoursPoste && (
                <TextInput
                  value={anneeFin}
                  onChangeText={setAnneeFin}
                  placeholder="Année de fin (ex : 2025)"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  keyboardType="number-pad"
                  className="border border-black/10 rounded-xl px-3.5 py-3 mt-2.5 text-[13.5px] text-[#1A1A1A]"
                />
              )}
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
