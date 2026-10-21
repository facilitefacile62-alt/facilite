import { Ionicons } from '@expo/vector-icons';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Keyboard, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SITE_URL } from '@/lib/webEcrans';

// Gabarit commun des écrans de connexion 03 à 14 (spécification du
// 12/10/2026) : bandeau vert foncé #0B3D2A avec le logo clé FIXE (même taille,
// même position d'un écran à l'autre), feuille crème dont le haut est arrondi,
// bouton retour 44 × 44 en haut à gauche de la feuille (si `retour`), liens
// légaux en bas masqués quand le clavier est ouvert.
//
// Aucun KeyboardAvoidingView : la feuille se remplit depuis le haut, donc le
// bouton « Continuer » ne bouge pas quand le clavier s'ouvre ; le clavier ne
// s'ouvre jamais seul (aucun autoFocus dans les écrans qui utilisent ce
// gabarit).
export const VERT_BANDEAU = '#0B3D2A';
export const CREME = '#FAF6F1';
export const CHAMP = '#EEECE7';

// La clé du logo, dessinée en vectoriel : le fichier cle-facilite.png a un fond
// blanc opaque, qui ferait un carré blanc sur le disque vert menthe.
export function CleVectorielle({ hauteur }: { hauteur: number }) {
  return (
    <Svg width={hauteur * 0.5} height={hauteur} viewBox="0 0 24 48">
      <Ellipse cx={12} cy={8.5} rx={6} ry={7.2} stroke="#4A3320" strokeWidth={3} fill="none" />
      <Rect x={10.4} y={16} width={3.2} height={28} rx={1} fill="#4A3320" />
      <Rect x={8.2} y={19.5} width={7.6} height={2.6} rx={1.2} fill="#4A3320" />
      <Rect x={13} y={34} width={5.2} height={3} rx={0.8} fill="#4A3320" />
      <Rect x={13} y={39.5} width={4.2} height={3} rx={0.8} fill="#4A3320" />
    </Svg>
  );
}

export function LogoCle({ taille = 90 }: { taille?: number }) {
  const disque = Math.round(taille * 0.69);
  return (
    <View
      className="items-center justify-center"
      style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: '#0F5C3B' }}>
      <View
        className="items-center justify-center"
        style={{ width: disque, height: disque, borderRadius: disque / 2, backgroundColor: '#C4F3DD' }}>
        <CleVectorielle hauteur={disque * 0.62} />
      </View>
    </View>
  );
}

export function useClavierOuvert(): boolean {
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

export function LiensLegaux() {
  const ouvrir = (chemin: string) => Linking.openURL(`${SITE_URL}${chemin}`).catch(() => {});
  return (
    <View className="flex-row justify-center items-center gap-2">
      {/* Le site n'a pas encore de page « Mentions légales » : on le dit au lieu d'ouvrir une page inexistante. */}
      <Pressable onPress={() => Alert.alert('Mentions légales', 'Cette page arrive bientôt.')}>
        <Text className="text-[13px] underline" style={{ color: 'rgba(0,0,0,0.5)' }}>Mentions légales</Text>
      </Pressable>
      <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.4)' }}>·</Text>
      <Pressable onPress={() => ouvrir('/conditions')}>
        <Text className="text-[13px] underline" style={{ color: 'rgba(0,0,0,0.5)' }}>CGU</Text>
      </Pressable>
      <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.4)' }}>·</Text>
      <Pressable onPress={() => ouvrir('/politique-de-confidentialite')}>
        <Text className="text-[13px] underline" style={{ color: 'rgba(0,0,0,0.5)' }}>Confidentialité</Text>
      </Pressable>
    </View>
  );
}

export default function EcranConnexion({ children, retour }: { children: ReactNode; retour?: () => void }) {
  const insets = useSafeAreaInsets();
  const clavier = useClavierOuvert();

  return (
    <View className="flex-1" style={{ backgroundColor: VERT_BANDEAU }}>
      <View className="items-center justify-center" style={{ paddingTop: insets.top, height: insets.top + 108 }}>
        <LogoCle />
      </View>

      <View className="flex-1" style={{ backgroundColor: CREME, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: retour ? 6 : 24, paddingBottom: clavier ? 16 : Math.max(insets.bottom, 12) + 4 }}>
          {retour ? (
            <Pressable
              onPress={retour}
              accessibilityLabel="Retour"
              hitSlop={4}
              className="items-center justify-center"
              style={{ width: 44, height: 44, marginLeft: -12 }}>
              <Ionicons name="chevron-back" size={26} color="#111" />
            </Pressable>
          ) : null}
          {children}
          {/* Liens légaux dans le flux : en bas de la feuille si le contenu est court,
              sous le contenu s'il est long (écran 17), jamais par-dessus. */}
          <View style={{ flexGrow: 1, minHeight: 20 }} />
          {!clavier ? <LiensLegaux /> : null}
        </ScrollView>
      </View>
    </View>
  );
}
