"use client";

import { useEffect, useState } from "react";
import { getChatAttachmentSignedUrl } from "@/lib/chatAttachments";

/**
 * Résout un chemin de pièce jointe de messagerie (chat-attachments, bucket
 * privé) en URL signée temporaire, sans restructurer le JSX qui l'affiche —
 * render-prop plutôt qu'un composant figé, pour rester utilisable aussi bien
 * pour un lien de téléchargement que pour un <audio src>.
 */
export default function ChatAttachmentUrl({ path, children }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) return undefined;
    getChatAttachmentSignedUrl(path).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return children(url);
}
