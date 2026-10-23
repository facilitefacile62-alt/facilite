import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import EcranConnexion, { CHAMP } from '@/components/EcranConnexion';
import { useAuth } from '@/context/AuthContext';
import { definirMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from '@/lib/motDePasse';
import { marquerEtapeMotDePasseVue } from '@/lib/preferencesConnexion';

// Étape FACULTATIVE après « Comment t'appelles-tu ? » (choix du 21/10/2026) : créer un mot de passe de secours, au cas où le
// code de confirmation n'arriverait pas un jour. « Passer cette étape » mène directement à la suite.
const champStyle = { flex: 1, height: 52, paddingLeft: 16, fontSize: 16, color: '#111', outlineStyle: 'none' } as object;

/** Champ mot de passe avec l'œil : toucher pour voir ce qu'on a écrit, retoucher pour le masquer. */
function ChampMotDePasse({ valeur, onChange, placeholder }: { valeur: string; onChange: (t: string) => void; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View className="flex-row items-center" style={{ height: 52, borderRadius: 12, backgroundColor: CHAMP }}>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(0,0,0,0.45)"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        style={champStyle}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{ width: 48, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="rgba(0,0,0,0.55)" />
      </Pressable>
    </View>
  );
}

/** Une ligne de la liste « ce qui est bon » : coche verte quand c'est rempli, rond gris sinon. */
function Critere({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <View className="flex-row items-center gap-2 mt-2">
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? '#10B981' : 'rgba(0,0,0,0.35)'} />
      <Text className="text-[13.5px] font-bold" style={{ color: ok ? '#047857' : 'rgba(0,0,0,0.55)' }}>{texte}</Text>
    </View>
  );
}

export default function MotDePasseFacultatifScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  // L'étape est notée dès qu'on la quitte (continuer ou passer) : en revenant plus tard, elle n'est plus reproposée.
  const suite = async () => {
    if (user?.id) await marquerEtapeMotDePasseVue(user.id);
    router.replace('/onboarding/email' as Href);
  };
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
    await suite();
  }

  return (
    <EcranConnexion>
      <Text className="text-[26px] font-black text-[#111] mt-1">Crée un mot de passe</Text>
      <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        Facultatif. Il te servira si le code de confirmation n’arrive pas, par exemple sur un nouveau téléphone.
      </Text>

      <Text className="text-[15px] font-black text-[#111] mb-2">Mot de passe</Text>
      <ChampMotDePasse valeur={motDePasse} onChange={setMotDePasse} placeholder={`Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`} />

      <Text className="text-[15px] font-black text-[#111] mt-4 mb-2">Confirmer le mot de passe</Text>
      <ChampMotDePasse valeur={confirmation} onChange={setConfirmation} placeholder="Écris-le une seconde fois" />

      <View className="mt-3">
        <Critere ok={assezLong} texte={`Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`} />
        <Critere ok={confirmation.length > 0 && motDePasse === confirmation} texte="Les deux mots de passe sont identiques" />
      </View>
      {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text> : null}

      <View className="mt-5">
        <BoutonContinuer onPress={continuer} actif={valide} chargement={chargement} />
      </View>
      <Pressable onPress={() => suite()} hitSlop={8} className="mt-5 self-center">
        <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Passer cette étape</Text>
      </Pressable>
    </EcranConnexion>
  );
}
