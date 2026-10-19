import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { traduire, useLangue } from '@/lib/i18n';
import { LANGUES, lireLangue, type CodeLangue } from '@/lib/preferencesConnexion';

// Langue de l'application — écran 02, en page entière (partagé par la page d'accueil de connexion et par les Paramètres :
// ce dernier ne peut PAS vivre dans le groupe (auth), dont le garde renvoie à l'accueil tout utilisateur déjà connecté) : croix à gauche, liste
// avec nom natif en gras et nom en français dessous, coche verte sur la langue
// choisie. Uniquement des langues internationales parlées en Afrique (pas de
// wolof pour le moment).
//
// Seul le français est traduit aujourd'hui : choisir une autre langue
// enregistre le choix, mais les textes de l'application restent en français
// tant que les traductions n'existent pas — on le dit à l'utilisateur.
export default function EcranLangue({ repli }: { repli: Href }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { changer, t } = useLangue();
  const [choisie, setChoisie] = useState<CodeLangue>('fr');

  useEffect(() => {
    lireLangue().then(setChoisie);
  }, []);

  async function choisir(code: CodeLangue) {
    setChoisie(code);
    await changer(code);
    if (code !== 'fr') {
      Alert.alert(
        traduire(code, 'Langue appliquée'),
        traduire(code, 'Les menus, la messagerie et les réglages sont traduits. Les autres écrans restent en français et seront traduits progressivement.')
      );
    }
    if (router.canGoBack()) router.back();
    else router.replace(repli);
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4" style={{ height: 66, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace(repli))}
          accessibilityLabel="Fermer"
          className="items-center justify-center"
          style={{ width: 44, height: 44 }}>
          <Ionicons name="close" size={26} color="#374151" />
        </Pressable>
        <Text className="text-[20px] font-black text-[#111] ml-3">{t("Langue de l'application")}</Text>
      </View>

      {LANGUES.map((l) => {
        const actif = l.code === choisie;
        return (
          <Pressable key={l.code} onPress={() => choisir(l.code)} className="flex-row items-center px-5" style={{ height: 70 }}>
            <View
              className="items-center justify-center"
              style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: actif ? '#10B981' : '#4B5563' }}>
              {actif ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981' }} /> : null}
            </View>
            <View className="ml-5">
              <Text className="text-[17px] text-[#111]">{l.natif}</Text>
              <Text className="text-[14px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{l.francais}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
