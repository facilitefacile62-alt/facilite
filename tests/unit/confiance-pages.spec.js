const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Pages de confiance : conseils anti-arnaque, contact, signalement d'une offre (table public.reports, sans migration), contrat « non précisé ».
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const contrat = () => import("../../src/lib/contratOffre.js");
const signal = () => import("../../src/lib/signalementOffre.js");
const coord = () => import("../../src/lib/contactFacilite.js");

const UUID = "86f77a29-8d77-4253-bbb9-4012ca8732ae";

// ---------- 4. Contrat ----------

test("contrat : vide, absent ou « Non spécifié » s'affichent « Contrat non précisé » ; un contrat renseigné est affiché tel quel", async () => {
  const { libelleContrat, contratEstPrecise, CONTRAT_NON_PRECISE } = await contrat();
  expect(CONTRAT_NON_PRECISE).toBe("Contrat non précisé");
  for (const v of [undefined, null, "", "   ", "Non spécifié", "non specifie", "NON SPÉCIFIÉ", "Non spécifiée", "Contrat non précisé", 42, {}]) {
    expect(libelleContrat(v), String(v)).toBe("Contrat non précisé");
    expect(contratEstPrecise(v), String(v)).toBe(false);
  }
  for (const v of ["CDI", "CDD", "Stage", "Plein Temps", "CDI / Plein temps", "Contrat d'essai suivi d'un CDD"]) {
    expect(libelleContrat(v), v).toBe(v);
    expect(contratEstPrecise(v), v).toBe(true);
  }
  expect(libelleContrat("  CDD  ")).toBe("CDD");
});

test("contrat affiché partout où il l'était (fiche, liste, accueil, recherche, suggestions, partage) ; aucun « CDI » supposé ni « Non spécifié » n'y reste", () => {
  const attendus = {
    "src/app/offres/[id]/OffreDetailClient.js": "libelleContrat(offer.contract_type)",
    "src/app/offres/OffresClient.jsx": "libelleContrat(offer.contract_type)",
    "src/app/recherche/page.js": "libelleContrat(offer.contract_type)",
    "src/app/page.js": "contract: libelleContrat(offer.contract_type),",
    "src/app/HomeClient.jsx": "contract: libelleContrat(offer.contract_type),",
    "src/components/Header.jsx": "libelleContrat(off.contract_type)",
    "src/components/SocialShareButtons.jsx": "libelleContrat(offer?.contract || offer?.contract_type)",
  };
  for (const [f, a] of Object.entries(attendus)) {
    const code = lire(f);
    expect(code, f).toContain(a);
    expect(code, f).toContain("@/lib/contratOffre");
    // (La fiche garde « CDI » comme valeur par défaut du FORMULAIRE de modification : c'est une donnée saisie, pas un affichage.)
    const sansFormulaire = f.endsWith("OffreDetailClient.js") ? code.replace(/(?:initialOffer|offer)\.contract_type \|\| "CDI"/g, "") : code;
    expect(sansFormulaire, f).not.toMatch(/contract(?:_type)?\s*\|\|\s*"(?:CDI|Non spécifié)"/);
  }
  // Cartes de l'accueil déjà en cache dans le navigateur (ancienne valeur « Non spécifié ») : le libellé est appliqué aussi à l'affichage.
  expect(lire("src/app/HomeClient.jsx")).toContain("libelleContrat(job.contract)");
  // La donnée n'est pas modifiée : le formulaire de modification garde la valeur enregistrée.
  expect(lire("src/app/offres/[id]/OffreDetailClient.js")).toContain("contract_type: contractType,");
});

// ---------- 3. Signalement ----------

test("signalement : cinq motifs (arnaque, demande d'argent, offre inexistante, doublon, autre) et un texte enregistré dans reports.reason", async () => {
  const { MOTIFS_SIGNALEMENT_OFFRE, construireRaison } = await signal();
  expect(MOTIFS_SIGNALEMENT_OFFRE.map((m) => m.id)).toEqual(["arnaque", "demande_argent", "offre_inexistante", "doublon", "autre"]);
  expect(construireRaison("arnaque")).toBe("[arnaque] Arnaque ou fausse offre");
  expect(construireRaison("doublon", "  Même offre\n publiée  deux fois ")).toBe("[doublon] Offre en double — Même offre publiée deux fois");
  expect(construireRaison("inconnu")).toBeNull();
  expect(construireRaison("autre", "x".repeat(900)).length).toBeLessThan(560);
});

