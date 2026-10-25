const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Connexion par code SMS : phrases simples, compte à rebours de 60 s, pas de double envoi, « Utiliser mon e-mail à la place ». Mêmes textes sur le site, dans
 * Facilité et dans Locaux (copie dans mobile/src/lib/messagesCode.ts, comparée ici quand le fichier est présent).
 */
const charger = () => import("../../src/lib/connexionTelephone.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const T0 = Date.parse("2026-10-25T12:00:00Z");

test.describe("messages", () => {
  test("les trois phrases demandées, mot pour mot", async () => {
    const m = await charger();
    expect(m.MESSAGE_CODE_INVALIDE).toBe("Ce code n'est pas bon. Vérifiez et réessayez.");
    expect(m.MESSAGE_CODE_EXPIRE).toBe("Ce code a expiré. Demandez-en un nouveau.");
    expect(m.MESSAGE_CODE_TARDE).toBe("Le code peut mettre quelques minutes à arriver. Ne demandez pas plusieurs codes.");
  });
  test("un code refusé peu après l'envoi = « pas bon » ; après 10 minutes = « expiré » ; même réponse technique de Supabase dans les deux cas", async () => {
    const m = await charger();
    const err = { message: "Token has expired or is invalid", code: "otp_expired" };
    expect(m.messageErreurCode(err, T0, T0 + 30_000)).toBe(m.MESSAGE_CODE_INVALIDE);
    expect(m.messageErreurCode(err, T0, T0 + 11 * 60_000)).toBe(m.MESSAGE_CODE_EXPIRE);
    expect(m.messageErreurCode(err, null, T0)).toBe(m.MESSAGE_CODE_INVALIDE);
  });
  test("jamais de texte technique (Twilio, configuration, message brut) à l'écran", async () => {
    const m = await charger();
    for (const err of [{ message: "Error sending sms: twilio 21608" }, { message: "{}" }, {}, "boom", null]) {
      expect(m.messageErreurEnvoi(err)).toBe(m.MESSAGE_ENVOI_IMPOSSIBLE);
    }
    expect(m.messageErreurEnvoi({ code: "over_sms_send_rate_limit" })).toBe(m.MESSAGE_TROP_DE_DEMANDES);
    expect(m.messageErreurEnvoi({ message: "For security purposes, you can only request this after 45 seconds" })).toBe(m.MESSAGE_TROP_DE_DEMANDES);
    expect(m.messageErreurEnvoi({ message: "Signups not allowed for otp", code: "otp_disabled" })).toBe(m.MESSAGE_NUMERO_INCONNU);
    expect(lire("src/components/PhoneAuthForm.jsx")).not.toMatch(/Twilio/i);
  });
  test("attente de 60 secondes et libellé visible du bouton", async () => {
    const m = await charger();
    expect(m.DELAI_RENVOI_S).toBe(60);
    expect(m.libelleRenvoi(42)).toBe("Renvoyer le code dans 42 s");
    expect(m.libelleRenvoi(0)).toBe("Renvoyer le code");
  });
});

test.describe("écran du site", () => {
  const f = lire("src/components/PhoneAuthForm.jsx");
  test("compte à rebours, bouton désactivé pendant l'attente, verrou contre les doubles envois", () => {
    expect(f).toContain("setAttente(DELAI_RENVOI_S)");
    expect(f).toMatch(/disabled=\{attente > 0 \|\| loading\}/);
    expect(f).toMatch(/if \(envoiEnCours\.current\) return;/);
    expect(f).toMatch(/envoiEnCours\.current = false;/);
    expect(f).toContain("MESSAGE_CODE_TARDE");
  });
  test("« Utiliser mon e-mail à la place » sur l'écran du code, et la page de connexion bascule vers l'onglet e-mail", () => {
    expect(f).toContain("LIBELLE_UTILISER_EMAIL");
    expect(f).toMatch(/\{onUseEmail && \(/);
    expect(lire("src/app/login/page.js")).toContain('onUseEmail={() => setAuthMethod("email")}');
  });
  test("grands boutons (hauteur minimale) pour le renvoi et l'e-mail", () => {
    expect(f.match(/min-h-14/g).length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("mêmes textes dans l'application (si présente sur cette branche)", () => {
  test("messagesCode.ts reprend exactement les phrases du site", async () => {
    const chemin = path.join(__dirname, "../../mobile/src/lib/messagesCode.ts");
    test.skip(!fs.existsSync(chemin), "l'application n'est pas à jour sur cette branche");
    const app = fs.readFileSync(chemin, "utf8");
    const m = await charger();
    for (const ph of [m.MESSAGE_CODE_INVALIDE, m.MESSAGE_CODE_EXPIRE, m.MESSAGE_CODE_TARDE, m.MESSAGE_TROP_DE_DEMANDES, m.MESSAGE_ENVOI_IMPOSSIBLE, m.MESSAGE_NUMERO_INCONNU, m.LIBELLE_RENVOYER, m.LIBELLE_UTILISER_EMAIL]) {
      expect(app, ph).toContain(ph);
    }
    expect(app).toMatch(/DELAI_RENVOI_S = 60/);
  });
});
