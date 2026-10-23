import { supabase } from '@/lib/supabase';

// Avatars proposés à la place d'une photo (choix du 23/10/2026) : la personne prend un avatar OU sa photo / le logo de son
// entreprise. Un avatar est enregistré dans `profiles.avatar_url` sous la forme « avatar:<id> » ; une photo, comme avant, par
// le chemin du bucket privé « avatars » (voir photoProfil.ts).
export const AVATARS_PREDEFINIS = [
  { id: 'a1', emoji: '👩🏾', fond: '#FDE68A' },
  { id: 'a2', emoji: '👨🏾', fond: '#BFDBFE' },
  { id: 'a3', emoji: '🧑🏾‍💼', fond: '#C7D2FE' },
  { id: 'a4', emoji: '👩🏾‍💼', fond: '#FBCFE8' },
  { id: 'a5', emoji: '🧕🏾', fond: '#A7F3D0' },
  { id: 'a6', emoji: '👳🏾‍♂️', fond: '#FED7AA' },
  { id: 'a7', emoji: '🧑🏾‍🍳', fond: '#FECACA' },
  { id: 'a8', emoji: '🛵', fond: '#D9F99D' },
  { id: 'a9', emoji: '🏪', fond: '#FDE68A' },
  { id: 'a10', emoji: '🧑🏾‍🔧', fond: '#BAE6FD' },
  { id: 'a11', emoji: '👩🏾‍🎓', fond: '#DDD6FE' },
  { id: 'a12', emoji: '🦁', fond: '#FDBA74' },
] as const;

export function avatarPredefini(valeur: string | null | undefined) {
  if (!valeur?.startsWith('avatar:')) return null;
  return AVATARS_PREDEFINIS.find((a) => a.id === valeur.slice(7)) ?? null;
}

export async function choisirAvatarPredefini(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: `avatar:${id}`, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw new Error(`Enregistrement de l'avatar impossible : ${error.message}`);
}

export async function retirerPhotoProfil(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw new Error(`Impossible de retirer la photo : ${error.message}`);
}
