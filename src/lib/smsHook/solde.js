import { bearerValide } from "../cronAuth.js";
import { lireSoldeOrange, orangeConfigure } from "./fournisseurs.js";

// Contrôle quotidien du solde de SMS Orange (appelé par la route /api/cron/solde-sms, Vercel Cron). La logique est ici, sans accès direct à la base ni au réseau
// autrement que par `deps`, pour être testée : en particulier, SANS le secret du cron, rien ne s'exécute (401), et aucune dépendance n'est touchée.
//   deps = { env, maintenant, fetchFn, purgerJournal(), compterAlertes(heures), journaliser(ligne), alerter({ sujet, texte }) }

const JOURS_AVANT_EXPIRATION = 14;

export async function executerControleSolde({ authorization, deps }) {
  const { env, maintenant } = deps;
  const secret = env.CRON_SECRET;
  if (!secret) return { statut: 503, corps: { error: "Cron non configuré." } };
  if (!bearerValide(authorization, [secret])) return { statut: 401, corps: { error: "Non autorisé." } };

  await deps.purgerJournal(); // journal gardé 90 jours

  if (env.SMS_PROVIDER !== "orange" || !orangeConfigure(env)) return { statut: 200, corps: { ok: true, ignore: "fournisseur_non_orange" } };

  const solde = await lireSoldeOrange({ env, fetchFn: deps.fetchFn, maintenant, delaiMs: 5000 });
  if (!solde.ok) return { statut: 502, corps: { ok: false, detail: solde.detail } };

  const seuil = Number(env.SMS_SOLDE_ALERTE) > 0 ? Number(env.SMS_SOLDE_ALERTE) : 200;
  const joursRestants = solde.expireLe ? Math.floor((solde.expireLe - maintenant()) / 86400000) : null;
  const motifs = [];
  if (solde.contratsActifs === 0) motifs.push("aucun forfait actif");
  else if (solde.unites < seuil) motifs.push(`il reste ${solde.unites} SMS (seuil : ${seuil})`);
  if (joursRestants !== null && joursRestants <= JOURS_AVANT_EXPIRATION) motifs.push(`le forfait expire dans ${joursRestants} jour(s)`);

  let alerte = false;
  if (motifs.length > 0 && (await deps.compterAlertes(20)) === 0) {
    const r = await deps.alerter({ sujet: "Solde de SMS Orange bas", texte: `Orange SMS Sénégal : ${motifs.join(" ; ")}. Rechargez un forfait sur developer.orange.com. Sans SMS Orange, les codes passent par Twilio (plus cher).` });
    await deps.journaliser({ evenement: "alerte", mode: "reel", fournisseur: "orange", resultat: r?.ok ? "ok" : "echec", detail: "solde_orange_bas" });
    alerte = Boolean(r?.ok);
  }
  return { statut: 200, corps: { ok: true, unites: solde.unites, joursRestants, alerte } };
}
