const { test, expect } = require("@playwright/test");

/**
 * Paiement de test réel du 24/10/2026 (10 XOF) : la notification d'Orange est arrivée moins d'une seconde après le paiement, avant que la
 * recherche de transactions ne liste la ligne. Le webhook a conclu « incohérent » (202) et n'a jamais crédité. Ces tests fixent :
 *  - la forme RÉELLE (anonymisée) de la réponse de recherche, bien lue par le code ;
 *  - « SUCCESS annoncé mais ligne pas encore retrouvée » = quelques essais rapprochés, puis 503 (Orange renverra), jamais un rejet définitif ;
 *  - aucun crédit sans confirmation d'Orange de la référence ET du montant.
 */
const charger = () => import("../../src/lib/orangeMoney.js");
const chargerWebhook = () => import("../../src/lib/webhookOrange.js");
const REF = "c993bb1b-3f08-4c46-936a-92879f811868";
const TX = "MP261024.1253.A58062";

// Ligne de recherche réelle, anonymisée (aucun numéro de téléphone) : tableau à la racine, amount = objet { value, unit }.
const LIGNE_REELLE = {
  amount: { value: 10, unit: "XOF" },
  requestDate: "2026-10-24T12:53:03.494Z",
  reference: REF,
  metadata: { successRedirectUrl: "https://ffacilite.com/premium?statut=succes", cancelRedirectUrl: "https://ffacilite.com/premium?statut=annule" },
  receiveNotification: true,
  type: "MERCHANT_PAYMENT",
  transactionId: TX,
  createdAt: "2026-10-24T12:53:03.494Z",
  updatedAt: "2026-10-24T12:53:03.600Z",
  channel: "MAXIT",
  status: "SUCCESS",
};

function simulerFetch(routes) {
  const original = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    const u = new URL(url);
    urls.push(u.pathname + u.search);
    const cle = Object.keys(routes).find((k) => u.pathname === k);
    const [statut, corps] = cle ? routes[cle] : [404, { code: "60" }];
    return { status: statut, ok: statut >= 200 && statut < 300, json: async () => corps, headers: new Headers() };
  };
  return { urls, restaurer: () => (global.fetch = original) };
}

test.describe("forme réelle de la recherche Orange", () => {
  test.beforeEach(() => {
    process.env.ORANGE_MONEY_CLIENT_ID = "id";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
  });

  test("tableau à la racine, amount objet, reference UUID : bien lus, paiement de 10 XOF confirmé", async () => {
    const { rechercherTransactionOrange, evaluerConfirmationOrange } = await charger();
    for (const filtres of [{ reference: REF }, { transactionId: TX }, { transactionId: TX, reference: REF }]) {
      const m = simulerFetch({
        "/oauth/v1/token": [200, { access_token: `jeton-${Math.random()}`, expires_in: 3600 }],
        "/api/eWallet/v1/transactions": [200, [LIGNE_REELLE]],
        [`/api/eWallet/v1/transactions/${TX}/status`]: [200, { status: "SUCCESS" }],
      });
      try {
        const r = await rechercherTransactionOrange(filtres);
        expect(r).toMatchObject({ status: "SUCCESS", reference: REF, transactionId: TX, source: "recherche+statut" });
        expect(evaluerConfirmationOrange(r, { reference: REF, montantXof: 10 }).etat).toBe("succes");
        expect(evaluerConfirmationOrange(r, { reference: REF, montantXof: 1000 }).etat).toBe("incoherent"); // jamais un autre montant
      } finally {
        m.restaurer();
      }
    }
  });

  test("ligne pas encore listée : « attente » (jamais payé, jamais rejeté)", async () => {
    const { rechercherTransactionOrange, evaluerConfirmationOrange } = await charger();
    const m = simulerFetch({
      "/oauth/v1/token": [200, { access_token: `jeton-${Math.random()}`, expires_in: 3600 }],
      "/api/eWallet/v1/transactions": [200, []],
      [`/api/eWallet/v1/transactions/${TX}/status`]: [200, { status: "SUCCESS" }],
    });
    try {
      const r = await rechercherTransactionOrange({ transactionId: TX, reference: REF });
      expect(r.reference).toBeNull();
      expect(evaluerConfirmationOrange(r, { reference: REF, montantXof: 10 }).etat).toBe("attente");
    } finally {
      m.restaurer();
    }
  });

  test("référence PRÉSENTE mais d'une autre commande : toujours « incohérent »", async () => {
    const { evaluerConfirmationOrange } = await charger();
    expect(evaluerConfirmationOrange({ ...LIGNE_REELLE, reference: "6f1d2a40-0000-4000-8000-000000000001" }, { reference: REF, montantXof: 10 }).etat).toBe("incoherent");
  });
});

