"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getSignedAvatarUrl } from "@/lib/supabase";

/**
 * Avatar résolu à la volée : chemin de bucket Storage -> URL signée,
 * data:/http(s)/asset local -> affiché tel quel, vide -> fallback.
 *
 * Pensé pour les listes (tableaux admin, résultats de recherche) affichant
 * l'avatar d'AUTRES utilisateurs que celui connecté : chaque instance résout
 * son propre chemin indépendamment (pas de Promise.all global qui ferait
 * attendre toute la liste sur la ligne la plus lente), et ne coûte un
 * aller-retour réseau que pour les comptes ayant réellement une photo migrée
 * vers Storage — getSignedAvatarUrl renvoie les autres cas sans appel réseau.
 *
 * `className` porte les classes de TAILLE/forme (w-8 h-8 rounded-full...),
 * appliquées au conteneur positionné (requis par <Image fill>) — l'image
 * elle-même se contente de le remplir.
 */
export default function AvatarImage({ path, alt, className, fallback = null }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return undefined;
    }
    getSignedAvatarUrl(path).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return fallback;

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes="48px"
        className="object-cover"
        onError={() => setUrl(null)}
      />
    </div>
  );
}
