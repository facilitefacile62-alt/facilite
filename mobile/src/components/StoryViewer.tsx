import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ilYA, type Story } from '@/lib/stories';

// Lecteur plein écran des stories (maquettes « Story ») : barres de
// progression en haut, vignette + titre + « il y a X h », croix, flèches
// précédent/suivant, bouton d'action en bas (« Commander via WhatsApp »…).
// Un appui sur le tiers gauche / droit de l'écran change de story ; l'avance
// est automatique (6 s). Les stories viennent de l'admin du site.
const DUREE_MS = 6000;

export default function StoryViewer({ stories, debut, onFermer }: { stories: Story[]; debut: number; onFermer: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.min(Math.max(debut, 0), Math.max(stories.length - 1, 0)));
  const [progression, setProgression] = useState(0);
  const story = stories[index];

  const suivante = () => {
    if (index >= stories.length - 1) onFermer();
    else {
      setIndex(index + 1);
      setProgression(0);
    }
  };
  const precedente = () => {
    if (index > 0) setIndex(index - 1);
    setProgression(0);
  };

  useEffect(() => {
    const debutMs = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - debutMs) / DUREE_MS);
      setProgression(p);
      if (p >= 1) {
        clearInterval(t);
        if (index >= stories.length - 1) onFermer();
        else {
          setIndex((i) => i + 1);
          setProgression(0);
        }
      }
    }, 80);
    return () => clearInterval(t);
    // onFermer est stable pour l'usage fait ici ; relancer à chaque rendu du parent remettrait la barre à zéro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories.length]);

  if (!story) return null;
  const whatsapp = Boolean(story.lien && /wa\.me|whatsapp/i.test(story.lien));

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {/* Visuel */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={{ uri: story.imageUrl }} alt={story.titre} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </View>

        {/* Zones de toucher */}
        <View style={{ position: 'absolute', top: insets.top + 80, bottom: 110, left: 0, right: 0, flexDirection: 'row' }}>
          <Pressable onPress={precedente} accessibilityLabel="Story précédente" style={{ flex: 1 }} />
          <View style={{ flex: 1 }} pointerEvents="none" />
          <Pressable onPress={suivante} accessibilityLabel="Story suivante" style={{ flex: 1 }} />
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
            <Image source={{ uri: story.imageUrl }} alt="" style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#34D399' }} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{story.titre}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' }}>{ilYA(story.creeLe)}</Text>
            </View>
            <Pressable onPress={onFermer} accessibilityLabel="Fermer la story" hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Flèches */}
        {index > 0 ? (
          <Pressable
            onPress={precedente}
            accessibilityLabel="Précédente"
            style={{ position: 'absolute', left: 8, top: '50%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={suivante}
          accessibilityLabel="Suivante"
          style={{ position: 'absolute', right: 8, top: '50%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>

        {/* Bouton d'action */}
        {story.lien && story.boutonVisible ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Math.max(insets.bottom, 12) + 4 }}>
            <Pressable
              onPress={() => Linking.openURL(story.lien as string).catch(() => {})}
              accessibilityRole="button"
              style={{ height: 52, borderRadius: 26, backgroundColor: whatsapp ? '#25D366' : '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name={whatsapp ? 'logo-whatsapp' : 'open-outline'} size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{story.libelleBouton}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
