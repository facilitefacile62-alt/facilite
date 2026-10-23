import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteModifierInfos from '@/components/EnteteModifierInfos';
import ReglagesCartes from '@/components/ReglagesCartes';
import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques } from '@/lib/vendeur';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// « Modifier infos » > Paramètres : la MÊME page de réglages que Locaux (décision du 23/10/2026 : une seule page de réglages pour les deux
// plateformes ; voir components/ReglagesCartes.tsx). L'en-tête « Modifier infos » et ses onglets restent ceux de Facilité.
export default function ParametresScreen() {
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const [estVendeur, setEstVendeur] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      chargerMesBoutiques(userId)
        .then((liste) => setEstVendeur(liste.length > 0))
        .catch(() => setEstVendeur(false));
    }, [userId])
  );

  function deconnexion() {
    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter pour accéder à votre compte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif="parametres" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }}>
          <ReglagesCartes plateforme="facilite" estVendeur={estVendeur} deconnexion={deconnexion} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
