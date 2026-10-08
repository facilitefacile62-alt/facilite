import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Coordonnées — maquette 54 : Téléphone, WhatsApp, E-mail, Ville.
// Colonnes réelles de `profiles` (mêmes noms que le site) : phone,
// contact_whatsapp, contact_email, city. L'e-mail du compte (auth) n'est
// pas modifiable ici — c'est l'écran Sécurité & Connexion qui s'en charge.
const CHAMPS = [
  { cle: 'phone', libelle: 'TÉLÉPHONE', icone: 'call-outline', placeholder: '+221 77 000 00 00', clavier: 'phone-pad' },
  { cle: 'contact_whatsapp', libelle: 'WHATSAPP', icone: 'logo-whatsapp', placeholder: '+221 77 000 00 00', clavier: 'phone-pad' },
  { cle: 'contact_email', libelle: 'E-MAIL', icone: 'mail-outline', placeholder: 'nom@exemple.com', clavier: 'email-address' },
  { cle: 'city', libelle: 'VILLE', icone: 'location-outline', placeholder: 'Dakar, Sénégal', clavier: 'default' },
] as const;

export default function ProfilCoordonneesScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const valeurInitiale = (cle: string) => {
    const v = profile?.[cle];
    return typeof v === 'string' ? v : '';
  };

  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHAMPS.map((c) => [c.cle, valeurInitiale(c.cle)]))
  );
  const [enCours, setEnCours] = useState(false);

  const modifie = CHAMPS.some((c) => (valeurs[c.cle] ?? '') !== valeurInitiale(c.cle));

  async function enregistrer() {
    if (!user?.id || enCours) return;
    setEnCours(true);
    try {
      await enregistrerChampsProfil(
        user.id,
        Object.fromEntries(CHAMPS.map((c) => [c.cle, valeurs[c.cle]?.trim() || null]))
      );
      await refreshProfile();
      Alert.alert('Coordonnées enregistrées');
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Coordonnées" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-2xl px-3.5 py-1">
            {CHAMPS.map((c, i) => (
              <View key={c.cle} className={i > 0 ? 'border-t border-black/[0.06] pt-3 mt-1' : 'pt-3'}>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name={c.icone} size={12} color="rgba(0,0,0,0.4)" />
                  <Text className="text-[10.5px] font-bold text-black/40 tracking-wider">{c.libelle}</Text>
                </View>
                <TextInput
                  value={valeurs[c.cle] ?? ''}
                  onChangeText={(v) => setValeurs((a) => ({ ...a, [c.cle]: v }))}
                  placeholder={c.placeholder}
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  keyboardType={c.clavier}
                  autoCapitalize={c.cle === 'contact_email' ? 'none' : 'sentences'}
                  className="text-[14px] font-bold text-[#1A1A1A] pb-3"
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={enregistrer}
            disabled={!modifie || enCours}
            className="flex-row items-center gap-3 rounded-[14px] p-3 mt-4"
            style={{
              backgroundColor: '#F3FBF7',
              borderWidth: 1.5,
              borderColor: '#34D399',
              opacity: !modifie || enCours ? 0.5 : 1,
            }}>
            <View className="w-10 h-10 rounded-[10px] bg-[#D7F2EA] items-center justify-center">
              {enCours ? <ActivityIndicator color="#047857" size="small" /> : <Ionicons name="checkmark" size={18} color="#047857" />}
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-[#1A1A1A]">Enregistrer</Text>
              <Text className="text-[12px] text-black/45 mt-0.5">Téléphone, WhatsApp, e-mail et ville</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
