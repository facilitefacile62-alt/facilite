import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Liste réelle des discussions pour l'écran Messages (mobile) — la ligne
// "Support RH Facilité" du design est fixe (voir messages.tsx), donc cette
// liste exclut volontairement les conversations dont l'interlocuteur est un
// admin (déjà représentées par cette ligne fixe), pour éviter un doublon.
export type ConversationReelle = {
  id: string;
  name: string;
  avatarLetter: string;
  lastText: string;
  time: string;
  nonLue: boolean;
};

function initiale(nom: string): string {
  const mot = nom.trim().split(/\s+/).filter(Boolean)[0];
  return mot ? mot.charAt(0).toUpperCase() : 'F';
}

function heureRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const heures = Math.floor(diffMs / 3_600_000);
  if (heures < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const jours = Math.floor(heures / 24);
  return jours === 1 ? 'Hier' : `${jours} j`;
}

export function useConversationsReelles(userId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationReelle[] | null>(null);

  useEffect(() => {
    let annule = false;

    async function charger() {
      if (!userId) {
        if (!annule) setConversations([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, user_1_id, user_2_id, last_message, updated_at')
          .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
          .not('last_message', 'is', null)
          .neq('last_message', '')
          .order('updated_at', { ascending: false })
          .limit(30);

        if (error || !data) {
          if (!annule) setConversations([]);
          return;
        }

        const autresIds = Array.from(
          new Set(
            data
              .map((c) => (c.user_1_id === userId ? c.user_2_id : c.user_1_id))
              .filter((id): id is string => Boolean(id) && id !== userId)
          )
        );

        if (autresIds.length === 0) {
          if (!annule) setConversations([]);
          return;
        }

        const idsConversations = data.map((c) => c.id);

        const [{ data: profils }, { data: roles }, { data: messagesNonLus }] = await Promise.all([
          supabase.from('profiles').select('id, full_name').in('id', autresIds),
          supabase.from('user_roles').select('user_id, role').in('user_id', autresIds),
          supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', idsConversations)
            .eq('receiver_id', userId)
            .eq('is_read', false),
        ]);

        const idsAdmin = new Set((roles || []).filter((r) => r.role === 'admin').map((r) => r.user_id));
        const idsNonLus = new Set((messagesNonLus || []).map((m) => m.conversation_id));
        const nomParId: Record<string, string> = {};
        (profils || []).forEach((p) => {
          nomParId[p.id] = p.full_name || 'Utilisateur Facilité';
        });

        const mapped = data
          .map((c) => {
            const autreId = c.user_1_id === userId ? c.user_2_id : c.user_1_id;
            return { c, autreId };
          })
          .filter(({ autreId }) => autreId && !idsAdmin.has(autreId))
          .map(({ c, autreId }) => {
            const nom = nomParId[autreId as string] || 'Utilisateur Facilité';
            return {
              id: c.id,
              name: nom,
              avatarLetter: initiale(nom),
              lastText: c.last_message || '',
              time: heureRelative(c.updated_at),
              nonLue: idsNonLus.has(c.id),
            };
          });

        if (!annule) setConversations(mapped);
      } catch (err) {
        console.error('Exception chargement des conversations réelles:', err);
        if (!annule) setConversations([]);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [userId]);

  return conversations;
}
