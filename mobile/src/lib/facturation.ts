import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';

// Données et paiement de la page de facturation de Locaux. Les jetons sont crédités UNIQUEMENT par le serveur (webhook Orange Money puis
// rattrapage) : l'application ne fait que créer la demande de paiement et lire l'état de la commande.
export type Taux = { cout_jeton_fcfa: number; jetons_requis_premium_an: number };

export async function chargerTaux(): Promise<Taux> {
  const { data, error } = await supabase.from('jetons_config').select('cout_jeton_fcfa, jetons_requis_premium_an').eq('id', 1).single();
  if (error || !data) throw new Error(error?.message ?? 'Tarif des jetons indisponible.');
  return data as Taux;
}

export async function chargerSolde(storeId: string): Promise<number> {
  const { data, error } = await supabase.from('jetons_boutique').select('solde_jetons').eq('store_id', storeId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.solde_jetons ?? 0;
}

/** Date de fin de la période Premium en cours, ou null si Premium n'est pas actif (vérifié à la lecture : date_expiration > maintenant). */
export async function chargerPremiumJusqua(storeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('premium_marketplace')
    .select('date_expiration')
    .eq('store_id', storeId)
    .gt('date_expiration', new Date().toISOString())
    .order('date_expiration', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.date_expiration ?? null;
}

/** Retire les jetons requis et active 1 an de Premium : une seule transaction atomique côté serveur (activer_premium_marketplace). */
export async function activerPremium(storeId: string): Promise<void> {
  const { error } = await supabase.rpc('activer_premium_marketplace', { p_store_id: storeId });
  if (error) throw new Error(error.message);
}

export type PaiementJetons = {
  transactionId: string;
  qrCodeBase64: string | null;
  deepLinkMaxit: string | null;
  deepLinkOm: string | null;
  quantiteJetons: number;
  montantXof: number;
  validForSeconds: number;
};

async function enteteAutorisation(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
}

/** Crée la demande de paiement (QR + liens d'ouverture). Le prix est calculé et enregistré par le serveur, jamais par l'application. */
export async function creerPaiementJetons(storeId: string, quantiteJetons: number): Promise<{ ok: true; paiement: PaiementJetons } | { ok: false; statut: number; message: string }> {
  try {
    const reponse = await fetch(`${SITE_URL}/api/pay/jetons-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await enteteAutorisation()) },
      body: JSON.stringify({ storeId, quantiteJetons }),
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !corps?.qrId) {
      return { ok: false, statut: reponse.status, message: typeof corps?.error === 'string' ? corps.error : "Le paiement n'a pas pu être préparé. Réessayez." };
    }
    return {
      ok: true,
      paiement: {
        transactionId: corps.transactionId,
        qrCodeBase64: corps.qrCodeBase64 ?? null,
        deepLinkMaxit: corps.deepLinkMaxit ?? null,
        deepLinkOm: corps.deepLinkOm ?? null,
        quantiteJetons: corps.quantiteJetons ?? quantiteJetons,
        montantXof: corps.montantXof,
        validForSeconds: corps.validForSeconds ?? 300,
      },
    };
  } catch {
    return { ok: false, statut: 0, message: 'Pas de connexion. Vérifiez votre réseau et réessayez.' };
  }
}

/** État de la commande côté serveur : « pending », « success » (jetons crédités) ou « failed ». */
export async function statutPaiementJetons(transactionId: string): Promise<'pending' | 'success' | 'failed' | 'inconnu'> {
  try {
    const reponse = await fetch(`${SITE_URL}/api/pay/jetons-checkout?transactionId=${encodeURIComponent(transactionId)}`, { headers: await enteteAutorisation() });
    const corps = await reponse.json().catch(() => ({}));
    return corps?.status === 'success' || corps?.status === 'failed' || corps?.status === 'pending' ? corps.status : 'inconnu';
  } catch {
    return 'inconnu';
  }
}
