import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

// Photo de profil — mêmes conventions que le site (src/app/profil/page.js) : bucket PRIVÉ `avatars`,
// fichier `{user_id}/avatar.jpg` (remplacé à chaque changement), chemin enregistré dans
// `profiles.avatar_url` ; l'URL consultable est signée à la lecture (voir AuthContext).
const BUCKET_AVATARS = 'avatars';
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
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Facilité a besoin d’accéder à vos photos pour choisir votre photo de profil.');
  const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
  if (choix.canceled) return false;
  const a = choix.assets[0];

  const reduite = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(640, a.width) } }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const blob = await (await fetch(reduite.uri)).blob();
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
