import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

// Bouton « Écouter » d'une offre qui a un audio (champ audio_url, facultatif à la publication — voir
// supabase/migrations/20261018100000_offres_audio.sql). Rien n'est téléchargé avant le premier appui : le
// lecteur n'est créé qu'à ce moment (un fil de 30 offres ne charge pas 30 audios). Un seul audio d'offre
// joue à la fois : en lancer un arrête celui qui jouait.
const VERT = '#10B981';
let arreterLecteurActif: (() => void) | null = null;

function LecteurActif({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const statut = useAudioPlayerStatus(player);
  const lance = useRef(false);

  // Lecture dès l'appui : le lecteur vient d'être créé par l'appui de l'utilisateur, on lance donc la lecture
  // tout de suite (attendre le chargement ferait perdre le « geste utilisateur » exigé par les navigateurs ;
  // sur téléphone, la lecture démarre dès que l'audio est prêt).
  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    if (arreterLecteurActif) arreterLecteurActif();
    arreterLecteurActif = () => player.pause();
    player.play();
  }, [player]);

  const termine = statut.didJustFinish;
  function basculer() {
    if (!statut.isLoaded) return;
    if (statut.playing) {
      player.pause();
      return;
    }
    if (termine || (statut.duration > 0 && statut.currentTime >= statut.duration - 0.05)) player.seekTo(0);
    if (arreterLecteurActif) arreterLecteurActif();
    arreterLecteurActif = () => player.pause();
    player.play();
  }

  const enLecture = statut.playing;
  return (
    <Pressable
      onPress={basculer}
      accessibilityLabel={enLecture ? "Mettre en pause l'audio de l'offre" : "Écouter l'audio de l'offre"}
      style={styleBouton(enLecture)}>
      {!statut.isLoaded && !statut.playing ? (
        <ActivityIndicator size="small" color="rgba(0,0,0,0.55)" />
      ) : (
        <Ionicons name={enLecture ? 'pause' : 'volume-high'} size={19} color={enLecture ? '#fff' : 'rgba(0,0,0,0.55)'} />
      )}
    </Pressable>
  );
}

function styleBouton(actif: boolean) {
  return {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: actif ? VERT : 'rgba(0,0,0,0.08)',
    backgroundColor: actif ? VERT : '#F5F3EE',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

export default function BoutonAudioOffre({ url }: { url?: string | null }) {
  const [demande, setDemande] = useState(false);
  if (!url) return null;
  if (demande) return <LecteurActif url={url} />;
  return (
    <Pressable onPress={() => setDemande(true)} accessibilityLabel="Écouter l'audio de l'offre" style={styleBouton(false)}>
      <View>
        <Ionicons name="volume-high" size={19} color="rgba(0,0,0,0.55)" />
      </View>
    </Pressable>
  );
}
