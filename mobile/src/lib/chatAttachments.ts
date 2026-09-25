import { supabase } from '@/lib/supabase';

/**
 * Pièces jointes de la messagerie mobile (photo, document, note vocale) — port de
 * src/lib/chatAttachments.js (site) : même bucket privé `chat-attachments`, même convention de chemin
 * ({userId}/{timestamp}_{nom}) et mêmes colonnes messages.attachment_url / attachment_type / file_name /
 * file_size, pour qu'un vendeur ou un admin qui répond depuis le SITE lise exactement le même fichier.
 */

export type TypePieceJointe = 'image' | 'audio' | 'pdf' | 'document';

export const MAX_CHAT_FILE_BYTES = 15 * 1024 * 1024; // 15 Mo, comme le site

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function classifierType(mime: string | undefined): TypePieceJointe {
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  return 'document';
}

export type PieceJointeEnvoyee = {
  attachmentUrl: string;
  attachmentType: TypePieceJointe;
  fileName: string;
  fileSize: string;
};

/**
 * Téléverse un fichier local (URI `file://`, photo ou note vocale enregistrée) dans le bucket privé
 * chat-attachments. `fetch(uri).blob()` : même patron déjà éprouvé pour l'envoi des photos d'articles
 * (voir vendeur.ts, envoyerPhotoArticle) — fonctionne aussi bien pour un document ou un fichier audio local.
 */
export async function envoyerPieceJointeChat({
  uri,
  userId,
  fileName,
  mimeType,
  attachmentType,
  taille,
}: {
  uri: string;
  userId: string;
  fileName: string;
  mimeType?: string;
  attachmentType?: TypePieceJointe;
  taille?: number;
}): Promise<PieceJointeEnvoyee> {
  if (!userId) throw new Error('Connexion requise pour envoyer une pièce jointe.');
  const nomSain = (fileName || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_');
  const chemin = `${userId}/${Date.now()}_${nomSain}`;

  const reponse = await fetch(uri);
  const blob = await reponse.blob();
  if (blob.size > MAX_CHAT_FILE_BYTES) {
    throw new Error('Fichier trop volumineux (15 Mo maximum).');
  }

  const { error } = await supabase.storage.from('chat-attachments').upload(chemin, blob, {
    contentType: mimeType || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);

  return {
    attachmentUrl: chemin,
    attachmentType: attachmentType || classifierType(mimeType),
    fileName: fileName || nomSain,
    fileSize: formatFileSize(taille ?? blob.size),
  };
}

// Expiration courte, même durée que le site : une URL signée copiée/mise en cache ne reste exploitable
// que quelques minutes.
const DUREE_URL_SIGNEE_SECONDES = 300;

/** Résout un chemin de pièce jointe (colonne attachment_url) en URL signée temporaire, affichable/jouable. */
export async function urlPieceJointeSignee(chemin: string | null | undefined): Promise<string | null> {
  if (!chemin) return null;
  // Anciens messages envoyés avant le passage du bucket en privé : URL publique historique, inchangée.
  if (/^https?:\/\//i.test(chemin)) return chemin;

  const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(chemin, DUREE_URL_SIGNEE_SECONDES);
  if (error) {
    console.error('Erreur génération URL signée pièce jointe:', error.message);
    return null;
  }
  return data?.signedUrl || null;
}
