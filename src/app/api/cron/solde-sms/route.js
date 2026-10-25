import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { executerControleSolde } from "@/lib/smsHook/solde";
import { envoyerAlerte } from "@/lib/smsHook/depsServeur";

export const runtime = "nodejs";

/**
 * Contrôle quotidien (Vercel Cron, voir vercel.json) du solde de SMS Orange : alerte par e-mail (au plus une par jour) quand il reste peu de SMS, que le
 * forfait expire bientôt ou qu'aucun contrat n'est actif ; purge du journal des envois après 90 jours. Exige CRON_SECRET (401 sinon), comme les autres tâches
 * planifiées. Sans effet tant que SMS_PROVIDER n'est pas « orange ». La logique, testée, est dans src/lib/smsHook/solde.js.
 */
export async function GET(req) {
  const env = process.env;
  // Le client d'administration n'est créé qu'après le contrôle du secret (voir executerControleSolde) : jamais de base touchée sans secret valide.
  let admin;
  const base = () => (admin ??= getSupabaseAdmin());
  const resultat = await executerControleSolde({
    authorization: req.headers.get("authorization"),
    deps: {
      env,
      maintenant: () => Date.now(),
      fetchFn: fetch,
      purgerJournal: async () => {
        const r = await base().from("sms_envois_journal").delete().lt("cree_le", new Date(Date.now() - 90 * 86400 * 1000).toISOString());
        if (r.error) console.error("[Cron solde SMS] Purge du journal impossible :", r.error.message);
      },
      compterAlertes: async (heures) => {
        const { count } = await base()
          .from("sms_envois_journal")
          .select("id", { count: "exact", head: true })
          .eq("evenement", "alerte")
          .eq("detail", "solde_orange_bas")
          .gte("cree_le", new Date(Date.now() - heures * 3600 * 1000).toISOString());
        return count ?? 0;
      },
      journaliser: async (ligne) => void (await base().from("sms_envois_journal").insert(ligne)),
      alerter: ({ sujet, texte }) => envoyerAlerte(env, sujet, texte),
    },
  });
  return NextResponse.json(resultat.corps, { status: resultat.statut });
}
