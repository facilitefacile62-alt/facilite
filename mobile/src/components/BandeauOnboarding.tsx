import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Gabarit des écrans d'onboarding 23 à 26 : illustration pleine largeur de
// 250 px (recadrée `cover`, centrée à `centrage` % en hauteur), sous laquelle
// une carte crème #FAF6F1 remonte de 24 px, coins hauts arrondis à 24 px,
// légère ombre. `retour` pose le rond blanc de 44 px sur l'image (écrans 24,
// 25 et 26).
export default function BandeauOnboarding({
  image,
  centrage,
  retour,
  children,
}: {
  image: number;
  centrage: number;
  retour?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ backgroundColor: '#FAF6F1' }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Image
          alt=""
          source={image}
          contentFit="cover"
          contentPosition={{ top: `${centrage}%`, left: '50%' }}
          style={{ width: '100%', height: 250 }}
        />
        <View
          style={{
            flexGrow: 1,
            marginTop: -24,
            backgroundColor: '#FAF6F1',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 26,
            paddingBottom: insets.bottom + 24,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: -3 },
            elevation: 6,
          }}>
          {children}
        </View>
      </ScrollView>
      {retour ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding/bienvenue' as never))}
          accessibilityLabel="Retour"
          className="absolute items-center justify-center bg-white"
          style={{ top: insets.top + 12, left: 16, width: 44, height: 44, borderRadius: 22 }}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
      ) : null}
    </View>
  );
}
