const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Un même QR payé deux fois, validité de 5 minutes, paiement confirmé après expiration.
 * Comportement réel testé avec une base simulée (transition atomique pending/failed → success), jamais seulement l'intention.
 */
const chargerOrange = () => import("../../src/lib/orangeMoney.js");
const chargerWebhook = () => import("../../src/lib/webhookOrange.js");
const chargerCredit = () => import("../../src/lib/jetonsPaiement.js");
const chargerValidite = () => import("../../src/lib/validiteQr.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

const REF = "c993bb1b-3f08-4c46-936a-92879f811868";
const TX1 = "MP261024.1253.A58062";
const TX2 = "MP261024.1301.B71234";

/** Base simulée : une commande de jetons, un solde, un journal d'événements. Les modifications suivent les mêmes conditions que la vraie base. */
function fauxeBase({ statut = "pending", providerReference = "qrid-abc", creeIlYa = 60_000 } = {}) {
  const etat = {
    commande: { id: REF, store_id: "boutique-1", montant: 10, montant_xof: 10, status: statut, provider_reference: providerReference, created_at: new Date(Date.now() - creeIlYa).toISOString() },
    solde: 0,
    credits: 0,
    journalMaj: [],
    journalRetraits: 0,
  };
  const admin = {
    rpc: async (nom, args) => {
      if (nom === "crediter_jetons_boutique") {
        etat.solde += args.p_montant;
        etat.credits += 1;
      }
      return { error: null };
    },
    from: (table) => {
      if (table !== "jetons_transactions") {
        return {
          insert: async () => ({ error: null }),
          delete: () => ({ eq: async () => ((etat.journalRetraits += 1), { error: null }) }),
          update: (charge) => ({ eq: async () => (etat.journalMaj.push(charge), { error: null }) }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: etat.commande.status, provider_reference: etat.commande.provider_reference }, error: null }) }) }),
        update: (charge) => {
          const filtres = { statuts: null };
          const chaine = {
            eq: (colonne, valeur) => {
              if (colonne === "status") filtres.statuts = [valeur];
              return chaine;
            },
            in: (colonne, valeurs) => {
              if (colonne === "status") filtres.statuts = valeurs;
              return chaine;
            },
            select: async () => {
              if (filtres.statuts && !filtres.statuts.includes(etat.commande.status)) return { data: [], error: null };
              Object.assign(etat.commande, charge);
              return { data: [{ ...etat.commande }], error: null };
            },
            then: (resolu) => {
              if (!filtres.statuts || filtres.statuts.includes(etat.commande.status)) Object.assign(etat.commande, charge);
              return Promise.resolve({ error: null }).then(resolu);
            },
          };
          return chaine;
        },
      };
    },
  };
  return { admin, etat };
}

async function adaptateurJetons(etat) {
  const { genererJetonCallback } = await chargerOrange();
  const { appliquerConfirmationAchat } = await chargerCredit();
  const { jeton, empreinte } = genererJetonCallback();
  return {
    jeton,
    adaptateur: {
      nom: "Test",
      tableJournal: "jetons_webhook_events",
      trouverCommande: async () => ({ commande: { ...etat.commande }, erreur: null }),
      empreinteJeton: () => empreinte,
      montantXof: (c) => c.montant_xof,
      appliquer: (admin, commande, confirmation, tx) => appliquerConfirmationAchat(admin, commande, confirmation, tx),
      transactionCrediteur: async () => (etat.commande.status === "success" ? etat.commande.provider_reference : null),
      champsJournal: (c) => ({ jetons_transaction_id: c.id }),
    },
  };
}

