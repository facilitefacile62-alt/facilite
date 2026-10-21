import { useAuth } from '@/context/AuthContext';
import { importerDocument } from '@/lib/documents';
import { useFonctionnalites } from '@/lib/featureFlags';
import { demanderRemontee } from '@/lib/remonterFil';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Bouton « + » de Facilité (maquettes 01 et 02 du dossier plus-stories-messages) :
//  - bouton rond vert de 56 px (dégradé #34D399 → #0F766E, ombre) en bas à droite, au-dessus de la barre du bas ;
//  - sous lui, sur l'Accueil, petit bouton rond rouge #E11D48 de 36 px avec une flèche vers le haut : il remonte
//    en haut du fil par un défilement doux ;
//  - ouvert : le « + » tourne de 45° et devient « × », un voile blanc léger couvre la page et des pilules blanches
//    s'empilent au-dessus (texte à gauche, rond coloré à droite) : Importer un document (violet : propose une photo ou un PDF
//    sans changer d'écran, 2 documents au maximum), Écrire un e-mail, Assistant vocal, Extracteur.
//    Toucher le voile ou le « × » referme.
// L'Assistant vocal n'est pas encore branché dans l'application (interrupteur feat_voice_assistant coupé) : tant
// qu'il l'est, sa pilule n'est pas proposée plutôt que de simuler un assistant.
type Action = { id: string; libelle: string; icone: keyof typeof Ionicons.glyphMap; couleur: string; agir: () => void; interrupteur?: string };

export default function BoutonFlottantFacilite() {
  const router = useRouter();
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);
  const [rotation] = useState(() => new Animated.Value(0));
  const autorise = useFonctionnalites();
  const { user } = useAuth();

  useEffect(() => {
    Animated.timing(rotation, { toValue: ouvert ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [ouvert, rotation]);

  // Chaque action peut être coupée depuis le site (Administration → Fonctionnalités).
  const toutesActions: Action[] = [
    { id: 'document', libelle: 'Importer un document', icone: 'cloud-upload', couleur: '#7C3AED', agir: () => {
        // Import direct (photo ou PDF), sans quitter l'écran en cours ; 2 documents au maximum.
        if (!user?.id) {
          Alert.alert('Connexion requise', 'Connectez-vous pour importer un document.');
          return;
        }
        importerDocument(user.id)
          .then((d) => d && Alert.alert('Document ajouté', `« ${d.titre} » est dans Profil > Documents.`))
          .catch((e: Error) => Alert.alert('Ajout impossible', e.message));
      } },
    { id: 'email', libelle: 'Écrire un e-mail', icone: 'mail', couleur: '#2563EB', agir: () => router.push('/messages?ecrire=1' as Href) },
    { id: 'assistant', libelle: 'Assistant vocal', icone: 'mic', couleur: '#065F46', agir: () => Alert.alert('Assistant vocal', 'Cette fonctionnalité arrive dans une prochaine mise à jour.'), interrupteur: 'feat_voice_assistant' },
    { id: 'extracteur', libelle: 'Extracteur', icone: 'flash', couleur: '#F59E0B', agir: () => router.push('/extracteur'), interrupteur: 'nav_extracteur' },
  ];
  const actions = toutesActions.filter((a) => autorise(a.interrupteur));

  const sousAccueil = chemin === '/' || chemin === '/index';
  const bas = Math.max(insets.bottom, 6) + 76 + (sousAccueil ? 46 : 0);

  return (
    <>
      {ouvert ? (
        <Pressable
          onPress={() => setOuvert(false)}
          accessibilityLabel="Fermer le menu des actions"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)', zIndex: 20, elevation: 10 }}
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
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#fff',
                  borderRadius: 30,
                  paddingLeft: 18,
                  paddingRight: 6,
                  paddingVertical: 6,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>{a.libelle}</Text>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: a.couleur, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={a.icone} size={19} color="#fff" />
                </View>
              </Pressable>
            ))
          : null}

        <Pressable
          onPress={() => setOuvert((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: ouvert }}
          accessibilityLabel={ouvert ? 'Fermer le menu des actions' : 'Ouvrir le menu des actions'}
          style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', boxShadow: '0 6px 16px rgba(15,118,110,0.45)' }}>
          <LinearGradient colors={['#34D399', '#0F766E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
              <Ionicons name="add" size={32} color="#fff" />
            </Animated.View>
          </LinearGradient>
        </Pressable>

      </View>

      {/* Flèche rouge « revenir en haut » : sous le « + », sur l'Accueil seulement. */}
      {sousAccueil ? (
        <Pressable
          onPress={() => {
            setOuvert(false);
            demanderRemontee();
          }}
          accessibilityRole="button"
          accessibilityLabel="Revenir en haut du fil"
          style={{
            position: 'absolute',
            right: 26,
            bottom: Math.max(insets.bottom, 6) + 76,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#E11D48',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 31,
            elevation: 13,
            boxShadow: '0 4px 10px rgba(225,29,72,0.4)',
          }}>
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </Pressable>
      ) : null}
    </>
  );
}
