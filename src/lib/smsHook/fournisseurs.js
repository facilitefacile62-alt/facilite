// Les deux fournisseurs de SMS du hook : API SMS Sénégal d'Orange (principal, quand SMS_PROVIDER = « orange ») et Twilio (secours, ou seul fournisseur par défaut).
// Chaque appel est BORNÉ dans le temps (AbortController) : Supabase n'accorde que 5 secondes à tout le hook, retries compris.
//
// Format Orange (getting-started de developer.orange.com/apis/sms, lu le 25/10/2026) :
//   jeton  : POST https://api.orange.com/oauth/v3/token, Authorization: Basic base64(client_id:client_secret), corps grant_type=client_credentials, valable 3600 s
//   envoi  : POST https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B<expediteur>/requests, Authorization: Bearer <jeton>, JSON
//            { outboundSMSMessageRequest: { address: "tel:+<destinataire>", senderAddress: "tel:+<expediteur>", [senderName], outboundSMSTextMessage: { message } } }
//            succès : 201 + resourceURL ; jeton expiré : 401 code 42 ; trop de requêtes : 403/429 code 53 ; surcharge : 503 code 6
//   solde  : GET https://api.orange.com/sms/admin/v1/contracts?country=SEN (availableUnits, expirationDate, status)

export const URL_JETON_ORANGE = "https://api.orange.com/oauth/v3/token";
export const URL_SOLDE_ORANGE = "https://api.orange.com/sms/admin/v1/contracts?country=SEN";
export const urlEnvoiOrange = (expediteur) => `https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(`tel:+${expediteur}`)}/requests`;

