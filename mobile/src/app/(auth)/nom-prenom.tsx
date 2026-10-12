import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import EcranConnexion, { CHAMP } from '@/components/EcranConnexion';
import { useAuth } from '@/context/AuthContext';
import { marquerNomConfirme, nomPropose } from '@/lib/preferencesConnexion';
import { supabase } from '@/lib/supabase';

// « Comment t'appelles-tu ? » — écrans 07 et 13 (et leurs versions avec
// clavier), montrés UNE SEULE FOIS, à la toute première connexion d'un
// nouveau compte (le garde du layout racine décide, voir _layout.tsx).
//
// Après un téléphone : champs vides (07). Après un e-mail ou Google : champs
// pré-remplis depuis le compte (13), modifiables.
//
// Retour : ramène à la connexion (écrans 07 et 13 → 03). La session est alors
// fermée : le compte reste créé, la page sera de nouveau proposée à la
// prochaine connexion.
const champStyle = {
  height: 52,
  borderRadius: 12,
  backgroundColor: CHAMP,
  paddingHorizontal: 16,
  fontSize: 16,
  color: '#111',
  outlineStyle: 'none',
} as object;

export default function NomPrenomScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile } = useAuth();
  const propose = nomPropose(user);
  const [prenom, setPrenom] = useState(propose.prenom);
  const [nom, setNom] = useState(propose.nom);
  const [enregistrement, setEnregistrement] = useState(false);

  const valide = prenom.trim().length > 0 && nom.trim().length > 0;

  async function continuer() {
    if (!valide || !user?.id || enregistrement) return;
    setEnregistrement(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: `${prenom.trim()} ${nom.trim()}`, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      setEnregistrement(false);
      Alert.alert('Erreur', "Impossible d'enregistrer ton nom pour le moment. Réessaie.");
      return;
    }
    await marquerNomConfirme(user.id);
    await refreshProfile();
    setEnregistrement(false);
    router.replace('/onboarding/bienvenue');
  }

  async function retour() {
    await signOut();
    router.replace('/login');
  }

  return (
    <EcranConnexion retour={retour}>
      <Text className="text-[26px] font-black text-[#111] mt-1">Comment t&apos;appelles-tu ?</Text>
      <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        {propose.depuisCompte
          ? 'Nous avons repris le nom de ton compte. Vérifie-le ou corrige-le.'
          : 'Ton numéro est vérifié. Indique ton prénom et ton nom pour créer ton compte.'}
      </Text>

      <Text className="text-[15px] font-black text-[#111] mb-2">Prénom</Text>
      <TextInput
        value={prenom}
        onChangeText={setPrenom}
        placeholder="Ton prénom"
        placeholderTextColor="rgba(0,0,0,0.45)"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        style={champStyle}
      />

      <Text className="text-[15px] font-black text-[#111] mt-4 mb-2">Nom</Text>
      <TextInput
        value={nom}
        onChangeText={setNom}
        placeholder="Ton nom"
        placeholderTextColor="rgba(0,0,0,0.45)"
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        style={champStyle}
      />

      <View className="mt-5">
        <BoutonContinuer onPress={continuer} actif={valide} chargement={enregistrement} />
      </View>
    </EcranConnexion>
  );
}
