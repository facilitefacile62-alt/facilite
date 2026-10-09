import { supabase } from '@/lib/supabase';

// Discussions de la plateforme Marketplace (acheteur <-> vendeur). Une
// conversation est « Marketplace » quand un de ses messages porte
// type_discussion = 'MARKETPLACE' (voir src/lib/messages.ts). Elles restent
// séparées des discussions Facilité (Support RH, offres, candidatures).

export type DiscussionMarketplace = {
  id: string;
  nom: string;
  initiale: string;
  dernierMessage: string;
  date: string;
  nonLue: boolean;
  /** Le dernier message est le mien : les coches ✓✓ de la maquette 35 ne s'affichent que dans ce cas. */
  dernierEnvoyeParMoi: boolean;
  /** … et l'autre personne l'a lu (coches bleues) ou pas encore (coches grises). */
  dernierLu: boolean;
};

function initiale(nom: string): string {
  return nom.trim().charAt(0).toUpperCase() || '?';
}

function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

export async function chargerDiscussionsMarketplace(userId: string): Promise<DiscussionMarketplace[]> {
  if (!userId) return [];
  const { data: messages, error } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at, sender_id, receiver_id, is_read')
    .eq('type_discussion', 'MARKETPLACE')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  // Dernier message par conversation (la liste est déjà triée du plus récent).
  const parConversation = new Map<
    string,
    { content: string; created_at: string; nonLue: boolean; moi: boolean; lu: boolean }
  >();
  for (const m of messages ?? []) {
    if (!m.conversation_id || parConversation.has(m.conversation_id)) continue;
    const nonLue = m.receiver_id === userId && m.is_read === false;
    parConversation.set(m.conversation_id, {
      content: m.content ?? '',
      created_at: m.created_at,
      nonLue,
      moi: m.sender_id === userId,
      lu: m.is_read === true,
    });
  }
  const ids = Array.from(parConversation.keys());
  if (ids.length === 0) return [];

  const { data: conversations, error: erreurConv } = await supabase
    .from('conversations')
    .select('id, user_1_id, user_2_id')
    .in('id', ids);
  if (erreurConv) throw new Error(erreurConv.message);

  const autresIds = Array.from(
    new Set((conversations ?? []).map((c) => (c.user_1_id === userId ? c.user_2_id : c.user_1_id)).filter((x): x is string => Boolean(x)))
  );
  const { data: profils } = autresIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', autresIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nomParId = new Map((profils ?? []).map((p) => [p.id, p.full_name?.trim() || 'Acheteur / vendeur']));

  const lignes = (conversations ?? []).map((c) => {
    const autre = c.user_1_id === userId ? c.user_2_id : c.user_1_id;
    const dernier = parConversation.get(c.id);
    const nom = (autre && nomParId.get(autre)) || 'Acheteur / vendeur';
    return {
      discussion: {
        id: c.id,
        nom,
        initiale: initiale(nom),
        dernierMessage: dernier?.content ?? '',
        date: dernier ? dateCourte(dernier.created_at) : '',
        nonLue: dernier?.nonLue ?? false,
        dernierEnvoyeParMoi: dernier?.moi ?? false,
        dernierLu: dernier?.lu ?? false,
      } satisfies DiscussionMarketplace,
      tri: dernier?.created_at ?? '',
    };
  });
  lignes.sort((a, b) => (a.tri < b.tri ? 1 : -1));
  return lignes.map((l) => l.discussion);
}

/** Identifiants des conversations Marketplace de l'utilisateur (à exclure de la messagerie Facilité). */
export async function idsConversationsMarketplace(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('type_discussion', 'MARKETPLACE')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .limit(1000);
  if (error) return new Set();
  return new Set((data ?? []).map((m) => m.conversation_id).filter((x): x is string => Boolean(x)));
}
