const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Ouverture automatique de l'application de paiement (MAXIT / Orange Money) sur téléphone : détection, choix du lien, UNE seule tentative
 * par commande, repli silencieux. Logique pure : aucun navigateur ni téléphone nécessaire.
 */
const charger = () => import("../../src/lib/ouvertureAppPaiement.js");

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidTablette: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadBureau: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
};
const LIENS = {
  deepLinkMaxit: "https://maxit.sn/pay/abc123",
  deepLinkOm: "https://om.orange.sn/pay/abc123",
  deepLink: "https://orange.example/pay/abc123",
};

function stockageFaux() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), m };
}

test.describe("détection du téléphone", () => {
  test("téléphones et tablettes mobiles : oui ; ordinateurs : non", async () => {
    const { estTelephone } = await charger();
    expect(estTelephone({ userAgent: UA.androidChrome })).toBe(true);
    expect(estTelephone({ userAgent: UA.iphone })).toBe(true);
    expect(estTelephone({ userAgent: UA.ipadBureau, maxTouchPoints: 5 })).toBe(true); // iPadOS se présente comme un Mac, mais il est tactile
    for (const ua of [UA.windows, UA.mac, UA.linux]) expect(estTelephone({ userAgent: ua })).toBe(false);
    expect(estTelephone({ userAgent: UA.mac, maxTouchPoints: 0 })).toBe(false);
    expect(estTelephone({})).toBe(false);
  });

  test("userAgentData.mobile prime quand il est connu", async () => {
    const { estTelephone } = await charger();
    expect(estTelephone({ userAgent: UA.windows, userAgentDataMobile: true })).toBe(true);
    expect(estTelephone({ userAgent: UA.windows, userAgentDataMobile: false })).toBe(false);
    expect(estTelephone({ userAgent: UA.androidChrome, userAgentDataMobile: false })).toBe(true); // Android « Mobile » reste un téléphone
    expect(estTelephone({ userAgent: UA.androidTablette, userAgentDataMobile: false })).toBe(false);
  });
});

test.describe("choix du lien", () => {
  test("MAXIT d'abord, puis Orange Money, puis le lien générique", async () => {
    const { choisirLien } = await charger();
    expect(choisirLien(LIENS, "android")).toEqual({ type: "maxit", url: LIENS.deepLinkMaxit });
    expect(choisirLien({ ...LIENS, deepLinkMaxit: null }, "android")).toEqual({ type: "om", url: LIENS.deepLinkOm });
    expect(choisirLien({ deepLink: LIENS.deepLink }, "android")).toEqual({ type: "autre", url: LIENS.deepLink });
    expect(choisirLien({}, "android")).toBeNull();
    expect(choisirLien(undefined, "android")).toBeNull();
  });

  test("jamais de javascript:, data:, file: ni lien vide ou démesuré", async () => {
    const { choisirLien, lienValide } = await charger();
    for (const mauvais of ["javascript://x", "javascript:alert(1)", "data://text/html;base64,AAAA", "file:///etc/passwd", "vbscript://x", "", "   ", "pas un lien", "https://", null, undefined, 42, `https://x.sn/${"a".repeat(3000)}`]) {
      expect(lienValide(mauvais)).toBe(false);
    }
    expect(choisirLien({ deepLinkMaxit: "javascript://x", deepLinkOm: LIENS.deepLinkOm }, "android")).toEqual({ type: "om", url: LIENS.deepLinkOm });
    expect(lienValide("maxit://pay?id=1")).toBe(true); // schéma d'application
    expect(lienValide("  https://maxit.sn/p  ")).toBe(true);
  });

  test("iPhone : seulement les liens https (jamais d'alerte « adresse invalide » de Safari)", async () => {
    const { choisirLien } = await charger();
    expect(choisirLien({ deepLinkMaxit: "maxit://pay?id=1", deepLinkOm: LIENS.deepLinkOm }, "ios")).toEqual({ type: "om", url: LIENS.deepLinkOm });
    expect(choisirLien({ deepLinkMaxit: "maxit://pay?id=1" }, "ios")).toBeNull();
    expect(choisirLien({ deepLinkMaxit: "maxit://pay?id=1" }, "android")).toEqual({ type: "maxit", url: "maxit://pay?id=1" });
  });
});

