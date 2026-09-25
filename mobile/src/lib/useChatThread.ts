import { useCallback, useEffect, useState } from 'react';
import {
  chargerAutreParticipant,
  fetchThreadMessages,
  marquerFilCommeLu,
  sendAttachmentMessage,
  sendMessage,
  touchConversation,
  type ChatMessage,
} from '@/lib/messages';
import type { TypePieceJointe } from '@/lib/chatAttachments';

export type AutreParticipant = { id: string; nom: string; estAdmin: boolean };

export function useChatThread(
  conversationId: string | undefined,
  userId: string | undefined,
  typeDiscussion?: 'MARKETPLACE'
) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [autreParticipant, setAutreParticipant] = useState<AutreParticipant | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    if (!conversationId || !userId) return;
    let annule = false;

    async function charger() {
      const [fil, autre] = await Promise.all([
        fetchThreadMessages(conversationId!, userId!),
        chargerAutreParticipant(conversationId!, userId!),
      ]);
      if (annule) return;
      setMessages(fil);
      setAutreParticipant(autre);
      // Marquer comme lu après le chargement, pas avant : l'utilisateur doit
      // avoir effectivement ouvert le fil.
      marquerFilCommeLu(conversationId!, userId!);
    }

    charger();
    return () => {
      annule = true;
    };
  }, [conversationId, userId]);

  const envoyer = useCallback(
    async (texte: string) => {
      const contenu = texte.trim();
      if (!contenu || !conversationId || !userId || envoiEnCours) return;

      setEnvoiEnCours(true);
      try {
        const nouveau = await sendMessage({
          senderId: userId,
          content: contenu,
          receiverId: autreParticipant?.id ?? null,
          conversationId,
          typeDiscussion,
        });
        if (nouveau) {
          setMessages((prev) => (prev ? [...prev, nouveau] : [nouveau]));
          await touchConversation(conversationId, contenu);
        }
      } finally {
        setEnvoiEnCours(false);
      }
    },
    [conversationId, userId, autreParticipant, envoiEnCours, typeDiscussion]
  );

  const envoyerPieceJointe = useCallback(
    async (attachmentUrl: string, attachmentType: TypePieceJointe, fileName: string, fileSize: string) => {
      if (!conversationId || !userId || envoiEnCours) return;

      setEnvoiEnCours(true);
      try {
        const nouveau = await sendAttachmentMessage({
          senderId: userId,
          receiverId: autreParticipant?.id ?? null,
          conversationId,
          typeDiscussion,
          attachmentUrl,
          attachmentType,
          fileName,
          fileSize,
        });
        if (nouveau) {
          setMessages((prev) => (prev ? [...prev, nouveau] : [nouveau]));
          await touchConversation(conversationId, nouveau.text);
        }
      } finally {
        setEnvoiEnCours(false);
      }
    },
    [conversationId, userId, autreParticipant, envoiEnCours, typeDiscussion]
  );

  return { messages, autreParticipant, envoyer, envoyerPieceJointe, envoiEnCours };
}
