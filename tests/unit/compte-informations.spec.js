const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Informations du compte » : règles côté serveur, partagées par le site, Facilité et Locaux. Le service tourne ici sur une doublure en mémoire
 * (tests/helpers/compteFaux.mjs) qui reproduit l'authentification, le déclencheur de recopie vers profiles et les pannes.
 */
const service = () => import("../../src/lib/compte/service.js");
const regles = () => import("../../src/lib/compte/regles.js");
const faux = () => import("../helpers/compteFaux.mjs");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const ANCIEN = "2026-10-25T08:00:00Z"; // connexion de plus de 5 minutes : un code est exigé

async function preuve(env, canal = "email") {
  const s = await service();
  const e = await s.envoyerPreuve(env.ctx, { canal }, env.deps);
  if (e.dejaVerifie) return e.autorisation;
  const v = await s.verifierPreuve(env.ctx, { canal, code: env.dernierCode("preuve") }, env.deps);
  return v.autorisation;
}
async function changer(env, canal, valeur) {
  const s = await service();
  const aut = await preuve(env, canal);
  const d = await s.demanderChangement(env.ctx, { canal, valeur, autorisation: aut }, env.deps);
  return { aut, d };
}
const autreCode = (bon) => (bon === "111111" ? "222222" : "111111");

test.describe("masquage et normalisation", () => {
  test("téléphone et e-mail masqués comme demandé", async () => {
    const r = await regles();
    expect(r.masquerTelephone("221771234632")).toBe("+221*****632");
    expect(r.masquerTelephone("+221771234632")).toBe("+221*****632");
    expect(r.masquerEmail("marie@gmail.com")).toBe("m*****@gmail.com");
    expect(r.masquerEmail("")).toBe("");
  });
  test("numéros E.164, mobile sénégalais seulement", async () => {
    const r = await regles();
    expect(r.normaliserTelephone("77 123 45 67")).toBe("+221771234567");
    expect(r.normaliserTelephone("+221 77 123 45 67")).toBe("+221771234567");
    expect(r.normaliserTelephone("00221771234567")).toBe("+221771234567");
    expect(r.normaliserTelephone("33 823 12 34")).toBeNull(); // fixe : ne reçoit pas de SMS
    expect(r.normaliserTelephone("12345")).toBeNull();
    expect(r.normaliserTelephone("abc")).toBeNull();
    expect(r.normaliserEmail(" Marie@Gmail.com ")).toBe("marie@gmail.com");
    expect(r.normaliserEmail("pas une adresse")).toBeNull();
  });
});

test.describe("dernière méthode de connexion", () => {
  test("jamais retirer la dernière méthode vérifiée (téléphone seul, e-mail seul)", async () => {
    const r = await regles();
    const telSeul = { phone: "221771234632", phone_confirmed_at: "x", email: null, identities: [] };
    const emailSeul = { email: "a@b.sn", email_confirmed_at: "x", phone: null, identities: [] };
    expect(r.peutDissocier(telSeul, "telephone")).toEqual({ ok: false, raison: "derniere_methode" });
    expect(r.peutDissocier(emailSeul, "email")).toEqual({ ok: false, raison: "derniere_methode" });
  });
  test("une adresse non vérifiée ne compte pas comme méthode de connexion", async () => {
    const r = await regles();
    expect(r.peutDissocier({ phone: "221771234632", phone_confirmed_at: "x", email: "a@b.sn", email_confirmed_at: null }, "telephone").ok).toBe(false);
  });
  test("un compte Google ou Apple garde une méthode : on peut retirer le téléphone", async () => {
    const r = await regles();
    const google = { phone: "221771234632", phone_confirmed_at: "x", email: null, identities: [{ provider: "google" }, { provider: "phone" }] };
    expect(r.peutDissocier(google, "telephone").ok).toBe(true);
  });
  test("le message exact du refus, et rien ne bouge", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { email: null, email_confirmed_at: null, last_sign_in_at: ANCIEN } });
    const aut = await preuve(env, "telephone");
    const r = await s.dissocier(env.ctx, { canal: "telephone", autorisation: aut }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Ajoutez d'abord une adresse e-mail pour pouvoir retirer ce numéro.");
    expect(env.monde.utilisateur.phone).toBe("221771234632");
  });
});