test.describe("une seule tentative automatique par commande", () => {
  test.beforeEach(async () => (await charger()).reinitialiserTentatives());

  test("première fois : ouvre MAXIT ; ensuite, jamais pour la même commande", async () => {
    const { tenterOuvertureAuto } = await charger();
    const stockage = stockageFaux();
    const ouvertures = [];
    const params = { commandeId: "cmd-1", liens: LIENS, appareil: { userAgent: UA.androidChrome }, stockage, ouvrir: (u) => ouvertures.push(u) };
    expect(tenterOuvertureAuto(params)).toEqual({ ouvert: true, raison: "ok", type: "maxit" });
    expect(ouvertures).toEqual([LIENS.deepLinkMaxit]);
    for (let i = 0; i < 5; i += 1) expect(tenterOuvertureAuto(params)).toMatchObject({ ouvert: false, raison: "deja_tentee" });
    expect(ouvertures).toHaveLength(1);
    // Même après « un rafraîchissement » (mémoire vidée) : sessionStorage se souvient.
    (await charger()).reinitialiserTentatives();
    expect(tenterOuvertureAuto(params)).toMatchObject({ ouvert: false, raison: "deja_tentee" });
    expect(ouvertures).toHaveLength(1);
  });

  test("une autre commande a droit à sa propre tentative", async () => {
    const { tenterOuvertureAuto } = await charger();
    const stockage = stockageFaux();
    const ouvertures = [];
    const base = { liens: LIENS, appareil: { userAgent: UA.androidChrome }, stockage, ouvrir: (u) => ouvertures.push(u) };
    tenterOuvertureAuto({ ...base, commandeId: "cmd-1" });
    tenterOuvertureAuto({ ...base, commandeId: "cmd-2" });
    expect(ouvertures).toHaveLength(2);
  });

  test("ordinateur : rien ne s'ouvre et la tentative n'est pas consommée", async () => {
    const { tenterOuvertureAuto, dejaTentee } = await charger();
    const stockage = stockageFaux();
    const ouvertures = [];
    const r = tenterOuvertureAuto({ commandeId: "cmd-1", liens: LIENS, appareil: { userAgent: UA.windows }, stockage, ouvrir: (u) => ouvertures.push(u) });
    expect(r).toEqual({ ouvert: false, raison: "ordinateur" });
    expect(ouvertures).toHaveLength(0);
    expect(dejaTentee("cmd-1", stockage)).toBe(false);
  });

  test("aucun lien utilisable : rien ne s'ouvre, tentative non consommée ; commande inconnue : rien", async () => {
    const { tenterOuvertureAuto, dejaTentee } = await charger();
    const stockage = stockageFaux();
    const base = { appareil: { userAgent: UA.androidChrome }, stockage, ouvrir: () => { throw new Error("ne doit jamais s'ouvrir"); } };
    expect(tenterOuvertureAuto({ ...base, commandeId: "cmd-1", liens: { deepLinkMaxit: "javascript://x" } })).toEqual({ ouvert: false, raison: "aucun_lien" });
    expect(dejaTentee("cmd-1", stockage)).toBe(false);
    expect(tenterOuvertureAuto({ ...base, commandeId: "", liens: LIENS })).toEqual({ ouvert: false, raison: "commande_inconnue" });
  });

  test("la tentative est notée AVANT l'ouverture : si le navigateur bloque (exception), on ne réessaie jamais", async () => {
    const { tenterOuvertureAuto } = await charger();
    const stockage = stockageFaux();
    let appels = 0;
    const params = {
      commandeId: "cmd-1",
      liens: LIENS,
      appareil: { userAgent: UA.androidChrome },
      stockage,
      ouvrir: () => {
        appels += 1;
        throw new Error("bloqué");
      },
    };
    expect(tenterOuvertureAuto(params)).toMatchObject({ ouvert: false, raison: "ouverture_bloquee" });
    expect(tenterOuvertureAuto(params)).toMatchObject({ ouvert: false, raison: "deja_tentee" });
    expect(appels).toBe(1);
  });

  test("sessionStorage indisponible (exceptions) : repli en mémoire, toujours une seule tentative, aucune erreur", async () => {
    const { tenterOuvertureAuto } = await charger();
    const casse = {
      getItem: () => {
        throw new Error("stockage bloqué");
      },
      setItem: () => {
        throw new Error("stockage bloqué");
      },
    };
    let ouvertures = 0;
    const params = { commandeId: "cmd-9", liens: LIENS, appareil: { userAgent: UA.androidChrome }, stockage: casse, ouvrir: () => (ouvertures += 1) };
    expect(tenterOuvertureAuto(params).ouvert).toBe(true);
    expect(tenterOuvertureAuto(params).ouvert).toBe(false);
    expect(ouvertures).toBe(1);
  });
});

test.describe("interrogation au retour dans le navigateur", () => {
  test("pas de double interrogation quand visibilitychange et focus arrivent ensemble", async () => {
    const { doitInterroger } = await charger();
    expect(doitInterroger(10_000, 0)).toBe(true);
    expect(doitInterroger(10_300, 10_000)).toBe(false);
    expect(doitInterroger(11_600, 10_000)).toBe(true);
  });
});

