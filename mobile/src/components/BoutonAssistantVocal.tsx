import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Bouton flottant « assistant » (micro) de la maquette « Accueil » (01).
// Charte §3 : il n'est présent QUE sur le fil d'actualité — il vivait
// jusqu'ici sur l'écran Fonctionnalités, où aucune maquette ne le montre.
// L'assistant vocal n'est pas encore branché : on le dit, on ne le simule pas.
export default function BoutonAssistantVocal() {
  return (
    <Pressable
      onPress={() => Alert.alert('Assistant vocal', 'Cette fonctionnalité arrive dans une prochaine mise à jour.')}
      accessibilityLabel="Assistant vocal"
      // zIndex/elevation : sans eux le bouton passe SOUS les cartes du fil
      // (constaté en aperçu web) alors qu'il doit flotter au-dessus.
      style={{ zIndex: 10, elevation: 6 }}
      className="absolute right-4 bottom-4 w-[52px] h-[52px] rounded-full overflow-hidden shadow-lg">
      <LinearGradient colors={['#10B981', '#0ea975']} className="w-full h-full items-center justify-center">
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M9 3H15V14A3 3 0 0 1 9 14V3Z" stroke="#fff" strokeWidth={1.8} />
          <Path d="M6 11V12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12V11" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M12 18V21" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      </LinearGradient>
    </Pressable>
  );
}