test.describe("webhook : SUCCESS annoncé, ligne pas encore retrouvée", () => {
  const notification = (status = "SUCCESS") => ({ type: "MERCHANT_PAYMENT", reference: REF, transactionId: TX, status, amount: { value: 10, unit: "XOF" } });
  const nonRetrouvee = async () => ({ status: "SUCCESS", reference: null, amount: null, transactionId: TX, source: "statut" });
  const retrouvee = async () => ({ status: "SUCCESS", reference: REF, amount: { value: 10, unit: "XOF" }, transactionId: TX, source: "recherche+statut" });

  async function preparer() {
    const { genererJetonCallback } = await charger();
    const { traiterNotificationOrange } = await chargerWebhook();
    const { jeton, empreinte } = genererJetonCallback();
    const retraits = [];
    const admin = {
      from: () => ({
        insert: async () => ({ error: null }),
        delete: () => ({ eq: async (c, v) => (retraits.push(v), { error: null }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    };
    let credits = 0;
    const adaptateur = {
      nom: "Test",
      tableJournal: "journal_test",
      trouverCommande: async () => ({ commande: { id: REF }, erreur: null }),
      empreinteJeton: () => empreinte,
      montantXof: () => 10,
      appliquer: async () => ((credits += 1), { resultat: "credite" }),
      champsJournal: (c) => ({ commande_id: c.id }),
    };
    const requete = (corps) =>
      new Request(`https://exemple.test/api/pay/jetons-webhook?t=${jeton}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
    return { traiterNotificationOrange, admin, adaptateur, requete, retraits, credits: () => credits };
  }

  test("retrouvée au 3e essai : crédit UNE fois, 202, après deux attentes", async () => {
    const { traiterNotificationOrange, admin, adaptateur, requete, credits } = await preparer();
    const reponses = [nonRetrouvee, nonRetrouvee, retrouvee];
    let appels = 0;
    const attentes = [];
    const r = await traiterNotificationOrange(requete(notification()), adaptateur, {
      admin,
      rechercher: (...a) => reponses[appels++](...a),
      attendre: async (ms) => attentes.push(ms),
      alerter: () => {},
    });
    expect(r.status).toBe(202);
    expect(appels).toBe(3);
    expect(attentes).toEqual([1500, 3000]);
    expect(credits()).toBe(1);
  });

  test("jamais retrouvée : 503 (Orange renverra), journal retiré, aucun crédit, pas de rejet définitif", async () => {
    const { traiterNotificationOrange, admin, adaptateur, requete, retraits, credits } = await preparer();
    let appels = 0;
    const r = await traiterNotificationOrange(requete(notification()), adaptateur, {
      admin,
      rechercher: async () => (appels++, nonRetrouvee()),
      attendre: async () => {},
      alerter: () => {},
    });
    expect(r.status).toBe(503);
    expect(appels).toBe(3);
    expect(retraits.length).toBe(1); // l'événement est retiré du journal : la renotification sera traitée, pas prise pour un doublon
    expect(credits()).toBe(0);
  });

  test("statut intermédiaire annoncé et ligne absente : 202 sans réessai ; référence différente : 202 sans réessai ni crédit", async () => {
    const { traiterNotificationOrange, admin, adaptateur, requete, credits } = await preparer();
    let appels = 0;
    const sansAttente = { admin, attendre: async () => {}, alerter: () => {} };
    expect((await traiterNotificationOrange(requete(notification("PENDING")), adaptateur, { ...sansAttente, rechercher: async () => (appels++, nonRetrouvee()) })).status).toBe(202);
    expect(appels).toBe(1);
    appels = 0;
    const autre = async () => (appels++, { status: "SUCCESS", reference: "6f1d2a40-0000-4000-8000-000000000001", amount: { value: 10, unit: "XOF" }, transactionId: TX });
    expect((await traiterNotificationOrange(requete(notification()), adaptateur, { ...sansAttente, rechercher: autre })).status).toBe(202);
    expect(appels).toBe(1);
    expect(credits()).toBe(0);
  });
});
