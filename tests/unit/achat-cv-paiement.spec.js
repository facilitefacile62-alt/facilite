const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Achat d'un modèle de CV (point 2) : adaptateur du webhook commun, pas un webhook indépendant. Les comportements sont testés avec une base
 * simulée qui reproduit les contraintes d'unicité de la vraie base (un seul achat confirmé par compte et par modèle, un transactionId Orange
 * ne valide qu'un achat) et avec la forme RÉELLE (anonymisée) des réponses d'Orange relevée lors du paiement de test du 24/10/2026.
 */
const chargerOrange = () => import("../../src/lib/orangeMoney.js");
const chargerWebhook = () => import("../../src/lib/webhookOrange.js");
const chargerCv = () => import("../../src/lib/cvAchatPaiement.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const REF = "c993bb1b-3f08-4c46-936a-92879f811868";
const REF_B = "0b6a7d1e-2f5c-4c0e-9b51-7f1f2f4d8a11";
const USER = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const MODELE = "33333333-3333-4333-8333-333333333333";
const TX1 = "MP261024.1253.A58062";
const TX2 = "MP261024.1301.B71234";

// Ligne de recherche réelle, anonymisée : tableau à la racine, amount = objet { value, unit }, reference = UUID de notre commande.
const ligneReelle = (tx, montant = 100, reference = REF) => ({
  amount: { value: montant, unit: "XOF" },
  requestDate: "2026-10-24T12:53:03.494Z",
  reference,
  metadata: { successRedirectUrl: "https://ffacilite.com/achat-cv?statut=succes", cancelRedirectUrl: "https://ffacilite.com/achat-cv?statut=annule" },
  receiveNotification: true,
  type: "MERCHANT_PAYMENT",
  transactionId: tx,
  createdAt: "2026-10-24T12:53:03.494Z",
  updatedAt: "2026-10-24T12:53:03.600Z",
  channel: "MAXIT",
  status: "SUCCESS",
});
const notification = (tx, montant = 100, reference = REF) => ({ type: "MERCHANT_PAYMENT", reference, transactionId: tx, status: "SUCCESS", amount: { value: montant, unit: "XOF" } });

function simulerFetch(routes) {
  const original = global.fetch;
  const appels = [];
  global.fetch = async (url) => {
    const u = new URL(url);
    appels.push(u.pathname);
    const cle = Object.keys(routes).find((k) => u.pathname === k);
    const [statut, corps] = cle ? routes[cle] : [404, { code: "60" }];
    return { status: statut, ok: statut >= 200 && statut < 300, json: async () => corps, headers: new Headers() };
  };
  return { appels, restaurer: () => (global.fetch = original) };
}
const routesOrange = (lignes, tx) => ({
  "/oauth/v1/token": [200, { access_token: `jeton-${Math.random()}`, expires_in: 3600 }],
  "/api/eWallet/v1/transactions": [200, lignes],
  ...(tx ? { [`/api/eWallet/v1/transactions/${tx}/status`]: [200, { status: "SUCCESS" }] } : {}),
});

/** Base simulée : tables en mémoire, requêtes chaînées comme supabase-js, contraintes d'unicité de la vraie base. */
function baseSimulee(achats, modeles = []) {
  const tables = { cv_achats: achats, cv_achat_webhook_events: [], cv_modeles: modeles };
  const etat = { tables, ecritures: 0 };
  const violation = (table, ligne) => {
    if (table !== "cv_achats" || ligne.status !== "success") return null;
    const autres = tables.cv_achats.filter((a) => a !== ligne && a.status === "success");
    if (autres.some((a) => a.user_id === ligne.user_id && a.modele_id === ligne.modele_id)) return { code: "23505", message: 'duplicate key value violates unique constraint "cv_achats_un_par_modele"' };
    if (ligne.provider_reference && autres.some((a) => a.provider_reference === ligne.provider_reference)) return { code: "23505", message: 'duplicate key value violates unique constraint "cv_achats_transaction_unique"' };
    return null;
  };
  class Requete {
    constructor(table) {
      this.table = table;
      this.op = "select";
      this.filtres = [];
      this.max = null;
    }
    select() {
      if (this.op === "select") this.op = "select";
      else this.retour = true;
      return this;
    }
    insert(c) { this.op = "insert"; this.charge = c; return this; }
    update(c) { this.op = "update"; this.charge = c; return this; }
    delete() { this.op = "delete"; return this; }
    eq(k, v) { this.filtres.push((r) => r[k] === v); return this; }
    in(k, vs) { this.filtres.push((r) => vs.includes(r[k])); return this; }
    not(k, op, v) { this.filtres.push((r) => (op === "is" && v === null ? r[k] != null : true)); return this; }
    limit(n) { this.max = n; return this; }
    maybeSingle() { return this.executer().then((r) => ({ data: r.data?.[0] ?? null, error: r.error })); }
    then(ok, ko) { return this.executer().then(ok, ko); }
    async executer() {
      const lignes = tables[this.table];
      const choisies = lignes.filter((r) => this.filtres.every((f) => f(r)));
      if (this.op === "select") return { data: choisies.slice(0, this.max ?? undefined).map((r) => ({ ...r })), error: null };
      if (this.op === "insert") {
        if (this.table === "cv_achat_webhook_events" && lignes.some((r) => r.idempotency_key === this.charge.idempotency_key)) return { data: null, error: { code: "23505", message: "duplicate key (idempotency_key)" } };
        lignes.push({ ...this.charge });
        etat.ecritures += 1;
        return { data: null, error: null };
      }
      if (this.op === "delete") {
        tables[this.table] = lignes.filter((r) => !choisies.includes(r));
        return { data: null, error: null };
      }
      // update
      const avant = choisies.map((r) => ({ ...r }));
      for (const r of choisies) Object.assign(r, this.charge);
      for (const r of choisies) {
        const v = violation(this.table, r);
        if (v) {
          choisies.forEach((c, i) => Object.assign(c, avant[i]));
          return { data: null, error: v };
        }
      }
      if (choisies.length) etat.ecritures += 1;
      return { data: this.retour ? choisies.map((r) => ({ ...r })) : null, error: null };
    }
  }
  etat.admin = { from: (table) => new Requete(table) };
  return etat;
}

async function nouvelAchat(surcharge = {}) {
  const { genererJetonCallback } = await chargerOrange();
  const { jeton, empreinte } = genererJetonCallback();
  return {
    jeton,
    achat: { id: REF, user_id: USER, modele_id: MODELE, montant_xof: 100, status: "pending", provider_reference: "qrid-abc", callback_token_hash: empreinte, created_at: new Date(Date.now() - 60_000).toISOString(), ...surcharge },
  };
}
const requete = (jeton, corps, query = `t=${jeton}`) =>
  new Request(`https://exemple.test/api/pay/cv-achat-webhook?${query}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
const sansAttente = { attendre: async () => {} };

test.describe("achat de CV : webhook commun, confirmation d'Orange, achat unique et idempotent", () => {
  test.beforeEach(async () => {
    process.env.ORANGE_MONEY_CLIENT_ID = "id";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
    // L'alerte réelle (Sentry) ne se charge pas hors du serveur Next : on la remplace, et on garde ses appels.
    (await chargerCv()).reglages.alerter = () => {};
  });

  test("bout en bout avec la forme réelle d'Orange : recherche + statut SUCCESS, montant lu en base, achat confirmé", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const m = simulerFetch(routesOrange([ligneReelle(TX1)], TX1));
    try {
      const r = await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, ...sansAttente });
      expect(r.status).toBe(202);
      expect(base.tables.cv_achats[0]).toMatchObject({ status: "success", provider_reference: TX1 });
      expect(base.tables.cv_achats[0].paye_le).toBeTruthy();
      expect(base.tables.cv_achat_webhook_events[0]).toMatchObject({ achat_id: REF, reference: REF, orange_transaction_id: TX1 });
    } finally {
      m.restaurer();
    }
  });

  test("la même notification reçue deux fois (redistribution d'Orange) : un seul achat, aucun drapeau de double paiement", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const alertes = [];
    const m = simulerFetch(routesOrange([ligneReelle(TX1)], TX1));
    try {
      const ctx = { admin: base.admin, alerter: (...a) => alertes.push(a), ...sansAttente };
      expect((await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateurAchatCv, ctx)).status).toBe(202);
      expect((await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateurAchatCv, ctx)).status).toBe(202);
      expect(base.tables.cv_achats.filter((a) => a.status === "success")).toHaveLength(1);
      expect(alertes).toHaveLength(0);
      expect(base.tables.cv_achat_webhook_events.some((e) => e.status === "DOUBLE_PAIEMENT")).toBe(false);
    } finally {
      m.restaurer();
    }
  });

  test("paiement confirmé APRÈS l'expiration du QR (achat vieux de 3 h, ou déjà « failed ») : acheté, une seule fois", async () => {
    const { appliquerConfirmationAchatCv } = await chargerCv();
    for (const statut of ["pending", "failed"]) {
      const { achat } = await nouvelAchat({ status: statut, created_at: new Date(Date.now() - 30 * 3_600_000).toISOString() });
      const base = baseSimulee([achat]);
      const confirmation = { etat: "succes", transactionId: TX1 };
      expect((await appliquerConfirmationAchatCv(base.admin, { ...achat }, confirmation, TX1)).resultat).toBe("credite");
      expect((await appliquerConfirmationAchatCv(base.admin, { ...achat }, confirmation, TX1)).resultat).toBe("deja_traite");
      expect(base.tables.cv_achats[0]).toMatchObject({ status: "success", provider_reference: TX1 });
    }
  });

  test("SUCCESS annoncé mais ligne pas encore listée par la recherche : 3 essais rapprochés, puis 503 (Orange renverra), rien d'acheté", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const attentes = [];
    const m = simulerFetch(routesOrange([], TX1));
    try {
      const r = await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, attendre: async (ms) => attentes.push(ms) });
      expect(r.status).toBe(503);
      expect(attentes).toEqual([1500, 3000]);
      expect(base.tables.cv_achats[0].status).toBe("pending");
      expect(base.tables.cv_achat_webhook_events).toHaveLength(0); // retiré du journal : la relance d'Orange sera traitée
    } finally {
      m.restaurer();
    }
  });

  test("montant confirmé par Orange différent du prix figé : jamais d'achat, alerte, aucun nouvel essai", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const alertes = [];
    const m = simulerFetch(routesOrange([ligneReelle(TX1, 50)], TX1));
    try {
      const r = await traiterNotificationOrange(requete(jeton, notification(TX1, 50)), adaptateurAchatCv, { admin: base.admin, alerter: (...a) => alertes.push(a), ...sansAttente });
      expect(r.status).toBe(202);
      expect(base.tables.cv_achats[0].status).toBe("pending");
      expect(alertes.some(([titre]) => /incohérente/i.test(titre))).toBe(true);
    } finally {
      m.restaurer();
    }
  });

  test("le montant déclaré par la notification ne compte pas : seule la confirmation d'Orange (référence ET montant) décide", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    // La notification annonce 100 mais Orange (recherche) ne connaît que 10 : incohérent, rien d'acheté.
    const m = simulerFetch(routesOrange([ligneReelle(TX1, 10)], TX1));
    try {
      await traiterNotificationOrange(requete(jeton, notification(TX1, 100)), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, ...sansAttente });
      expect(base.tables.cv_achats[0].status).toBe("pending");
    } finally {
      m.restaurer();
    }
  });

  test("mauvais jeton de callback : 404, Orange n'est JAMAIS interrogé, aucune écriture ; secret global ?s= accepté", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const m = simulerFetch(routesOrange([ligneReelle(TX1)], TX1));
    try {
      const r = await traiterNotificationOrange(requete("mauvais", notification(TX1)), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, ...sansAttente });
      expect(r.status).toBe(404);
      expect(m.appels).toHaveLength(0);
      expect(base.tables.cv_achats[0].status).toBe("pending");
      expect(base.ecritures).toBe(0);

      process.env.ORANGE_MONEY_CALLBACK_SECRET = "secret-global-de-test";
      const r2 = await traiterNotificationOrange(requete("x", notification(TX1), "s=secret-global-de-test"), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, ...sansAttente });
      expect(r2.status).toBe(202);
      expect(base.tables.cv_achats[0].status).toBe("success");
    } finally {
      delete process.env.ORANGE_MONEY_CALLBACK_SECRET;
      m.restaurer();
    }
  });

  test("référence qui n'est pas un UUID : 404 sans toucher la base ni Orange", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const m = simulerFetch(routesOrange([], null));
    try {
      const r = await traiterNotificationOrange(requete(jeton, { ...notification(TX1), reference: "pas-un-uuid" }), adaptateurAchatCv, { admin: base.admin, alerter: () => {}, ...sansAttente });
      expect(r.status).toBe(404);
      expect(m.appels).toHaveLength(0);
    } finally {
      m.restaurer();
    }
  });

  test("même QR payé deux fois : un seul achat, le second paiement est journalisé DOUBLE_PAIEMENT et signalé", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    const alertes = [];
    const ctx = { admin: base.admin, alerter: (...a) => alertes.push(a), ...sansAttente };
    for (const tx of [TX1, TX2]) {
      const m = simulerFetch(routesOrange([ligneReelle(tx)], tx));
      try {
        expect((await traiterNotificationOrange(requete(jeton, notification(tx)), adaptateurAchatCv, ctx)).status).toBe(202);
      } finally {
        m.restaurer();
      }
    }
    expect(base.tables.cv_achats[0]).toMatchObject({ status: "success", provider_reference: TX1 });
    expect(base.tables.cv_achat_webhook_events.filter((e) => e.status === "DOUBLE_PAIEMENT")).toHaveLength(1);
    expect(alertes.find(([titre]) => /double/i.test(titre))[1]).toMatchObject({ reference: REF, transactionIdCrediteur: TX1, transactionIdEnDouble: TX2 });
  });

  test("ancien QR payé alors que le modèle est déjà acheté par une autre commande : pas de second achat, paiement en double signalé", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { adaptateurAchatCv } = await chargerCv();
    const { jeton, achat } = await nouvelAchat({ status: "failed" }); // ancien QR, fermé côté base par une nouvelle demande
    const dejaAchete = { ...achat, id: REF_B, status: "success", provider_reference: TX1, callback_token_hash: "autre" };
    const base = baseSimulee([achat, dejaAchete]);
    const alertes = [];
    const m = simulerFetch(routesOrange([ligneReelle(TX2)], TX2));
    try {
      const r = await traiterNotificationOrange(requete(jeton, notification(TX2)), adaptateurAchatCv, { admin: base.admin, alerter: (...a) => alertes.push(a), ...sansAttente });
      expect(r.status).toBe(202);
      expect(base.tables.cv_achats.filter((a) => a.status === "success")).toHaveLength(1);
      expect(base.tables.cv_achats.find((a) => a.id === REF).status).not.toBe("success");
      expect(base.tables.cv_achat_webhook_events.some((e) => e.status === "DOUBLE_PAIEMENT")).toBe(true);
      expect(alertes.some(([titre]) => /double/i.test(titre))).toBe(true);
    } finally {
      m.restaurer();
    }
  });

  test("un même transactionId Orange ne valide jamais deux achats", async () => {
    const { appliquerConfirmationAchatCv } = await chargerCv();
    const a1 = (await nouvelAchat({ id: REF })).achat;
    const a2 = (await nouvelAchat({ id: REF_B, modele_id: "44444444-4444-4444-8444-444444444444" })).achat;
    const base = baseSimulee([a1, a2]);
    expect((await appliquerConfirmationAchatCv(base.admin, { ...a1 }, { etat: "succes" }, TX1)).resultat).toBe("credite");
    expect((await appliquerConfirmationAchatCv(base.admin, { ...a2 }, { etat: "succes" }, TX1)).resultat).toBe("doublon_transaction");
    expect(base.tables.cv_achats.find((a) => a.id === REF_B).status).toBe("pending");
  });

  test("échec confirmé (FAILED) : jamais d'achat ; un achat déjà confirmé n'est pas touché", async () => {
    const { appliquerConfirmationAchatCv } = await chargerCv();
    const { achat } = await nouvelAchat();
    const base = baseSimulee([achat]);
    expect((await appliquerConfirmationAchatCv(base.admin, { ...achat }, { etat: "echec" }, null)).resultat).toBe("echec_enregistre");
    expect(base.tables.cv_achats[0].status).toBe("failed");
    const paye = (await nouvelAchat({ status: "success", provider_reference: TX1 })).achat;
    const base2 = baseSimulee([paye]);
    await appliquerConfirmationAchatCv(base2.admin, { ...paye }, { etat: "echec" }, TX2);
    expect(base2.tables.cv_achats[0].status).toBe("success");
  });

  test("prix minimum 100 FCFA : un achat dont le montant figé est inférieur n'est jamais validé", async () => {
    const { appliquerConfirmationAchatCv, montantAchatCvValide, PRIX_MIN_MODELE_CV_XOF } = await chargerCv();
    expect(PRIX_MIN_MODELE_CV_XOF).toBe(100);
    expect([99, 0, -5, 100.5, null, "100"].map(montantAchatCvValide)).toEqual([false, false, false, false, false, false]);
    expect(montantAchatCvValide(100)).toBe(true);
    const { achat } = await nouvelAchat({ montant_xof: 99 });
    const base = baseSimulee([achat]);
    expect((await appliquerConfirmationAchatCv(base.admin, { ...achat }, { etat: "succes" }, TX1)).resultat).toBe("erreur");
    expect(base.tables.cv_achats[0].status).toBe("pending");
  });
});

test.describe("achat de CV : nom du QR, téléchargement sécurisé, aperçu", () => {
  test("nom du QR Orange : « CV » + modèle, sans accent, 20 caractères au plus, jamais vide", async () => {
    const { nomQrCv } = await chargerCv();
    for (const nom of ["Élégant Créatif très long modèle premium", "Classique", "", "Œuvre ÀÉÎÕÜ", "名前"]) {
      const n = nomQrCv(nom);
      expect(n).toMatch(/^[A-Za-z0-9 ]{1,20}$/);
    }
    expect(nomQrCv("Classique")).toBe("CV Classique");
  });

  test("téléchargement : seulement l'ACHETEUR d'un achat CONFIRMÉ ; autre compte, achat en attente ou échoué, fichier absent, base en panne refusés", async () => {
    const { autoriserTelechargementCv } = await chargerCv();
    const modeles = [{ id: MODELE, nom: "Classique", fichier_livre: "livres/classique.pdf" }];
    const { achat } = await nouvelAchat({ status: "success", provider_reference: TX1 });
    const base = baseSimulee([achat], modeles);
    expect(await autoriserTelechargementCv(base.admin, USER, MODELE)).toEqual({ chemin: "livres/classique.pdf", nom: "Classique" });
    expect(await autoriserTelechargementCv(base.admin, AUTRE, MODELE)).toMatchObject({ statut: 403 });
    for (const statut of ["pending", "failed"]) {
      const b = baseSimulee([{ ...achat, status: statut }], modeles);
      expect(await autoriserTelechargementCv(b.admin, USER, MODELE)).toMatchObject({ statut: 403 });
    }
    expect(await autoriserTelechargementCv(baseSimulee([achat], [{ id: MODELE, nom: "Classique", fichier_livre: null }]).admin, USER, MODELE)).toMatchObject({ statut: 404 });
    const enPanne = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: { message: "panne" } }) }) }) }) }) }) }) };
    expect(await autoriserTelechargementCv(enPanne, USER, MODELE)).toMatchObject({ statut: 503 });
  });

  test("nom du fichier téléchargé : simplifié, avec l'extension du fichier livré", async () => {
    const { nomFichierLivre } = await chargerCv();
    expect(nomFichierLivre("Élégant Créatif", "livres/x/modele.DOCX")).toBe("CV-Elegant-Creatif.docx");
    expect(nomFichierLivre("", "livres/x")).toBe("CV-modele.pdf");
  });

  test("aperçu : seules les pages existantes sont servies, jamais un chemin libre ; types d'image restreints", async () => {
    const { cheminApercuCv, typeImageApercu } = await chargerCv();
    const apercus = ["a/1.webp", "a/2.webp"];
    expect(cheminApercuCv(apercus, "1")).toBe("a/1.webp");
    expect(cheminApercuCv(apercus, "2")).toBe("a/2.webp");
    for (const page of ["0", "3", "abc", "1; DROP", "../x", "-1", "001", "", undefined]) expect(cheminApercuCv(apercus, page)).toBeNull();
    expect(cheminApercuCv(null, "1")).toBeNull();
    expect(typeImageApercu("a/1.webp")).toBe("image/webp");
    expect(typeImageApercu("a/1.JPG")).toBe("image/jpeg");
    expect(typeImageApercu("a/1.pdf")).toBeNull(); // un PDF n'est jamais servi comme aperçu
    expect(typeImageApercu("a/1.docx")).toBeNull();
  });
});

test.describe("achat de CV : structure des routes (même circuit, aucune logique parallèle)", () => {
  test("le webhook est un simple adaptateur du traitement commun, sans logique de paiement propre", () => {
    const s = lire("src/app/api/pay/cv-achat-webhook/route.js");
    expect(s).toContain("traiterNotificationOrange(req, adaptateurAchatCv)");
    expect(s).not.toMatch(/\.from\(|createClient|fetch\(/);
    const lib = lire("src/lib/cvAchatPaiement.js");
    expect(lib).toContain('tableJournal: "cv_achat_webhook_events"');
    expect(lib).toContain("transactionCrediteur");
    expect(lib).toContain('.in("status", ["pending", "failed"])');
  });

  test("la création du paiement : seul l'identifiant du modèle vient du navigateur ; prix et état lus en base ; QR 5 min, nom court, un seul à la fois", () => {
    const s = lire("src/app/api/pay/cv-checkout/route.js");
    expect(s).toContain("z.object({ modeleId: z.string().uuid() })");
    expect(s).not.toMatch(/montant|prix/i.test("") ? /$^/ : /corps\.data\.(montant|prix)|body\.(montant|prix)/);
    expect(s).toContain('admin.rpc("preparer_achat_cv"');
    expect(s).toContain("nom: nomQrCv(preparation.nom)");
    expect(s).toContain("validiteSecondes: QR_VALIDITE_SECONDES");
    expect(s).toContain("validForSeconds: QR_VALIDITE_SECONDES");
    expect(s).toContain("montantAchatCvValide(montantXof)");
    expect(s).toContain('preparation.etat === "en_cours"');
    expect(s).toContain("cv-achat-webhook?t=${jetonCallback}");
    expect(s).toContain("requireUser(req)");
    expect(s).toContain("checkRateLimit(user.id)");
    expect(s).toContain("orangeMoneyActif()");
    // le GET ne fait aucune écriture
    const get = s.slice(s.indexOf("export async function GET"));
    expect(get).not.toMatch(/\.(insert|update|delete|rpc)\(/);
  });

  test("le rattrapage reprend les achats de CV avec les mêmes conditions que le webhook et la même idempotence", () => {
    const s = lire("src/app/api/cron/rattrapage-achats-cv/route.js");
    expect(s).toContain("bearerValide(");
    expect(s).toContain("rechercherTransactionOrange({ reference: commande.id })");
    expect(s).toContain("evaluerConfirmationOrange(reponse, { reference: commande.id, montantXof: commande.montant_xof })");
    expect(s).toContain("appliquerConfirmationAchatCv(admin, commande, confirmation, reponse?.transactionId)");
    expect(s).toContain('.eq("status", "failed")'); // un paiement tardif sur un ancien QR est repris
    const flux = lire(".github/workflows/rattrapage-achats-jetons.yml");
    expect(flux).toContain("https://ffacilite.com/api/cron/rattrapage-achats-cv");
    expect(flux).toContain("https://ffacilite.com/api/cron/rattrapage-achats-jetons");
  });

  test("téléchargement : lien signé de courte durée, créé après le contrôle de l'achat confirmé ; l'aperçu ne touche jamais le fichier livré", () => {
    const dl = lire("src/app/api/cv-modeles/[id]/telecharger/route.js");
    expect(dl.indexOf("autoriserTelechargementCv(")).toBeGreaterThan(-1);
    expect(dl.indexOf("autoriserTelechargementCv(")).toBeLessThan(dl.indexOf("createSignedUrl("));
    expect(dl).toContain("DUREE_LIEN_TELECHARGEMENT_SECONDES");
    expect(dl).toContain("requireUser(req)");
    expect(dl).not.toMatch(/console\.\w+\([^)]*signedUrl/);
    const ap = lire("src/app/api/cv-modeles/[id]/apercu/[page]/route.js");
    expect(ap).toContain("cv-modeles-apercus");
    expect(ap).not.toMatch(/cv-modeles-livres|fichier_livre|createSignedUrl/);
    expect(ap).toContain("no-store");
    expect(ap).toContain("requireUser(req)");
    const dlCache = dl.includes("no-store");
    expect(dlCache).toBe(true);
  });

  test("l'admin voit les achats de CV non aboutis et les paiements en double, peut revérifier et marquer remboursé", () => {
    const liste = lire("src/app/api/admin/commandes-orange/route.js");
    expect(liste).toContain('from("cv_achat_webhook_events")');
    expect(liste).toContain("achatsCv:");
    expect(liste).toContain('type: "cv"');
    expect(lire("src/app/api/admin/commandes-orange/rembourse/route.js")).toContain('cv: "cv_achat_webhook_events"');
    expect(lire("src/app/api/admin/commandes-orange/reverifier/route.js")).toContain("appliquerConfirmationAchatCv(admin, commande, confirmation, reponse?.transactionId)");
    const page = lire("src/app/admin/commandes-orange/page.js");
    expect(page).toContain("Paiements en double à rembourser");
    expect(page).toContain("Achats de modèles de CV");
    expect(page).toContain('"Modèle de CV"');
  });

  test("les webhooks existants (jetons, formation CV) et le rattrapage des jetons ne sont pas modifiés par ce chantier", () => {
    expect(lire("src/app/api/pay/jetons-webhook/route.js")).toContain('nom: "Webhook Jetons"');
    expect(lire("src/app/api/pay/formation-cv-webhook/route.js")).toContain('nom: "Webhook Formation CV"');
    expect(lire("src/lib/webhookOrange.js")).not.toMatch(/cv_achat|AchatCv/);
  });
});