test("ligne insérée dans public.reports : target_type « job_offer », compte connecté, offre à identifiant UUID ; sinon rien", async () => {
  const { ligneSignalement, offreSignalable } = await signal();
  const ok = ligneSignalement({ reporterId: "u1", offreId: UUID, motifId: "demande_argent", precisions: "On m'a demandé 5000 francs" });
  expect(ok).toEqual({ reporter_id: "u1", target_type: "job_offer", target_id: UUID, reason: "[demande_argent] On me demande de l'argent — On m'a demandé 5000 francs" });
  expect(Object.keys(ok).sort()).toEqual(["reason", "reporter_id", "target_id", "target_type"]); // seules les colonnes autorisées en insertion
  for (const mauvais of [
    { reporterId: "", offreId: UUID, motifId: "arnaque" },
    { reporterId: "u1", offreId: "1", motifId: "arnaque" }, // offre d'exemple à identifiant numérique
    { reporterId: "u1", offreId: "pas-un-uuid", motifId: "arnaque" },
    { reporterId: "u1", offreId: UUID, motifId: "" },
    { reporterId: "u1", offreId: UUID, motifId: "nimporte" },
    undefined,
  ]) {
    expect(ligneSignalement(mauvais)).toBeNull();
  }
  expect(offreSignalable(UUID)).toBe(true);
  expect(offreSignalable("100")).toBe(false);
});

test("envoi : une seule insertion dans « reports », rien d'autre ; erreur ou refus de la base : échec neutre, sans exception", async () => {
  const { envoyerSignalementOffre } = await signal();
  const appels = [];
  const faux = (reponse) => ({ from: (t) => ({ insert: (l) => { appels.push([t, l]); return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse); } }) });
  const donnees = { reporterId: "u1", offreId: UUID, motifId: "arnaque" };
  expect(await envoyerSignalementOffre(faux({ error: null }), donnees)).toEqual({ ok: true });
  expect(appels).toHaveLength(1);
  expect(appels[0][0]).toBe("reports");
  expect(appels[0][1].target_type).toBe("job_offer");
  expect(await envoyerSignalementOffre(faux({ error: { message: "permission denied" } }), donnees)).toEqual({ ok: false, raison: "erreur" });
  expect(await envoyerSignalementOffre(faux(new Error("réseau")), donnees)).toEqual({ ok: false, raison: "erreur" });
  appels.length = 0;
  expect(await envoyerSignalementOffre(faux({ error: null }), { ...donnees, offreId: "3" })).toEqual({ ok: false, raison: "donnees_invalides" });
  expect(appels).toHaveLength(0);
});