/** Exécute `appel(signal)` avec un délai maximal ; renvoie { timeout: true } au lieu de lever si le délai est dépassé. */
export async function avecDelai(appel, delaiMs) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), Math.max(1, delaiMs));
  try {
    return await appel(controleur.signal);
  } catch (erreur) {
    if (controleur.signal.aborted || erreur?.name === "AbortError") return { ok: false, timeout: true, detail: "delai_depasse" };
    return { ok: false, detail: "reseau" };
  } finally {
    clearTimeout(minuteur);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Orange
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

const cacheJeton = { valeur: null, expireLe: 0 };
export const viderCacheJetonOrange = () => {
  cacheJeton.valeur = null;
  cacheJeton.expireLe = 0;
};

export const orangeConfigure = (env) => Boolean((env.ORANGE_SMS_AUTHORIZATION_HEADER || (env.ORANGE_SMS_CLIENT_ID && env.ORANGE_SMS_CLIENT_SECRET)));

function enteteBasic(env) {
  if (env.ORANGE_SMS_AUTHORIZATION_HEADER) return env.ORANGE_SMS_AUTHORIZATION_HEADER;
  return `Basic ${Buffer.from(`${env.ORANGE_SMS_CLIENT_ID}:${env.ORANGE_SMS_CLIENT_SECRET}`).toString("base64")}`;
}

/** Jeton OAuth (gardé en mémoire de l'instance jusqu'à 2 minutes avant son expiration : en régime normal, aucun appel supplémentaire). */
export async function jetonOrange({ env, fetchFn, maintenant, delaiMs }) {
  if (cacheJeton.valeur && cacheJeton.expireLe - maintenant() > 120_000) return { ok: true, jeton: cacheJeton.valeur };
  const r = await avecDelai(async (signal) => {
    const reponse = await fetchFn(URL_JETON_ORANGE, {
      method: "POST",
      headers: { Authorization: enteteBasic(env), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: "grant_type=client_credentials",
      signal,
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !donnees.access_token) return { ok: false, httpCode: reponse.status, detail: "jeton_refuse" };
    return { ok: true, jeton: donnees.access_token, dureeS: Number(donnees.expires_in) || 3600 };
  }, delaiMs);
  if (r.ok) {
    cacheJeton.valeur = r.jeton;
    cacheJeton.expireLe = maintenant() + r.dureeS * 1000;
  }
  return r;
}

const codeOrange = (donnees) => {
  const c = donnees?.code ?? donnees?.requestError?.serviceException?.messageId;
  return c === undefined ? null : String(c).slice(0, 20);
};

/** Classe un échec Orange : « jeton » (à renouveler), « limite », « indisponible » (réessayer ailleurs), « autre » (refus : expéditeur non validé, contrat épuisé…). */
export function classerEchecOrange(httpCode, codeApi) {
  if (httpCode === 401 || codeApi === "42") return "jeton";
  if (httpCode === 429 || codeApi === "53") return "limite";
  if (httpCode >= 500 || httpCode === 408) return "indisponible";
  return "autre";
}

export async function envoyerOrange({ numero, message, env, fetchFn, maintenant, delaiMs }) {
  const debut = maintenant();
  const reste = () => Math.max(1, delaiMs - (maintenant() - debut));
  const expediteur = env.ORANGE_SMS_SENDER_NUMBER || "2210000";

  for (let essai = 0; essai < 2; essai++) {
    const j = await jetonOrange({ env, fetchFn, maintenant, delaiMs: Math.min(800, reste()) });
    if (!j.ok) return { ok: false, httpCode: j.httpCode ?? null, classe: j.timeout ? "indisponible" : "autre", detail: j.detail };
    const corps = {
      outboundSMSMessageRequest: {
        address: `tel:${numero}`,
        senderAddress: `tel:+${expediteur}`,
        ...(env.ORANGE_SMS_SENDER_NAME ? { senderName: env.ORANGE_SMS_SENDER_NAME } : {}),
        outboundSMSTextMessage: { message },
      },
    };
    const r = await avecDelai(async (signal) => {
      const reponse = await fetchFn(urlEnvoiOrange(expediteur), {
        method: "POST",
        headers: { Authorization: `Bearer ${j.jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify(corps),
        signal,
      });
      if (reponse.status === 201 || reponse.status === 200) return { ok: true, httpCode: reponse.status };
      const donnees = await reponse.json().catch(() => ({}));
      const codeApi = codeOrange(donnees);
      return { ok: false, httpCode: reponse.status, codeApi, classe: classerEchecOrange(reponse.status, codeApi), detail: `orange_${reponse.status}${codeApi ? `_${codeApi}` : ""}` };
    }, reste());
    if (r.ok) return r;
    if (r.timeout) return { ok: false, httpCode: null, classe: "indisponible", detail: r.detail };
    if (r.classe === "jeton" && essai === 0) {
      viderCacheJetonOrange(); // jeton expiré avant l'heure : un seul renouvellement, puis un seul nouvel essai
      continue;
    }
    return r;
  }
  return { ok: false, httpCode: 401, classe: "jeton", detail: "orange_401" };
}

/** Solde Orange : somme des SMS disponibles des contrats ACTIFS, et date d'expiration la plus proche. */
export async function lireSoldeOrange({ env, fetchFn, maintenant, delaiMs }) {
  const j = await jetonOrange({ env, fetchFn, maintenant, delaiMs: Math.min(800, delaiMs) });
  if (!j.ok) return { ok: false, detail: j.detail };
  const r = await avecDelai(async (signal) => {
    const reponse = await fetchFn(URL_SOLDE_ORANGE, { method: "GET", headers: { Authorization: `Bearer ${j.jeton}`, Accept: "application/json" }, signal });
    if (!reponse.ok) return { ok: false, detail: `solde_${reponse.status}` };
    const donnees = await reponse.json().catch(() => null);
    return { ok: true, contrats: Array.isArray(donnees) ? donnees : [] };
  }, delaiMs);
  if (!r.ok) return r;
  return { ok: true, ...resumerSolde(r.contrats) };
}

export function resumerSolde(contrats) {
  const actifs = contrats.filter((c) => String(c?.status).toUpperCase() === "ACTIVE");
  const unites = actifs.reduce((n, c) => n + (Number(c?.availableUnits) || 0), 0);
  const expirations = actifs.map((c) => Date.parse(c?.expirationDate)).filter(Number.isFinite);
  return { unites, contratsActifs: actifs.length, expireLe: expirations.length ? Math.min(...expirations) : null };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Twilio (REST direct : aucun chargement de bibliothèque, donc pas de surcoût de démarrage)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

// Authentification Twilio : une CLÉ D'API (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET, avec TWILIO_ACCOUNT_SID) est préférée — révocable seule, sans exposer le compte ;
// l'Auth token (TWILIO_AUTH_TOKEN) reste accepté. L'adresse de l'API contient toujours l'identifiant du COMPTE.
const identifiantsTwilio = (env) => {
  if (env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET) return { utilisateur: env.TWILIO_API_KEY_SID, secret: env.TWILIO_API_KEY_SECRET };
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) return { utilisateur: env.TWILIO_ACCOUNT_SID, secret: env.TWILIO_AUTH_TOKEN };
  return null;
};
export const twilioConfigure = (env) => Boolean(env.TWILIO_ACCOUNT_SID && identifiantsTwilio(env) && (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_SMS_FROM));

export async function envoyerTwilio({ numero, message, env, fetchFn, delaiMs }) {
  if (!twilioConfigure(env)) return { ok: false, httpCode: null, classe: "autre", detail: "twilio_non_configure" };
  const corps = new URLSearchParams({ To: numero, Body: message });
  if (env.TWILIO_MESSAGING_SERVICE_SID) corps.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  else corps.set("From", env.TWILIO_SMS_FROM);
  const identifiants = identifiantsTwilio(env);
  const auth = Buffer.from(`${identifiants.utilisateur}:${identifiants.secret}`).toString("base64");
  const r = await avecDelai(async (signal) => {
    const reponse = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: corps.toString(),
      signal,
    });
    if (reponse.status === 201 || reponse.status === 200) return { ok: true, httpCode: reponse.status };
    const donnees = await reponse.json().catch(() => ({}));
    const code = donnees?.code ? String(donnees.code).slice(0, 10) : null;
    return { ok: false, httpCode: reponse.status, classe: reponse.status >= 500 ? "indisponible" : "autre", detail: `twilio_${reponse.status}${code ? `_${code}` : ""}` };
  }, delaiMs);
  if (r.timeout) return { ok: false, httpCode: null, classe: "indisponible", detail: r.detail };
  return r;
}