test.describe("preuve récente obligatoire", () => {
  test("sans preuve, ni changement ni retrait", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde();
    const a = await s.demanderChangement(env.ctx, { canal: "email", valeur: "nouveau@gmail.com", autorisation: "x".repeat(43) }, env.deps);
    const b = await s.dissocier(env.ctx, { canal: "telephone", autorisation: "x".repeat(43) }, env.deps);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(env.monde.appelsAuth).toEqual([]);
    expect(env.monde.utilisateur.phone).toBe("221771234632");
  });
  test("connexion de moins de 5 minutes : aucun code envoyé", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: "2026-10-25T11:58:00Z" } });
    const r = await s.envoyerPreuve(env.ctx, { canal: "email" }, env.deps);
    expect(r.dejaVerifie).toBe(true);
    expect(env.monde.envois).toEqual([]);
  });
  test("connexion plus ancienne : un code part vers la méthode actuelle ; mauvais code refusé ; bon code accepté", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const e = await s.envoyerPreuve(env.ctx, { canal: "email" }, env.deps);
    expect(e.ok).toBe(true);
    expect(env.monde.envois[0].destination).toBe("marie@gmail.com");
    const mauvais = await s.verifierPreuve(env.ctx, { canal: "email", code: autreCode(env.dernierCode("preuve")) }, env.deps);
    expect(mauvais.ok).toBe(false);
    const bon = await s.verifierPreuve(env.ctx, { canal: "email", code: env.dernierCode("preuve") }, env.deps);
    expect(bon.ok).toBe(true);
    expect(typeof bon.autorisation).toBe("string");
  });
  test("le code expire après 10 minutes et l'autorisation aussi", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    await s.envoyerPreuve(env.ctx, { canal: "email" }, env.deps);
    env.avancer(10 * 60 * 1000 + 1000);
    const r = await s.verifierPreuve(env.ctx, { canal: "email", code: env.dernierCode("preuve") }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("code_expire");
    const env2 = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const aut = await preuve(env2);
    env2.avancer(10 * 60 * 1000 + 1000);
    const d = await s.demanderChangement(env2.ctx, { canal: "email", valeur: "nouveau@gmail.com", autorisation: aut }, env2.deps);
    expect(d.code).toBe("autorisation_invalide");
  });
  test("5 essais maximum par code : le bon code ne passe plus ensuite", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    await s.envoyerPreuve(env.ctx, { canal: "email" }, env.deps);
    const bon = env.dernierCode("preuve");
    for (let i = 0; i < 5; i++) await s.verifierPreuve(env.ctx, { canal: "email", code: autreCode(bon) }, env.deps);
    const r = await s.verifierPreuve(env.ctx, { canal: "email", code: bon }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("trop_d_essais");
  });
  test("une autorisation inventée ou d'un autre compte est refusée", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    await preuve(env);
    const r = await s.dissocier({ ...env.ctx, userId: "autre" }, { canal: "telephone", autorisation: "inventee".repeat(6) }, env.deps);
    expect(r.ok).toBe(false);
  });
});

