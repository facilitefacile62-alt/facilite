import { supabase } from "./supabase";

/**
 * Téléversement des pièces jointes de la messagerie (fichiers choisis et
 * notes vocales enregistrées) — partagé entre /messagerie et
 * /admin/messages pour éviter de dupliquer la logique d'upload deux fois.
 */

export const CHAT_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const MAX_CHAT_FILE_BYTES = 15 * 1024 * 1024; // 15 Mo

export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function classifyAttachment(mimeType) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Valide un fichier choisi par l'utilisateur avant tout upload (taille,
 * type MIME déclaré). Purement côté client : cet upload va directement vers
 * Supabase Storage, sans passer par une route API capable de vérifier les
 * magic bytes comme pour les CV — acceptable ici, le risque est le même que
 * pour l'upload direct des photos d'offres déjà en place dans /recruteur.
 */
export async function validateChatFile(file) {
  if (!file) return { valid: false, error: "Aucun fichier sélectionné." };
  if (!CHAT_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: "Format non supporté (PDF, DOC/DOCX, PNG ou JPG uniquement)." };
  }
  if (file.size > MAX_CHAT_FILE_BYTES) {
    return { valid: false, error: "Fichier trop volumineux (15 Mo maximum)." };
  }
  
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const arr = new Uint8Array(buffer);
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    let realType = null;
    if (hex.startsWith("25504446")) realType = "application/pdf";
    else if (hex.startsWith("504B0304")) realType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (hex.startsWith("D0CF11E0")) realType = "application/msword";
    else if (hex.startsWith("89504E47")) realType = "image/png";
    else if (hex.startsWith("FFD8FF")) realType = "image/jpeg";
    else if (hex.startsWith("52494646") && hex.substring(16, 24) === "57454250") realType = "image/webp";

    const isImageOrAudio = file.type.startsWith("image/") || file.type.startsWith("audio/");
    
    if (realType && realType !== file.type && !isImageOrAudio) {
        return { valid: false, error: "Le contenu réel du fichier ne correspond pas à son extension (sécurité)." };
    }
  } catch (err) {
    console.error("Erreur de lecture Magic Bytes :", err);
    return { valid: false, error: "Impossible d'analyser la sécurité du fichier." };
  }

  return { valid: true, error: null };
}

/**
 * Téléverse un fichier (ou un Blob audio enregistré) dans le bucket privé
 * chat-attachments, sous {userId}/{timestamp}_{nom}, et renvoie les
 * métadonnées prêtes à insérer dans messages.attachment_url /
 * attachment_type / file_name / file_size.
 *
 * attachment_url stocke désormais le CHEMIN de stockage (comme
 * resumes.file_url), pas une URL publique — le bucket est privé depuis la
 * Partie 2 du chantier (invariant 4). Résoudre en URL affichable via
 * getChatAttachmentSignedUrl().
 */
export async function uploadChatAttachment({ file, userId, fileName, attachmentType }) {
  const rawName = fileName || file.name || "fichier";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    console.error("Erreur upload pièce jointe:", uploadError.message);
    return { error: uploadError.message };
  }

  return {
    attachment_url: storagePath,
    attachment_type: attachmentType || classifyAttachment(file.type),
    file_name: rawName,
    file_size: formatFileSize(file.size),
    error: null,
  };
}

// Expiration courte : une URL signée fuitée (copiée, cachée navigateur) ne
// reste exploitable que quelques minutes, pas indéfiniment comme l'ancienne
// URL publique.
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Résout un chemin de pièce jointe en URL signée temporaire. La policy
 * Storage "Participants lisent les pieces jointes de leur conversation"
 * est le contrôle d'accès réel : ce client porte le JWT de l'utilisateur,
 * la RLS refuse la signature si l'appelant n'est ni participant ni
 * admin/publisher — pas une simple convention côté app.
 *
 * Les valeurs déjà en `http(s)://` sont d'anciens messages envoyés avant ce
 * correctif (URL publique historique) : renvoyées telles quelles, sans
 * tentative de signature — elles ne fonctionneront plus une fois le bucket
 * basculé en privé (comportement attendu, pas un bug).
 */
export async function getChatAttachmentSignedUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("Erreur génération URL signée pièce jointe:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}
