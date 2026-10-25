const { test, expect } = require("@playwright/test");

/**
 * Orange Money — conformité à la documentation officielle (API v1.1.0) : statuts, recherche + statut avant tout crédit, en-tête
 * Authorization facultatif, attente croissante sur 429, et codes de réponse du webhook (202 / 4xx définitif / 5xx passager).
 * Aucun appel réseau : fetch et la base sont simulés.
 */
const charger = () => import("../../src/lib/orangeMoney.js");
const chargerWebhook = () => import("../../src/lib/webhookOrange.js");
const REF = "6f1d2a40-0000-4000-8000-000000000001";
const TX = "MP261023.1200.C58502";

test.describe("statuts de la documentation", () => {
  test("seul SUCCESS est « payé » ; intermédiaires = attente ; CANCELLED / FAILED / REJECTED = échec", async () => {
    const { evaluerConfirmationOrange } = await charger();
    const ok = { reference: REF, amount: { value: 1500, unit: "XOF" } };
    const juge = (status, extra = ok) => evaluerConfirmationOrange({ status, ...extra }, { reference: REF, montantXof: 1500 }).etat;
    expect(juge("SUCCESS")).toBe("succes");
    for (const s of ["ACCEPTED", "INITIATED", "PENDING", "PRE_INITIATED", "NOT_FOUND", "N_IMPORTE_QUOI"]) expect(juge(s)).toBe("attente");
    for (const s of ["CANCELLED", "FAILED", "REJECTED"]) expect(juge(s)).toBe("echec");
    expect(juge("success")).toBe("succes");
  });

  test("SUCCESS sans référence ou montant correspondants n'est jamais « payé »", async () => {
    const { evaluerConfirmationOrange } = await charger();
    const attendu = { reference: REF, montantXof: 1500 };
    // Référence ABSENTE = transaction pas encore retrouvée : jamais payée, mais en attente (pas un rejet définitif).
    expect(evaluerConfirmationOrange({ status: "SUCCESS" }, attendu).etat).toBe("attente");
    expect(evaluerConfirmationOrange({ status: "SUCCESS", reference: "", amount: { value: 1500 } }, attendu).etat).toBe("attente");
    // Référence PRÉSENTE mais différente = incohérent.
    expect(evaluerConfirmationOrange({ status: "SUCCESS", reference: "autre", amount: { value: 1500 } }, attendu).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange({ status: "SUCCESS", reference: REF, amount: { value: 1 } }, attendu).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange({ status: "SUCCESS", reference: REF, amount: { value: 1500, unit: "EUR" } }, attendu).etat).toBe("incoherent");
  });
});

test.describe("en-tête Authorization: Basic (facultatif)", () => {
  test("rien d'imposé tant que la variable n'existe pas", async () => {
    const { controlerBasicCallback } = await charger();
    expect(controlerBasicCallback(null, undefined)).toEqual({ requis: false, valide: true });
    expect(controlerBasicCallback("Basic n'importe-quoi", "")).toEqual({ requis: false, valide: true });
  });
  test("avec la variable : seule la bonne clé passe, en-tête absent refusé", async () => {
    const { controlerBasicCallback } = await charger();
    expect(controlerBasicCallback("Basic secret-partage", "secret-partage")).toEqual({ requis: true, valide: true });
    expect(controlerBasicCallback("Basic autre", "secret-partage").valide).toBe(false);
    expect(controlerBasicCallback(null, "secret-partage").valide).toBe(false);
  });
});

/** fetch simulé : routes → réponses [statut, corps], appelées dans l'ordre pour une même route. */
function simulerFetch(routes) {
  const original = global.fetch;
  const appels = [];
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    appels.push(`${init.method || "GET"} ${u.pathname}`);
    const cle = Object.keys(routes).find((k) => u.pathname + u.search === k || u.pathname === k);
    const file = cle ? routes[cle] : null;
    const [statut, corps] = Array.isArray(file?.[0]) ? file.shift() : file || [404, { code: "60" }];
    return { status: statut, ok: statut >= 200 && statut < 300, json: async () => corps };
  };
  return { appels, restaurer: () => (global.fetch = original) };
}
const JETON = ["/oauth/v1/token", [[200, { access_token: "jeton-factice", expires_in: 3600 }]]];

