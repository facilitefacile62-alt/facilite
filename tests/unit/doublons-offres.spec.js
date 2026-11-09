const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Doublons d'offres : un doublon = même titre normalisé ET même ville ET même lien ou contact de candidature (renseigné des deux côtés).
 * Des postes du même recruteur sous le même titre avec des liens différents (Global Talent HR et ses liens Zoho) ne sont PAS des doublons.
 */
const lib = () => import("../../src/lib/doublonsOffres.js");
const ZOHO = "https://globaltalnt.zohorecruit.com/jobs/Careers";

// Les trois offres « 18 Électriciens » et les deux « 45 Coffreurs » relevées sur /offres le 09/11/2026 (liens de candidature réels, un lien par poste).
const A = { id: "53d0dccf", title: "Global Talent HR recrute 18 Électriciens (H/F)", company: "Global Talent HR", location: "Sénégal", external_link: `${ZOHO}/790352000004432064/45-Ferailleur-H-F?source=CareerSite` };
const B = { id: "7e2e1c98", title: "Global Talent HR recrute 18 Électriciens (H/F)", company: "Global Talent HR", location: "Sénégal", external_link: `${ZOHO}/790352000004432084/18-%C3%89lectriciens-H-F?source=CareerSite` };
const C = { id: "f68011de", title: "Global Talent HR recrute 18 Électriciens (H/F)", company: "Global Talent HR", location: "Sénégal", external_link: `${ZOHO}/790352000004432101/18-Soudeurs-H-F?source=CareerSite` };
const D = { id: "e5774b7d", title: "Global Talent HR recrute 45 Coffreurs (H/F)", company: "Global Talent HR", location: "Sénégal", external_link: `${ZOHO}/790352000004432084/18-%C3%89lectriciens-H-F?source=CareerSite` };
const E = { id: "6d12719a", title: "Global Talent HR recrute 45 Coffreurs (H/F)", company: "Global Talent HR", location: "Sénégal", external_link: `${ZOHO}/790352000004432050/45-Coffreurs-H-F?source=CareerSite` };

test("cas Global Talent HR : même recruteur, même titre, liens Zoho différents = PAS des doublons, aucun avertissement", async () => {
  const { sontDoublons, trouverDoublons } = await lib();
  expect(sontDoublons(A, B)).toBe(false);
  expect(sontDoublons(A, C)).toBe(false);
  expect(sontDoublons(B, C)).toBe(false);
  expect(sontDoublons(D, E)).toBe(false); // « 45 Coffreurs » deux fois, deux liens différents
  expect(trouverDoublons(B, [A, C, D, E])).toEqual([]); // publier une 3e offre « 18 Électriciens » avec un nouveau lien : rien à signaler
  expect(trouverDoublons({ ...A, id: "nouvelle", external_link: `${ZOHO}/790352000009999999/18-Electriciens-H-F` }, [A, B, C, D, E])).toEqual([]);
});

test("vrai doublon : même titre normalisé, même ville et même lien (paramètres, casse, accents, ponctuation et « / » final ignorés)", async () => {
  const { sontDoublons, trouverDoublons } = await lib();
  const copie = { id: "autre", title: "GLOBAL TALENT HR RECRUTE 18 ELECTRICIENS (H/F) !", location: "Sénégal", external_link: `${ZOHO.toUpperCase()}/790352000004432084/18-%C3%89LECTRICIENS-H-F/?source=Autre#haut`.replace("HTTPS", "https") };
  expect(sontDoublons(B, copie)).toBe(true);
  expect(trouverDoublons(copie, [A, B, C])).toEqual([B]);
  // Même lien mais sans le paramètre source ni le protocole.
  expect(sontDoublons(B, { ...B, id: "x", external_link: "www.globaltalnt.zohorecruit.com/jobs/Careers/790352000004432084/18-Électriciens-H-F" })).toBe(true);
});

test("la même offre n'est pas son propre doublon (identifiant ignoré)", async () => {
  const { trouverDoublons } = await lib();
  expect(trouverDoublons(B, [B])).toEqual([]);
});

