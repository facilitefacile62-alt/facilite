/**
 * Alerte email admin pour les erreurs critiques capturées par Sentry.
 *
 * Aucun jeton d'API Sentry n'est accessible depuis cet environnement pour
 * configurer une règle d'alerte native côté tableau de bord Sentry — cette
 * alerte est donc implémentée au niveau code, déclenchée depuis beforeSend
 * (sentry.server.config.js / sentry.edge.config.js), APRÈS scrubbing :
 * l'email ne doit jamais contenir plus de données que ce que Sentry
 * lui-même recevrait.
 *
 * "Critique" (au sens de ce fichier) :
 *  - toute exception non gérée (event.exception) — couvre les "500"
 *    remontés automatiquement par onRequestError (instrumentation.js),
 *    sans qu'aucun code d'appel supplémentaire soit nécessaire ;
 *  - tout event.message explicitement marqué tags.critical = "true" —
 *    utilisé pour les échecs de paiement/webhook qui sont aujourd'hui
 *    catchés et journalisés (console.error) plutôt que jetés, donc
 *    invisibles pour onRequestError. Voir les appels
 *    Sentry.captureMessage(..., { level: "error", tags: { critical: "true" } })
 *    ajoutés aux points d'échec réellement actionnables de
 *    api/pay/checkout, api/pay/kpay-webhook et api/pay/paydunya-webhook —
 *    pas exhaustif sur CHAQUE avertissement mineur de ces fichiers
 *    (ex. un montant incohérent déjà journalisé et déjà répondu 200 pour
 *    éviter une boucle de retry webhook reste un simple log, pas une
 *    alerte), seulement les échecs francs (signature invalide, erreur
 *    interne, commande introuvable).
 */

/**
 * Marque explicitement un échec de paiement/webhook comme critique auprès
 * de Sentry — nécessaire car ces échecs sont aujourd'hui catchés et
 * journalisés (console.error) plutôt que jetés, donc invisibles pour la
 * capture automatique onRequestError. best-effort : ne jette jamais (un
 * échec de Sentry.captureMessage ne doit jamais faire échouer la route
 * elle-même).
 */
export function captureCriticalPaymentError(message, extra = {}) {
  try {
    // Import dynamique : évite d'alourdir chaque route qui n'a pas besoin
    // du SDK complet au chargement, cohérent avec l'import dynamique de
    // "resend" plus bas dans ce fichier.
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureMessage(message, { level: "error", tags: { critical: "true" }, extra });
    });
  } catch (err) {
    console.error("[sentryAlert] Échec captureCriticalPaymentError:", err?.message);
  }
}

export function isCriticalSentryEvent(event) {
  if (!event) return false;
  if (event.exception?.values?.length > 0) return true;
  return event.tags?.critical === "true" || event.tags?.critical === true;
}

function summarizeEvent(event) {
  const route = event?.request?.url || "route inconnue";
  const method = event?.request?.method || "";
  const exceptionValue = event?.exception?.values?.[0];
  const title = exceptionValue
    ? `${exceptionValue.type || "Erreur"} : ${exceptionValue.value || ""}`
    : event?.message || "Erreur critique";
  const level = event?.level || "error";
  const eventId = event?.event_id || "inconnu";
  const extraEntries = Object.entries(event?.extra || {})
    .map(([k, v]) => `${k} = ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

  return { route, method, title, level, eventId, extraEntries };
}

/**
 * Envoi best-effort : un échec d'envoi d'alerte ne doit jamais faire
 * échouer la capture Sentry elle-même (beforeSend doit toujours retourner
 * l'event, même si ce mail échoue).
 */
export async function sendCriticalAlertEmail(event) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey === "re_dummy_key") {
    console.warn("[sentryAlert] RESEND_API_KEY absente, alerte non envoyée.");
    return;
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "facilitefacile62@gmail.com";
  const isProd = process.env.NODE_ENV === "production";
  const sender =
    process.env.RESEND_FROM_ALERTS ||
    (isProd ? "Facilite Alertes <alertes@ffacilite.com>" : "Facilite <onboarding@resend.dev>");
  const isOnboarding = sender.includes("onboarding@resend.dev");
  const recipient = isOnboarding ? process.env.RESEND_TEST_RECIPIENT || process.env.RESEND_VERIFIED_EMAIL || adminEmail : adminEmail;

  const { route, method, title, level, eventId, extraEntries } = summarizeEvent(event);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: sender,
      to: recipient,
      subject: `🚨 [Facilite] Erreur critique (${level}) — ${title.slice(0, 80)}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #DC2626;">Erreur critique détectée</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 6px; font-weight: bold; width: 140px;">Titre :</td><td style="padding: 6px;">${title}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Route :</td><td style="padding: 6px;">${method} ${route}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Niveau :</td><td style="padding: 6px;">${level}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Sentry event ID :</td><td style="padding: 6px; font-family: monospace;">${eventId}</td></tr>
          </table>
          ${extraEntries ? `<pre style="background:#f9f9f9; padding:12px; border-radius:8px; font-size:12px;">${extraEntries}</pre>` : ""}
          <p style="font-size:12px; color:#777;">Données déjà passées par le scrubbing Sentry (jamais de cookies, jetons, ni champs sensibles).</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[sentryAlert] Échec d'envoi de l'alerte email:", err?.message);
  }
}