test.describe("recherche + statut avant tout crédit", () => {
  test.beforeEach(() => {
    process.env.ORANGE_MONEY_CLIENT_ID = "id";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
  });

  test("recherche SUCCESS + statut SUCCESS → SUCCESS avec référence et montant", async () => {
    const { rechercherTransactionOrange, evaluerConfirmationOrange } = await charger();
    const m = simulerFetch({
      "/oauth/v1/token": [[200, { access_token: "t1", expires_in: 3600 }]],
      "/api/eWallet/v1/transactions": [[200, [{ transactionId: TX, reference: REF, status: "SUCCESS", amount: { value: 1500, unit: "XOF" } }]]],
      [`/api/eWallet/v1/transactions/${TX}/status`]: [[200, { status: "SUCCESS" }]],
    });
    try {
      const r = await rechercherTransactionOrange({ transactionId: TX, reference: REF });
      expect(r).toMatchObject({ status: "SUCCESS", reference: REF, transactionId: TX });
      expect(evaluerConfirmationOrange(r, { reference: REF, montantXof: 1500 }).etat).toBe("succes");
      expect(m.appels.some((a) => a.endsWith("/status"))).toBe(true); // l'API de statut est toujours interrogée
    } finally {
      m.restaurer();
    }
  });

  test("la recherche dit SUCCESS mais l'API de statut dit PENDING → jamais SUCCESS", async () => {
    const { rechercherTransactionOrange, evaluerConfirmationOrange } = await charger();
    const m = simulerFetch({
      "/oauth/v1/token": [[200, { access_token: "t2", expires_in: 3600 }]],
      "/api/eWallet/v1/transactions": [[200, [{ transactionId: TX, reference: REF, status: "SUCCESS", amount: { value: 1500 } }]]],
      [`/api/eWallet/v1/transactions/${TX}/status`]: [[200, { status: "PENDING" }]],
    });
    try {
      const r = await rechercherTransactionOrange({ transactionId: TX, reference: REF });
      expect(r.status).toBe("PENDING");
      expect(evaluerConfirmationOrange(r, { reference: REF, montantXof: 1500 }).etat).toBe("attente");
    } finally {
      m.restaurer();
    }
  });

  test("recherche non autorisée (403) : repli statut + notification ; sans notification, pas de crédit", async () => {
    const { rechercherTransactionOrange, evaluerConfirmationOrange } = await charger();
    const routes = () => ({
      "/oauth/v1/token": [[200, { access_token: "t3", expires_in: 3600 }]],
      "/api/eWallet/v1/transactions": [[403, { code: "11" }]],
      [`/api/eWallet/v1/transactions/${TX}/status`]: [[200, { status: "SUCCESS" }]],
    });
    let m = simulerFetch(routes());
    try {
      const avec = await rechercherTransactionOrange({ transactionId: TX, reference: REF, declare: { reference: REF, amount: { value: 1500, unit: "XOF" } } });
      expect(avec.source).toBe("statut+notification");
      expect(evaluerConfirmationOrange(avec, { reference: REF, montantXof: 1500 }).etat).toBe("succes");
    } finally {
      m.restaurer();
    }
    m = simulerFetch(routes());
    try {
      const sans = await rechercherTransactionOrange({ transactionId: TX, reference: REF });
      expect(evaluerConfirmationOrange(sans, { reference: REF, montantXof: 1500 }).etat).toBe("attente");
    } finally {
      m.restaurer();
    }
  });

  test("429 : attente croissante puis nouvel essai (un seul jeton demandé)", async () => {
    const { obtenirStatutTransaction } = await charger();
    const m = simulerFetch({
      "/oauth/v1/token": [[200, { access_token: "t4", expires_in: 3600 }]],
      [`/api/eWallet/v1/transactions/${TX}/status`]: [[429, { code: "9" }], [200, { status: "SUCCESS" }]],
    });
    try {
      const debut = Date.now();
      const r = await obtenirStatutTransaction(TX);
      expect(r.status).toBe("SUCCESS");
      expect(Date.now() - debut).toBeGreaterThanOrEqual(900);
    } finally {
      m.restaurer();
    }
  });
});

