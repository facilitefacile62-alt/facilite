import { createHmac } from "node:crypto";
import { verifierSignatureWebhook } from "./signature.js";
import { envoyerOrange, envoyerTwilio, orangeConfigure } from "./fournisseurs.js";

// « Send SMS Hook » de Supabase Auth : Supabase nous remet le numéro et le code à 6 chiffres, NOUS envoyons le SMS.
//
// BUDGET DE TEMPS. Supabase accorde 5 secondes à TOUT le hook, retries compris, et réessaie (jusqu'à 3 fois, 2 s d'écart) sur une réponse 429 ou 503 :
// on ne répond donc JAMAIS 429/503 (403 = refus, 500 = échec), sinon le même code partirait plusieurs fois.
//   contrôles (signature, forme, limites)   ≤ 0,4 s   (Redis borné ; sinon compteur en mémoire)
//   Orange (jeton si absent + envoi)        ≤ 1,6 s
//   Twilio en secours                       ≤ 1,2 s   (tenté seulement s'il reste ≥ 0,4 s avant l'heure limite)
//   journal                                 ≤ 0,3 s
//   heure limite de NOTRE code              3,5 s  → il reste 1,5 s pour le démarrage à froid de la fonction et le réseau.
//
// SMS_PROVIDER : « twilio » (défaut) = Twilio seul ; « orange » = Orange d'abord, Twilio en secours. Tant que le hook n'est pas activé dans Supabase, cette route ne
// reçoit rien : rien ne change pour personne. SMS_A_BLANC=1 : aucun SMS, seulement une ligne de journal (essais — jamais en production avec le hook actif).

export const BUDGETS = { controlesMs: 400, orangeMs: 1600, twilioMs: 1200, journalMs: 300, limiteMs: 3500, margeTwilioMs: 400 };
export const LIMITE_PAR_NUMERO_HEURE = 3;
export const LIMITE_PAR_NUMERO_JOUR = 10;
export const PLAFOND_JOUR_PAR_DEFAUT = 300;
export const PLAFOND_SECOURS_TWILIO_PAR_DEFAUT = 20;

const reponse = (statut, message) => ({ statut, corps: message ? { error: { http_code: statut, message } } : {} });
const jourUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Empreinte du numéro pour le journal et les limites (jamais le numéro en clair). */
export const empreinteNumero = (numero, secret) => createHmac("sha256", secret || "sans-secret").update(`num:${numero}`).digest("hex").slice(0, 32);

/** « +221771234567 » ou null. */
export function normaliserNumeroHook(telephone) {
  const chiffres = String(telephone ?? "").replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(chiffres) ? `+${chiffres}` : null;
}

export const messageSms = (code) => `Facilité : votre code est ${code}. Valable 10 minutes. Ne le donnez à personne.`;

/**
 * deps = { env, maintenant, limiter, fetchFn, journaliser(ligne, delaiMs), alerter({sujet, texte}), compterAlertesRecentes(cle), apres(fn), budgets? }
 * `apres(fn)` : travail différé HORS budget (alertes e-mail) — en production, `after()` de Next.js : la réponse part d'abord.
 * corps = texte brut reçu ; entetes = Headers
 */