test.describe("changement : la nouvelle valeur est confirmée avant tout changement", () => {
  test("rien ne change tant que le code de la nouvelle adresse n'est pas confirmé", async () => {
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { d } = await changer(env, "email", "Nouveau@Gmail.com");
    expect(d.ok).toBe(true);
    expect(d.envoyeA).toBe("n*****@gmail.com");
    expect(env.monde.utilisateur.email).toBe("marie@gmail.com");
    expect(env.monde.appelsAuth).toEqual([]);
  });
  test("le code va à la NOUVELLE adresse ; après confirmation : auth ET profil changés, alerte à l'ANCIENNE adresse, autres sessions fermées", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { aut } = await changer(env, "email", "nouveau@gmail.com");
    expect(env.monde.envois.at(-1).destination).toBe("nouveau@gmail.com");
    const r = await s.confirmerChangement(env.ctx, { canal: "email", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
    expect(r.ok).toBe(true);
    expect(r.message).toBe("Votre adresse e-mail a été changée.");
    expect(env.monde.utilisateur.email).toBe("nouveau@gmail.com");
    expect(env.monde.profil.email).toBe("nouveau@gmail.com");
    expect(env.monde.alertes).toEqual([{ destination: "marie@gmail.com", action: "changer", canal: "email" }]);
    expect(env.monde.sessionsFermees).toBe(1);
    expect(r.etat.email).toBe("n*****@gmail.com");
  });
  test("un mauvais code ne change rien", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { aut } = await changer(env, "email", "nouveau@gmail.com");
    const r = await s.confirmerChangement(env.ctx, { canal: "email", code: autreCode(env.dernierCode("nouvelle_valeur")), autorisation: aut }, env.deps);
    expect(r.ok).toBe(false);
    expect(env.monde.utilisateur.email).toBe("marie@gmail.com");
    expect(env.monde.appelsAuth).toEqual([]);
  });
  test("l'autorisation sert une seule fois", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { aut } = await changer(env, "email", "nouveau@gmail.com");
    await s.confirmerChangement(env.ctx, { canal: "email", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
    const encore = await s.demanderChangement(env.ctx, { canal: "email", valeur: "autre@gmail.com", autorisation: aut }, env.deps);
    expect(encore.ok).toBe(false);
  });
  test("valeur déjà utilisée : message neutre, aucun code envoyé", async () => {
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { d } = await changer(env, "email", "pris@gmail.com");
    expect(d.ok).toBe(false);
    expect(d.message).toBe("Impossible d'utiliser cette adresse. Essayez-en une autre.");
    expect(env.monde.envois.filter((e) => e.but === "nouvelle_valeur")).toEqual([]);
    const tel = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const t = await changer(tel, "telephone", "78 111 22 33");
    expect(t.d.message).toBe("Impossible d'utiliser ce numéro. Essayez-en un autre.");
  });
  test("valeur invalide ou identique refusée", async () => {
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    expect((await changer(env, "email", "pas une adresse")).d.code).toBe("valeur_invalide");
    expect((await changer(env, "email", "MARIE@gmail.com")).d.code).toBe("identique");
  });
  test("au plus 3 changements réussis par 24 heures", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: "2026-10-25T11:59:00Z" } });
    for (let i = 1; i <= 3; i++) {
      const aut = await preuve(env);
      const d = await s.demanderChangement(env.ctx, { canal: "email", valeur: `n${i}@gmail.com`, autorisation: aut }, env.deps);
      expect(d.ok).toBe(true);
      const c = await s.confirmerChangement(env.ctx, { canal: "email", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
      expect(c.ok).toBe(true);
      env.avancer(1000);
    }
    const aut = await preuve(env);
    const quatrieme = await s.demanderChangement(env.ctx, { canal: "email", valeur: "n4@gmail.com", autorisation: aut }, env.deps);
    expect(quatrieme.code).toBe("limite_changements");
  });
  test("limite d'envois de codes par heure et par personne", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await s.envoyerPreuve(env.ctx, { canal: "email" }, env.deps));
    expect(r.slice(0, 3).every((x) => x.ok)).toBe(true);
    expect(r[3].ok).toBe(false);
    expect(r[3].code).toBe("trop_de_demandes");
  });
  test("limite d'envois par adresse IP, même si la limite par personne est contournée", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const base = env.deps.limiter;
    let i = 0;
    const deps = { ...env.deps, limiter: (cle, max, f) => base(cle.startsWith("compte:envoi:u:") ? `${cle}:${i}` : cle, max, f) };
    let refus = 0;
    for (; i < 12; i++) {
      const r = await s.envoyerPreuve(env.ctx, { canal: "email" }, deps);
      if (!r.ok && r.code === "trop_de_demandes") refus++;
    }
    expect(refus).toBe(2);
  });
});

test.describe("on ne dit « changé » ou « retiré » qu'après avoir relu le compte", () => {
  test("changement accepté par l'API mais sans effet : « Impossible pour le moment », échec journalisé", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN }, options: { sansEffetAuth: true } });
    const { aut } = await changer(env, "email", "nouveau@gmail.com");
    const r = await s.confirmerChangement(env.ctx, { canal: "email", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^Impossible pour le moment/);
    expect(env.monde.alertes).toEqual([]);
    const j = env.monde.tables.compte_journal_securite.find((l) => l.type === "changement_echec");
    expect(j).toMatchObject({ resultat: "echec", detail: "sans_effet_auth" });
  });
  test("auth changé mais profil non synchronisé : la copie est réparée puis relue", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN }, options: { sansSyncProfil: true } });
    const { aut } = await changer(env, "email", "nouveau@gmail.com");
    const r = await s.confirmerChangement(env.ctx, { canal: "email", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
    expect(r.ok).toBe(true);
    expect(env.monde.profil.email).toBe("nouveau@gmail.com");
  });
  test("dissociation refusée (« Manual linking is disabled ») : « Impossible pour le moment », rien ne bouge, échec journalisé", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN }, options: { refuseDissociation: true } });
    const aut = await preuve(env, "telephone");
    const r = await s.dissocier(env.ctx, { canal: "telephone", autorisation: aut }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^Impossible pour le moment/);
    expect(env.monde.utilisateur.phone).toBe("221771234632");
    expect(env.monde.tables.compte_journal_securite.some((l) => l.type === "dissociation_echec" && l.resultat === "echec")).toBe(true);
    expect(env.monde.alertes).toEqual([]);
  });
  test("dissociation acceptée sans effet : jamais « retiré »", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN }, options: { dissociationSansEffet: true } });
    const aut = await preuve(env, "telephone");
    const r = await s.dissocier(env.ctx, { canal: "telephone", autorisation: aut }, env.deps);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^Impossible pour le moment/);
    expect(env.monde.tables.compte_journal_securite.find((l) => l.type === "dissociation_echec").detail).toBe("sans_effet_auth");
  });
  test("dissociation réussie : relue côté auth ET profil, alerte, autres sessions fermées", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const aut = await preuve(env, "telephone");
    const r = await s.dissocier(env.ctx, { canal: "telephone", autorisation: aut }, env.deps);
    expect(r.ok).toBe(true);
    expect(r.message).toBe("Votre numéro a été retiré.");
    expect(env.monde.utilisateur.phone).toBeNull();
    expect(env.monde.profil.phone).toBeNull();
    expect(r.etat.telephone).toBeNull();
    expect(env.monde.alertes[0]).toMatchObject({ destination: "marie@gmail.com", action: "dissocier", canal: "telephone" });
    expect(env.monde.sessionsFermees).toBe(1);
  });
});

