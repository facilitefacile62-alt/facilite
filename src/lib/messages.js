import { supabase } from "./supabase";

/**
 * Couche d'accès à la table `messages`.
 *
 * Isolée du composant de page pour que la logique d'épinglage (ordre de tri,
 * invariant "un seul message épinglé", gestion d'erreur) soit testable et
 * réutilisable ailleurs (page admin, API route...).
 */

const formatTime = (isoDate) =>
  new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Convertit une ligne Supabase en message tel que l'attend l'UI du chat.
 */
export function formatMessageRow(row, currentUserId) {
  return {
    id: row.id,
    sender: row.sender_id === currentUserId ? "me" : "them",
    text: row.content,
    time: formatTime(row.created_at),
    createdAt: row.created_at,
    status: row.is_read ? "read" : "sent",
    isPinned: Boolean(row.is_pinned),
    // Distingue les messages réellement en base des messages purement locaux
    // (optimistes, simulés) : eux seuls peuvent être épinglés.
    persisted: true,
    // 'OFFRE' (candidature à une offre recruteur) ou 'ECHANGE' (défaut) —
    // sert au filtre par onglet de la messagerie.
    typeDiscussion: row.type_discussion || "ECHANGE",
    jobOfferId: row.job_offer_id || null,
    // Pièce jointe (fichier ou note vocale) — noms de colonnes conservés tels
    // quels (pas de camelCase) pour matcher directement les lignes brutes
    // reçues via Realtime, affichées sans passer par ce formatage.
    attachment_url: row.attachment_url || null,
    attachment_type: row.attachment_type || null,
    file_name: row.file_name || null,
    file_size: row.file_size || null,
  };
}

/**
 * Récupère le fil de discussion de l'utilisateur authentifié.
 *
 * Le tri se fait en base sur (is_pinned DESC, created_at ASC) : la première
 * ligne renvoyée est donc toujours le message épinglé s'il existe. On renvoie
 * malgré tout `pinned` séparément, et on CONSERVE ce message dans `messages` :
 * la bannière du haut sert de rappel permanent, mais le message doit rester à sa
 * place chronologique dans le fil pour pouvoir être désépinglé depuis celui-ci.
 *
 * @returns {Promise<{ messages: Array, pinned: Object|null, error: string|null }>}
 */
export async function fetchConversationMessages(userId) {
  if (!userId) {
    return { messages: [], pinned: null, error: "Utilisateur non authentifié." };
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, conversation_id, content, is_read, is_pinned, created_at, type_discussion, job_offer_id, attachment_url, attachment_type, file_name, file_size")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erreur de chargement des messages:", error.message);
    return { messages: [], pinned: null, error: error.message };
  }

  const rows = data || [];
  const pinnedRow = rows.find((row) => row.is_pinned) || null;

  // Le tri SQL remonte l'épinglé en tête : on rétablit l'ordre chronologique
  // pour l'affichage du fil.
  const messages = rows
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((row) => formatMessageRow(row, userId));

  return {
    messages,
    pinned: pinnedRow ? formatMessageRow(pinnedRow, userId) : null,
    error: null,
  };
}

/**
 * Épingle ou désépingle un message via la RPC `toggle_message_pin`.
 *
 * On passe par une RPC SECURITY DEFINER plutôt qu'un `update()` direct car la
 * policy RLS d'UPDATE est restreinte à l'expéditeur : sans elle, un message
 * REÇU (la note d'un recruteur, cas d'usage principal) serait inépinglable.
 * La RPC vérifie l'appartenance au fil et ne modifie que `is_pinned`.
 *
 * @returns {Promise<{ data: Object|null, error: string|null }>}
 */
export async function toggleMessagePin(messageId, nextPinned) {
  const { data, error } = await supabase.rpc("toggle_message_pin", {
    p_message_id: messageId,
    p_pinned: nextPinned,
  });

  if (error) {
    console.error("Erreur d'épinglage du message:", error.message);
    return { data: null, error: error.message };
  }

  // La fonction renvoie `SETOF`-like côté PostgREST selon la version : on
  // normalise en un objet unique.
  return { data: Array.isArray(data) ? data[0] || null : data, error: null };
}

/**
 * Insère un message et renvoie la ligne créée (avec son UUID réel), afin que
 * l'UI puisse remplacer son id temporaire — sans quoi l'épinglage d'un message
 * tout juste envoyé échouerait.
 */
export async function sendMessage({
  senderId,
  content,
  receiverId = null,
  conversationId = null,
  typeDiscussion = "ECHANGE",
  jobOfferId = null,
  attachmentUrl = null,
  attachmentType = null,
  fileName = null,
  fileSize = null,
}) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      conversation_id: conversationId,
      content,
      is_read: false,
      type_discussion: typeDiscussion,
      job_offer_id: jobOfferId,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      file_name: fileName,
      file_size: fileSize,
    })
    .select("id, sender_id, receiver_id, conversation_id, content, is_read, is_pinned, created_at, type_discussion, job_offer_id, attachment_url, attachment_type, file_name, file_size")
    .single();

  if (error) {
    console.error("Erreur d'envoi du message sur Supabase:", error.message);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Retrouve (ou crée) la conversation entre l'utilisateur connecté et un
 * administrateur.
 *
 * Pourquoi : /messagerie envoie les messages du fil fusionné "Support RH
 * Facilité" sans destinataire précis (receiver_id NULL) — ce qui les rendait
 * invisibles côté /admin/messages, entièrement construit autour de la table
 * `conversations`. Cette fonction garantit qu'un vrai destinataire (un admin
 * réel) et une conversation existent AVANT l'envoi, pour que le message y
 * soit rattaché dès sa création plutôt que de rester orphelin.
 *
 * @returns {Promise<{ conversationId: string, adminId: string } | null>}
 */
export async function resolveSupportConversation(userId) {
  if (!userId) return null;

  const { data: admins, error: adminsErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);

  if (adminsErr) {
    console.error("Erreur recherche d'un compte admin:", adminsErr.message);
    return null;
  }
  if (!admins || admins.length === 0) {
    // Aucun admin sur la plateforme pour l'instant : rien à résoudre, le
    // message repartira sans destinataire (comportement précédent).
    return null;
  }
  const adminId = admins[0].id;

  const { data: existing, error: existingErr } = await supabase
    .from("conversations")
    .select("id")
    .or(`and(user_1_id.eq.${userId},user_2_id.eq.${adminId}),and(user_1_id.eq.${adminId},user_2_id.eq.${userId})`)
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    console.error("Erreur recherche conversation support existante:", existingErr.message);
  }
  if (existing) {
    return { conversationId: existing.id, adminId };
  }

  const { data: created, error: createErr } = await supabase
    .from("conversations")
    .insert({ user_1_id: userId, user_2_id: adminId, last_message: "", updated_at: new Date().toISOString() })
    .select("id")
    .single();

  if (createErr || !created) {
    console.error("Erreur création conversation support:", createErr?.message);
    return null;
  }

  return { conversationId: created.id, adminId };
}

/**
 * Met à jour last_message/updated_at d'une conversation après un envoi, pour
 * qu'elle remonte en tête de la colonne de gauche côté admin (ce dernier
 * s'appuie sur un canal Realtime écoutant les changements de cette table).
 */
export async function touchConversation(conversationId, lastMessage) {
  if (!conversationId) return;
  const { error } = await supabase
    .from("conversations")
    .update({ last_message: lastMessage, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    console.error("Erreur mise à jour de la conversation:", error.message);
  }
}
