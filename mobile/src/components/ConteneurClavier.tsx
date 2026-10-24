import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Keyboard, TextInput, View, type KeyboardEvent } from 'react-native';

// Garde TOUJOURS la zone de saisie visible : le contenu s'arrête au-dessus du clavier.
//
// KeyboardAvoidingView se trompait sous Android (clavier en superposition, zone sûre, barre du bas de la plateforme située SOUS la
// page) : la saisie restait cachée. Ici, la place prise par le clavier est MESURÉE : on compare le bas réel du conteneur (position à
// l'écran) avec le haut du clavier, et on ne rajoute que le recouvrement. Si le système a déjà réduit la fenêtre, le recouvrement est
// nul et rien n'est ajouté (jamais de double compensation). Le conteneur extérieur ne reçoit pas le rembourrage : sa mesure reste stable.
//
// Ensuite, le champ qui a le focus est mesuré à son tour : s'il reste trop près du clavier (page défilante, champ en bas de page), le
// contenu REMONTE juste assez pour qu'on voie ce qu'on écrit. Revérifié toutes les 300 ms tant que le clavier est ouvert (changement de champ).
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

export default function ConteneurClavier({ children }: { children: ReactNode }) {
  const racine = useRef<View>(null);
  const clavier = useRef<KeyboardEvent | null>(null);
  const [decalage, setDecalage] = useState(0);
  const [monte, setMonte] = useState(0);
  const monteRef = useRef(0);
  const MARGE = 28;

  const remonterChamp = useCallback(() => {
    const evenement = clavier.current;
    const champ = TextInput.State.currentlyFocusedInput?.();
    if (!evenement || !champ) {
      monteRef.current = 0;
      setMonte(0);
      return;
    }
    champ.measureInWindow((_x: number, y: number, _l: number, h: number) => {
      const hautClavier = evenement.endCoordinates.screenY > 0 ? evenement.endCoordinates.screenY : Dimensions.get('screen').height - evenement.endCoordinates.height;
      const basNaturel = y + h + monteRef.current;
      const besoin = Math.max(0, Math.round(basNaturel - (hautClavier - MARGE)));
      if (Math.abs(besoin - monteRef.current) > 2) {
        monteRef.current = besoin;
        setMonte(besoin);
      }
    });
  }, []);

  const mesurer = useCallback(() => {
    const evenement = clavier.current;
    if (!evenement) {
      setDecalage(0);
      return;
    }
    racine.current?.measureInWindow((_x, y, _l, h) => {
      const hautClavier = evenement.endCoordinates.screenY > 0 ? evenement.endCoordinates.screenY : Dimensions.get('screen').height - evenement.endCoordinates.height;
      setDecalage(Math.max(0, Math.round(y + h - hautClavier)));
      setTimeout(remonterChamp, 120);
    });
  }, [remonterChamp]);

  useEffect(() => {
    const ouvre = Keyboard.addListener('keyboardDidShow', (e) => {
      clavier.current = e;
      mesurer();
    });
    const ferme = Keyboard.addListener('keyboardDidHide', () => {
      clavier.current = null;
      monteRef.current = 0;
      setDecalage(0);
      setMonte(0);
    });
    const veille = setInterval(() => {
      if (clavier.current) remonterChamp();
    }, 300);
    return () => {
      ouvre.remove();
      ferme.remove();
      clearInterval(veille);
    };
  }, [mesurer, remonterChamp]);

  return (
    <View ref={racine} collapsable={false} style={{ flex: 1 }} onLayout={mesurer}>
      <View style={{ flex: 1, paddingBottom: decalage, transform: [{ translateY: -monte }] }}>{children}</View>
    </View>
  );
}
