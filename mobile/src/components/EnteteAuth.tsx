import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

// En-tête des écrans d'authentification (maquettes 45, 57 et 58) : « Facilité »
// en bleu à gauche, bouton vert « Connexion » à droite, sur la bande #e3dbcc.
// Le bouton ramène à l'écran de connexion par téléphone.
//
// Ni recherche ni menu, contrairement au site : avant la connexion, ils
// ouvriraient des écrans protégés et renverraient aussitôt ici — des boutons
// morts.
export default function EnteteAuth() {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between px-5 py-3.5" style={{ backgroundColor: '#e3dbcc' }}>
      <Text className="text-[19px] font-black text-[#2563EB]">Facilité</Text>
      <Pressable
        onPress={() => router.replace('/login')}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 rounded-full px-4 py-2.5"
        style={{ backgroundColor: '#10B981' }}>
        <Ionicons name="log-in-outline" size={15} color="#fff" />
        <Text className="text-white text-[13px] font-bold">Connexion</Text>
      </Pressable>
    </View>
  );
}
