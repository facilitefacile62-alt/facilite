import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { FormulaireProfilVisiteur } from '@/app/marketplace/modifier-profil';
import { ReglagesMarketplace } from '@/app/marketplace/reglages';

// « Modifier infos » de Locaux : deux onglets, « Modifier profil » et « Réglages », qu'on fait glisser comme « Modifier infos » de Facilité et comme
// « Facilité | Locaux » du menu ☰ (la page suit le doigt, se cale en douceur, l'onglet souligné suit). Toucher un onglet fait le même déplacement.
const ONGLETS = ['Modifier profil', 'Réglages'] as const;

export default function ModifierInfosLocauxPager({ depart }: { depart: 0 | 1 }) {
  const largeur = Dimensions.get('window').width;
  const [position] = useState(() => new Animated.Value(depart));
  const pageCourante = useRef<0 | 1>(depart);
  const [actif, setActif] = useState<0 | 1>(depart);

  useEffect(() => {
    const id = position.addListener(({ value }) => setActif(value >= 0.5 ? 1 : 0));
    return () => position.removeListener(id);
  }, [position]);

  function aller(index: 0 | 1) {
    pageCourante.current = index;
    Animated.spring(position, { toValue: index, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
  }

  const pager = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderMove: (_e, g) => position.setValue(Math.max(-0.12, Math.min(1.12, pageCourante.current - g.dx / largeur))),
        onPanResponderRelease: (_e, g) => {
          let cible: 0 | 1 = pageCourante.current;
          if (g.dx <= -largeur * 0.2 || g.vx <= -0.4) cible = 1;
          else if (g.dx >= largeur * 0.2 || g.vx >= 0.4) cible = 0;
          aller(cible);
        },
        onPanResponderTerminate: () => aller(pageCourante.current),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position, largeur]
  );

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <EnteteMarketplace titre="Modifier infos" />
      <View className="flex-row items-center px-4 gap-6" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)', paddingTop: 12 }}>
        {ONGLETS.map((nom, i) => (
          <Pressable
            key={nom}
            onPress={() => aller(i as 0 | 1)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif === i }}
            style={{ paddingBottom: 10, borderBottomWidth: actif === i ? 2 : 0, borderBottomColor: '#1A1A1A', marginBottom: -1 }}>
            <Text className="text-[15px]" style={{ fontWeight: actif === i ? '900' : '700', color: actif === i ? '#1A1A1A' : 'rgba(0,0,0,0.45)' }}>
              {nom}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-1" style={{ overflow: 'hidden' }} {...pager.panHandlers}>
        <Animated.View
          style={{ flex: 1, width: largeur * 2, flexDirection: 'row', transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, -largeur] }) }] }}>
          <View style={{ width: largeur }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <FormulaireProfilVisiteur integre />
            </ScrollView>
          </View>
          <View style={{ width: largeur }}>
            <ReglagesMarketplace integre />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
