import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Marques posées sur les messages d'une discussion, gardées SUR L'APPAREIL (aucune colonne en base) : réaction emoji,
// message épinglé, message important, message supprimé « pour moi ». Elles ne sont vues que par leur auteur ; l'autre
// personne ne les voit pas. Une clé de stockage par discussion.
export type MarquesMessages = {
  epingles: string[];
  importants: string[];
  masques: string[];
  reactions: Record<string, string>;
};

const VIDE: MarquesMessages = { epingles: [], importants: [], masques: [], reactions: {} };

export function useMarquesMessages(conversationId: string | undefined) {
  const cle = `FACILITE_MARQUES_MESSAGES_${conversationId ?? 'aucune'}`;
  const [marques, setMarques] = useState<MarquesMessages>(VIDE);

  useEffect(() => {
    if (!conversationId) return;
    AsyncStorage.getItem(cle)
      .then((brut) => setMarques(brut ? { ...VIDE, ...(JSON.parse(brut) as Partial<MarquesMessages>) } : VIDE))
      .catch(() => {});
  }, [cle, conversationId]);

  const enregistrer = useCallback(
    (suivant: MarquesMessages) => {
      setMarques(suivant);
      AsyncStorage.setItem(cle, JSON.stringify(suivant)).catch(() => {});
    },
    [cle]
  );

  /** Ajoute ou retire l'identifiant d'une des trois listes (épinglés, importants, masqués). */
  const basculer = useCallback(
    (liste: 'epingles' | 'importants' | 'masques', id: string) => {
      const actuelle = marques[liste];
      enregistrer({ ...marques, [liste]: actuelle.includes(id) ? actuelle.filter((x) => x !== id) : [...actuelle, id] });
    },
    [marques, enregistrer]
  );

  /** Pose une réaction ; la même réaction touchée une seconde fois est retirée. */
  const reagir = useCallback(
    (id: string, emoji: string) => {
      const reactions = { ...marques.reactions };
      if (reactions[id] === emoji) delete reactions[id];
      else reactions[id] = emoji;
      enregistrer({ ...marques, reactions });
    },
    [marques, enregistrer]
  );

  return { marques, basculer, reagir };
}
