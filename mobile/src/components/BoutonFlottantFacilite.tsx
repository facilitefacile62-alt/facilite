import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Bouton flottant de Facilité (13/10/2026) : il remplace le micro de l'assistant
// et RASSEMBLE trois actions, affichées en pile quand on l'ouvre :
//  - Extracteur (candidature à partir d'une annonce) — il n'est plus dans la
//    barre du bas, où « Autour de moi » a pris sa place ;
//  - Assistant vocal — pas encore branché dans l'application : on le dit, on ne
//    le simule pas ;
//  - Écrire un e-mail — écran d'écriture à la manière de Gmail.
// Il flotte au-dessus de la barre du bas sur les cinq onglets de Facilité.
const VERT = '#10B981';

type Action = { id: string; libelle: string; icone: keyof typeof Ionicons.glyphMap; couleur: string; agir: () => void };

export default function BoutonFlottantFacilite() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);

  const actions: Action[] = [
    { id: 'email', libelle: 'Écrire un e-mail', icone: 'mail', couleur: '#2563EB', agir: () => router.push('/ecrire-email' as Href) },
    { id: 'assistant', libelle: 'Assistant vocal', icone: 'mic', couleur: VERT, agir: () => Alert.alert('Assistant vocal', 'Cette fonctionnalité arrive dans une prochaine mise à jour.') },
    { id: 'extracteur', libelle: 'Extracteur', icone: 'flash', couleur: '#F59E0B', agir: () => router.push('/extracteur') },
  ];

  const bas = Math.max(insets.bottom, 6) + 76;

  return (
    <>
      {ouvert ? (
        <Pressable
          onPress={() => setOuvert(false)}
          accessibilityLabel="Fermer le menu des actions"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 20, elevation: 10 }}
        />
      ) : null}

      <View style={{ position: 'absolute', right: 16, bottom: bas, alignItems: 'flex-end', gap: 12, zIndex: 30, elevation: 12, pointerEvents: 'box-none' }}>
        {ouvert
          ? actions.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  setOuvert(false);
                  a.agir();
                }}
                accessibilityRole="button"
                accessibilityLabel={a.libelle}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#1A1A1A' }}>{a.libelle}</Text>
                </View>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: a.couleur, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                  <Ionicons name={a.icone} size={22} color="#fff" />
                </View>
              </Pressable>
            ))
          : null}

        <Pressable
          onPress={() => setOuvert((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: ouvert }}
          accessibilityLabel={ouvert ? 'Fermer le menu des actions' : 'Ouvrir le menu des actions'}
          style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <LinearGradient colors={['#10B981', '#0ea975']} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ouvert ? 'close' : 'apps'} size={26} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}
