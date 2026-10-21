import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteAjouter, CarteLigne, ListeCartes, PASTILLE_CERTIFIE, TexteVide } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
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
        <EnteteRubrique titre="Langues" />

        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          <ListeCartes>
            {langues.length === 0 ? <TexteVide texte="Aucune langue enregistrée pour le moment." /> : null}
            {langues.map((l, i) => (
              <CarteLigne
                key={l.id ?? i}
                icone="globe-outline"
                titre={l.name}
                sous={l.level}
                badgeTitre={i === 0 ? { ...PASTILLE_CERTIFIE, texte: 'Principal' } : undefined}
                droite={
                  <Pressable onPress={() => supprimerLangue(i)} hitSlop={8} accessibilityLabel="Supprimer cette langue">
                    <Ionicons name="trash-outline" size={17} color="rgba(0,0,0,0.35)" />
                  </Pressable>
                }
              />
            ))}
            <CarteAjouter libelle="Ajouter une langue" onPress={() => setModalOuvert(true)} />
          </ListeCartes>
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