test.describe("les deux pages de paiement utilisent cette logique, sans toucher au reste", () => {
  const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
  for (const [nom, fichier] of [
    ["jetons", "src/app/premium/PremiumClient.jsx"],
    ["formation CV", "src/app/formation-redaction-cv/FormationRedactionCvClient.jsx"],
  ]) {
    test(`${nom} : ouverture automatique une fois, retour interrogé tout de suite, interrogation toutes les 4 s, boutons et QR conservés`, () => {
      const s = lire(fichier) + lire("src/components/AttentePaiementQr.jsx");
      expect(s).toContain("useOuvertureAppPaiement");
      expect(s).toContain("tenterAuto(");
      expect(s).toContain("interrogerRef.current = interroger");
      expect(s).toContain("setInterval(interroger, POLL_INTERVAL_MS)");
      expect(s).toContain("const POLL_INTERVAL_MS = 4000");
      expect(s).toContain("Ouvrir MAXIT");
      expect(s).toContain("Ouvrir Orange Money");
      expect(s).toContain("data:image/png;base64");
      expect(s).toContain('data-testid="ouvrir-maxit"'); // « Ouvrir MAXIT » au premier plan sur téléphone (voir les tests de rendu)
    });
  }

  test("ni la création du QR, ni le webhook, ni les prix ne sont modifiés par cette fonctionnalité", () => {
    const hook = lire("src/lib/useOuvertureAppPaiement.js");
    expect(hook).not.toMatch(/fetch\(|montant|prix|webhook/i);
  });
});

test.describe("bouton « Payer avec MAXIT » (téléphone) et texte d'aide", () => {
  test("téléphone : « Payer avec MAXIT » et une phrase d'aide sans le mot « QR » ; ordinateur : texte habituel, pas d'aide", async () => {
    const { libelleBoutonPaiement, aideBoutonPaiement, TEXTE_BOUTON_MAXIT, AIDE_BOUTON_MAXIT } = await charger();
    expect(TEXTE_BOUTON_MAXIT).toBe("Payer avec MAXIT");
    expect(libelleBoutonPaiement(true, "Générer mon QR de paiement Orange Money")).toBe("Payer avec MAXIT");
    expect(libelleBoutonPaiement(false, "Générer mon QR de paiement Orange Money")).toBe("Générer mon QR de paiement Orange Money");
    expect(libelleBoutonPaiement(false, "Payer 15 000 FCFA avec Orange Money")).toBe("Payer 15 000 FCFA avec Orange Money");
    expect(aideBoutonPaiement(true)).toBe("Touchez le bouton : MAXIT s'ouvre pour payer.");
    expect(aideBoutonPaiement(false)).toBeNull();
    expect(AIDE_BOUTON_MAXIT).not.toMatch(/qr/i);
    expect(AIDE_BOUTON_MAXIT.split(/[.!?]/).filter(Boolean)).toHaveLength(1); // une phrase courte
    expect(AIDE_BOUTON_MAXIT.length).toBeLessThanOrEqual(60);
  });

  test("le texte suit la détection : le même appareil donne « Payer avec MAXIT » sur téléphone et le texte habituel sur ordinateur", async () => {
    const { libelleBoutonPaiement, estTelephone } = await charger();
    const habituel = "Générer mon QR de paiement Orange Money";
    expect(libelleBoutonPaiement(estTelephone({ userAgent: UA.androidChrome }), habituel)).toBe("Payer avec MAXIT");
    expect(libelleBoutonPaiement(estTelephone({ userAgent: UA.iphone }), habituel)).toBe("Payer avec MAXIT");
    expect(libelleBoutonPaiement(estTelephone({ userAgent: UA.windows }), habituel)).toBe(habituel);
    expect(libelleBoutonPaiement(estTelephone({ userAgent: UA.mac }), habituel)).toBe(habituel);
  });

  test("les deux pages utilisent ces textes, et gardent le texte d'ordinateur", () => {
    const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
    const premium = lire("src/app/premium/PremiumClient.jsx");
    const formation = lire("src/app/formation-redaction-cv/FormationRedactionCvClient.jsx");
    expect(premium).toContain('libelleBoutonPaiement(estMobile, "Générer mon QR de paiement Orange Money")');
    expect(formation).toContain('libelleBoutonPaiement(estMobile, `Payer ${MONTANT_XOF.toLocaleString("fr-FR")} FCFA avec Orange Money`)');
    for (const s of [premium, formation]) {
      expect(s).toContain("aideBoutonPaiement(estMobile)");
      expect(s).toContain("fa-qrcode"); // même icône
    }
  });
});

test.describe("forme d'un lien d'application pour les journaux (sans chemin ni paramètres)", () => {
  test("https, schéma d'application, absent, inconnu", async () => {
    const { formeLien } = await charger();
    expect(formeLien("https://maxit.sn/pay/SECRET123?id=SECRET456")).toBe("https://maxit.sn (43 car.)");
    expect(formeLien("maxit://pay?payment=SECRET789")).toBe("maxit://pay (29 car.)");
    expect(formeLien(null)).toBe("absent");
    expect(formeLien("")).toBe("absent");
    expect(formeLien("n'importe quoi")).toMatch(/^forme inconnue/);
    for (const brut of ["https://maxit.sn/pay/SECRET123?id=SECRET456", "maxit://pay?payment=SECRET789"]) expect(formeLien(brut)).not.toMatch(/SECRET/);
  });

  test("les routes journalisent seulement la forme, jamais le lien brut", () => {
    const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
    for (const f of ["src/app/api/pay/jetons-checkout/route.js", "src/app/api/pay/formation-cv-checkout/route.js"]) {
      const s = lire(f);
      expect(s).toContain("formeLien(qrCode.deepLinkMaxit)");
      const sansFormes = s.replace(/formeLien\([^)]*\)/g, "");
      expect(sansFormes).not.toMatch(/console\.\w+\([^;]*qrCode\.deepLink/);
    }
  });
});
