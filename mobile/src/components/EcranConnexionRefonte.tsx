import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Keyboard, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoCle } from '@/components/EcranConnexion';
import { SITE_URL } from '@/lib/webEcrans';

// Gabarit des deux écrans « connexion par e-mail » et « mot de passe » (maquettes du 30/10/2026, dossier Telechargement-connexion-email) :
// bandeau vert #0B3D2A de 150 px avec le logo clé FIXE (halo 88, rond 62, clé 40), feuille crème #F7F4EE aux coins du haut arrondis à 20 px,
// marges de 18 px, 14 px entre les éléments, champs et boutons de 50 px de haut aux coins de 14 px. Utilisé SEULEMENT par ces deux écrans :
// les autres écrans de connexion gardent EcranConnexion.
export const BANDEAU = '#0B3D2A';
export const FEUILLE = '#F7F4EE';
export const VERT = '#10B981';
export const GRIS_BOUTON = '#B9B4AA';

/** Forme commune des champs, du bouton Google et des boutons : 50 px, coins de 14 px. */
export const FORME = { height: 50, borderRadius: 14 } as const;
/** Champ blanc : contour fin et légère ombre. */
export const CHAMP_BLANC = {
  ...FORME,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.12)',
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

function useClavierOuvert(): boolean {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setOuvert(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setOuvert(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return ouvert;
}

function LiensBas() {
  const ouvrir = (chemin: string) => Linking.openURL(`${SITE_URL}${chemin}`).catch(() => {});
  const style = { fontSize: 10.5, color: 'rgba(0,0,0,0.5)', textDecorationLine: 'underline' as const };
  return (
    <View className="flex-row justify-center items-center gap-2">
      <Pressable onPress={() => Alert.alert('Mentions légales', 'Cette page arrive bientôt.')}>
        <Text style={style}>Mentions légales</Text>
      </Pressable>
      <Text style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.4)' }}>·</Text>
      <Pressable onPress={() => ouvrir('/conditions')}>
        <Text style={style}>CGU</Text>
      </Pressable>
      <Text style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.4)' }}>·</Text>
      <Pressable onPress={() => ouvrir('/politique-de-confidentialite')}>
        <Text style={style}>Confidentialité</Text>
      </Pressable>
    </View>
  );
}

export default function EcranConnexionRefonte({ children, retour }: { children: ReactNode; retour?: () => void }) {
  const insets = useSafeAreaInsets();
  const clavier = useClavierOuvert();
  return (
    <View className="flex-1" style={{ backgroundColor: BANDEAU }}>
      <View style={{ height: insets.top + 150, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }}>
        <LogoCle taille={88} />
        {retour ? (
          <Pressable
            onPress={retour}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={6}
            className="items-center justify-center"
            style={{ position: 'absolute', left: 10, top: insets.top + 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1" style={{ backgroundColor: FEUILLE, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 22, paddingBottom: clavier ? 16 : Math.max(insets.bottom, 12) + 4, gap: 14 }}>
          {children}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          {!clavier ? <LiensBas /> : null}
        </ScrollView>
      </View>
    </View>
  );
}