test("les trois conditions sont nécessaires : titre différent, ville différente, ou lien différent = pas de doublon", async () => {
  const { sontDoublons } = await lib();
  const base = { id: "1", title: "Comptable", location: "Dakar, Sénégal", contact_email: "rh@exemple.sn" };
  expect(sontDoublons(base, { ...base, id: "2" })).toBe(true);
  expect(sontDoublons(base, { ...base, id: "2", title: "Comptable senior" })).toBe(false); // titre différent
  expect(sontDoublons(base, { ...base, id: "2", location: "Thiès, Sénégal" })).toBe(false); // ville différente
  expect(sontDoublons(base, { ...base, id: "2", contact_email: "autre@exemple.sn" })).toBe(false); // contact différent
  // Même lien mais titre différent : pas un doublon (cas D du relevé : le lien du poste « 18 Électriciens » sous le titre « 45 Coffreurs »).
  expect(sontDoublons(B, D)).toBe(false);
});

test("deux « Comptable » d'entreprises différentes à des villes ou contacts différents : aucun avertissement", async () => {
  const { sontDoublons } = await lib();
  const khelcom = { id: "d0568439", title: "Comptable", company: "KHELCOM BACHES SARL", location: "Pikine, Sénégal", contact_email: "rh-recrutement@khelcombache.com" };
  const didakikos = { id: "08aa732d", title: "Comptable", company: "DIDAKIKOS", location: "Dakar, Sénégal", contact_email: "RH@PREMIUMSARL.SN" };
  expect(sontDoublons(khelcom, didakikos)).toBe(false);
});

test("sans lien ni contact d'un côté (ou des deux) : on ne conclut pas, donc pas d'avertissement", async () => {
  const { sontDoublons, identifiantsCandidature } = await lib();
  const sans = { id: "1", title: "Chauffeur", location: "Dakar" };
  expect(sontDoublons(sans, { ...sans, id: "2" })).toBe(false);
  expect(sontDoublons(sans, { ...sans, id: "2", contact_email: "rh@exemple.sn" })).toBe(false);
  expect(identifiantsCandidature({})).toEqual([]);
  expect(identifiantsCandidature(null)).toEqual([]);
  expect(identifiantsCandidature({ external_link: "du texte avec des espaces", contact_email: "pas-une-adresse" })).toEqual([]);
});

test("contacts : même e-mail (casse ignorée, « mailto: » accepté), même WhatsApp ou téléphone = même candidature ; même ville requise", async () => {
  const { sontDoublons } = await lib();
  const a = { id: "1", title: "Agent de sécurité", location: "Dakar", contact_email: "RH@Exemple.sn" };
  expect(sontDoublons(a, { id: "2", title: "agent de securite", location: "Dakar, Sénégal", external_link: "mailto:rh@exemple.sn?subject=Candidature" })).toBe(true);
  expect(sontDoublons(a, { id: "2", title: "Agent de sécurité", location: "Dakar", application_email: "rh@exemple.sn" })).toBe(true);
  const b = { id: "3", title: "Livreur", location: "Dakar", contact_whatsapp: "+221 77 717 73 73" };
  expect(sontDoublons(b, { id: "4", title: "Livreur", location: "Dakar", contact_phone: "221777177373" })).toBe(true);
  expect(sontDoublons(b, { id: "4", title: "Livreur", location: "Dakar", contact_phone: "221770000000" })).toBe(false);
  expect(sontDoublons(null, b)).toBe(false);
});

test("l'incohérence titre / description n'est pas un critère ; le module ne touche à rien (aucune lecture ni écriture en base, aucune suppression)", () => {
  const code = fs.readFileSync(path.join(__dirname, "../../src/lib/doublonsOffres.js"), "utf8");
  expect(code).not.toMatch(/\bdescription\b\s*[:=.]|\.description/);
  expect(code).not.toMatch(/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(|fetch\(/);
});