test("bouton « Signaler cette offre » : visiteur renvoyé vers la connexion puis vers la fiche, message neutre, absent pour le propriétaire", async () => {
  const c = lire("src/components/SignalerOffre.jsx");
  expect(c).toContain("Signaler cette offre");
  expect(c).toContain("router.push(`/login?redirect=${encodeURIComponent(`/offres/${offreId}`)}`)");
  expect(c).toContain("MESSAGE_CONFIRMATION_SIGNALEMENT");
  expect(c).toContain("if (!offreSignalable(offreId)) return null;");
  const { MESSAGE_CONFIRMATION_SIGNALEMENT } = await signal();
  expect(MESSAGE_CONFIRMATION_SIGNALEMENT).toBe("Merci. Votre signalement a été transmis à l'équipe, qui l'examinera.");
  expect(MESSAGE_CONFIRMATION_SIGNALEMENT).not.toMatch(/arnaque|fraude|escroc|coupable/i);
  const fiche = lire("src/app/offres/[id]/OffreDetailClient.js");
  expect(fiche).toContain("{!canManage && <SignalerOffre offreId={offer.id} />}");
  // Aucune écriture hors de la bibliothèque dédiée, et aucune migration ajoutée par cette étape.
  expect(c).not.toMatch(/\.from\(|\.insert\(|\.rpc\(/);
  expect(lire("src/lib/signalementOffre.js").match(/\.from\("([a-z_]+)"\)/g)).toEqual(['.from("reports")']);
});

// ---------- 2. Contact ----------

test("page Contact : seulement des coordonnées déjà publiées (WhatsApp d'assistance, e-mail des pages légales), jamais inventées ; trois informations « à compléter » marquées", async () => {
  const { FACILITE_WHATSAPP_NUMBER, FACILITE_WHATSAPP_DISPLAY, FACILITE_EMAIL_CONTACT } = await coord();
  // Mêmes valeurs que celles déjà publiées ailleurs sur le site.
  expect(lire("src/app/faq/page.js")).toContain(FACILITE_WHATSAPP_DISPLAY);
  expect(lire("src/app/aide-candidature/page.js")).toContain(FACILITE_WHATSAPP_DISPLAY);
  expect(lire("src/app/conditions/page.js")).toContain(FACILITE_EMAIL_CONTACT);
  expect(lire("src/app/confidentialite/page.js")).toContain(FACILITE_EMAIL_CONTACT);
  expect(FACILITE_WHATSAPP_NUMBER).toBe(FACILITE_WHATSAPP_DISPLAY.replace(/\D/g, ""));
  const page = lire("src/app/contact/page.js");
  expect(page).toContain("FACILITE_WHATSAPP_DISPLAY");
  expect(page).toContain("FACILITE_EMAIL_CONTACT");
  // Aucun numéro ni adresse écrits en dur dans la page : tout vient de la bibliothèque.
  expect(page).not.toMatch(/\+?\d[\d ]{8,}\d/);
  expect(page).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  // Trois informations de l'éditeur laissées « à compléter », visiblement marquées.
  expect(page.match(/<AComplete>/g)).toHaveLength(3);
  expect(page).toContain("[À COMPLÉTER : {children}]");
  expect(page).toContain("data-a-completer");
  for (const lien of ["/messagerie", "/faq", "/aide-candidature", "/conseils/anti-arnaque", "/conditions", "/confidentialite"]) expect(page).toContain(`"${lien}"`);
  // Le numéro WhatsApp réexporté par whatsappHelp.js reste le même.
  const w = lire("src/lib/whatsappHelp.js");
  expect(w).toContain('from "./contactFacilite.js"');
  expect(w).not.toContain('"221771400832"');
});

// ---------- 1. Conseils anti-arnaque ----------

test("page anti-arnaque : les cinq thèmes demandés, aucune donnée personnelle, aucune promesse sur les offres du site", () => {
  const p = lire("src/app/conseils/anti-arnaque/page.js");
  for (const t of [
    "Ne payez jamais pour postuler",
    "adresses personnelles et des liens raccourcis",
    "code reçu par SMS ni d&apos;informations bancaires",
    "Comment reconnaître une fausse offre",
    "Que faire en cas de doute ou d&apos;arnaque",
    "Signaler cette offre",
  ]) expect(p, t).toContain(t);
  expect(p).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  expect(p).not.toMatch(/\+?\d[\d ]{8,}\d/);
  expect(p).not.toMatch(/Facilité (?:vérifie|garantit)|toutes nos offres/i);
  expect(p).toContain('href="/contact"');
  expect(p).toContain("alternates: { canonical: URL_PAGE }");
});

test("accès et visibilité : /contact public pour les visiteurs, /conseils/anti-arnaque couvert par /conseils, plan du site, pied de page et index des conseils", () => {
  const proxy = lire("src/proxy.js");
  expect(proxy).toMatch(/PUBLIC_ROUTES = \[[\s\S]*?"\/contact",[\s\S]*?\];/);
  expect(proxy).toContain('"/conseils",');
  expect("/conseils/anti-arnaque".startsWith("/conseils/")).toBe(true);
  const sitemap = lire("src/app/sitemap.js");
  expect(sitemap).toContain('{ path: "/contact"');
  expect(sitemap).toContain('{ path: "/conseils/anti-arnaque"');
  const pied = lire("src/components/Footer.jsx");
  expect(pied).toContain('href="/conseils/anti-arnaque"');
  expect(pied).toContain("Conseils anti-arnaque");
  expect(pied).toContain('href="/contact"');
  expect(lire("src/app/conseils/page.js")).toContain('href="/conseils/anti-arnaque"');
});
