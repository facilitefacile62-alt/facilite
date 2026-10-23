import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { avatarPredefini } from '@/lib/avatarsPredefinis';

/** Rond de profil : avatar choisi, photo / logo, ou initiale du nom quand rien n'est choisi. */
export default function AvatarProfil({ valeur, nom, taille, fond = '#E4DED2' }: { valeur?: string | null; nom: string; taille: number; fond?: string }) {
  const avatar = avatarPredefini(valeur);
  const rond = { width: taille, height: taille, borderRadius: taille / 2, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (avatar) {
    return (
      <View style={[rond, { backgroundColor: avatar.fond }]}>
        <Text style={{ fontSize: taille * 0.52 }}>{avatar.emoji}</Text>
      </View>
    );
  }
  if (valeur && /^(https?:|data:)/.test(valeur)) {
    return (
      <View style={[rond, { backgroundColor: fond }]}>
        <Image source={{ uri: valeur }} alt="Photo de profil" style={{ width: taille, height: taille }} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={[rond, { backgroundColor: fond }]}>
      <Text style={{ fontSize: taille * 0.34, fontWeight: '900', color: '#1A1A1A' }}>{nom.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}
