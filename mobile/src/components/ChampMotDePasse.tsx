import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

/** Champ mot de passe avec l'œil : toucher pour voir ce qu'on a écrit, retoucher pour le masquer. */
export default function ChampMotDePasse({
  valeur,
  onChange,
  placeholder = '••••••••',
  nouveau,
  onFocus,
}: {
  valeur: string;
  onChange: (t: string) => void;
  placeholder?: string;
  /** Mot de passe à créer (et non à saisir) : indique au clavier de proposer un mot de passe fort. */
  nouveau?: boolean;
  onFocus?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View className="flex-row items-center border-[1.5px] border-[#0B3D2A] rounded-[14px] mt-2">
      <TextInput
        value={valeur}
        onFocus={onFocus}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(0,0,0,0.3)"
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={nouveau ? 'new-password' : 'current-password'}
        style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 14, color: '#1A1A1A', outlineStyle: 'none' } as object}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{ width: 46, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color="rgba(0,0,0,0.55)" />
      </Pressable>
    </View>
  );
}
