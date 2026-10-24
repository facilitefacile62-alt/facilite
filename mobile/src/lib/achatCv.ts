import { useEffect, useState } from 'react';

import { adresseApercu, lireModeleCv, type ModeleCv } from '@/lib/achatCvLogique';
import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';

// Données et paiement de l'« Achat de CV ». Un modèle n'est « acheté » que par le serveur (webhook Orange Money puis rattrapage) : l'application
// crée la demande de paiement et lit l'état de l'achat. Elle ne reçoit JAMAIS le fichier d'origine avant l'achat : seulement des images
// d'aperçu filigranées en basse définition, servies page par page par le serveur.

async function jetonAcces(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}
async function enteteAutorisation(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await jetonAcces()}` };
}

/** Catalogue : les modèles actifs, sans aucun chemin de fichier (fonction lister_modeles_cv). */
export async function chargerModelesCv(): Promise<ModeleCv[]> {
  const { data, error } = await supabase.rpc('lister_modeles_cv');
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).map(lireModeleCv).filter((m): m is ModeleCv => m !== null);
}

/** En-tête d'autorisation pour charger les images d'aperçu (réservées aux comptes connectés). Vide tant que la session n'est pas lue. */
export function useEnteteImages(): Record<string, string> | null {
  const [entete, setEntete] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let annule = false;
    enteteAutorisation().then((e) => {
      if (!annule) setEntete(e);
    });
    return () => {
      annule = true;
    };
  }, []);
  return entete;
}

export const urlApercuPage = (modeleId: string, page: number): string | null => adresseApercu(SITE_URL, modeleId, page);

export type PaiementCv = {
  achatId: string;
  qrCodeBase64: string | null;
  deepLinkMaxit: string | null;
  deepLinkOm: string | null;
  montantXof: number;
  validForSeconds: number;
};

export type ResultatPaiementCv =
  | { ok: true; paiement: PaiementCv }
  | { ok: false; statut: number; message: string; dejaAchete?: boolean; paiementEnCours?: boolean; achatId?: string };

/** Crée la demande de paiement : seul l'identifiant du modèle est envoyé, le prix est lu par le serveur. */
export async function creerPaiementCv(modeleId: string): Promise<ResultatPaiementCv> {
  try {
    const reponse = await fetch(`${SITE_URL}/api/pay/cv-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await enteteAutorisation()) },
      body: JSON.stringify({ modeleId }),
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !corps?.qrId) {
      return {
        ok: false,
        statut: reponse.status,
        message: typeof corps?.error === 'string' ? corps.error : "Le paiement n'a pas pu être préparé. Réessayez.",
        dejaAchete: corps?.dejaAchete === true,
        paiementEnCours: corps?.paiementEnCours === true,
        achatId: typeof corps?.achatId === 'string' ? corps.achatId : undefined,
      };
    }
    return {
      ok: true,
      paiement: {
        achatId: corps.achatId,
        qrCodeBase64: corps.qrCodeBase64 ?? null,
        deepLinkMaxit: corps.deepLinkMaxit ?? null,
        deepLinkOm: corps.deepLinkOm ?? null,
        montantXof: corps.montantXof,
        validForSeconds: corps.validForSeconds ?? 300,
      },
    };
  } catch {
    return { ok: false, statut: 0, message: 'Pas de connexion. Vérifiez votre réseau et réessayez.' };
  }
}

/** État de l'achat côté serveur : « pending », « success » (modèle acheté) ou « failed ». */
export async function statutAchatCv(achatId: string): Promise<'pending' | 'success' | 'failed' | 'inconnu'> {
  try {
    const reponse = await fetch(`${SITE_URL}/api/pay/cv-checkout?achatId=${encodeURIComponent(achatId)}`, { headers: await enteteAutorisation() });
    const corps = await reponse.json().catch(() => ({}));
    return corps?.status === 'success' || corps?.status === 'failed' || corps?.status === 'pending' ? corps.status : 'inconnu';
  } catch {
    return 'inconnu';
  }
}

/** Lien signé de courte durée (60 s) du fichier livré — seulement pour l'acheteur d'un achat confirmé. null si refusé ou indisponible. */
export async function lienTelechargementCv(modeleId: string): Promise<string | null> {
  try {
    const reponse = await fetch(`${SITE_URL}/api/cv-modeles/${encodeURIComponent(modeleId)}/telecharger`, { headers: await enteteAutorisation() });
    const corps = await reponse.json().catch(() => ({}));
    return reponse.ok && typeof corps?.url === 'string' ? corps.url : null;
  } catch {
    return null;
  }
}
