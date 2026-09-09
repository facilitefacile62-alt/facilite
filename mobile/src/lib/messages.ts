import { supabase } from '@/lib/supabase';

// Port mobile de src/lib/messages.js (web) — mêmes fonctions, même schéma
// de la table `messages` (vérifié en direct sur la base de production :
// id, sender_id, receiver_id, content, conversation_id, is_read,
// created_at, ...). Le web fusionne tous les fils d'un utilisateur en une
// seule vue ("/messagerie") ; ce port est scopé par conversation_id dès le
// départ (fetchThreadMessages), pour matcher l'écran de détail par
// conversation du handoff (06-chat-detail.html), plutôt que le modèle
// fusionné du web.

export type ChatMessage = {
  id: string;
  sender: 'me' | 'them';
  senderId: string | null;
  text: string;
  time: string;
  createdAt: string;
};

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function formatMessageRow(row: {
  id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}, currentUserId: string): ChatMessage {
  return {
    id: row.id,
    sender: row.sender_id === currentUserId ? 'me' : 'them',
    senderId: row.sender_id,
    text: row.content,
    time: formatTime(row.created_at),
    createdAt: row.created_at,
  };
}

/** Fil de messages d'UNE conversation précise (pas le fil fusionné du web). */
export async function fetchThreadMessages(conversationId: string, currentUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at, is_read')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.error('Erreur de chargement du fil de discussion:', error?.message);
    return [];
  }

  return data.map((row) => formatMessageRow(row, currentUserId));
}

/** Marque comme lus les messages reçus non lus de cette conversation. */
export async function marquerFilCommeLu(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('receiver_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Erreur marquage des messages comme lus:', error.message);
  }
}

/** Insère un message et renvoie la ligne créée (id réel côté serveur). */
export async function sendMessage({
  senderId,
  content,
  receiverId,
  conversationId,
}: {
  senderId: string;
  content: string;
  receiverId: string | null;
  conversationId: string;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      conversation_id: conversationId,
      content,
      is_read: false,
    })
    .select('id, sender_id, receiver_id, content, created_at, is_read')
    .single();

  if (error || !data) {
    console.error("Erreur d'envoi du message:", error?.message);
    return null;
  }

  return formatMessageRow(data, senderId);
}

async function findOrCreateConversation(userId: string, otherUserId: string): Promise<string | null> {
  const { data: existing, error: existingErr } = await supabase
    .from('conversations')
    .select('id')
    .or(`and(user_1_id.eq.${userId},user_2_id.eq.${otherUserId}),and(user_1_id.eq.${otherUserId},user_2_id.eq.${userId})`)
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    console.error('Erreur recherche conversation existante:', existingErr.message);
  }
  if (existing) return existing.id;

  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ user_1_id: userId, user_2_id: otherUserId, last_message: '', updated_at: new Date().toISOString() })
    .select('id')
    .single();

  if (createErr || !created) {
    console.error('Erreur création conversation:', createErr?.message);
    return null;
  }

  return created.id;
}

/**
 * Retrouve (ou crée) la conversation avec un administrateur — via la RPC
 * `resolve_admin_id`, déjà utilisée côté web (src/lib/messages.js), pas
 * réinventée ici.
 */
export async function resolveSupportConversation(
  userId: string
): Promise<{ conversationId: string; adminId: string } | null> {
  const { data: adminId, error: adminsErr } = await supabase.rpc('resolve_admin_id');

  if (adminsErr || !adminId || adminId === userId) {
    if (adminsErr) console.error("Erreur recherche d'un compte admin:", adminsErr.message);
    return null;
  }

  const conversationId = await findOrCreateConversation(userId, adminId);
  return conversationId ? { conversationId, adminId } : null;
}

/** Récupère l'autre participant d'une conversation (id + nom affiché). */
export async function chargerAutreParticipant(conversationId: string, userId: string) {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select('user_1_id, user_2_id')
    .eq('id', conversationId)
    .single();

  if (error || !conv) return null;

  const autreId = conv.user_1_id === userId ? conv.user_2_id : conv.user_1_id;
  if (!autreId) return null;

  const [{ data: profil }, { data: role }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', autreId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', autreId).maybeSingle(),
  ]);

  const estAdmin = role?.role === 'admin';
  return {
    id: autreId as string,
    nom: estAdmin ? 'Support RH Facilité' : profil?.full_name || 'Utilisateur Facilité',
    estAdmin,
  };
}

/** Fait remonter la conversation en tête de liste après un envoi. */
export async function touchConversation(conversationId: string, lastMessage: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ last_message: lastMessage, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) {
    console.error('Erreur mise à jour de la conversation:', error.message);
  }
}
