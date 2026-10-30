import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ContenuAPropos from '@/components/ContenuAPropos';
import ContenuParametres from '@/components/ContenuParametres';
import EnteteModifierInfos from '@/components/EnteteModifierInfos';

// « Modifier infos » : À propos et Paramètres sont deux pages d'un même glisseur, avec le MÊME mouvement que « Facilité | Locaux » du menu ☰ :
// la page suit le doigt, se cale en douceur au relâchement (ou revient si le glissé est trop court), et toucher un onglet fait le même
// déplacement animé. L'onglet souligné change dès que le glissé dépasse la moitié.
export default function ModifierInfosPager({ depart }: { depart: 0 | 1 }) {
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
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif={actif === 0 ? 'apropos' : 'parametres'} surChoix={aller} />
        <View className="flex-1" style={{ overflow: 'hidden' }} {...pager.panHandlers}>
          <Animated.View
            style={{ flex: 1, width: largeur * 2, flexDirection: 'row', transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, -largeur] }) }] }}>
            <View style={{ width: largeur }}>
              <ContenuAPropos />
            </View>
            <View style={{ width: largeur }}>
              <ContenuParametres />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
