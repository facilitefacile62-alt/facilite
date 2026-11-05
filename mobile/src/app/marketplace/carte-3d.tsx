import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { adresseCarte3D } from '@/lib/carte3d';

// Carte 3D (prototype) : la page 3D du site dans une WebView. La page gère elle-même ses replis (appareil faible, WebGL absent) et renvoie vers la carte 2D du SITE ; dans l'application,
// le bouton « Retour » ramène à la carte « Autour de moi ».
export default function Carte3DScreen() {
  const router = useRouter();
  const url = adresseCarte3D();
  const [charge, setCharge] = useState(false);
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/marketplace/autour'));

  return (
    <View className="flex-1" style={{ backgroundColor: '#E8EAEE' }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 py-2.5" style={{ backgroundColor: '#fff' }}>
          <Pressable onPress={retour} accessibilityRole="button" accessibilityLabel="Retour" className="flex-row items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: '#F2F0EA' }}>
            <Ionicons name="arrow-back" size={15} color="#1A1A1A" />
            <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Retour</Text>
          </Pressable>
          <Text className="flex-1 text-[13.5px] font-extrabold text-[#1A1A1A]">Carte 3D (prototype)</Text>
        </View>
        {url ? (
          <View className="flex-1">
            <WebView
              source={{ uri: url }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['https://*']}
              setSupportMultipleWindows={false}
              onLoadEnd={() => setCharge(true)}
              style={{ flex: 1, backgroundColor: '#E8EAEE' }}
            />
            {!charge ? (
              <View pointerEvents="none" className="absolute inset-0 items-center justify-center" style={{ backgroundColor: '#E8EAEE' }}>
                <ActivityIndicator color="#10B981" />
                <Text className="mt-2 text-[12px] font-bold text-black/55">Chargement de la carte 3D…</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-[13px] font-bold text-black/60">La carte 3D n'est pas disponible pour le moment.</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
