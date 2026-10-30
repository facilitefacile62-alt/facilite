import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { permissionGalerie } from '@/lib/galerie';

import { supabase } from '@/lib/supabase';

// Photo de profil — mêmes conventions que le site (src/app/profil/page.js) : bucket PRIVÉ `avatars`,
// fichier `{user_id}/avatar.jpg` (remplacé à chaque changement), chemin enregistré dans
// `profiles.avatar_url` ; l'URL consultable est signée à la lecture (voir AuthContext).
const BUCKET_AVATARS = 'avatars';
const BUCKET_COUVERTURES = 'covers';
const DUREE_URL_SIGNEE_S = 3600;

/** URL consultable d'une photo de profil : une URL complète est gardée, un chemin est signé. */
export async function urlPhotoProfil(valeur: string | null | undefined): Promise<string | null> {
  if (!valeur) return null;
  if (/^(https?:|data:|avatar:)/.test(valeur)) return valeur;
  const { data, error } = await supabase.storage.from(BUCKET_AVATARS).createSignedUrl(valeur, DUREE_URL_SIGNEE_S);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/** Choisit une photo dans la galerie et l'enregistre. Renvoie false si l'utilisateur annule ou refuse l'accès. */
export async function changerPhotoProfil(userId: string): Promise<boolean> {
  const permission = await permissionGalerie();
  if (!permission.granted) throw new Error('Facilité a besoin d’accéder à vos photos pour choisir votre photo de profil.');
  const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
  if (choix.canceled) return false;
  const a = choix.assets[0];

  const reduite = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(640, a.width) } }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  // Octets plutôt que Blob : sur Android le Blob d'un fichier local arrive typé « text/plain » et le bucket le refuse.
  const blob = Uint8Array.from(atob(reduite.base64 ?? ''), (c) => c.charCodeAt(0));
  const chemin = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from(BUCKET_AVATARS).upload(chemin, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);

  const { error: erreurProfil } = await supabase
    .from('profiles')
    .update({ avatar_url: chemin, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (erreurProfil) throw new Error(`Enregistrement de la photo impossible : ${erreurProfil.message}`);
  return true;
}

/** URL consultable d'une photo de couverture (bucket privé « covers », fichier `{user_id}/cover.jpg`). */
export async function urlPhotoCouverture(valeur: string | null | undefined): Promise<string | null> {
  if (!valeur) return null;
  if (/^(https?:|data:)/.test(valeur)) return valeur;
  const { data, error } = await supabase.storage.from(BUCKET_COUVERTURES).createSignedUrl(valeur, DUREE_URL_SIGNEE_S);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/** Choisit une photo de couverture dans la galerie et l'enregistre. Renvoie false si l'utilisateur annule. */
export async function changerPhotoCouverture(userId: string): Promise<boolean> {
  const permission = await permissionGalerie();
  if (!permission.granted) throw new Error('Facilité a besoin d’accéder à vos photos pour choisir votre photo de couverture.');
  const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [16, 7] });
  if (choix.canceled) return false;
  const a = choix.assets[0];

  const reduite = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(1280, a.width) } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  const blob = Uint8Array.from(atob(reduite.base64 ?? ''), (c) => c.charCodeAt(0));
  const chemin = `${userId}/cover.jpg`;
  const { error } = await supabase.storage.from(BUCKET_COUVERTURES).upload(chemin, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Envoi de la couverture impossible : ${error.message}`);

  const { error: erreurProfil } = await supabase
    .from('profiles')
    .update({ cover_url: chemin, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (erreurProfil) throw new Error(`Enregistrement de la couverture impossible : ${erreurProfil.message}`);
  return true;
}
