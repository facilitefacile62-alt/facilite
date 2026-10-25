import { NextResponse } from "next/server";
import { verifierSignatureWebhook } from "@/lib/smsHook/signature";
import { BUDGETS, traiterEnvoi } from "@/lib/smsHook/service";
import { creerDependancesHook } from "@/lib/smsHook/depsServeur";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * « Send SMS Hook » de Supabase Auth (Authentication → Hooks) : à chaque code par téléphone, Supabase appelle cette route avec { user, sms: { otp } } et attend
 * un 200. Route PUBLIQUE par nature (appelée par Supabase, jamais par un utilisateur) : la seule barrière est la signature « Standard Webhooks » vérifiée ici
 * AVANT toute lecture ou tout envoi (puis une seconde fois dans le service). Voir src/lib/smsHook/service.js pour le budget de temps (Supabase : 5 s au total).
 *
 * Tant que le hook n'est pas activé côté Supabase, cette route ne reçoit rien. SMS_PROVIDER vaut « twilio » par défaut.
 */
export async function POST(req) {
  const corps = await req.text();
  const controle = verifierSignatureWebhook({ corps, entetes: req.headers, secret: process.env.SEND_SMS_HOOK_SECRET });
  if (!controle.ok) {
    // Secret non défini (hook pas encore configuré) : 403, JAMAIS 503 — Supabase réessaierait un 503 jusqu'à 3 fois. Rien n'est envoyé, rien n'est écrit au journal.
    // Signature fausse alors que le secret existe : 401.
    const statut = controle.raison === "secret_absent" ? 403 : 401;
    return NextResponse.json({ error: { http_code: statut, message: statut === 403 ? "Hook non configuré." : "Signature invalide." } }, { status: statut });
  }

  const limite = new Promise((resolve) =>
    setTimeout(() => resolve({ statut: 500, corps: { error: { http_code: 500, message: "Envoi trop long." } } }), BUDGETS.limiteMs)
  );
  const resultat = await Promise.race([traiterEnvoi({ corps, entetes: req.headers, deps: creerDependancesHook() }), limite]);
  return NextResponse.json(resultat.corps, { status: resultat.statut });
}