// ------------------------------------------------------------------------------------------------------------------------------
// Webhook : codes de réponse
// ------------------------------------------------------------------------------------------------------------------------------
function fauxAdmin({ commande, erreurLecture = null, erreurJournal = null }) {
  const journal = [];
  const admin = {
    journal,
    from: (table) => ({
      insert: async (ligne) => {
        if (erreurJournal) return { error: erreurJournal };
        journal.push({ table, ...ligne });
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  return { admin, commande, erreurLecture };
}

function adaptateur({ commande, erreurLecture, jetonHash, appliquer }) {
  return {
    nom: "Test",
    tableJournal: "journal_test",
    trouverCommande: async () => ({ commande, erreur: erreurLecture }),
    empreinteJeton: () => jetonHash,
    montantXof: () => 1500,
    appliquer: appliquer ?? (async () => ({ resultat: "credite" })),
    champsJournal: (c) => ({ commande_id: c.id }),
  };
}

function requete(corps, { jeton = "", secret = "", entetes = {} } = {}) {
  const q = new URLSearchParams();
  if (jeton) q.set("t", jeton);
  if (secret) q.set("s", secret);
  return new Request(`https://exemple.test/api/pay/webhook?${q.toString()}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...entetes },
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
  });
}

test.describe("webhook : 202 / 4xx définitif / 5xx passager", () => {
  const notification = (status = "SUCCESS") => ({ type: "MERCHANT_PAYMENT", reference: REF, transactionId: TX, status, amount: { value: 1500, unit: "XOF" } });
  const bonneReponse = async () => ({ status: "SUCCESS", reference: REF, amount: { value: 1500, unit: "XOF" }, transactionId: TX, source: "recherche+statut" });

  async function preparer() {
    const { genererJetonCallback } = await charger();
    const { traiterNotificationOrange } = await chargerWebhook();
    const { jeton, empreinte } = genererJetonCallback();
    return { traiterNotificationOrange, jeton, empreinte };
  }

  test("paiement confirmé : 202 au corps VIDE, crédit appliqué une fois", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande });
    let credits = 0;
    const adapt = adaptateur({ commande, jetonHash: empreinte, appliquer: async () => ((credits += 1), { resultat: "credite" }) });
    const r = await traiterNotificationOrange(requete(notification(), { jeton }), adapt, { admin, rechercher: bonneReponse, alerter: () => {} });
    expect(r.status).toBe(202);
    expect(await r.text()).toBe("");
    expect(credits).toBe(1);
  });

  test("référence qui n'est pas un UUID : 404 définitif, sans toucher à la base ni interroger Orange", async () => {
    const { traiterNotificationOrange, empreinte, jeton } = await preparer();
    for (const reference of ["x", "123", "6f1d2a40-0000-4000-8000-00000000000", { a: 1 }, 42]) {
      let baseAppelee = 0;
      let orangeAppele = 0;
      const admin = { from: () => ((baseAppelee += 1), { insert: async () => ({ error: null }) }) };
      const adapt = {
        ...adaptateur({ commande: { id: REF }, jetonHash: empreinte }),
        trouverCommande: async () => ((baseAppelee += 1), { commande: null, erreur: { message: "invalid input syntax for type uuid" } }),
      };
      const r = await traiterNotificationOrange(requete({ ...notification(), reference }, { jeton }), adapt, {
        admin,
        rechercher: async () => ((orangeAppele += 1), {}),
        alerter: () => {},
      });
      expect(r.status).toBe(404);
      expect(baseAppelee).toBe(0);
      expect(orangeAppele).toBe(0);
    }
  });

  test("corps illisible = 400 définitif ; jeton invalide ou commande inconnue = 404 définitif", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande });
    const ctx = { admin, rechercher: bonneReponse, alerter: () => {} };
    expect((await traiterNotificationOrange(requete("pas du json", { jeton }), adaptateur({ commande, jetonHash: empreinte }), ctx)).status).toBe(400);
    expect((await traiterNotificationOrange(requete(notification(), { jeton: "mauvais" }), adaptateur({ commande, jetonHash: empreinte }), ctx)).status).toBe(404);
    expect((await traiterNotificationOrange(requete(notification()), adaptateur({ commande, jetonHash: empreinte }), ctx)).status).toBe(404);
    expect((await traiterNotificationOrange(requete(notification(), { jeton }), adaptateur({ commande: null, jetonHash: empreinte }), ctx)).status).toBe(404);
  });

  test("base indisponible = 503 (passager, jamais un 404 définitif)", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const { admin } = fauxAdmin({ commande: null });
    const r = await traiterNotificationOrange(requete(notification(), { jeton }), adaptateur({ commande: null, erreurLecture: new Error("base HS"), jetonHash: empreinte }), { admin, rechercher: bonneReponse, alerter: () => {} });
    expect(r.status).toBe(503);
  });

  test("API Orange indisponible = 5xx ; SUCCESS annoncé mais statut pas final = 5xx ; statut intermédiaire annoncé = 202", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande });
    const adapt = adaptateur({ commande, jetonHash: empreinte });
    const enPanne = async () => {
      throw new Error("Orange HS");
    };
    expect((await traiterNotificationOrange(requete(notification(), { jeton }), adapt, { admin, rechercher: enPanne, alerter: () => {} })).status).toBeGreaterThanOrEqual(500);
    const pasFinal = async () => ({ status: "PENDING", reference: REF, amount: { value: 1500 }, transactionId: TX });
    expect((await traiterNotificationOrange(requete(notification("SUCCESS"), { jeton }), adapt, { admin, rechercher: pasFinal, alerter: () => {} })).status).toBe(503);
    expect((await traiterNotificationOrange(requete(notification("PENDING"), { jeton }), adapt, { admin, rechercher: pasFinal, alerter: () => {} })).status).toBe(202);
  });

  test("notification en double (clé déjà journalisée) = 202 sans second crédit", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande, erreurJournal: { code: "23505", message: "dup" } });
    let credits = 0;
    const adapt = adaptateur({ commande, jetonHash: empreinte, appliquer: async () => ((credits += 1), { resultat: "credite" }) });
    const r = await traiterNotificationOrange(requete(notification(), { jeton }), adapt, { admin, rechercher: bonneReponse, alerter: () => {} });
    expect(r.status).toBe(202);
    expect(credits).toBe(0);
  });

  test("paiement incohérent (montant différent) = aucun crédit ; erreur d'application = 500 (Orange réessaiera)", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande });
    let credits = 0;
    const adapt = adaptateur({ commande, jetonHash: empreinte, appliquer: async () => ((credits += 1), { resultat: "credite" }) });
    const mauvaisMontant = async () => ({ status: "SUCCESS", reference: REF, amount: { value: 10 }, transactionId: TX });
    expect((await traiterNotificationOrange(requete(notification(), { jeton }), adapt, { admin, rechercher: mauvaisMontant, alerter: () => {} })).status).toBe(202);
    expect(credits).toBe(0);
    const echecBase = adaptateur({ commande, jetonHash: empreinte, appliquer: async () => ({ resultat: "erreur" }) });
    expect((await traiterNotificationOrange(requete(notification(), { jeton }), echecBase, { admin, rechercher: bonneReponse, alerter: () => {} })).status).toBe(500);
  });

  test("Authorization Basic : refusé seulement si la variable existe", async () => {
    const { traiterNotificationOrange, jeton, empreinte } = await preparer();
    const commande = { id: REF };
    const { admin } = fauxAdmin({ commande });
    const adapt = adaptateur({ commande, jetonHash: empreinte });
    const ctx = { admin, rechercher: bonneReponse, alerter: () => {} };
    const ancien = process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY;
    try {
      delete process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY;
      expect((await traiterNotificationOrange(requete(notification(), { jeton }), adapt, ctx)).status).toBe(202);
      process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY = "cle-partagee";
      expect((await traiterNotificationOrange(requete(notification(), { jeton }), adapt, ctx)).status).toBe(401);
      expect((await traiterNotificationOrange(requete(notification(), { jeton, entetes: { authorization: "Basic cle-partagee" } }), adapt, ctx)).status).toBe(202);
    } finally {
      if (ancien === undefined) delete process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY;
      else process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY = ancien;
    }
  });
});
