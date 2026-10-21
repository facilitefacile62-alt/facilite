import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import EcranConnexion, { CHAMP } from '@/components/EcranConnexion';
import { definirMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from '@/lib/motDePasse';

// Étape FACULTATIVE après « Comment t'appelles-tu ? » (choix du 21/10/2026) : créer un mot de passe de secours, au cas où le
// code de confirmation n'arriverait pas un jour. « Passer cette étape » mène directement à la suite.
const champStyle = { height: 52, borderRadius: 12, backgroundColor: CHAMP, paddingHorizontal: 16, fontSize: 16, color: '#111', outlineStyle: 'none' } as object;

export default function MotDePasseFacultatifScreen() {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const suite = () => router.replace('/onboarding/bienvenue' as Href);
  const assezLong = motDePasse.length >= LONGUEUR_MIN_MOT_DE_PASSE;
  const valide = assezLong && motDePasse === confirmation;

  async function continuer() {
    if (!valide || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await definirMotDePasse(motDePasse);
    setChargement(false);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    suite();
  }

  return (
    <EcranConnexion>
      <Text className="text-[26px] font-black text-[#111] mt-1">Crée un mot de passe</Text>
      <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        Facultatif. Il te servira si le code de confirmation n’arrive pas, par exemple sur un nouveau téléphone.
      </Text>

      <Text className="text-[15px] font-black text-[#111] mb-2">Mot de passe</Text>
      <TextInput
        value={motDePasse}
        onChangeText={setMotDePasse}
        placeholder={`Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`}
        placeholderTextColor="rgba(0,0,0,0.45)"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        style={champStyle}
      />

      <Text className="text-[15px] font-black text-[#111] mt-4 mb-2">Confirmer le mot de passe</Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Écris-le une seconde fois"
        placeholderTextColor="rgba(0,0,0,0.45)"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        style={champStyle}
      />

      {confirmation.length > 0 && motDePasse !== confirmation ? (
        <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>Les deux mots de passe ne sont pas identiques.</Text>
      ) : null}
      {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text> : null}

      <View className="mt-5">
        <BoutonContinuer onPress={continuer} actif={valide} chargement={chargement} />
      </View>
      <Pressable onPress={suite} hitSlop={8} className="mt-5 self-center">
        <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Passer cette étape</Text>
      </Pressable>
    </EcranConnexion>
  );
}
