import { z } from "zod";

/**
 * Validation des entrées des routes API.
 *
 * La validation côté navigateur (attribut `accept`, contrôles React) relève de
 * l'ergonomie, pas de la sécurité : elle est contournée par un simple `curl`.
 * Chaque payload est donc re-vérifié ici, côté serveur.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

/**
 * Signatures binaires réelles en tête de fichier. Le type MIME annoncé par le
 * client n'est qu'une déclaration : un attaquant renomme malware.exe en
 * photo.jpg et annonce image/jpeg. Les magic bytes, eux, ne mentent pas.
 */
const MAGIC_SIGNATURES = [
  { signature: "%PDF", mime: "application/pdf" },
  { signature: "PK\x03\x04", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { signature: "\xD0\xCF\x11\xE0", mime: "application/msword" },
];

/**
 * Renvoie le type réel déduit des premiers octets, ou null si inconnu
 * (cas normal pour les images et le texte brut, non couverts ici).
 */
export function sniffMimeType(buffer) {
  const head = buffer.subarray(0, 8).toString("latin1");
  return MAGIC_SIGNATURES.find(({ signature }) => head.startsWith(signature))?.mime ?? null;
}

/**
 * Contrôle complet d'un fichier téléversé.
 * Renvoie { valid: true } ou { valid: false, error, status }.
 */
export function validateUploadedFile(buffer, declaredMimeType, declaredSize) {
  const size = declaredSize ?? buffer.length;

  if (size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, status: 413, error: "Fichier trop volumineux (10 Mo maximum)." };
  }

  if (declaredMimeType && !ALLOWED_MIME_TYPES.has(declaredMimeType)) {
    return { valid: false, status: 415, error: "Format de fichier non pris en charge." };
  }

  const realType = sniffMimeType(buffer);
  // Les images et le texte brut n'ont pas de signature vérifiée ici : on ne
  // rejette que lorsqu'une signature connue CONTREDIT le type déclaré.
  const estImageOuTexte =
    declaredMimeType?.startsWith("image/") || declaredMimeType === "text/plain";

  if (realType && declaredMimeType && realType !== declaredMimeType && !estImageOuTexte) {
    return {
      valid: false,
      status: 415,
      error: "Le contenu du fichier ne correspond pas au format déclaré.",
    };
  }

  return { valid: true };
}

// --- Schémas de payload ---

const AttachmentSchema = z.object({
  type: z.enum(["image", "document"]),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  // ~13,3 Mo de base64 pour 10 Mo de binaire
  data: z.string().max(14_000_000),
});

export const AssistantPayloadSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(20_000),
      })
    )
    .min(1)
    .max(50),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

export const DiagnosticPayloadSchema = z.object({
  fileData: z.string().min(1).max(14_000_000),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
});

export const ParseDocumentJsonSchema = z.object({
  documentText: z.string().max(500_000),
});
