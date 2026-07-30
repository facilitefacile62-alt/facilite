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
export function validateChatFile(file) {
  if (!file) return { valid: false, error: "Aucun fichier sélectionné." };
  if (!CHAT_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: "Format non supporté (PDF, DOC/DOCX, PNG ou JPG uniquement)." };
  }
  if (file.size > MAX_CHAT_FILE_BYTES) {
    return { valid: false, error: "Fichier trop volumineux (15 Mo maximum)." };
  }
  return { valid: true, error: null };
}

/**
 * Téléverse un fichier (ou un Blob audio enregistré) dans le bucket public
 * chat-attachments, sous {userId}/{timestamp}_{nom}, et renvoie les
 * métadonnées prêtes à insérer dans messages.attachment_url /
 * attachment_type / file_name / file_size.
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

  const { data: publicUrlData } = supabase.storage.from("chat-attachments").getPublicUrl(storagePath);

  return {
    attachment_url: publicUrlData?.publicUrl || "",
    attachment_type: attachmentType || classifyAttachment(file.type),
    file_name: rawName,
    file_size: formatFileSize(file.size),
    error: null,
  };
}
