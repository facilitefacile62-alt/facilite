import { after } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { limiter } from "@/lib/limiteur";

// Dépendances RÉELLES du hook SMS (base, limites, e-mail d'alerte, travail différé). Les tests passent leurs doublures au même service.

const avecPlafond = (promesse, ms) => Promise.race([promesse, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

export function creerDependancesHook(env = process.env) {
  const admin = getSupabaseAdmin();
  return {
    env,
    maintenant: () => Date.now(),
    limiter,
    fetchFn: fetch,
    // Journal : ne fait JAMAIS échouer l'envoi, et ne dépasse pas son petit budget de temps.
    journaliser: async (ligne, delaiMs = 300) => {
      try {
        await avecPlafond(admin.from("sms_envois_journal").insert(ligne), delaiMs);
      } catch (erreur) {
        console.error("[SMS hook] Journal impossible :", erreur?.message);
      }
    },
    compterAlertesRecentes: async (cle) => {
      const { count } = await admin
        .from("sms_envois_journal")
        .select("id", { count: "exact", head: true })
        .eq("evenement", "alerte")
        .eq("detail", cle)
        .gte("cree_le", new Date(Date.now() - 3600 * 1000).toISOString());
      return count ?? 0;
    },
    alerter: async ({ sujet, texte }) => envoyerAlerte(env, sujet, texte),
    apres: (fn) => after(fn),
  };
}

export async function envoyerAlerte(env, sujet, texte) {
  const destinataire = env.SMS_ALERTE_EMAIL;
  if (!destinataire) {
    console.error(`[SMS hook] ALERTE (SMS_ALERTE_EMAIL absent, aucun e-mail envoyé) : ${sujet}`);
    return { ok: false };
  }
  const resend = new Resend(env.RESEND_API_KEY || "re_dummy_key");
  const expediteur = env.RESEND_FROM_CANDIDATE || "Facilite <noreply@ffacilite.com>";
  const { error } = await resend.emails.send({ from: expediteur, to: destinataire, subject: `[Facilité SMS] ${sujet}`, html: `<p>${texte}</p>` });
  return { ok: !error };
}
