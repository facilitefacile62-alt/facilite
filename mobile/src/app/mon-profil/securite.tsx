import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Sécurité & Connexion — maquette 56 : informations du compte (téléphone
// SMS, e-mail confirmé, date de naissance, région/pays) puis définition
// d'un mot de passe.
//
// Les informations viennent du compte d'authentification (user.email,
// user.phone, email_confirmed_at) et de `profiles` (birth_date, country —
// noms vérifiés dans 20260802060000_profiles_deny_by_default.sql) : rien
// n'est affiché quand la valeur n'existe pas (« Non renseignée »), jamais
// une valeur d'exemple.
const LONGUEUR_MIN = 8;

/** "macoumba@gmail.com" -> "m***@gmail.com", comme la maquette. */
function emailMasque(email: string | undefined): string {
  if (!email) return 'Aucune adresse';
  const [local, domaine] = email.split('@');
  if (!domaine) return email;
  return `${local.slice(0, 1)}***@${domaine}`;
}

function texteOuNonRenseigne(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v : 'Non renseignée';
}

export default function ProfilSecuriteScreen() {
  const { user, profile } = useAuth();
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);

  const assezLong = motDePasse.length >= LONGUEUR_MIN;

  async function definirMotDePasse() {
    if (!assezLong || enCours) return;
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setEnCours(false);
    if (error) {
      Alert.alert('Mot de passe non enregistré', error.message);
      return;
    }
    setMotDePasse('');
    Alert.alert('Mot de passe enregistré', 'Vous pouvez désormais vous connecter avec ce mot de passe.');
  }

  const lignes = [
    {
      cle: 'telephone',
      libelle: 'Téléphone (SMS)',
      valeur: user?.phone ? user.phone : 'Aucun numéro',
      confirme: false,
    },
    {
      cle: 'email',
      libelle: 'E-mail',
      valeur: emailMasque(user?.email),
      confirme: Boolean(user?.email_confirmed_at),
    },
    {
      cle: 'naissance',
      libelle: 'Date de naissance',
      valeur: texteOuNonRenseigne(profile?.birth_date),
      confirme: false,
    },
    {
      cle: 'pays',
      libelle: 'Région / Pays',
      valeur: texteOuNonRenseigne(profile?.country),
      confirme: false,
    },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Sécurité & Connexion" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-2xl p-3.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="card-outline" size={15} color="#2563EB" />
              <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">Informations du compte</Text>
            </View>

            {lignes.map((l, i) => (
              <View key={l.cle} className={`py-3.5 ${i > 0 ? 'border-t border-black/[0.06]' : 'mt-1'}`}>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[12px] font-bold text-black/70">{l.libelle}</Text>
                      {l.confirme ? (
                        <View className="bg-[#D1FAE5] rounded-full px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-[#047857]">Confirmé</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Valeurs absentes en italique gris, comme la maquette 56. */}
                    <Text
                      className="text-[13.5px] mt-1"
                      style={/^(Non renseign|Aucun num)/.test(l.valeur) ? { fontStyle: 'italic', color: 'rgba(0,0,0,0.45)' } : { fontWeight: '700', color: '#1A1A1A' }}>
                      {l.valeur}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={15} color="rgba(0,0,0,0.35)" />
                </View>
              </View>
            ))}
          </View>

          <View className="bg-white rounded-2xl p-3.5 mt-3.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="key-outline" size={15} color="#2563EB" />
              <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">Créer un mot de passe</Text>
            </View>

            <View className="bg-[#F7F7F5] rounded-xl p-3 mt-3">
              <Text className="text-[12px] text-black/60 leading-[17px]">
                Ce compte n&apos;a pas encore de mot de passe (connexion Google ou téléphone). Vous pourrez ensuite aussi
                vous connecter avec un mot de passe.
              </Text>
            </View>

            <Text className="text-[12px] font-bold text-black/55 mt-3.5">Nouveau mot de passe</Text>
            <TextInput
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder="••••••••"
              placeholderTextColor="rgba(0,0,0,0.3)"
              secureTextEntry
              autoCapitalize="none"
              className="border-[1.5px] border-[#0B3D2A] rounded-[14px] px-3.5 py-3.5 mt-2 text-[14px] text-[#1A1A1A]"
            />
            <View className="flex-row items-center gap-1.5 mt-2">
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: assezLong ? '#10B981' : 'rgba(0,0,0,0.25)' }}
              />
              <Text className="text-[11.5px] text-black/45">{LONGUEUR_MIN} caractères minimum</Text>
            </View>

            <Pressable
              onPress={definirMotDePasse}
              disabled={!assezLong || enCours}
              className="flex-row items-center gap-3 rounded-full mt-3.5"
              style={{
                backgroundColor: '#F3FBF7',
                borderWidth: 1.5,
                borderColor: '#34D399',
                opacity: !assezLong || enCours ? 0.5 : 1,
                paddingVertical: 8,
                paddingLeft: 8,
                paddingRight: 20,
              }}>
              <View className="w-11 h-11 rounded-full bg-[#D7F2EA] items-center justify-center">
                {enCours ? (
                  <ActivityIndicator color="#047857" size="small" />
                ) : (
                  <Ionicons name="lock-closed-outline" size={18} color="#047857" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-[#1A1A1A]">Enregistrer le mot de passe</Text>
                <Text className="text-[12px] text-black/45 mt-0.5">Connexion par e-mail</Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
