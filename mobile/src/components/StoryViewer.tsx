import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import ImagePublique from '@/components/ImagePublique';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, PanResponder, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WHATSAPP_FACILITE } from '@/lib/configFacilite';
import { candidatsImage } from '@/lib/imagesPubliques';
import { ilYA, type Story } from '@/lib/stories';
import { marquerStoryVue } from '@/lib/storiesVues';

// Lecteur plein écran des stories (maquettes 10 à 14, prompt « Stories ») :
//  - une barre de progression par story, la barre en cours se remplit en 5 s puis passage automatique à la suivante ;
//    après la dernière, le lecteur se ferme ;
//  - en-tête : avatar rond, nom de la story, « par ffacilite », menu ⋮ et croix de fermeture ;
//  - navigation : flèches rondes, toucher le TIERS GAUCHE = story précédente, le reste = story suivante, APPUI LONG =
//    pause (relâcher = reprise), GLISSER VERS LE BAS = fermer ;
//  - bouton vert WhatsApp « Commander via WhatsApp » : ouvre le WhatsApp de Facilité (confection de CV) avec le message
//    « Bonjour, je souhaite commander : <nom de la story>. » ; la story reste en pause pendant l'ouverture de WhatsApp ;
//  - l'image de la story suivante est préchargée pour un passage sans attente.
// Une story est « vue » dès qu'elle s'affiche (mémorisé sur l'appareil, voir storiesVues).
const DUREE_MS = 5000;
const PAS_MS = 50;

export default function StoryViewer({ stories, debut, onFermer }: { stories: Story[]; debut: number; onFermer: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(Math.max(debut, 0), Math.max(stories.length - 1, 0)));
  const [progression, setProgression] = useState(0);
  const [pauseTouche, setPauseTouche] = useState(false);
  const [pauseWhatsapp, setPauseWhatsapp] = useState(false);
  const enPause = pauseTouche || pauseWhatsapp;
  const story = stories[index];
  const ecoule = useRef(0);

  const aller = (cible: number) => {
    ecoule.current = 0;
    setProgression(0);
    if (cible < 0) setIndex(0);
    else if (cible >= stories.length) onFermer();
    else setIndex(cible);
  };

  // Compteur de 5 s, figé pendant la pause ; réinitialisé à chaque changement de story.
  useEffect(() => {
    ecoule.current = 0;
    const t = setInterval(() => {
      if (enPause) return;
      ecoule.current += PAS_MS;
      const p = Math.min(1, ecoule.current / DUREE_MS);
      setProgression(p);
      if (p >= 1) {
        clearInterval(t);
        if (index >= stories.length - 1) onFermer();
        else {
          setIndex((i) => i + 1);
          setProgression(0);
        }
      }
    }, PAS_MS);
    return () => clearInterval(t);
    // onFermer est stable pour l'usage fait ici ; relancer à chaque rendu du parent remettrait la barre à zéro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories.length, enPause]);

  // Une story affichée est une story vue ; la suivante est préchargée.
  const idStory = story?.id;
  useEffect(() => {
    if (idStory) marquerStoryVue(idStory);
    const suivante = stories[index + 1];
    if (suivante) Image.prefetch(candidatsImage(suivante.imageUrl)[0] ?? suivante.imageUrl, 'disk').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStory]);

  // Retour de WhatsApp : la story reprend.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') setPauseWhatsapp(false);
    });
    return () => abonnement.remove();
  }, []);

  // Glisser vers le bas : fermer.
  const [geste] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90) onFermer();
      },
    })
  );

  if (!story) return null;
  const message = story.messageWhatsapp ? story.messageWhatsapp.replace(/\{nom\}/g, story.titre) : `Bonjour, je souhaite commander : ${story.titre}.`;
  const lienWhatsapp = story.lien && /wa\.me|whatsapp/i.test(story.lien)
    ? story.lien.includes('text=') ? story.lien : `${story.lien}${story.lien.includes('?') ? '&' : '?'}text=${encodeURIComponent(message)}`
    : null;
  // Un lien d'une autre nature défini par l'administrateur est respecté ; sinon : WhatsApp de Facilité, message pré-rempli.
  // Une OFFRE D'EMPLOI a toujours un bouton « Postuler » vers le lien de l'offre (jamais WhatsApp de commande de CV).
  const offre = story.type === 'offre';
  const lienAction = offre && story.lien ? story.lien : story.lien && !lienWhatsapp ? story.lien : lienWhatsapp ?? `https://wa.me/${WHATSAPP_FACILITE}?text=${encodeURIComponent(message)}`;
  const whatsapp = !offre && (lienAction.includes('wa.me') || /whatsapp/i.test(lienAction));

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} {...geste.panHandlers}>
        {/* Visuel, ratio conservé */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ImagePublique source={{ uri: story.imageUrl }} alt={story.titre} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </View>

        {/* Zones de toucher : tiers gauche = précédente, le reste = suivante ; appui long = pause */}
        <View style={{ position: 'absolute', top: insets.top + 90, bottom: 110, left: 0, right: 0, flexDirection: 'row' }}>
          <Pressable
            onPress={() => aller(index - 1)}
            onLongPress={() => setPauseTouche(true)}
            onPressOut={() => setPauseTouche(false)}
            delayLongPress={200}
            accessibilityLabel="Story précédente"
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={() => aller(index + 1)}
            onLongPress={() => setPauseTouche(true)}
            onPressOut={() => setPauseTouche(false)}
            delayLongPress={200}
            accessibilityLabel="Story suivante"
            style={{ flex: 2 }}
          />
        </View>

        {/* Barres + en-tête */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.35)', paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {stories.map((s, i) => (
              <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                <View style={{ height: 3, backgroundColor: '#fff', width: `${(i < index ? 1 : i === index ? progression : 0) * 100}%` }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <ImagePublique source={{ uri: story.imageUrl }} alt="" style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#34D399' }} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14.5, fontWeight: '800' }}>{story.titre}</Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11.5, fontWeight: '700' }}>par ffacilite · {ilYA(story.creeLe)}</Text>
            </View>
            <Pressable
              onPress={() => Share.share({ message: `${story.titre} — ${story.imageUrl}` }).catch(() => {})}
              accessibilityLabel="Menu de la story"
              hitSlop={8}
              style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={onFermer} accessibilityLabel="Fermer la story" hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Flèches rondes */}
        {index > 0 ? (
          <Pressable
            onPress={() => aller(index - 1)}
            accessibilityLabel="Précédente"
            style={{ position: 'absolute', left: 8, top: '50%', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => aller(index + 1)}
          accessibilityLabel="Suivante"
          style={{ position: 'absolute', right: 8, top: '50%', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>

        {/* Bouton d'action : story en pause pendant l'ouverture de WhatsApp */}
        {story.boutonVisible ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Math.max(insets.bottom, 12) + 4 }}>
            <Pressable
              onPress={() => {
                setPauseWhatsapp(true);
                Linking.openURL(lienAction).catch(() => setPauseWhatsapp(false));
              }}
              accessibilityRole="button"
              style={{ height: 54, borderRadius: 27, backgroundColor: whatsapp ? '#25D366' : '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name={whatsapp ? 'logo-whatsapp' : offre ? 'paper-plane' : 'open-outline'} size={21} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '900' }}>{story.libelleBouton || (offre ? 'Postuler' : 'Commander via WhatsApp')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
