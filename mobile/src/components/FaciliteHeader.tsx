import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { IconMenuHamburger, IconNotifs, IconRecherche } from '@/components/facilite-icons';

// En-tête partagé, simplifié : la navigation principale vit maintenant dans
// la barre d'onglets native du bas (app-tabs.tsx : Accueil/Offres/
// Extracteur/Messages/Profil), donc la rangée à 6 icônes du dossier de
// design (redondante avec cette barre) est retirée. Profil a sa place dans
// les onglets ; Notifications prend sa place ici, en haut à droite, à
// l'emplacement où était l'avatar — badges à ajouter dans un point séparé.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

export default function FaciliteHeader() {
  const router = useRouter();

  return (
    <View className="bg-white border-b border-black/[0.06]">
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-3">
        <Pressable onPress={() => router.replace('/')}>
          <Text className="text-blue-600 text-[18px] font-black">Facilité</Text>
        </Pressable>
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={() => BIENTOT('Recherche')}>
            <IconRecherche />
          </Pressable>
          <Pressable onPress={() => BIENTOT('Notifications')}>
            <IconNotifs />
          </Pressable>
          <Pressable onPress={() => BIENTOT('Menu')}>
            <IconMenuHamburger />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