export async function traiterEnvoi({ corps, entetes, deps }) {
  const { env, maintenant } = deps;
  const budgets = { ...BUDGETS, ...(deps.budgets ?? {}) };
  const debut = maintenant();
  const ecoule = () => maintenant() - debut;

  // 1) Signature : sans elle, rien.
  const sig = verifierSignatureWebhook({ corps, entetes, secret: env.SEND_SMS_HOOK_SECRET, maintenantMs: maintenant() });
  if (!sig.ok) {
    // Secret non défini : 403 (jamais 503, que Supabase réessaierait) ; rien n'est envoyé ni journalisé.
    if (sig.raison === "secret_absent") return reponse(403, "Hook non configuré.");
    return reponse(401, "Signature invalide.");
  }

  // 2) Forme de la demande.
  let donnees;
  try {
    donnees = JSON.parse(corps);
  } catch {
    return reponse(400, "Demande invalide.");
  }
  const numero = normaliserNumeroHook(donnees?.user?.phone);
  const code = donnees?.sms?.otp;
  if (!numero || typeof code !== "string" || !/^\d{6}$/.test(code)) return reponse(400, "Demande invalide.");

  const empreinte = empreinteNumero(numero, env.SEND_SMS_HOOK_SECRET);
  const ligne = { evenement: "envoi", numero_hash: empreinte, numero_fin: numero.slice(-3), mode: env.SMS_A_BLANC === "1" ? "a_blanc" : "reel", fournisseur: "aucun" };
  const finir = async (statut, message, extra) => {
    await deps.journaliser({ ...ligne, ...extra, duree_ms: ecoule() }, budgets.journalMs);
    return reponse(statut, message);
  };

  // 3) Limites : par numéro (heure, jour) et plafond global du jour (garde-fou contre une facture folle). Pas de limite par IP ici : le hook ne reçoit pas l'IP du
  //    client (limites d'envoi propres à Supabase Auth, ou route intermédiaire plus tard).
  const lim = (cle, max, secondes) => deps.limiter(cle, max, secondes, budgets.controlesMs);
  const parHeure = await lim(`smshook:h:${empreinte}`, LIMITE_PAR_NUMERO_HEURE, 3600);
  const parJour = parHeure && (await lim(`smshook:j:${empreinte}`, LIMITE_PAR_NUMERO_JOUR, 86400));
  if (!parHeure || !parJour) return finir(403, "Trop de demandes pour ce numéro.", { resultat: "limite", detail: parHeure ? "numero_jour" : "numero_heure" });
  const plafond = Number(env.SMS_PLAFOND_JOUR) > 0 ? Number(env.SMS_PLAFOND_JOUR) : PLAFOND_JOUR_PAR_DEFAUT;
  if (!(await lim(`smshook:g:${jourUtc(maintenant())}`, plafond, 86400))) {
    deps.apres(() => signaler(deps, "plafond_jour", "Plafond quotidien de SMS atteint", `Le plafond de ${plafond} SMS par jour est atteint : les codes sont refusés jusqu'à demain. Si ce n'est pas une période de forte affluence, vérifiez qu'il ne s'agit pas d'un abus.`));
    return finir(403, "Plafond quotidien atteint.", { resultat: "refuse", detail: "plafond_jour" });
  }

  // 4) À blanc : aucun SMS, seulement le journal.
  if (env.SMS_A_BLANC === "1") return finir(200, null, { resultat: "ok", detail: "a_blanc" });

  // 5) Envoi : Orange d'abord (si demandé et configuré), Twilio en secours — dans le budget.
  const message = messageSms(code);
  const reste = () => budgets.limiteMs - ecoule();
  const veutOrange = env.SMS_PROVIDER === "orange" && orangeConfigure(env);
  let detailOrange = null;

  if (veutOrange) {
    const r = await envoyerOrange({ numero, message, env, fetchFn: deps.fetchFn, maintenant, delaiMs: Math.min(budgets.orangeMs, reste()) });
    if (r.ok) return finir(200, null, { fournisseur: "orange", resultat: "ok", code_http: r.httpCode });
    detailOrange = r.detail;
    deps.apres(() => signaler(deps, "echec_orange", "Échec d'envoi par Orange", `Orange n'a pas accepté un SMS (${r.detail ?? "inconnu"}). Le secours Twilio a été tenté. Vérifiez le solde et le contrat sur developer.orange.com (« SMS Sénégal »).`));
  }

  // Plafond propre au SECOURS Twilio (derrière Orange) : un Orange en panne ne doit pas se transformer en grosse facture Twilio. Ne s'applique pas quand Twilio
  // est le fournisseur choisi (SMS_PROVIDER = « twilio ») : là, seul le plafond global compte.
  if (veutOrange) {
    const plafondSecours = Number(env.SMS_PLAFOND_TWILIO_SECOURS_JOUR) > 0 ? Number(env.SMS_PLAFOND_TWILIO_SECOURS_JOUR) : PLAFOND_SECOURS_TWILIO_PAR_DEFAUT;
    if (!(await lim(`smshook:tw:${jourUtc(maintenant())}`, plafondSecours, 86400))) {
      deps.apres(() => signaler(deps, "plafond_secours_twilio", "Plafond du secours Twilio atteint", `Orange n'a pas pu envoyer et le secours Twilio a déjà servi ${plafondSecours} fois aujourd'hui : il est suspendu jusqu'à demain. Vérifiez Orange (solde, contrat) sans attendre : des personnes ne reçoivent plus leur code.`));
      return finir(500, "Envoi impossible.", { fournisseur: "orange", resultat: "refuse", detail: `${detailOrange ?? "orange"}|plafond_secours_twilio`.slice(0, 120) });
    }
  }

  if (reste() < budgets.margeTwilioMs) {
    return finir(500, "Envoi impossible.", { fournisseur: veutOrange ? "orange" : "aucun", resultat: "echec", detail: veutOrange ? `${detailOrange ?? "orange"}|temps_epuise` : "temps_epuise" });
  }
  const t = await envoyerTwilio({ numero, message, env, fetchFn: deps.fetchFn, delaiMs: Math.min(budgets.twilioMs, reste()) });
  if (t.ok) return finir(200, null, { fournisseur: "twilio", resultat: "ok", code_http: t.httpCode, detail: veutOrange ? `secours_apres_${detailOrange ?? "orange"}`.slice(0, 120) : null });
  return finir(500, "Envoi impossible.", { fournisseur: "twilio", resultat: "echec", code_http: t.httpCode ?? null, detail: `${veutOrange ? `${detailOrange}|` : ""}${t.detail ?? "twilio"}`.slice(0, 120) });
}

/** Alerte e-mail, au plus UNE par heure ET PAR MOTIF (comptée dans le journal : une alerte « échec Orange » ne masque pas « plafond atteint ») — jamais bloquante. */
async function signaler(deps, cle, sujet, texte) {
  try {
    if ((await deps.compterAlertesRecentes(cle)) > 0) return;
    await deps.alerter({ sujet, texte });
    await deps.journaliser({ evenement: "alerte", mode: "reel", fournisseur: "aucun", resultat: "ok", detail: cle }, 300);
  } catch (erreur) {
    console.error("[SMS hook] Alerte impossible :", erreur?.message);
  }
}
