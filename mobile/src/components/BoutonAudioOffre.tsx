import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable } from 'react-native';

// Bouton audio d'une offre (maquette « Fil d'actualité — audio » du 22/10/2026, règle du 23/10/2026) : rond de 44 px, comme
// « Aide » et « Partager ».
//  - L'offre a un audio (champ audio_url, ajouté à la publication ou à la modification, voir
//    supabase/migrations/20261018100000_offres_audio.sql) : le bouton est VERT, icône blanche, et se lit au toucher.
//  - Pas d'audio : le bouton est GRIS et n'est pas cliquable. Aucune voix de synthèse n'est jouée à la place.
// Aucun fichier n'est téléchargé avant l'appui (un fil de 30 offres ne charge pas 30 audios). Un seul audio d'offre joue à la
// fois ; la lecture s'arrête à la fin, en quittant l'écran et quand l'application passe en arrière-plan.
const VERT = '#10B981';
let arreterActif: (() => void) | null = null;
let idActif: string | null = null;

/** Arrête l'audio en cours si son offre n'est plus à l'écran (appelé par le défilement du fil). */
export function arreterAudioSiHorsEcran(idsVisibles: string[]) {
  if (idActif && !idsVisibles.includes(idActif)) arreterActif?.();
}

function styleBouton(actif: boolean) {
  return {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: actif ? VERT : 'rgba(0,0,0,0.08)',
    backgroundColor: actif ? VERT : '#EFEDE8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

/** Arrête la lecture quand l'écran perd le focus ou que l'application passe en arrière-plan. */
function useArretAutomatique(arreter: () => void) {
  useFocusEffect(useCallback(() => arreter, [arreter]));
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') arreter();
    });
    return () => abonnement.remove();
  }, [arreter]);
}

function LecteurActif({ url, offreId, onFin }: { url: string; offreId?: string; onFin: () => void }) {
  const player = useAudioPlayer(url);
  const statut = useAudioPlayerStatus(player);
  const lance = useRef(false);
  const arreter = useCallback(() => player.pause(), [player]);

  // Prend la main : l'audio d'une autre offre en cours est arrêté (son bouton redevient normal), puis celui-ci démarre.
  const jouer = useCallback(() => {
    if (arreterActif) arreterActif();
    const moi = () => {
      try {
        player.pause();
      } catch {}
      onFin();
    };
    arreterActif = moi;
    idActif = offreId ?? null;
    player.play();
  }, [player, offreId, onFin]);

  // Lecture dès l'appui : le lecteur vient d'être créé par l'appui de la personne.
  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    jouer();
  }, [jouer]);
  useEffect(() => {
    if (statut.didJustFinish) onFin();
  }, [statut.didJustFinish, onFin]);
  useArretAutomatique(arreter);

  function basculer() {
    if (!statut.isLoaded) return;
    if (statut.playing) {
      player.pause();
      return;
    }
    if (statut.duration > 0 && statut.currentTime >= statut.duration - 0.05) player.seekTo(0);
    jouer();
  }

  return (
    <Pressable
      onPress={basculer}
      accessibilityRole="button"
      accessibilityLabel={statut.playing ? "Mettre en pause l'audio de l'offre" : "Écouter l'audio de l'offre"}
      style={styleBouton(true)}>
      {!statut.isLoaded && !statut.playing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name={statut.playing ? 'pause' : 'volume-high'} size={21} color="#fff" />
      )}
    </Pressable>
  );
}

export default function BoutonAudioOffre({ url, offreId }: { url?: string | null; offreId?: string }) {
  const [demande, setDemande] = useState(false);
  const fin = useCallback(() => setDemande(false), []);

  if (!url) {
    return (
      // Pas `disabled` : un bouton désactivé laisse passer le toucher à la carte (qui ouvrirait l'offre). Ici le toucher est absorbé.
      <Pressable
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel="Pas d'audio pour cette offre"
        style={styleBouton(false)}>
        <Ionicons name="volume-high" size={21} color="rgba(0,0,0,0.25)" />
      </Pressable>
    );
  }
  if (demande) return <LecteurActif url={url} offreId={offreId} onFin={fin} />;
  return (
    <Pressable onPress={() => setDemande(true)} accessibilityRole="button" accessibilityLabel="Écouter l'audio de l'offre" style={styleBouton(true)}>
      <Ionicons name="volume-high" size={21} color="#fff" />
    </Pressable>
  );
}
