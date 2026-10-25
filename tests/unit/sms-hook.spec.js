const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Send SMS Hook » (Orange puis Twilio en secours) : signature, forme des appels Orange, secours, limites, budget de temps, mode à blanc, journal.
 * AUCUN vrai SMS : tout passe par un faux « fetch ». Le code et le numéro ne doivent jamais apparaître dans le journal ni dans les sorties console.
 */
const service = () => import("../../src/lib/smsHook/service.js");
const sig = () => import("../../src/lib/smsHook/signature.js");
const four = () => import("../../src/lib/smsHook/fournisseurs.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const SECRET = `v1,whsec_${Buffer.from("secret-de-test-0123456789").toString("base64")}`;
const NUMERO = "+221771234632";
const CODE = "482913";
const ENV_ORANGE = { SEND_SMS_HOOK_SECRET: SECRET, SMS_PROVIDER: "orange", ORANGE_SMS_CLIENT_ID: "id-test", ORANGE_SMS_CLIENT_SECRET: "secret-test", TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "tok", TWILIO_SMS_FROM: "+15550001111" };

async function appelValide({ env = ENV_ORANGE, numero = NUMERO, code = CODE, deps, horodatage } = {}) {
  const { signerWebhook } = await sig();
  const corps = JSON.stringify({ user: { id: "u1", phone: numero }, sms: { otp: code } });
  const id = "msg_test";
  const timestamp = String(horodatage ?? Math.floor(Date.now() / 1000));
  const entetes = new Headers({ "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signerWebhook({ id, timestamp, corps, secret: SECRET }) });
  const { traiterEnvoi } = await service();
  return traiterEnvoi({ corps, entetes, deps: { ...deps, env } });
}

/** Faux monde : fetch scripté, journal, compteurs de limites, alertes. */
function monde({ orangeJeton = { status: 200, json: { access_token: "jeton-1", expires_in: 3600 } }, orangeEnvoi = [{ status: 201, json: { resourceURL: "x" } }], twilio = { status: 201, json: { sid: "SM1" } }, budgets, apresDirect = true } = {}) {
  const m = { appels: [], journal: [], alertes: [], compteurs: new Map(), differees: [] };
  let iEnvoi = 0;
  const reponse = (r) => ({ ok: r.status < 400, status: r.status, json: async () => r.json ?? {} });
  m.deps = {
    maintenant: () => Date.now(),
    budgets,
    limiter: async (cle, max) => {
      const n = (m.compteurs.get(cle) ?? 0) + 1;
      m.compteurs.set(cle, n);
      return n <= max;
    },
    fetchFn: async (url, init = {}) => {
      m.appels.push({ url, methode: init.method, entetes: init.headers, corps: init.body });
      const suspendre = (r) => (r.suspendu ? new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" })))) : null);
      if (url.includes("/oauth/v3/token")) return suspendre(orangeJeton) ?? reponse(orangeJeton);
      if (url.includes("/smsmessaging/v1/outbound/")) {
        const r = orangeEnvoi[Math.min(iEnvoi++, orangeEnvoi.length - 1)];
        return suspendre(r) ?? reponse(r);
      }
      if (url.includes("api.twilio.com")) return suspendre(twilio) ?? reponse(twilio);
      throw new Error(`appel inattendu ${url}`);
    },
    journaliser: async (ligne) => void m.journal.push(ligne),
    compterAlertesRecentes: async (cle) => m.journal.filter((l) => l.evenement === "alerte" && l.detail === cle).length,
    alerter: async (a) => void m.alertes.push(a),
    apres: (fn) => (apresDirect ? fn() : m.differees.push(fn)),
  };
  m.orangeEnvois = () => m.appels.filter((a) => a.url.includes("/smsmessaging/"));
  m.twilioEnvois = () => m.appels.filter((a) => a.url.includes("api.twilio.com"));
  return m;
}

test.beforeEach(async () => (await four()).viderCacheJetonOrange());

test.describe("signature", () => {
  test("appel signé accepté ; corps modifié, mauvais secret, horodatage trop ancien, en-têtes absents : refusés, rien n'est envoyé", async () => {
    const { signerWebhook, verifierSignatureWebhook } = await sig();
    const corps = '{"a":1}';
    const e = (s, id = "i1", ts = String(Math.floor(Date.now() / 1000))) => new Headers({ "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": s });
    const ts = String(Math.floor(Date.now() / 1000));
    const bonne = signerWebhook({ id: "i1", timestamp: ts, corps, secret: SECRET });
    expect(verifierSignatureWebhook({ corps, entetes: e(bonne, "i1", ts), secret: SECRET }).ok).toBe(true);
    expect(verifierSignatureWebhook({ corps: '{"a":2}', entetes: e(bonne, "i1", ts), secret: SECRET }).raison).toBe("signature_invalide");
    expect(verifierSignatureWebhook({ corps, entetes: e(bonne, "i1", ts), secret: `v1,whsec_${Buffer.from("autre").toString("base64")}` }).ok).toBe(false);
    const vieux = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifierSignatureWebhook({ corps, entetes: e(signerWebhook({ id: "i1", timestamp: vieux, corps, secret: SECRET }), "i1", vieux), secret: SECRET }).raison).toBe("horodatage_hors_delai");
    expect(verifierSignatureWebhook({ corps, entetes: new Headers(), secret: SECRET }).raison).toBe("entetes_absents");
    expect(verifierSignatureWebhook({ corps, entetes: e(bonne, "i1", ts), secret: "" }).raison).toBe("secret_absent");
    // plusieurs signatures dans l'en-tête : une seule bonne suffit
    expect(verifierSignatureWebhook({ corps, entetes: e(`v1,AAAA ${bonne}`, "i1", ts), secret: SECRET }).ok).toBe(true);
  });
  test("service : signature fausse = 401 et aucun appel réseau", async () => {
    const { traiterEnvoi } = await service();
    const m = monde();
    const r = await traiterEnvoi({ corps: JSON.stringify({ user: { phone: NUMERO }, sms: { otp: CODE } }), entetes: new Headers({ "webhook-id": "x", "webhook-timestamp": String(Math.floor(Date.now() / 1000)), "webhook-signature": "v1,AAAA" }), deps: { ...m.deps, env: ENV_ORANGE } });
    expect(r.statut).toBe(401);
    expect(m.appels).toEqual([]);
  });
  test("la route vérifie elle-même la signature avant tout", () => {
    const route = lire("src/app/api/auth/send-sms-hook/route.js");
    expect(route).toContain("verifierSignatureWebhook");
    expect(route.indexOf("verifierSignatureWebhook(")).toBeLessThan(route.indexOf("traiterEnvoi("));
  });
});

test.describe("fournisseur par défaut : Twilio seul", () => {
  test("SMS_PROVIDER absent = « twilio » : Orange n'est jamais appelé", async () => {
    const m = monde();
    const { SMS_PROVIDER, ...sansProvider } = ENV_ORANGE;
    void SMS_PROVIDER;
    const r = await appelValide({ env: sansProvider, deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.orangeEnvois()).toHaveLength(0);
    expect(m.appels.some((a) => a.url.includes("/oauth/"))).toBe(false);
    expect(m.twilioEnvois()).toHaveLength(1);
    expect(m.journal[0]).toMatchObject({ fournisseur: "twilio", resultat: "ok", mode: "reel" });
  });
  test("« orange » demandé mais identifiants Orange absents : Twilio, sans appeler Orange", async () => {
    const m = monde();
    const r = await appelValide({ env: { ...ENV_ORANGE, ORANGE_SMS_CLIENT_ID: "", ORANGE_SMS_CLIENT_SECRET: "" }, deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.orangeEnvois()).toHaveLength(0);
    expect(m.twilioEnvois()).toHaveLength(1);
  });
});

test.describe("appel Orange : format exact", () => {
  test("jeton (Basic, grant_type) puis envoi (Bearer, adresses tel:+, nom d'expéditeur, URL encodée)", async () => {
    const m = monde();
    const r = await appelValide({ env: { ...ENV_ORANGE, ORANGE_SMS_SENDER_NAME: "Facilite", ORANGE_SMS_SENDER_NUMBER: "2210000" }, deps: m.deps });
    expect(r.statut).toBe(200);
    const jeton = m.appels[0];
    expect(jeton.url).toBe("https://api.orange.com/oauth/v3/token");
    expect(jeton.methode).toBe("POST");
    expect(jeton.entetes.Authorization).toBe(`Basic ${Buffer.from("id-test:secret-test").toString("base64")}`);
    expect(jeton.corps).toBe("grant_type=client_credentials");
    const envoi = m.orangeEnvois()[0];
    expect(envoi.url).toBe("https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B2210000/requests");
    expect(envoi.entetes.Authorization).toBe("Bearer jeton-1");
    const corps = JSON.parse(envoi.corps).outboundSMSMessageRequest;
    expect(corps.address).toBe(`tel:${NUMERO}`);
    expect(corps.senderAddress).toBe("tel:+2210000");
    expect(corps.senderName).toBe("Facilite");
    expect(corps.outboundSMSTextMessage.message).toContain(CODE);
    expect(m.twilioEnvois()).toHaveLength(0);
    expect(m.journal[0]).toMatchObject({ fournisseur: "orange", resultat: "ok", code_http: 201 });
  });
  test("le jeton est réutilisé pour l'envoi suivant (un seul appel de jeton) ; un jeton refusé (401, code 42) est renouvelé une fois", async () => {
    const m = monde();
    await appelValide({ deps: m.deps });
    await appelValide({ deps: m.deps, numero: "+221761112233" });
    expect(m.appels.filter((a) => a.url.includes("/oauth/")).length).toBe(1);
    (await four()).viderCacheJetonOrange();
    const m2 = monde({ orangeEnvoi: [{ status: 401, json: { code: 42, message: "Expired credentials" } }, { status: 201 }] });
    const r = await appelValide({ deps: m2.deps });
    expect(r.statut).toBe(200);
    expect(m2.appels.filter((a) => a.url.includes("/oauth/")).length).toBe(2);
    expect(m2.orangeEnvois()).toHaveLength(2);
    expect(m2.twilioEnvois()).toHaveLength(0);
  });
  test("classement des échecs Orange", async () => {
    const { classerEchecOrange } = await four();
    expect(classerEchecOrange(401, "42")).toBe("jeton");
    expect(classerEchecOrange(403, "53")).toBe("limite");
    expect(classerEchecOrange(429, null)).toBe("limite");
    expect(classerEchecOrange(503, "6")).toBe("indisponible");
    expect(classerEchecOrange(400, null)).toBe("autre");
  });
  test("résumé du solde : seuls les contrats actifs comptent, expiration la plus proche", async () => {
    const { resumerSolde } = await four();
    const r = resumerSolde([
      { status: "ACTIVE", availableUnits: 120, expirationDate: "2026-12-01T00:00:00Z" },
      { status: "ACTIVE", availableUnits: 30, expirationDate: "2026-11-10T00:00:00Z" },
      { status: "EXPIRED", availableUnits: 999, expirationDate: "2026-01-01T00:00:00Z" },
    ]);
    expect(r).toMatchObject({ unites: 150, contratsActifs: 2, expireLe: Date.parse("2026-11-10T00:00:00Z") });
    expect(resumerSolde([])).toMatchObject({ unites: 0, contratsActifs: 0, expireLe: null });
  });
});

test.describe("secours Twilio", () => {
  test("Orange refuse (400) : Twilio envoie, journalisé « secours », alerte e-mail (une seule)", async () => {
    const m = monde({ orangeEnvoi: [{ status: 400, json: { code: 24 } }] });
    const r = await appelValide({ deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.twilioEnvois()).toHaveLength(1);
    expect(m.journal.find((l) => l.evenement === "envoi")).toMatchObject({ fournisseur: "twilio", resultat: "ok" });
    expect(m.journal.find((l) => l.evenement === "envoi").detail).toMatch(/^secours_apres_orange_400/);
    expect(m.alertes).toHaveLength(1);
    await appelValide({ deps: m.deps, numero: "+221761112233" });
    expect(m.alertes).toHaveLength(1); // pas de deuxième alerte dans l'heure
  });
  test("Orange et Twilio échouent : 500 (jamais 429/503, que Supabase réessaierait), échec journalisé", async () => {
    const m = monde({ orangeEnvoi: [{ status: 503, json: { code: 6 } }], twilio: { status: 500, json: {} } });
    const r = await appelValide({ deps: m.deps });
    expect(r.statut).toBe(500);
    expect([429, 503]).not.toContain(r.statut);
    expect(m.journal.find((l) => l.evenement === "envoi")).toMatchObject({ resultat: "echec", fournisseur: "twilio" });
  });
});

test.describe("budget de temps (Supabase : 5 s au total)", () => {
  test("les budgets cumulés tiennent dans l'heure limite, qui laisse 1,5 s pour le démarrage à froid et le réseau", async () => {
    const { BUDGETS } = await service();
    expect(BUDGETS.controlesMs + BUDGETS.orangeMs + BUDGETS.twilioMs + BUDGETS.journalMs).toBeLessThanOrEqual(BUDGETS.limiteMs);
    expect(5000 - BUDGETS.limiteMs).toBeGreaterThanOrEqual(1500);
  });
  test("pire cas simulé (Orange ET Twilio muets) : réponse dans l'heure limite, sans dépasser", async () => {
    const budgets = { controlesMs: 30, orangeMs: 160, twilioMs: 120, journalMs: 30, limiteMs: 360, margeTwilioMs: 40 };
    const m = monde({ orangeJeton: { suspendu: true }, twilio: { suspendu: true }, budgets });
    const t0 = Date.now();
    const r = await appelValide({ deps: m.deps });
    const duree = Date.now() - t0;
    expect(r.statut).toBe(500);
    expect(duree).toBeLessThan(360 + 80);
    expect(m.twilioEnvois()).toHaveLength(1); // le secours a bien été tenté dans le temps restant
  });
  test("si Orange a consommé presque tout le budget, Twilio n'est pas tenté (pas de dépassement)", async () => {
    const budgets = { controlesMs: 30, orangeMs: 300, twilioMs: 120, journalMs: 30, limiteMs: 330, margeTwilioMs: 100 };
    const m = monde({ orangeJeton: { suspendu: true }, budgets });
    const t0 = Date.now();
    const r = await appelValide({ deps: m.deps });
    expect(r.statut).toBe(500);
    expect(Date.now() - t0).toBeLessThan(330 + 80);
    expect(m.twilioEnvois()).toHaveLength(0);
    expect(m.journal.find((l) => l.evenement === "envoi").detail).toContain("temps_epuise");
  });
  test("les alertes e-mail sont différées hors budget (après la réponse)", async () => {
    const m = monde({ orangeEnvoi: [{ status: 400 }], apresDirect: false });
    const r = await appelValide({ deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.alertes).toHaveLength(0);
    expect(m.differees).toHaveLength(1);
    await m.differees[0]();
    expect(m.alertes).toHaveLength(1);
  });
});

test.describe("limites d'envoi", () => {
  test("3 codes par heure et par numéro : le 4e est refusé en 403 (pas de retry Supabase), sans envoi", async () => {
    const m = monde();
    for (let i = 0; i < 3; i++) expect((await appelValide({ deps: m.deps })).statut).toBe(200);
    const r = await appelValide({ deps: m.deps });
    expect(r.statut).toBe(403);
    expect(m.orangeEnvois()).toHaveLength(3);
    expect(m.journal.at(-1)).toMatchObject({ resultat: "limite", detail: "numero_heure" });
  });
  test("plafond du jour : au-delà, tout est refusé et une alerte part", async () => {
    const m = monde();
    const env = { ...ENV_ORANGE, SMS_PLAFOND_JOUR: "2" };
    expect((await appelValide({ env, deps: m.deps, numero: "+221771110001" })).statut).toBe(200);
    expect((await appelValide({ env, deps: m.deps, numero: "+221771110002" })).statut).toBe(200);
    const r = await appelValide({ env, deps: m.deps, numero: "+221771110003" });
    expect(r.statut).toBe(403);
    expect(m.alertes[0].sujet).toMatch(/Plafond/);
  });
  test("demande invalide (numéro ou code mal formés) : 400, aucun envoi", async () => {
    const m = monde();
    expect((await appelValide({ deps: m.deps, numero: "abc" })).statut).toBe(400);
    expect((await appelValide({ deps: m.deps, code: "12" })).statut).toBe(400);
    expect(m.appels).toEqual([]);
  });
});

test.describe("mode à blanc", () => {
  test("SMS_A_BLANC=1 : aucun appel réseau, une ligne de journal « a_blanc », réponse 200", async () => {
    const m = monde();
    const r = await appelValide({ env: { ...ENV_ORANGE, SMS_A_BLANC: "1" }, deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.appels).toEqual([]);
    expect(m.journal[0]).toMatchObject({ mode: "a_blanc", fournisseur: "aucun", resultat: "ok" });
  });
});

test.describe("confidentialité", () => {
  test("ni le code ni le numéro entier dans le journal ni dans la console, même quand tout échoue", async () => {
    const sorties = [];
    const orig = { log: console.log, error: console.error, warn: console.warn };
    console.log = console.error = console.warn = (...a) => void sorties.push(a.join(" "));
    try {
      const m = monde({ orangeEnvoi: [{ status: 503 }], twilio: { status: 500 } });
      await appelValide({ deps: m.deps });
      const m2 = monde();
      await appelValide({ deps: m2.deps, env: { ...ENV_ORANGE, SMS_A_BLANC: "1" } });
      const brut = JSON.stringify([m.journal, m2.journal, m.alertes, sorties]);
      expect(brut).not.toContain(CODE);
      expect(brut).not.toContain(NUMERO);
      expect(brut).not.toContain("771234632");
      const envoi = m.journal.find((l) => l.evenement === "envoi");
      expect(envoi.numero_hash).toMatch(/^[0-9a-f]{32}$/);
      expect(envoi.numero_fin).toBe("632");
    } finally {
      Object.assign(console, orig);
    }
  });
});

test.describe("migration du journal et solde", () => {
  test("table fermée aux applications, droit explicite pour le serveur, retour arrière présent", () => {
    const m = lire("supabase/migrations/20261025210000_journal_envois_sms.sql");
    expect(m).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(m).toMatch(/REVOKE ALL ON public\.sms_envois_journal FROM PUBLIC, anon, authenticated/);
    expect(m).toMatch(/GRANT ALL ON public\.sms_envois_journal TO service_role/);
    expect(m).not.toMatch(/CREATE POLICY/);
    expect(m).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE/);
    expect(lire("docs/rollbacks/20261025210000_journal_envois_sms.down.sql")).toMatch(/DROP TABLE IF EXISTS public\.sms_envois_journal/);
  });
  test("le cron est déclaré dans vercel.json et la route reste mince (la logique testée est dans solde.js)", () => {
    expect(JSON.parse(lire("vercel.json")).crons.some((c) => c.path === "/api/cron/solde-sms")).toBe(true);
    const r = lire("src/app/api/cron/solde-sms/route.js");
    expect(r).toContain("executerControleSolde(");
    expect(r).not.toMatch(/^const admin = getSupabaseAdmin\(\)/m); // jamais de client d'administration avant le contrôle du secret
  });
});

test.describe("contrôle du solde : secret du cron obligatoire", () => {
  const controle = () => import("../../src/lib/smsHook/solde.js");
  const depsCron = (env, extra = {}) => {
    const appels = [];
    const note = (nom) => async (...a) => void appels.push([nom, ...a]);
    return {
      appels,
      deps: {
        env, maintenant: () => Date.parse("2026-10-25T12:00:00Z"), purgerJournal: note("purge"), compterAlertes: async () => 0, journaliser: note("journal"), alerter: async (x) => (appels.push(["alerte", x.sujet]), { ok: true }),
        fetchFn: async (url) => (url.includes("/oauth/") ? { ok: true, status: 200, json: async () => ({ access_token: "j", expires_in: 3600 }) } : { ok: true, status: 200, json: async () => [{ status: "ACTIVE", availableUnits: 50, expirationDate: "2027-01-01T00:00:00Z" }] }),
        ...extra,
      },
    };
  };
  test("sans en-tête, avec un mauvais secret ou un secret d'un autre cron : 401 et rien n'est touché", async () => {
    const { executerControleSolde } = await controle();
    for (const authorization of [null, "", "Bearer faux", "Basic secret-cron", "Bearer secret-rattrapage"]) {
      const { deps, appels } = depsCron({ CRON_SECRET: "secret-cron", RATTRAPAGE_CRON_SECRET: "secret-rattrapage", SMS_PROVIDER: "orange" });
      const r = await executerControleSolde({ authorization, deps });
      expect(r.statut).toBe(401);
      expect(appels).toEqual([]);
    }
  });
  test("CRON_SECRET absent du serveur : 503 (jamais ouvert)", async () => {
    const { executerControleSolde } = await controle();
    const { deps, appels } = depsCron({});
    expect((await executerControleSolde({ authorization: "Bearer undefined", deps })).statut).toBe(503);
    expect(appels).toEqual([]);
  });
  test("bon secret, fournisseur « twilio » : purge du journal puis rien d'autre ; fournisseur « orange », solde bas : une alerte", async () => {
    const { executerControleSolde } = await controle();
    const a = depsCron({ CRON_SECRET: "secret-cron" });
    const r1 = await executerControleSolde({ authorization: "Bearer secret-cron", deps: a.deps });
    expect(r1).toMatchObject({ statut: 200, corps: { ignore: "fournisseur_non_orange" } });
    expect(a.appels.map((x) => x[0])).toEqual(["purge"]);
    const b = depsCron({ CRON_SECRET: "secret-cron", SMS_PROVIDER: "orange", ORANGE_SMS_CLIENT_ID: "i", ORANGE_SMS_CLIENT_SECRET: "s" });
    const r2 = await executerControleSolde({ authorization: "Bearer secret-cron", deps: b.deps });
    expect(r2.statut).toBe(200);
    expect(r2.corps).toMatchObject({ unites: 50, alerte: true });
    expect(b.appels.filter((x) => x[0] === "alerte")).toHaveLength(1);
  });
  test("déjà alerté dans les dernières 20 h : pas de deuxième e-mail", async () => {
    const { executerControleSolde } = await controle();
    const b = depsCron({ CRON_SECRET: "secret-cron", SMS_PROVIDER: "orange", ORANGE_SMS_CLIENT_ID: "i", ORANGE_SMS_CLIENT_SECRET: "s" }, { compterAlertes: async () => 1 });
    const r = await executerControleSolde({ authorization: "Bearer secret-cron", deps: b.deps });
    expect(r.corps.alerte).toBe(false);
    expect(b.appels.filter((x) => x[0] === "alerte")).toHaveLength(0);
  });
});

test.describe("Twilio : clé d'API préférée", () => {
  test("avec TWILIO_API_KEY_SID + SECRET : Basic = clé d'API, adresse au nom du COMPTE ; l'Auth token n'est pas utilisé", async () => {
    const m = monde();
    const env = { SEND_SMS_HOOK_SECRET: SECRET, TWILIO_ACCOUNT_SID: "ACcompte", TWILIO_API_KEY_SID: "SKcle", TWILIO_API_KEY_SECRET: "secret-cle", TWILIO_AUTH_TOKEN: "ne-doit-pas-servir", TWILIO_MESSAGING_SERVICE_SID: "MGservice" };
    const r = await appelValide({ env, deps: m.deps });
    expect(r.statut).toBe(200);
    const t = m.twilioEnvois()[0];
    expect(t.url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACcompte/Messages.json");
    expect(t.entetes.Authorization).toBe(`Basic ${Buffer.from("SKcle:secret-cle").toString("base64")}`);
    expect(t.corps).toContain("MessagingServiceSid=MGservice");
  });
  test("sans clé d'API, l'Auth token reste accepté ; sans aucun des deux, Twilio n'est pas considéré comme configuré", async () => {
    const m = monde();
    const r = await appelValide({ env: { SEND_SMS_HOOK_SECRET: SECRET, TWILIO_ACCOUNT_SID: "ACcompte", TWILIO_AUTH_TOKEN: "tok", TWILIO_SMS_FROM: "+15550001111" }, deps: m.deps });
    expect(r.statut).toBe(200);
    expect(m.twilioEnvois()[0].entetes.Authorization).toBe(`Basic ${Buffer.from("ACcompte:tok").toString("base64")}`);
    const { twilioConfigure } = await four();
    expect(twilioConfigure({ TWILIO_ACCOUNT_SID: "AC", TWILIO_SMS_FROM: "+1" })).toBe(false);
    expect(twilioConfigure({ TWILIO_ACCOUNT_SID: "AC", TWILIO_API_KEY_SID: "SK", TWILIO_SMS_FROM: "+1" })).toBe(false);
    expect(twilioConfigure({ TWILIO_ACCOUNT_SID: "AC", TWILIO_API_KEY_SID: "SK", TWILIO_API_KEY_SECRET: "s", TWILIO_SMS_FROM: "+1" })).toBe(true);
  });
});

test.describe("plafond propre au secours Twilio", () => {
  test("Orange en panne : 2 secours autorisés (plafond réglé à 2), le 3e est refusé avec alerte, sans appeler Twilio", async () => {
    const m = monde({ orangeEnvoi: [{ status: 503, json: { code: 6 } }] });
    const env = { ...ENV_ORANGE, SMS_PLAFOND_TWILIO_SECOURS_JOUR: "2" };
    expect((await appelValide({ env, deps: m.deps, numero: "+221771110001" })).statut).toBe(200);
    expect((await appelValide({ env, deps: m.deps, numero: "+221771110002" })).statut).toBe(200);
    const r = await appelValide({ env, deps: m.deps, numero: "+221771110003" });
    expect(r.statut).toBe(500);
    expect(m.twilioEnvois()).toHaveLength(2);
    expect(m.journal.filter((l) => l.evenement === "envoi").at(-1)).toMatchObject({ resultat: "refuse", fournisseur: "orange" });
    expect(m.journal.at(-1).detail).toBeTruthy();
    expect(m.alertes.map((a) => a.sujet)).toContain("Plafond du secours Twilio atteint");
  });
  test("plafond par défaut : 20 par jour", async () => {
    const { PLAFOND_SECOURS_TWILIO_PAR_DEFAUT } = await service();
    expect(PLAFOND_SECOURS_TWILIO_PAR_DEFAUT).toBe(20);
  });
  test("ce plafond ne s'applique PAS quand Twilio est le fournisseur choisi (SMS_PROVIDER = twilio) : seul le plafond global compte", async () => {
    const m = monde();
    const { SMS_PROVIDER, ...env } = ENV_ORANGE;
    void SMS_PROVIDER;
    for (let i = 1; i <= 25; i++) expect((await appelValide({ env: { ...env, SMS_PLAFOND_TWILIO_SECOURS_JOUR: "1" }, deps: m.deps, numero: `+2217711${String(i).padStart(5, "0")}` })).statut).toBe(200);
    expect(m.twilioEnvois()).toHaveLength(25);
  });
  test("les alertes sont limitées par motif : une alerte « échec Orange » ne masque pas « plafond atteint »", async () => {
    const m = monde({ orangeEnvoi: [{ status: 503 }] });
    const env = { ...ENV_ORANGE, SMS_PLAFOND_TWILIO_SECOURS_JOUR: "1" };
    await appelValide({ env, deps: m.deps, numero: "+221771110001" });
    await appelValide({ env, deps: m.deps, numero: "+221771110002" });
    expect(m.alertes.map((a) => a.sujet).sort()).toEqual(["Plafond du secours Twilio atteint", "Échec d'envoi par Orange"].sort());
  });
});
