import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { IconMenuHamburger, IconNotifs, IconRecherche } from '@/components/facilite-icons';
import PanneauMenuProfil from '@/components/PanneauMenuProfil';
import PanneauNotifications from '@/components/PanneauNotifications';

// En-tête partagé, simplifié : la navigation principale vit maintenant dans
// la barre d'onglets native du bas (app-tabs.tsx : Accueil/Offres/
// Extracteur/Messages/Profil), donc la rangée à 6 icônes du dossier de
// design (redondante avec cette barre) est retirée. Profil a sa place dans
// les onglets ; Notifications prend sa place ici, en haut à droite, à
// l'emplacement où était l'avatar — badges à ajouter dans un point séparé.
//
// Notifications et Menu s'ouvrent en <Modal> (couvrent tout l'écran quelle
// que soit la taille réelle de ce header) plutôt qu'en overlay positionné
// localement. Recherche pousse /recherche (écran à part, voir
// app/recherche.tsx) via le Stack racine.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

export default function FaciliteHeader() {
  const router = useRouter();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <View className="bg-white border-b border-black/[0.06]">
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-3">
        <Pressable onPress={() => router.replace('/')}>
          <Text className="text-blue-600 text-[18px] font-black">Facilité</Text>
        </Pressable>
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={() => router.push('/recherche')}>
            <IconRecherche />
          </Pressable>
          <Pressable onPress={() => setNotifsOuvertes(true)}>
            <IconNotifs />
          </Pressable>
          <Pressable onPress={() => setMenuOuvert(true)}>
            <IconMenuHamburger />
          </Pressable>
        </View>
      </View>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
      <PanneauMenuProfil visible={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}
