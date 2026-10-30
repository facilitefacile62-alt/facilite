"use client";

import { useEffect } from "react";
import { HOTE_IMAGES, imagesWorkerActives, reparerElement } from "@/lib/imagesPubliques";

/**
 * Filet de sécurité de l'interrupteur « images par le Worker » : si une image, un audio ou une vidéo servi par le Worker échoue à se charger, l'élément est remis sur
 * Supabase (une seule fois). Interrupteur fermé : ne fait rien du tout (aucun écouteur). Les erreurs de chargement ne « remontent » pas : on écoute en phase de capture.
 */
export default function ImagesRepliSupabase() {
  useEffect(() => {
    if (!imagesWorkerActives()) return undefined;
    const surErreur = (e) => {
      reparerElement(e.target, HOTE_IMAGES);
    };
    document.addEventListener("error", surErreur, true);
    return () => document.removeEventListener("error", surErreur, true);
  }, []);
  return null;
}
