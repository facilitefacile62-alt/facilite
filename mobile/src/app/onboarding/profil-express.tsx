import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import BandeauOnboarding from '@/components/BandeauOnboarding';
import BoutonAction from '@/components/BoutonAction';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Onboarding — Profil express (visiteur), maquette « Onboarding — Profil express ».
export default function OnboardingProfilExpressScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const connu = (profile?.full_name as string | undefined) ?? '';
  const [prenom, setPrenom] = useState(connu.split(' ')[0] ?? '');
  const [nom, setNom] = useState(connu.split(' ').slice(1).join(' '));
  const [enregistrement, setEnregistrement] = useState(false);

  async function continuer() {
    if (!user?.id) return;
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: `${prenom.trim()} ${nom.trim()}`.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      router.replace('/marketplace');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer votre profil.");
    } finally {
      setEnregistrement(false);
    }
  }

  const champ = { height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff', paddingHorizontal: 20, fontSize: 16, color: '#1A1A1A', outlineStyle: 'none' } as object;

  return (
    <BandeauOnboarding image={require('../../../assets/images/onboarding/onboarding-express-v2.jpg')} centrage={30} retour>
      <Text className="text-[26px] font-black text-[#111] text-center">Profil express</Text>
      <Text className="text-[14.5px] text-center mt-2 mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>Juste votre nom pour commencer vos achats.</Text>

      <Text className="text-[13.5px] font-black text-[#111] mb-1.5">Prénom</Text>
      <TextInput value={prenom} onChangeText={setPrenom} placeholder="Votre prénom" placeholderTextColor="rgba(0,0,0,0.35)" style={champ} />
      <Text className="text-[13.5px] font-black text-[#111] mt-4 mb-1.5">Nom</Text>
      <TextInput value={nom} onChangeText={setNom} placeholder="Votre nom" placeholderTextColor="rgba(0,0,0,0.35)" style={champ} />
      <View className="mt-4">
        <BoutonAction titre="Accéder à la marketplace" sousTitre="Découvrir et acheter des articles" icone="cart-outline" onPress={continuer} chargement={enregistrement} />
      </View>
    </BandeauOnboarding>
  );
}
