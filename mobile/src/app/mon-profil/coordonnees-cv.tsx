import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FOND_CARTES } from '@/components/CarteMenu';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Contact DU CV (« Modifier infos » > À propos) : téléphone, e-mail et ville que le candidat choisit de mettre sur son CV, pour que les
// recruteurs sachent comment le joindre. Colonnes À PART du profil (cv_telephone, cv_email, cv_ville, migration 20261024120000) : elles restent
// VIDES tant que la personne ne les remplit pas — rien n'est repris du numéro ou de l'e-mail du compte.
const CHAMPS = [
  { cle: 'cv_telephone', libelle: 'Téléphone', icone: 'call-outline', placeholder: '+221 77 000 00 00', clavier: 'phone-pad' },
  { cle: 'cv_email', libelle: 'E-mail', icone: 'mail-outline', placeholder: 'nom@exemple.com', clavier: 'email-address' },
  { cle: 'cv_ville', libelle: 'Ville', icone: 'location-outline', placeholder: 'Dakar, Sénégal', clavier: 'default' },
] as const;

export default function ProfilCoordonneesCvScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [edition, setEdition] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);

  const valeur = (cle: string) => {
    const v = profile?.[cle];
    return typeof v === 'string' ? v.trim() : '';
  };

  async function enregistrer(cle: string, effacer = false) {
    if (!user?.id || enCours) return;
    const texte = effacer ? '' : saisie.trim();
    if (cle === 'cv_email' && texte && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texte)) {
      Alert.alert('E-mail non valide', 'Vérifiez l’adresse (exemple : nom@exemple.com).');
      return;
    }
    setEnCours(true);
    try {
      await enregistrerChampsProfil(user.id, { [cle]: texte || null });
      await refreshProfile();
      setEdition(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Contact" />

        <ScrollView contentContainerClassName="px-5 pb-8 gap-3" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text className="text-[12.5px] leading-[18px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
            Ce sont les informations de contact de votre CV, pour que les recruteurs sachent comment vous joindre. Elles restent vides tant que vous ne les remplissez pas.
          </Text>

          {CHAMPS.map((c) => {
            const enEdition = edition === c.cle;
            const v = valeur(c.cle);
            return (
              <View
                key={c.cle}
                style={{ borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: enEdition ? '#34D399' : '#D9D1C1', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <Pressable
                  onPress={() => {
                    setSaisie(v);
                    setEdition(enEdition ? null : c.cle);
                  }}
                  accessibilityRole="button"
                  className="flex-row items-center gap-3 px-3.5"
                  style={{ minHeight: 64, paddingVertical: 10 }}>
                  <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D7F2EA', borderWidth: 1, borderColor: '#BFEBDC' }}>
                    <Ionicons name={c.icone} size={19} color="#059669" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">{c.libelle}</Text>
                    <Text numberOfLines={1} className="text-[12px] mt-0.5" style={{ color: v ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.35)', fontStyle: v ? 'normal' : 'italic' }}>
                      {v || 'Non renseigné'}
                    </Text>
                  </View>
                  <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0EEE8' }}>
                    <Ionicons name={enEdition ? 'chevron-up' : v ? 'create-outline' : 'add'} size={16} color="#1A1A1A" />
                  </View>
                </Pressable>

                {enEdition ? (
                  <View className="px-3.5 pb-3.5 gap-2.5">
                    <TextInput
                      value={saisie}
                      onChangeText={setSaisie}
                      autoFocus
                      placeholder={c.placeholder}
                      placeholderTextColor="rgba(0,0,0,0.3)"
                      keyboardType={c.clavier}
                      autoCapitalize={c.cle === 'cv_email' ? 'none' : 'sentences'}
                      autoCorrect={false}
                      onSubmitEditing={() => enregistrer(c.cle)}
                      className="border-[1.5px] border-[#0B3D2A] rounded-[14px] px-3.5 py-3 text-[14px] text-[#1A1A1A]"
                      style={{ outlineStyle: 'none' } as object}
                    />
                    <View className="flex-row items-center gap-2.5">
                      <Pressable
                        onPress={() => enregistrer(c.cle)}
                        disabled={enCours}
                        className="flex-row items-center gap-2 rounded-full px-5 py-2.5"
                        style={{ backgroundColor: '#047857', opacity: enCours ? 0.5 : 1 }}>
                        {enCours ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={15} color="#fff" />}
                        <Text className="text-[13px] font-bold text-white">Enregistrer</Text>
                      </Pressable>
                      {v ? (
                        <Pressable onPress={() => enregistrer(c.cle, true)} disabled={enCours} hitSlop={8}>
                          <Text className="text-[13px] font-bold" style={{ color: '#DC2626' }}>Effacer</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