test.describe("téléphone derrière le drapeau", () => {
  test("drapeau fermé : toutes les actions téléphone refusées, l'e-mail fonctionne", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN }, options: { telephoneActif: false } });
    const reponses = [
      await s.envoyerPreuve(env.ctx, { canal: "telephone" }, env.deps),
      await s.verifierPreuve(env.ctx, { canal: "telephone", code: "123456" }, env.deps),
      await s.demanderChangement(env.ctx, { canal: "telephone", valeur: "77 123 45 67", autorisation: "x".repeat(43) }, env.deps),
      await s.confirmerChangement(env.ctx, { canal: "telephone", code: "123456", autorisation: "x".repeat(43) }, env.deps),
      await s.dissocier(env.ctx, { canal: "telephone", autorisation: "x".repeat(43) }, env.deps),
    ];
    for (const r of reponses) {
      expect(r.ok).toBe(false);
      expect(r.code).toBe("telephone_indisponible");
    }
    expect(env.monde.envois).toEqual([]);
    expect((await changer(env, "email", "nouveau@gmail.com")).d.ok).toBe(true);
    const etat = await s.lireEtat(env.ctx, env.deps);
    expect(etat.etat.telephoneActif).toBe(false);
  });
  test("drapeau ouvert : changer le numéro de bout en bout", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    const { aut, d } = await changer(env, "telephone", "76 555 44 33");
    expect(d.ok).toBe(true);
    expect(env.monde.envois.at(-1).destination).toBe("+221765554433");
    const r = await s.confirmerChangement(env.ctx, { canal: "telephone", code: env.dernierCode("nouvelle_valeur"), autorisation: aut }, env.deps);
    expect(r.ok).toBe(true);
    expect(env.monde.utilisateur.phone).toBe("221765554433");
    expect(env.monde.profil.phone).toBe("221765554433");
  });
});

test.describe("état affiché et même résultat partout", () => {
  test("l'état ne contient que des valeurs masquées", async () => {
    const s = await service();
    const { creerMonde } = await faux();
    const env = creerMonde();
    const { etat } = await s.lireEtat(env.ctx, env.deps);
    expect(etat.email).toBe("m*****@gmail.com");
    expect(etat.telephone).toBe("+221*****632");
    expect(JSON.stringify(etat)).not.toContain("marie@gmail.com");
    expect(JSON.stringify(etat)).not.toContain("771234632");
  });
  test("le service ne connaît pas l'application appelante : mêmes résultats pour site, Facilité et Locaux", async () => {
    const { creerMonde } = await faux();
    const resultats = [];
    for (const appareil of ["Site web", "Facilité (Android)", "Locaux (Android)"]) {
      const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
      const { d } = await changer({ ...env, ctx: { ...env.ctx, appareil } }, "email", "pris@gmail.com");
      resultats.push(JSON.stringify(d));
    }
    expect(new Set(resultats).size).toBe(1);
    expect(lire("src/lib/compte/service.js")).not.toMatch(/ctx\.appareil\s*[=!]=|mobile|locaux/i);
  });
  test("le journal ne garde jamais l'adresse IP en clair", async () => {
    const { creerMonde } = await faux();
    const env = creerMonde({ utilisateur: { last_sign_in_at: ANCIEN } });
    await changer(env, "email", "pris@gmail.com");
    const brut = JSON.stringify(env.monde.tables.compte_journal_securite);
    expect(brut).not.toContain("1.2.3.4");
    expect(env.monde.tables.compte_journal_securite.length).toBeGreaterThan(0);
    expect(env.monde.tables.compte_journal_securite.every((l) => /^[0-9a-f]{32}$/.test(l.ip_hash))).toBe(true);
  });
});