const notification = (tx) => ({ type: "MERCHANT_PAYMENT", reference: REF, transactionId: tx, status: "SUCCESS", amount: { value: 10, unit: "XOF" } });
const orangeConfirme = (tx) => async () => ({ status: "SUCCESS", reference: REF, amount: { value: 10, unit: "XOF" }, transactionId: tx, source: "recherche+statut" });
const requete = (jeton, corps) => new Request(`https://exemple.test/api/pay/jetons-webhook?t=${jeton}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });

test.describe("même QR payé deux fois : jamais de double crédit, paiement en double détecté", () => {
  test("1er paiement crédite ; 2e SUCCESS (autre transactionId) : aucun second crédit, journal DOUBLE_PAIEMENT, alerte", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { admin, etat } = fauxeBase();
    const { jeton, adaptateur } = await adaptateurJetons(etat);
    const alertes = [];
    const ctx = (tx) => ({ admin, rechercher: orangeConfirme(tx), alerter: (...a) => alertes.push(a), attendre: async () => {} });

    expect((await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx(TX1))).status).toBe(202);
    expect(etat.solde).toBe(10);
    expect(etat.commande).toMatchObject({ status: "success", provider_reference: TX1 });
    expect(alertes).toHaveLength(0);

    const r2 = await traiterNotificationOrange(requete(jeton, notification(TX2)), adaptateur, ctx(TX2));
    expect(r2.status).toBe(202); // livrée : Orange ne la renverra pas
    expect(etat.solde).toBe(10); // PAS de second crédit
    expect(etat.credits).toBe(1);
    expect(etat.commande.provider_reference).toBe(TX1); // la transaction créditée ne change pas
    expect(alertes.some(([titre]) => /double/i.test(titre))).toBe(true);
    expect(alertes.find(([titre]) => /double/i.test(titre))[1]).toMatchObject({ reference: REF, transactionIdCrediteur: TX1, transactionIdEnDouble: TX2 });
    expect(etat.journalMaj.some((m) => m.status === "DOUBLE_PAIEMENT")).toBe(true);
  });

  test("même transactionId reçu deux fois (redistribution d'Orange) : pas un double, aucun drapeau, aucun second crédit", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { admin, etat } = fauxeBase();
    const { jeton, adaptateur } = await adaptateurJetons(etat);
    const alertes = [];
    const ctx = { admin, rechercher: orangeConfirme(TX1), alerter: (...a) => alertes.push(a), attendre: async () => {} };
    await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx);
    await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx);
    expect(etat.credits).toBe(1);
    expect(alertes).toHaveLength(0);
    expect(etat.journalMaj.some((m) => m.status === "DOUBLE_PAIEMENT")).toBe(false);
  });

  test("le second paiement n'est signalé que s'il est CONFIRMÉ par Orange (référence ET montant) : jamais sur la seule notification", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { admin, etat } = fauxeBase();
    const { jeton, adaptateur } = await adaptateurJetons(etat);
    const alertes = [];
    const ctx = (rechercher) => ({ admin, rechercher, alerter: (...a) => alertes.push(a), attendre: async () => {} });
    await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx(orangeConfirme(TX1)));
    // Orange ne confirme pas le second paiement (montant différent) : incohérence, pas de « double paiement »
    const montantDifferent = async () => ({ status: "SUCCESS", reference: REF, amount: { value: 5, unit: "XOF" }, transactionId: TX2 });
    await traiterNotificationOrange(requete(jeton, notification(TX2)), adaptateur, ctx(montantDifferent));
    expect(etat.journalMaj.some((m) => m.status === "DOUBLE_PAIEMENT")).toBe(false);
    expect(etat.credits).toBe(1);
  });
});

test.describe("paiement réussi confirmé APRÈS l'expiration du QR : crédité, une seule fois", () => {
  test("commande « pending » vieille de 3 heures : crédit normal, une seule fois", async () => {
    const { traiterNotificationOrange } = await chargerWebhook();
    const { admin, etat } = fauxeBase({ creeIlYa: 3 * 3_600_000 });
    const { jeton, adaptateur } = await adaptateurJetons(etat);
    const ctx = { admin, rechercher: orangeConfirme(TX1), alerter: () => {}, attendre: async () => {} };
    expect((await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx)).status).toBe(202);
    expect((await traiterNotificationOrange(requete(jeton, notification(TX1)), adaptateur, ctx)).status).toBe(202);
    expect(etat.solde).toBe(10);
    expect(etat.credits).toBe(1);
  });

  test("commande marquée « failed » (ancienne tentative refusée, ou plus de 24 h) puis SUCCESS confirmé : créditée une seule fois", async () => {
    const { appliquerConfirmationAchat } = await chargerCredit();
    const { admin, etat } = fauxeBase({ statut: "failed", providerReference: "qrid-abc", creeIlYa: 30 * 3_600_000 });
    const confirmation = { etat: "succes", transactionId: TX1 };
    expect((await appliquerConfirmationAchat(admin, { ...etat.commande }, confirmation, TX1)).resultat).toBe("credite");
    expect((await appliquerConfirmationAchat(admin, { ...etat.commande }, confirmation, TX1)).resultat).toBe("deja_traite");
    expect(etat.credits).toBe(1);
    expect(etat.solde).toBe(10);
    expect(etat.commande.status).toBe("success");
  });

  test("un échec confirmé (FAILED) ne crédite jamais et ne touche pas une commande déjà payée", async () => {
    const { appliquerConfirmationAchat } = await chargerCredit();
    const { admin, etat } = fauxeBase({ statut: "success", providerReference: TX1 });
    expect((await appliquerConfirmationAchat(admin, { ...etat.commande }, { etat: "echec" }, TX2)).resultat).toBe("echec_enregistre");
    expect(etat.commande.status).toBe("success");
    expect(etat.credits).toBe(0);
  });
});

test.describe("validité du QR : 5 minutes, une seule constante", () => {
  test("QR_VALIDITE_SECONDES vaut 300, envoyée à Orange par défaut et par les deux routes", async () => {
    const { QR_VALIDITE_SECONDES, genererQrCodePaiement } = await chargerOrange();
    expect(QR_VALIDITE_SECONDES).toBe(300);
    const sauvegarde = { fetch: global.fetch, env: { ...process.env } };
    process.env.ORANGE_MONEY_CLIENT_ID = "id";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
    process.env.ORANGE_MONEY_MERCHANT_CODE = "629988";
    let corps = null;
    global.fetch = async (url, init) => {
      if (String(url).endsWith("/oauth/v1/token")) return new Response(JSON.stringify({ access_token: "j", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
      corps = JSON.parse(init.body);
      return new Response(JSON.stringify({ qrId: "QR1" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      await genererQrCodePaiement({ reference: REF, montantXof: 100, nom: "Test", callbackSuccessUrl: "https://ffacilite.com/a", callbackCancelUrl: "https://ffacilite.com/b" });
    } finally {
      global.fetch = sauvegarde.fetch;
      for (const k of Object.keys(process.env)) if (!(k in sauvegarde.env)) delete process.env[k];
      Object.assign(process.env, sauvegarde.env);
    }
    expect(corps.validity).toBe(300);
    for (const f of ["src/app/api/pay/jetons-checkout/route.js", "src/app/api/pay/formation-cv-checkout/route.js"]) {
      const s = lire(f);
      expect(s).toContain("validiteSecondes: QR_VALIDITE_SECONDES");
      expect(s).toContain("validForSeconds: QR_VALIDITE_SECONDES");
      expect(s).not.toMatch(/QR_VALIDITY_SECONDS|=\s*900\b/);
    }
  });

  test("textes : « valable 5 minutes », compte à rebours, phrase de fin", async () => {
    const { texteValidite, formaterCompteARebours, secondesRestantes, phraseTempsEcoule } = await chargerValidite();
    expect(texteValidite(300)).toBe("valable 5 minutes");
    expect(texteValidite(60)).toBe("valable 1 minute");
    expect(formaterCompteARebours(300)).toBe("5:00");
    expect(formaterCompteARebours(272)).toBe("4:32");
    expect(formaterCompteARebours(5)).toBe("0:05");
    expect(formaterCompteARebours(-3)).toBe("0:00");
    expect(secondesRestantes(10_000, 4_100)).toBe(6);
    expect(secondesRestantes(10_000, 20_000)).toBe(0);
    expect(phraseTempsEcoule(true, "Générer mon QR de paiement Orange Money")).toBe("Le temps est écoulé. Touchez « Payer avec MAXIT » pour recommencer.");
    expect(phraseTempsEcoule(false, "Générer mon QR de paiement Orange Money")).toBe("Le temps est écoulé. Touchez « Générer mon QR de paiement Orange Money » pour recommencer.");
  });

  test("formation CV : QR masqué à l'expiration (jamais scannable), bouton prêt, interrogation du statut qui continue", () => {
    const s = lire("src/app/formation-redaction-cv/FormationRedactionCvClient.jsx");
    const composant = lire("src/components/AttentePaiementQr.jsx");
    expect(composant).toContain("texteValidite(paiement.validForSeconds)");
    expect(composant).toContain("phraseTempsEcoule(");
    expect(s).toContain("<AttentePaiementQr");
    expect(s).toContain("qrExpire={qrExpire}");
    expect(s).toContain("boutonRecommencer={renderBoutonGenerer()}");
    // Écran « temps écoulé » du composant : plus de QR à l'écran
    const debut = composant.indexOf("if (qrExpire) {");
    const fin = composant.indexOf('data-testid="paiement-en-attente"', debut);
    const ecranTempsEcoule = composant.slice(debut, fin);
    expect(ecranTempsEcoule).toContain("boutonRecommencer");
    expect(ecranTempsEcoule).not.toMatch(/qrCodeBase64|<img|data:image/);
    expect(s).toContain("setInterval(interroger, POLL_INTERVAL_MS)"); // le suivi du paiement ne s'arrête pas à l'expiration
    expect(s).not.toMatch(/setQrExpire\(true\)[^;]*arreterSondage/); // l'expiration n'arrête pas le suivi
  });

  test("jetons : à l'expiration le QR et la barre fixe disparaissent (seuls le message « temps écoulé » et le bouton restent), le suivi continue", () => {
    const s = lire("src/app/premium/PremiumClient.jsx");
    expect(s).toContain('const enAttenteQr = statutAchat === "attente" && Boolean(paiement) && !qrExpire;');
    expect(s).toContain('{statutAchat === "attente" && paiement && !qrExpire ? (');
    expect(s).toContain("<QrPaiementCarte paiement={paiement} />");
    expect(s).toContain("{enAttenteQr && <BarrePaiementFixe");
    expect(s).toContain('phraseTempsEcoule(estMobile, "Générer mon QR de paiement Orange Money")');
    // le bouton pour recommencer est celui du formulaire, affiché dès que le QR est masqué
    expect(s).toContain("{renderBoutonGenerer()}");
    expect(s).toContain("setInterval(interroger, POLL_INTERVAL_MS)");
    expect(s).not.toMatch(/setQrExpire\(true\)[^;]*arreterSondage/);
  });
});

test.describe("réduire le risque de double paiement", () => {
  test("la route des jetons refuse un 2e QR créé moins de 20 secondes après le premier (même boutique)", () => {
    const s = lire("src/app/api/pay/jetons-checkout/route.js");
    expect(s).toContain("Date.now() - 20_000");
    expect(s).toContain('.not("provider_reference", "is", null)');
    expect(s).toMatch(/qrRecents \?\? 0\) > 0[\s\S]{0,300}status: 429/);
  });

  test("l'admin voit les paiements en double (référence, transactions, montant) et peut les marquer remboursés", () => {
    const liste = lire("src/app/api/admin/commandes-orange/route.js");
    expect(liste).toContain("STATUT_PAIEMENT_EN_DOUBLE");
    expect(liste).toContain("transactionEnDouble");
    expect(liste).toContain("transactionCreditee");
    const rembourse = lire("src/app/api/admin/commandes-orange/rembourse/route.js");
    expect(rembourse).toContain("isCallerAdmin");
    expect(rembourse).toContain(".eq(\"status\", STATUT_PAIEMENT_EN_DOUBLE)");
    const page = lire("src/app/admin/commandes-orange/page.js");
    expect(page).toContain("Paiements en double à rembourser");
  });

  test("les deux webhooks savent quelle transaction a crédité la commande", () => {
    expect(lire("src/app/api/pay/jetons-webhook/route.js")).toContain("transactionCrediteur");
    expect(lire("src/app/api/pay/formation-cv-webhook/route.js")).toContain("transactionCrediteur");
  });
});
