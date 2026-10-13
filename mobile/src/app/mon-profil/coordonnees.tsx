import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Coordonnées — maquette 54 (version du 12/10/2026) : quatre lignes —
// Téléphone, WhatsApp, E-mail, Ville — avec le libellé en petites capitales
// grises, la valeur en gras et un chevron. Un appui sur une ligne l'ouvre en
// modification ; « OK » enregistre cette ligne seule (plus de bouton
// « Enregistrer » global, absent de la maquette).
// Colonnes réelles de `profiles` (mêmes noms que le site) : phone,
// contact_whatsapp, contact_email, city. L'e-mail du compte (auth) n'est
// pas modifiable ici — c'est l'écran Sécurité & Connexion qui s'en charge.
const CHAMPS = [
  { cle: 'phone', libelle: 'TÉLÉPHONE', placeholder: '+221 77 000 00 00', clavier: 'phone-pad' },
  { cle: 'contact_whatsapp', libelle: 'WHATSAPP', placeholder: '+221 77 000 00 00', clavier: 'phone-pad' },
  { cle: 'contact_email', libelle: 'E-MAIL', placeholder: 'nom@exemple.com', clavier: 'email-address' },
  { cle: 'city', libelle: 'VILLE', placeholder: 'Dakar, Sénégal', clavier: 'default' },
] as const;

export default function ProfilCoordonneesScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [edition, setEdition] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);

  const valeur = (cle: string) => {
    const v = profile?.[cle];
    return typeof v === 'string' ? v : '';
  };

  async function enregistrer(cle: string) {
    if (!user?.id || enCours) return;
    setEnCours(true);
    try {
      await enregistrerChampsProfil(user.id, { [cle]: saisie.trim() || null });
      await refreshProfile();
      setEdition(null);
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
          <View className="bg-white rounded-2xl px-4 py-1">
            {CHAMPS.map((c, i) => {
              const enEdition = edition === c.cle;
              return (
                <View key={c.cle} className={i > 0 ? 'border-t border-black/[0.06]' : ''}>
                  {enEdition ? (
                    <View className="py-3">
                      <Text className="text-[10.5px] font-bold text-black/40 tracking-wider">{c.libelle}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <TextInput
                          value={saisie}
                          onChangeText={setSaisie}
                          autoFocus
                          placeholder={c.placeholder}
                          placeholderTextColor="rgba(0,0,0,0.3)"
                          keyboardType={c.clavier}
                          autoCapitalize={c.cle === 'contact_email' ? 'none' : 'sentences'}
                          onSubmitEditing={() => enregistrer(c.cle)}
                          className="flex-1 text-[14px] font-bold text-[#1A1A1A]"
                          style={{ paddingVertical: 4, outlineStyle: 'none' } as object}
                        />
                        <Pressable onPress={() => enregistrer(c.cle)} disabled={enCours} accessibilityLabel="Enregistrer" hitSlop={8} className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: '#D7F2EA' }}>
                          {enCours ? <ActivityIndicator color="#047857" size="small" /> : <Ionicons name="checkmark" size={18} color="#047857" />}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setSaisie(valeur(c.cle));
                        setEdition(c.cle);
                      }}
                      className="flex-row items-center py-3"
                      accessibilityRole="button">
                      <View className="flex-1">
                        <Text className="text-[10.5px] font-bold text-black/40 tracking-wider">{c.libelle}</Text>
                        <Text className="text-[14px] font-bold mt-0.5" style={{ color: valeur(c.cle) ? '#1A1A1A' : 'rgba(0,0,0,0.3)' }}>
                          {valeur(c.cle) || c.placeholder}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
