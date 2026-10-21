import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteAjouter, CarteLigne, ListeCartes, TexteVide } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil, periodeFormation, type Formation } from '@/lib/profilChamps';

// Formation — maquette 51. Données réelles : profiles.educations
// ([{ school, degree, field, startYear, endYear, isCurrent }], voir
// handleAddEducation dans src/app/profil/page.js côté web). Même forme
// d'entrée que le site, pour qu'une formation saisie ici s'affiche là-bas
// et réciproquement.
function initiales(nom: string): string {
  return (nom || '?').trim().slice(0, 2).toUpperCase();
}

export default function ProfilFormationScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const formations: Formation[] = Array.isArray(profile?.educations) ? (profile.educations as Formation[]) : [];

  const [modalOuvert, setModalOuvert] = useState(false);
  const [etablissement, setEtablissement] = useState('');
  const [diplome, setDiplome] = useState('');
  const [domaine, setDomaine] = useState('');
  const [anneeDebut, setAnneeDebut] = useState('');
  const [anneeFin, setAnneeFin] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer(nouvelles: Formation[]) {
    if (!user?.id) return;
    try {
      await enregistrerChampsProfil(user.id, { educations: nouvelles });
      await refreshProfile();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    }
  }

  async function ajouter() {
    if (!etablissement.trim() || !diplome.trim()) return;
    setEnregistrement(true);
    await enregistrer([
      {
        id: `edu-${Date.now()}`,
        school: etablissement.trim(),
        degree: diplome.trim(),
        field: domaine.trim() || undefined,
        startYear: anneeDebut.trim() || undefined,
        endYear: enCours ? undefined : anneeFin.trim() || undefined,
        isCurrent: enCours,
      },
      ...formations,
    ]);
    setEnregistrement(false);
    setModalOuvert(false);
    setEtablissement('');
    setDiplome('');
    setDomaine('');
    setAnneeDebut('');
    setAnneeFin('');
    setEnCours(false);
  }

  function supprimer(index: number) {
    Alert.alert('Supprimer cette formation ?', formations[index]?.school, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => enregistrer(formations.filter((_, i) => i !== index)) },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Formation" />

        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          <ListeCartes>
            {formations.length === 0 ? <TexteVide texte="Aucune formation enregistrée pour le moment." /> : null}
            {formations.map((f, i) => (
              <CarteLigne
                key={String(f.id ?? i)}
                icone="school-outline"
                titre={f.school}
                sous={[f.degree, f.field].filter(Boolean).join(' - ')}
                enfants={
                  periodeFormation(f) ? <Text style={{ fontSize: 11.5, marginTop: 2, color: 'rgba(0,0,0,0.4)' }}>{periodeFormation(f)}</Text> : null
                }
                droite={
                  <Pressable onPress={() => supprimer(i)} hitSlop={8} accessibilityLabel="Supprimer">
                    <Ionicons name="trash-outline" size={17} color="rgba(0,0,0,0.35)" />
                  </Pressable>
                }
              />
            ))}
            <CarteAjouter libelle="Ajouter une formation" onPress={() => setModalOuvert(true)} />
          </ListeCartes>
        </ScrollView>

        <Modal visible={modalOuvert} transparent animationType="fade" onRequestClose={() => setModalOuvert(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-6">
            <View className="bg-white rounded-2xl p-5 w-full">
              <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Ajouter une formation</Text>

              <ChampTexte valeur={etablissement} onChange={setEtablissement} placeholder="Établissement *" />
              <ChampTexte valeur={diplome} onChange={setDiplome} placeholder="Diplôme / certificat *" />
              <ChampTexte valeur={domaine} onChange={setDomaine} placeholder="Domaine (facultatif)" />
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <ChampTexte valeur={anneeDebut} onChange={setAnneeDebut} placeholder="Année de début" numerique />
                </View>
                <View className="flex-1">
                  <ChampTexte
                    valeur={enCours ? '' : anneeFin}
                    onChange={setAnneeFin}
                    placeholder={enCours ? 'En cours' : 'Année de fin'}
                    numerique
                    desactive={enCours}
                  />
                </View>
              </View>

              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-[13px] text-[#1A1A1A]">Formation en cours</Text>
                <Switch value={enCours} onValueChange={setEnCours} trackColor={{ true: '#10B981' }} />
              </View>

              <View className="flex-row gap-2.5 mt-4">
                <Pressable
                  onPress={() => setModalOuvert(false)}
                  className="flex-1 items-center py-3 rounded-full border border-black/10">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={ajouter}
                  disabled={!etablissement.trim() || !diplome.trim() || enregistrement}
                  className={`flex-1 items-center py-3 rounded-full ${
                    !etablissement.trim() || !diplome.trim() ? 'bg-emerald-500/40' : 'bg-emerald-500'
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

/** Champ de saisie de la charte §2.1 : bordure 1,5 px vert foncé, coins 14 px. */
function ChampTexte({
  valeur,
  onChange,
  placeholder,
  numerique,
  desactive,
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  numerique?: boolean;
  desactive?: boolean;
}) {
  return (
    <TextInput
      value={valeur}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="rgba(0,0,0,0.35)"
      editable={!desactive}
      keyboardType={numerique ? 'number-pad' : 'default'}
      maxLength={numerique ? 4 : undefined}
      className="border-[1.5px] border-[#0B3D2A] rounded-[14px] px-3.5 py-3.5 mt-2.5 text-[13.5px] text-[#1A1A1A]"
      style={desactive ? { opacity: 0.5 } : undefined}
    />
  );
}
