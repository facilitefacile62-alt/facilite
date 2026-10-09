import { useEffect, useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { LONGUEUR_CODE } from '@/lib/connexionSms';

// Les six cases du code SMS (maquette 44), partagées par la connexion et
// l'inscription par téléphone. Case active bordée de bleu, case remplie vert
// foncé. Une seule saisie réelle : le champ est invisible et couvre les
// cases, ce qui permet la saisie automatique du code reçu par SMS
// (textContentType oneTimeCode / autoComplete sms-otp).
const VERT_FONCE = '#0B3D2A';
const BLEU = '#2563EB';

export default function SaisieCodeSms({
  code,
  onChange,
  autoFocus = true,
}: {
  code: string;
  onChange: (valeur: string) => void;
  autoFocus?: boolean;
}) {
  const champ = useRef<TextInput>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => champ.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [autoFocus]);

  return (
    <Pressable onPress={() => champ.current?.focus()} accessibilityLabel="Saisir le code reçu par SMS">
      <View className="flex-row justify-between">
        {Array.from({ length: LONGUEUR_CODE }).map((_, i) => {
          const rempli = i < code.length;
          const actif = i === Math.min(code.length, LONGUEUR_CODE - 1);
          return (
            <View
              key={i}
              className="items-center justify-center rounded-[12px] bg-white"
              style={{
                width: 48,
                height: 54,
                borderWidth: 1.5,
                borderColor: actif ? BLEU : rempli ? VERT_FONCE : 'rgba(0,0,0,0.12)',
              }}>
              <Text className="text-[22px] font-black text-[#1A1A1A]">{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={champ}
        value={code}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, LONGUEUR_CODE))}
        keyboardType="number-pad"
        maxLength={LONGUEUR_CODE}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        caretHidden
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
      />
    </Pressable>
  );
}
