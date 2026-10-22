import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable } from 'react-native';

// Bouton audio d'une offre (maquette « Fil d'actualité — audio » du 22/10/2026) : rond de 44 px, comme « Aide » et « Partager »,
// blanc et gris à l'arrêt, vert avec une icône blanche pendant la lecture.
//  - Si l'offre a un fichier audio enregistré (champ audio_url, voir supabase/migrations/20261018100000_offres_audio.sql), on le
//    lit à la place de la synthèse vocale. Aucun fichier n'est téléchargé avant l'appui (un fil de 30 offres ne charge pas
//    30 audios).
//  - Sinon, l'offre est lue à voix haute en français par la synthèse vocale du téléphone : titre, entreprise, lieu, contrat,
//    puis le texte.
//  - Une seule offre est lue à la fois : lancer une lecture arrête celle qui jouait. La lecture s'arrête aussi quand on quitte
//    l'écran, quand l'application passe en arrière-plan, et à la fin du texte.
const VERT = '#10B981';
let arreterActif: (() => void) | null = null;

export type TexteAudioOffre = { titre: string; entreprise?: string | null; localisation?: string | null; contrat?: string | null; description?: string | null };

/** Texte lu à voix haute : sans adresses web, émojis ni symboles de mise en forme, borné à la limite de la synthèse. */
export function texteALire(o: TexteAudioOffre): string {
  const nettoye = (t?: string | null) =>
    String(t ?? '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
      .replace(/[*_#>`~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const parties = [
    nettoye(o.titre),
    o.entreprise ? `chez ${nettoye(o.entreprise)}` : '',
    o.localisation ? `à ${nettoye(o.localisation)}` : '',
    o.contrat ? `contrat : ${nettoye(o.contrat)}` : '',
    nettoye(o.description),
  ].filter(Boolean);
  const texte = parties.join('. ');
  const max = Math.max(500, Speech.maxSpeechInputLength - 20);
  return texte.length > max ? texte.slice(0, max) : texte;
}

function styleBouton(actif: boolean) {
  return {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: actif ? VERT : 'rgba(0,0,0,0.12)',
    backgroundColor: actif ? VERT : '#FFFFFF',
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

function LecteurFichier({ url, onFin }: { url: string; onFin: () => void }) {
  const player = useAudioPlayer(url);
  const statut = useAudioPlayerStatus(player);
  const lance = useRef(false);
  const arreter = useCallback(() => player.pause(), [player]);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    if (arreterActif) arreterActif();
    arreterActif = () => {
      player.pause();
      onFin();
    };
    player.play();
  }, [player, onFin]);
  useEffect(() => {
    if (statut.didJustFinish) onFin();
  }, [statut.didJustFinish, onFin]);
  useArretAutomatique(arreter);

  const enLecture = statut.playing;
  return (
    <Pressable
      onPress={() => {
        if (statut.playing) {
          player.pause();
          onFin();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel="Arrêter l'audio de l'offre"
      style={styleBouton(true)}>
      {!statut.isLoaded && !enLecture ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="volume-high" size={21} color="#fff" />}
    </Pressable>
  );
}

export default function BoutonAudioOffre({ url, offre }: { url?: string | null; offre: TexteAudioOffre }) {
  const [enLecture, setEnLecture] = useState(false);
  const [fichier, setFichier] = useState(false);

  const arreter = useCallback(() => {
    Speech.stop();
    setEnLecture(false);
    setFichier(false);
  }, []);
  useArretAutomatique(arreter);
  useEffect(() => () => void Speech.stop(), []);

  async function demarrer() {
    if (enLecture) {
      if (arreterActif) arreterActif();
      arreterActif = null;
      arreter();
      return;
    }
    if (arreterActif) arreterActif();
    if (url) {
      setFichier(true);
      setEnLecture(true);
      arreterActif = arreter;
      return;
    }
    const texte = texteALire(offre);
    if (!texte) return;
    // Voix française du téléphone : fr-SN si elle existe, sinon fr-FR.
    let langue = 'fr-FR';
    try {
      const voix = await Speech.getAvailableVoicesAsync();
      if (voix.some((v) => v.language?.toLowerCase().replace('_', '-') === 'fr-sn')) langue = 'fr-SN';
    } catch {
      // Liste des voix indisponible : fr-FR par défaut.
    }
    arreterActif = arreter;
    setEnLecture(true);
    Speech.speak(texte, {
      language: langue,
      rate: 0.95,
      onDone: () => {
        if (arreterActif === arreter) arreterActif = null;
        setEnLecture(false);
      },
      onStopped: () => setEnLecture(false),
      onError: () => setEnLecture(false),
    });
  }

  if (fichier && url) return <LecteurFichier url={url} onFin={arreter} />;
  return (
    <Pressable
      onPress={demarrer}
      accessibilityRole="button"
      accessibilityLabel={enLecture ? "Arrêter la lecture de l'offre" : "Écouter l'offre à voix haute"}
      style={styleBouton(enLecture)}>
      <Ionicons name="volume-high" size={21} color={enLecture ? '#fff' : 'rgba(0,0,0,0.55)'} />
    </Pressable>
  );
}
