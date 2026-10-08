import { supabase } from '@/lib/supabase';

// Notifications réelles — table `public.notifications`
// (supabase/migrations/20260814030000_notifications.sql). La RLS limite la
// lecture à ses propres lignes (`user_id = auth.uid()`) et SELECT est le
// seul droit accordé à `authenticated` : le marquage « lu » passe par la
// fonction SECURITY DEFINER `mark_notification_read(notification_id)`
// (20260814040000), jamais par un UPDATE direct.
//
// Ce module remplace la liste d'exemple qui vivait dans
// PanneauNotifications : la table existe depuis le 14/08/2026, le
// commentaire « aucune table dédiée n'existe encore » était périmé.

export type TypeNotification =
  | 'jobs'
  | 'posts'
  | 'mentions'
  | 'candidature'
  | 'reponse'
  | 'badge'
  | 'message'
  | 'system';

export type NotificationFacilite = {
  id: string;
  type: TypeNotification;
  contenu: string;
  lien: string | null;
  lue: boolean;
  creeLe: string;
};

type LigneNotification = {
  id: string;
  type: string;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

// Pastille par type, comme la maquette « Notifications » (image 42) : la
// couleur porte la nature de l'événement, elle n'est pas décorative.
export const COULEUR_TYPE: Record<TypeNotification, string> = {
  jobs: '#2563EB',
  posts: '#2563EB',
  mentions: '#8B5CF6',
  candidature: '#8B5CF6',
  reponse: '#10B981',
  badge: '#F59E0B',
  message: '#10B981',
  system: '#DC2626',
};

function versNotification(r: LigneNotification): NotificationFacilite {
  return {
    id: r.id,
    type: (r.type as TypeNotification) ?? 'system',
    contenu: r.content ?? '',
    lien: r.link,
    lue: r.is_read === true,
    creeLe: r.created_at,
  };
}

export async function chargerNotifications(limite = 30): Promise<NotificationFacilite[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, content, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneNotification[]).map(versNotification);
}

/** Compte réel des non lues. `head: true` : aucune ligne transférée. */
export async function compterNotificationsNonLues(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function marquerNotificationLue(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { notification_id: id });
  if (error) throw new Error(error.message);
}

/** Messages reçus non lus, pour la pastille de l'onglet Messages. */
export async function compterMessagesNonLus(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** "9+" au-delà de 9 (règle §1.4 de la charte), rien en dessous de 1. */
export function libellePastille(n: number): string | null {
  if (!Number.isFinite(n) || n < 1) return null;
  return n > 9 ? '9+' : String(Math.trunc(n));
}
