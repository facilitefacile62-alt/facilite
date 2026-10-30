import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CHAMP } from '@/components/EcranConnexion';

// Les six cases du code (écrans 05, 06, 11 et 12), pour le SMS comme pour
// l'e-mail : cases #EEECE7, case active bordée de vert #10B981. Une seule
// saisie réelle : un champ invisible couvre les cases, ce qui permet la saisie
// automatique du code (oneTimeCode / sms-otp). Aucun focus automatique : le
// clavier ne s'ouvre qu'au toucher des cases.
export function CasesCode({
  code,
  onChange,
  longueur = 6,
}: {
  code: string;
  onChange: (valeur: string) => void;
  longueur?: number;
}) {
  const champ = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => champ.current?.focus()} accessibilityLabel="Saisir le code">
      <View className="flex-row justify-between">
        {Array.from({ length: longueur }).map((_, i) => {
          const actif = i === Math.min(code.length, longueur - 1);
          return (
            <View
              key={i}
              className="items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: CHAMP,
                borderWidth: actif ? 2 : 0,
                borderColor: '#10B981',
              }}>
              <Text className="text-[22px] font-black text-[#111]">{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={champ}
        value={code}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, longueur))}
        keyboardType="number-pad"
        maxLength={longueur}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        caretHidden
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
      />
    </Pressable>
  );
}

/** Case ronde des écrans de connexion (cochée : disque vert avec ✓). */
export function CaseRonde({
  cochee,
  onChange,
  texte,
}: {
  cochee: boolean;
  onChange: (v: boolean) => void;
  texte: string;
}) {
  return (
    <Pressable onPress={() => onChange(!cochee)} className="flex-row items-start gap-3" accessibilityRole="checkbox" accessibilityState={{ checked: cochee }}>
      <View
        className="items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          marginTop: 1,
          backgroundColor: cochee ? '#10B981' : 'transparent',
          borderWidth: cochee ? 0 : 1.5,
          borderColor: 'rgba(0,0,0,0.3)',
        }}>
        {cochee ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(0,0,0,0.6)', lineHeight: 19 }}>{texte}</Text>
    </Pressable>
  );
}

/** Bouton « Continuer » : vert pâle tant que désactivé, vert #10B981 ensuite. */
export function BoutonContinuer({
  onPress,
  actif,
  chargement,
  libelle = 'Continuer',
  noir = false,
}: {
  onPress: () => void;
  actif: boolean;
  chargement?: boolean;
  libelle?: string;
  /** Variante de la page de connexion : bouton noir, coins arrondis (pas vert). */
  noir?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!actif || chargement}
      accessibilityRole="button"
      className="items-center justify-center"
      style={noir ? { height: 58, borderRadius: 16, backgroundColor: actif ? '#1A1A1A' : '#B9B7B2' } : { height: 56, borderRadius: 28, backgroundColor: actif ? '#10B981' : '#BDEFD9' }}>
      <Text className="text-[17px] font-black text-white">{chargement ? '…' : libelle}</Text>
    </Pressable>
  );
}