test.describe("mêmes phrases partout", () => {
  test("le site et l'application (branche fil-audio, si présente) affichent les mêmes textes", async () => {
    const web = lire("src/app/informations-compte/InformationsCompte.jsx");
    const { MESSAGE_SUPPORT_PERDU } = await import("../../src/lib/compte/messages.js");
    const appFichier = path.join(__dirname, "../../mobile/src/lib/compteApi.ts");
    test.skip(!fs.existsSync(appFichier), "l'application n'est pas sur cette branche");
    const app = fs.readFileSync(appFichier, "utf8");
    const phrases = [
      "Cette adresse sert à vous connecter et à protéger votre compte. Personne d'autre ne la voit.",
      "Ce numéro sert à vous connecter et à protéger votre compte. Personne d'autre ne le voit.",
      "Changer de téléphone",
      "Dissocier le téléphone",
      "Dissocier l'e-mail",
      "Changer d'adresse e-mail",
    ];
    for (const ph of phrases) {
      expect(web, ph).toContain(ph);
      expect(app, ph).toContain(ph);
    }
    // Le site importe le texte « Je n'ai plus accès » de messages.js ; l'application le recopie : il doit rester identique.
    expect(web).toContain("MESSAGE_SUPPORT_PERDU");
    for (const ph of [MESSAGE_SUPPORT_PERDU.titre, MESSAGE_SUPPORT_PERDU.phrase, ...MESSAGE_SUPPORT_PERDU.informations]) expect(app, ph).toContain(ph);
  });
});

test.describe("aucune écriture directe depuis un client", () => {
  test("les écrans (site et application) n'écrivent jamais e-mail ou téléphone dans une table ni via updateUser", async () => {
    const fichiers = ["src/app/informations-compte/InformationsCompte.jsx", "mobile/src/lib/compteApi.ts", "mobile/src/components/EcranInformationsCompte.tsx"].filter((f) =>
      fs.existsSync(path.join(__dirname, "../..", f))
    );
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const t = lire(f);
      expect(t, f).not.toMatch(/updateUser\s*\(/);
      expect(t, f).not.toMatch(/unlinkIdentity\s*\(/);
      expect(t, f).not.toMatch(/from\(\s*['"]profiles['"]\s*\)\s*\.(update|upsert|insert)/);
    }
  });
  test("« Sécurité & Connexion » ne change plus ni e-mail ni téléphone et ne dissocie plus rien : lien vers l'écran unique", async () => {
    const t = lire("src/components/SecurityTabContent.jsx");
    expect(t).not.toMatch(/updateUser\s*\(\s*\{\s*(phone|email)/);
    expect(t).not.toMatch(/unlinkIdentity\s*\(/);
    expect(t).not.toMatch(/type:\s*["'](phone_change|email_change)["']/);
    expect(t).toContain('href="/informations-compte"');
  });
  test("le client n'a aucun droit sur les tables des codes et du journal (migration)", async () => {
    const m = lire("supabase/migrations/20261025190000_informations_compte.sql");
    expect(m).toMatch(/REVOKE ALL ON public\.compte_verifications FROM PUBLIC, anon, authenticated/);
    expect(m).toMatch(/GRANT SELECT ON public\.compte_journal_securite TO authenticated/);
    expect(m).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*compte_/i);
    expect(m).toMatch(/REVOKE ALL ON FUNCTION public\.compte_dissocier_methode\(UUID, TEXT\) FROM PUBLIC, anon, authenticated/);
  });
  test("chaque route /api/compte exige une session", async () => {
    const dossier = path.join(__dirname, "../../src/app/api/compte");
    const routes = [];
    const parcourir = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? parcourir(path.join(d, e.name)) : e.name === "route.js" && routes.push(path.join(d, e.name))));
    parcourir(dossier);
    expect(routes.length).toBe(7);
    for (const r of routes) expect(fs.readFileSync(r, "utf8"), r).toMatch(/requireUser\(req/);
  });
});
