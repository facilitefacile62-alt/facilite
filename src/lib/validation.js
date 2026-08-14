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

// `useChat` (@ai-sdk/react@4) envoie des UIMessage : le texte est porté par un
// tableau `parts`, plus par un champ `content`. Les deux formes sont acceptées
// ici pour rester tolérant aux appels directs de l'API hors composant React.
const UiMessagePartSchema = z.object({
  type: z.string().max(50),
  text: z.string().max(20_000).optional(),
});

export const AssistantPayloadSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().max(100).optional(),
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(UiMessagePartSchema).max(50).optional(),
        content: z.string().max(20_000).optional(),
      })
    )
    .min(1)
    .max(50),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

// Payload de /api/ai-chat : historique de conversation.
// Deux formes de payload coexistent volontairement :
//   - `messages` : historique complet (messagerie), l'assistant garde le contexte
//   - `message`  : tour unique (bulle flottante)
// Accepter les deux évite d'imposer une réécriture simultanée des deux clients.
export const AiChatPayloadSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(20_000),
        })
      )
      .min(1)
      .max(30)
      .optional(),
    message: z.string().min(1).max(20_000).optional(),
    model: z.string().max(100).optional(),
    customSystemPrompt: z.string().max(25_000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    attachments: z.array(AttachmentSchema).max(5).optional(),
  })
  .refine((d) => (d.messages && d.messages.length > 0) || d.message, {
    message: "Un message ou un historique de messages est requis.",
  });

export const DiagnosticPayloadSchema = z.object({
  fileData: z.string().min(1).max(14_000_000),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  customRules: z.string().max(25_000).optional(),
});

export const ParseDocumentJsonSchema = z.object({
  documentText: z.string().max(500_000),
});

// Payload de /api/send-application : volontairement PAS de candidateId ici.
// Le candidat est déterminé côté serveur via requireUser (le JWT authentifié),
// jamais par une valeur envoyée par le client — sans quoi n'importe qui
// pourrait déclencher un envoi de candidature au nom d'un autre utilisateur.
export const SendApplicationPayloadSchema = z.object({
  recipientEmail: z.string().trim().email().max(254),
});
