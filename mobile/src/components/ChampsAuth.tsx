import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { CHAMP } from '@/components/EcranConnexion';
import { IconGoogle } from '@/components/facilite-icons';

// Éléments communs aux écrans de connexion 15, 16 et 17 (mise à jour du
// 12/10/2026 : même design que l'écran 03 — champs #EEECE7 de 52 px à coins de
// 12 px, boutons en pilule, pas d'en-tête du site).

export function BoutonGoogle({ libelle, onPress, chargement }: { libelle: string; onPress: () => void; chargement?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={chargement}
      accessibilityRole="button"
      className="flex-row items-center justify-center gap-3 bg-white"
      style={{ height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: '#E5E2DC', opacity: chargement ? 0.6 : 1 }}>
      <IconGoogle size={20} />
      <Text className="text-[17px] font-black text-[#111]">{chargement ? 'Redirection…' : libelle}</Text>
    </Pressable>
  );
}

export function SeparateurOu({ texte = 'ou' }: { texte?: string }) {
  return (
    <View className="flex-row items-center gap-3 mt-5">
      <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
      <Text className="text-[13px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>{texte}</Text>
      <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
    </View>
  );
}

export function Etiquette({ texte }: { texte: string }) {
  return <Text className="text-[15px] font-black text-[#111] mb-2">{texte}</Text>;
}

/** Champ crème de l'écran 03 ; avec `masque`, un œil afficher/masquer. */
export function ChampCreme({ masque, ...props }: TextInputProps & { masque?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View className="flex-row items-center" style={{ height: 52, borderRadius: 12, backgroundColor: CHAMP, paddingHorizontal: 16 }}>
      <TextInput
        placeholderTextColor="rgba(0,0,0,0.45)"
        {...props}
        secureTextEntry={masque ? !visible : props.secureTextEntry}
        style={[{ flex: 1, fontSize: 16, color: '#111', outlineStyle: 'none' } as object, props.style]}
      />
      {masque ? (
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityLabel="Afficher ou masquer le mot de passe">
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(0,0,0,0.5)" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function BoiteErreur({ texte }: { texte: string }) {
  return (
    <View className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5 mt-3">
      <Text className="text-[12.5px] font-bold text-red-600">{texte}</Text>
    </View>
  );
}

export function LienTexte({ texte, onPress, couleur = '#10B981' }: { texte: string; onPress: () => void; couleur?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} className="self-center" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text className="text-[15px] font-bold" style={{ color: couleur }}>{texte}</Text>
    </Pressable>
  );
}
