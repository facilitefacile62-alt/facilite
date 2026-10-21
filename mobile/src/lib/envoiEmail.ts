import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';
import * as DocumentPicker from 'expo-document-picker';
import type { FichierLocal } from '@/lib/candidature';

// « Écrire un e-mail » : envoi par la route /api/envoyer-email du site, qui
// contrôle la session, plafonne à 10 envois par 24 h et envoie depuis le domaine
// de Facilité avec « Répondre à » = l'adresse de l'utilisateur.
export const MAX_PIECES = 3;
const TAILLE_MAX_PIECE_O = 10 * 1024 * 1024;

/** Choisit sur l'appareil un fichier à joindre : PDF, Word ou image. */
export async function choisirPieceJointe(): Promise<FichierLocal | null> {
  const choix = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (choix.canceled || !choix.assets?.length) return null;
  const f = choix.assets[0];
  if (typeof f.size === 'number' && f.size > TAILLE_MAX_PIECE_O) throw new Error('Fichier trop lourd : 10 Mo maximum.');
  return { uri: f.uri, nom: f.name || 'document', type: f.mimeType || 'application/octet-stream' };
}

export async function envoyerEmail(champs: { to: string; subject: string; message: string; pieces: FichierLocal[]; resumeIds?: string[] }): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré. Veuillez vous reconnecter.');

  const formData = new FormData();
  formData.append('to', champs.to.trim());
  formData.append('subject', champs.subject.trim());
  formData.append('message', champs.message.trim());
  // « Joindre : Mon CV · Lettre » : seuls les identifiants partent ; le serveur relit lui-même les documents de l'utilisateur.
  (champs.resumeIds ?? []).forEach((id) => formData.append('resume_ids', id));
  champs.pieces.forEach((f) => {
    // Forme propre à React Native pour un fichier local (pas la Blob web).
    formData.append('pieces', { uri: f.uri, name: f.nom, type: f.type } as unknown as Blob);
  });

  const reponse = await fetch(`${SITE_URL}/api/envoyer-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: formData,
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !resultat?.success) {
    throw new Error(typeof resultat?.error === 'string' ? resultat.error : "L'e-mail n'a pas pu être envoyé.");
  }
}
