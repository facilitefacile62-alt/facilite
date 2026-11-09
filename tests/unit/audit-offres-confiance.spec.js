const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Confiance des fiches d'offres (suite de l'audit du 09/11/2026) :
 *  1. les offres statiques de secours (ids « 1 » à « 7 », « 100 »…) ne sont plus servies en production et ne portent jamais « recruteur vérifié » ;
 *  2. prudence neutre sur un contact externe (e-mail personnel, WhatsApp, lien raccourci, formulaire externe), jamais pour un recruteur vérifié ;
 *  3. JobPosting : directApply vrai seulement si la candidature se fait dans Facilité, validThrough seulement s'il y a une date limite ;
 *  4. résidus de copie (« [cite: 13] ») retirés à l'affichage, dans les données structurées et à la publication.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const secours = () => import("../../src/lib/offresSecours.js");
const contact = () => import("../../src/lib/contactExterne.js");
const nettoyage = () => import("../../src/lib/nettoyerTexteOffre.js");
const referencement = () => import("../../src/lib/offreReferencement.js");

// ---------- 1. Offres de secours ----------

const EXEMPLES = ["1", "2", "3", "4", "5", "7", "100"];

test("production : seules les offres d'EXEMPLE répondent 404 ; toute autre offre codée en dur reste servie (aucune offre réelle ou récente masquée)", async () => {
  const { trouverOffreSecours, estOffreExemple, OFFRES_SECOURS, IDS_EXEMPLES } = await secours();
  expect([...IDS_EXEMPLES]).toEqual(EXEMPLES);
  for (const id of EXEMPLES) {
    expect(estOffreExemple(id), id).toBe(true);
    expect(trouverOffreSecours(id, "production"), `${id} en production`).toBeNull();
    expect(trouverOffreSecours(id, "development"), `${id} en développement`).not.toBeNull();
    expect(trouverOffreSecours(id, "test"), `${id} en test`).not.toBeNull();
  }
  const autres = Object.keys(OFFRES_SECOURS).filter((id) => !EXEMPLES.includes(id));
  expect(autres.length).toBe(Object.keys(OFFRES_SECOURS).length - EXEMPLES.length);
  expect(autres).toEqual(expect.arrayContaining(["9b125270-1234-4567-89ab-cdef25272026", "6", "101", "102", "77177373-1111-4444-8888-000000000001"]));
  for (const id of autres) {
    for (const env of ["production", "development", "test"]) {
      const o = trouverOffreSecours(id, env);
      expect(o, `${id} (${env})`).not.toBeNull();
      expect(o.title, id).toBe(OFFRES_SECOURS[id].title);
      expect(o.deadline, id).toBe(OFFRES_SECOURS[id].deadline); // état réel : la date limite d'origine, jamais modifiée
    }
  }
  // Insensible à la casse pour les UUID.
  expect(trouverOffreSecours("9B125270-1234-4567-89AB-CDEF25272026", "production")).not.toBeNull();
  expect(trouverOffreSecours("inconnu", "production")).toBeNull();
  expect(trouverOffreSecours("", "production")).toBeNull();
});

test("aucune offre de secours ne porte « recruteur vérifié » : trouverOffreSecours force recruiterVerified à false, et le code n'écrit plus true", async () => {
  const { trouverOffreSecours, OFFRES_SECOURS } = await secours();
  for (const id of Object.keys(OFFRES_SECOURS)) {
    expect(trouverOffreSecours(id, "test").recruiterVerified, id).toBe(false);
    expect(OFFRES_SECOURS[id].recruiterVerified, id).toBeUndefined();
  }
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).not.toMatch(/recruiterVerified:\s*true/);
  expect(page).not.toContain("FALLBACK_STATIC_OFFERS");
  expect(page).toContain("const secours = trouverOffreSecours(strId);");
  expect(lire("src/lib/offresSecours.js")).not.toMatch(/recruiterVerified:\s*true/);
});

test("plan du site : inchangé par rapport à avant (l'offre de secours reste soumise à sa seule date limite)", () => {
  const s = lire("src/app/sitemap.js");
  expect(s).not.toContain("offresSecours");
  expect(s).toContain("if (!knownOfferIds.has(OFFRE_SECOURS.id) && !offreHorsReferencement({ deadline: OFFRE_SECOURS.deadline })) {");
  const [, id, limite] = /OFFRE_SECOURS = \{ id: "([^"]+)", deadline: "([^"]+)" \}/.exec(s);
  const bloc = lire("src/lib/offresSecours.js");
  const debut = bloc.slice(bloc.indexOf(`"${id}": {`));
  expect(/deadline: "([^"]+)"/.exec(debut)[1]).toBe(limite);
});

test("changement de la règle « +60 jours » : aucune offre visible n'est retirée de la liste ni du plan du site ; seule la déclaration validThrough change", async () => {
  const ref = await referencement();
  const maintenant = Date.parse("2026-11-09T12:00:00.000Z");
  const jour = (n) => new Date(maintenant + n * 86400000).toISOString();
  const offres = [
    { id: "a", created_at: jour(-3), is_active: true, status: "approved" }, // récente, sans date limite
    { id: "b", created_at: jour(-30), is_active: true, status: "approved" }, // 30 jours, sans date limite
    { id: "c", created_at: jour(-59), is_active: true, status: "approved" }, // 59 jours, sans date limite
    { id: "d", created_at: jour(-3), deadline: new Date(maintenant + 5 * 86400000).toISOString().slice(0, 10), is_active: true, status: "approved" },
  ];
  for (const o of offres) {
    expect(ref.offreHorsReferencement(o, maintenant), `${o.id} reste dans le plan du site`).toBe(false);
    expect(ref.offreCloturee(o), `${o.id} reste affichée comme ouverte`).toBe(false);
  }
  // La règle de sortie du référencement garde sa fin « publication + 60 jours » : une offre de 61 jours sans date limite en sort, comme avant.
  expect(ref.offreHorsReferencement({ id: "e", created_at: jour(-61), is_active: true, status: "approved" }, maintenant)).toBe(true);
  // Seul validThrough (déclaré à Google) n'est plus inventé.
  for (const o of offres.slice(0, 3)) expect(ref.validThroughIso(o)).toBeUndefined();
  expect(ref.validThroughIso(offres[3])).toBeDefined();
  // Les fonctions qui décident de la visibilité n'ont pas été modifiées par cette étape.
  const src = lire("src/lib/offreReferencement.js");
  expect(src).toContain("export function offreHorsReferencement(offre, maintenant = Date.now()) {");
  expect(src).toContain("return fin ? fin.getTime() < maintenant : false;");
  expect(lire("src/app/sitemap.js")).toContain("if (offreHorsReferencement(offer)) continue;");
});

// ---------- 2. Contact externe ----------

test("e-mail personnel : gmail, yahoo, hotmail, outlook, live, icloud… sont signalés ; une adresse d'entreprise ou officielle ne l'est pas", async () => {
  const { contactExterneNonVerifie, estCourrielPersonnel } = await contact();
  for (const mail of [
    "walykebe@gmail.com", "Afrimoovsn@GMAIL.COM", "x@googlemail.com", "maaguysarr@hotmail.com", "a@hotmail.fr", "a@yahoo.fr", "a@yahoo.com", "a@ymail.com",
    "a@outlook.com", "a@outlook.fr", "a@live.fr", "a@msn.com", "a@icloud.com", "a@protonmail.com", "a@proton.me", "a@gmx.net", "a@free.fr", "a@orange.fr",
    "mailto:contact@gmail.com?subject=Candidature", " rh@gmail.com ",
  ]) {
    expect(estCourrielPersonnel(mail), mail).toBe(true);
    expect(contactExterneNonVerifie({ contact_email: mail }).motifs, mail).toContain("email_personnel");
  }
  for (const mail of ["recrutement@orange.sn", "rh@ziac.sn", "DakarHR@state.gov", "recrutement+ba@orbusdigital.com", "cyk@simplon.co", "a@gmail.com.evil.sn", "a@notgmail.com", "", null, undefined, "pas-une-adresse"]) {
    expect(estCourrielPersonnel(mail), String(mail)).toBe(false);
  }
});

test("l'e-mail personnel est aussi détecté dans application_email et dans un lien « mailto: » de external_link", async () => {
  const { contactExterneNonVerifie } = await contact();
  expect(contactExterneNonVerifie({ application_email: "a@yahoo.fr" }).externe).toBe(true);
  expect(contactExterneNonVerifie({ external_link: "mailto:a@hotmail.com?subject=Candidature%20Chauffeur" }).motifs).toEqual(["email_personnel"]);
  expect(contactExterneNonVerifie({ external_link: "mailto:recrutement@orange.sn?subject=Candidature" }).externe).toBe(false);
});

test("liens WhatsApp, raccourcis et formulaires externes sont signalés ; les portails officiels et les sites d'entreprise ne le sont pas", async () => {
  const { categorieLien, contactExterneNonVerifie } = await contact();
  const attendus = {
    "https://wa.me/221777177373?text=Bonjour": "whatsapp",
    "https://api.whatsapp.com/send?phone=221777177373": "whatsapp",
    "https://chat.whatsapp.com/AbCdEf": "whatsapp",
    "wa.me/221777177373": "whatsapp",
    "https://lnkd.in/gv6pvNJq": "lien_raccourci",
    "https://bit.ly/3abcd": "lien_raccourci",
    "http://tinyurl.com/xyz": "lien_raccourci",
    "https://t.co/abc": "lien_raccourci",
    "https://cutt.ly/abc": "lien_raccourci",
    "https://docs.google.com/forms/d/e/1FAIpQLSc/viewform": "formulaire_externe",
    "https://forms.gle/abc": "formulaire_externe",
    "https://forms.office.com/r/abc": "formulaire_externe",
    "https://exemple.typeform.com/to/abc": "formulaire_externe",
    "https://www.jotform.com/123": "formulaire_externe",
  };
  for (const [lien, categorie] of Object.entries(attendus)) expect(categorieLien(lien), lien).toBe(categorie);
  for (const lien of [
    "https://sigof.onfp.sn/ylp", "https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms", "https://mirador.education.gouv.sn/recr26", "https://orbusdigital.com",
    "https://jobs.foundever.com/", "https://docs.google.com/document/d/abc", "https://recrutement.senelec.sn/", "https://wa.me.evil.sn/x", "https://notwa.me/x",
    "mailto:rh@ziac.sn", "", null, undefined, "du texte avec des espaces", "https://",
  ]) {
    expect(categorieLien(lien), String(lien)).toBeNull();
  }
  expect(contactExterneNonVerifie({ external_link: "https://lnkd.in/dp9s3CFt" }).motifs).toEqual(["lien_raccourci"]);
  expect(contactExterneNonVerifie({ application_url: "https://forms.gle/abc" }).motifs).toEqual(["formulaire_externe"]);
  expect(contactExterneNonVerifie({ contact_whatsapp: "+221777177373" }).motifs).toEqual(["whatsapp"]);
  expect(contactExterneNonVerifie({ contact_whatsapp: "  " }).externe).toBe(false);
  expect(contactExterneNonVerifie({ contact_email: "rh@ziac.sn", external_link: "https://sigof.onfp.sn/ylp" })).toEqual({ externe: false, motifs: [] });
});

test("recruteur vérifié : aucun avertissement, même avec un contact externe ; offre vide ou absente : aucun avertissement", async () => {
  const { contactExterneNonVerifie } = await contact();
  const offre = { contact_email: "a@gmail.com", external_link: "https://wa.me/221777177373", contact_whatsapp: "+221777177373" };
  expect(contactExterneNonVerifie({ ...offre, recruiterVerified: true })).toEqual({ externe: false, motifs: [] });
  expect(contactExterneNonVerifie({ ...offre, recruiterVerified: false }).externe).toBe(true);
  expect(contactExterneNonVerifie(offre).motifs.sort()).toEqual(["email_personnel", "whatsapp"]);
  expect(contactExterneNonVerifie({}).externe).toBe(false);
  expect(contactExterneNonVerifie(null).externe).toBe(false);
});

test("fiche d'offre : message neutre sans accusation, affiché seulement quand contactExterneNonVerifie le décide", async () => {
  const { MESSAGE_CONTACT_EXTERNE } = await contact();
  expect(MESSAGE_CONTACT_EXTERNE).toBe("Contact externe, non vérifié par Facilité. Ne payez jamais pour postuler et ne communiquez pas d'informations bancaires.");
  expect(MESSAGE_CONTACT_EXTERNE).not.toMatch(/arnaque|fraude|escroc|faux/i);
  const c = lire("src/app/offres/[id]/OffreDetailClient.js");
  expect(c).toContain("contactExterneNonVerifie(offer).externe && (");
  expect(c).toContain('data-testid="avertissement-contact-externe"');
  expect(c).toContain("{MESSAGE_CONTACT_EXTERNE}");
  // Le badge vérifié lit offer.recruiterVerified, que contactExterneNonVerifie lit aussi : le bloc est donc exclusif du badge.
  expect(c).toContain("{offer.recruiterVerified && <BadgeDisplay");
});

// ---------- 3. Données structurées JobPosting ----------

test("directApply : vrai pour une candidature dans Facilité (interne ou par e-mail), faux pour un portail, un lien externe ou WhatsApp", async () => {
  const { candidatureDansFacilite } = await contact();
  expect(candidatureDansFacilite({})).toBe(true);
  expect(candidatureDansFacilite({ contact_email: "rh@ziac.sn" })).toBe(true);
  expect(candidatureDansFacilite({ application_email: "rh@ziac.sn" })).toBe(true);
  expect(candidatureDansFacilite({ contact_email: "rh@ziac.sn", external_link: "mailto:rh@ziac.sn?subject=Candidature" })).toBe(true);
  expect(candidatureDansFacilite({ external_link: "https://sigof.onfp.sn/ylp" })).toBe(false);
  expect(candidatureDansFacilite({ external_link: "https://wa.me/221777177373" })).toBe(false);
  expect(candidatureDansFacilite({ application_url: "https://recrutement.ucad.sn" })).toBe(false);
  expect(candidatureDansFacilite({ application_url: "https://wa.me/221777177373" })).toBe(false);
  expect(candidatureDansFacilite({ contact_email: "rh@ziac.sn", external_link: "https://docs.google.com/forms/d/e/abc/viewform" })).toBe(false);
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("directApply: candidatureDansFacilite(offer),");
  expect(page).not.toMatch(/directApply:\s*true/);
});

test("validThrough : la date limite de l'offre, sinon le champ est omis (jamais « publication + 60 jours ») ; date illisible : omis", async () => {
  const { validThroughIso, dateFinValidite } = await referencement();
  expect(validThroughIso({ deadline: "2026-11-30" })).toBe("2026-11-30T23:59:59.999Z");
  expect(validThroughIso({ deadline: "2026-11-30T10:00:00.000Z" })).toBe("2026-11-30T10:00:00.000Z");
  expect(validThroughIso({ created_at: "2026-09-01T10:00:00.000Z" })).toBeUndefined();
  expect(validThroughIso({ deadline: "", created_at: "2026-09-01T10:00:00.000Z" })).toBeUndefined();
  expect(validThroughIso({ deadline: "bientôt" })).toBeUndefined();
  expect(validThroughIso(null)).toBeUndefined();
  // La règle de sortie du référencement (noindex, plan du site) garde sa fin « publication + 60 jours » : seule la déclaration à Google change.
  expect(dateFinValidite({ created_at: "2026-09-01T10:00:00.000Z" }).toISOString()).toBe("2026-10-31T10:00:00.000Z");
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("validThrough: validThroughIso(offer),");
});

test("adresse du JobPosting : la ville et le pays, jamais le texte libre recopié trois fois", async () => {
  const { adresseJobPosting } = await referencement();
  const a = adresseJobPosting("Dakar et ses environs, Sénégal");
  expect(a).toEqual({ "@type": "PostalAddress", addressLocality: "Dakar et ses environs", addressCountry: "SN" });
  expect(Object.keys(adresseJobPosting("Thiès, Sénégal"))).toEqual(["@type", "addressLocality", "addressCountry"]);
  expect(adresseJobPosting("Sénégal (National)")).toEqual({ "@type": "PostalAddress", addressCountry: "SN" });
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("address: adresseJobPosting(offer.location),");
  expect(page).not.toMatch(/streetAddress:|addressRegion:/);
});

// ---------- 4. Résidus de copie ----------

test("retirerMarquesCopie : « [cite: 13] » et variantes disparaissent sans coller les mots ni laisser d'espace parasite", async () => {
  const { retirerMarquesCopie } = await nettoyage();
  const cas = [
    ["Envoyez votre candidature [cite: 13].", "Envoyez votre candidature."],
    ["Envoyez votre candidature [cite:13]", "Envoyez votre candidature"],
    ["Mission A [cite: 1, 2] puis B", "Mission A puis B"],
    ["Mission A [cite: 1] [cite: 2] puis B", "Mission A puis B"],
    ["Mission A [cite: 1-3] puis B", "Mission A puis B"],
    ["[cite_start]Chef de chantier", "Chef de chantier"],
    ["Fin du texte[cite_end]", "Fin du texte"],
    ["Texte [cite]", "Texte"],
    ["ligne 1\n[cite: 5] ligne 2", "ligne 1\nligne 2"],
    ["ligne 1 [cite: 5]\nligne 2", "ligne 1\nligne 2"],
    ["abc[cite: 4]def", "abc def"],
    ["Texte [CITE: 7]", "Texte"],
    ["Lien https://exemple.sn/jobs [cite", "Lien https://exemple.sn/jobs"],
    ["Texte 【4†source】 suite", "Texte suite"],
    ["Texte [4†source] suite", "Texte suite"],
    ["Texte :contentReference[oaicite:0]{index=0} suite", "Texte suite"],
    ["Texte [oaicite:2] suite", "Texte suite"],
  ];
  for (const [entree, sortie] of cas) expect(retirerMarquesCopie(entree), entree).toBe(sortie);
});

test("retirerMarquesCopie : un texte sans marque est renvoyé identique (crochets, listes, typographie française intacts) ; une valeur non textuelle aussi", async () => {
  const { retirerMarquesCopie } = await nettoyage();
  for (const t of ["", "Bonjour !", "Profil : Bac+2 [BTS] et [1] référence", "• Mission 1\n• Mission 2", "  espaces  conservés  ", "Citez vos références"]) {
    expect(retirerMarquesCopie(t)).toBe(t);
  }
  expect(retirerMarquesCopie(null)).toBeNull();
  expect(retirerMarquesCopie(undefined)).toBeUndefined();
  expect(retirerMarquesCopie(42)).toBe(42);
});

test("nettoyerOffreAffichee : titre et description nettoyés, les autres champs et l'original intacts", async () => {
  const { nettoyerOffreAffichee } = await nettoyage();
  const o = { id: "x", title: "Comptable [cite: 2]", description: "Missions [cite: 13].", contact_email: "rh@ziac.sn [cite: 1]" };
  const p = nettoyerOffreAffichee(o);
  expect(p).toEqual({ id: "x", title: "Comptable", description: "Missions.", contact_email: "rh@ziac.sn [cite: 1]" });
  expect(o.title).toBe("Comptable [cite: 2]");
  expect(nettoyerOffreAffichee(null)).toBeNull();
});

test("le nettoyage est branché partout : fiche (serveur et affichage), et chaque point de publication (recruteur, administration, route de publication)", () => {
  const page = lire("src/app/offres/[id]/page.js");
  expect(page.match(/nettoyerOffreAffichee\(/g).length).toBeGreaterThanOrEqual(2);
  const client = lire("src/app/offres/[id]/OffreDetailClient.js");
  expect(client).toContain("nettoyerPourAffichage(offer.title)");
  expect(client).toContain('nettoyerPourAffichage(offer.description || "")');
  const recruteur = lire("src/app/recruteur/page.js");
  expect(recruteur.match(/description: retirerMarquesCopie\(/g)).toHaveLength(2);
  expect(recruteur.match(/title: retirerMarquesCopie\(/g)).toHaveLength(2);
  const admin = lire("src/app/admin/offres/page.js");
  expect(admin.match(/description: retirerMarquesCopie\(/g)).toHaveLength(2);
  expect(admin.match(/title: retirerMarquesCopie\(/g)).toHaveLength(2);
  const route = lire("src/app/api/admin/publish-offer/route.js");
  expect(route).toContain("title: retirerMarquesCopie(body.title),");
  expect(route).toContain("description: retirerMarquesCopie(body.description),");
});

// ---------- 5. Nettoyage à l'affichage, partout ----------

test("« ! » collé devant la marque : « ![cite: 13] », « ![cite_start] » et variantes disparaissent ; un « ! » qui termine un mot reste", async () => {
  const { retirerMarquesCopie, nettoyerPourAffichage } = await nettoyage();
  const cas = [
    ["Envoyez votre candidature. ![cite: 13]", "Envoyez votre candidature."],
    ["Envoyez votre candidature ![cite: 13] Merci", "Envoyez votre candidature Merci"],
    ["![cite_start]Chef de chantier", "Chef de chantier"],
    ["Fin du texte ![cite_end]", "Fin du texte"],
    ["Mission A ![cite: 1, 2] puis B", "Mission A puis B"],
    ["ligne 1\n![cite: 5] ligne 2", "ligne 1\nligne 2"],
    ["Texte ![cite]", "Texte"],
    ["Texte ![CITE: 7].", "Texte."],
    ["Texte ![4†source] suite", "Texte suite"],
    ["Venez nombreux![cite: 3]", "Venez nombreux!"],
    ["Bravo ! [cite: 3]", "Bravo !"],
    ["![cite: 13] ![cite: 14]", ""],
  ];
  for (const [entree, sortie] of cas) {
    expect(retirerMarquesCopie(entree), entree).toBe(sortie);
    expect(nettoyerPourAffichage(entree), entree).toBe(sortie);
  }
});

test("préfixes de gabarit au tout début : « Titre du poste ou de l'offre : », « Titre de l'offre : » et variantes ; rien d'autre ne change", async () => {
  const { nettoyerPourAffichage, retirerMarquesCopie } = await nettoyage();
  const cas = [
    ["Titre du poste ou de l'offre : Chargé de clientèle", "Chargé de clientèle"],
    ["Titre du poste ou de l’offre : Chargé de clientèle", "Chargé de clientèle"],
    ["Titre de l'offre : Comptable", "Comptable"],
    ["Titre du poste : Comptable", "Comptable"],
    ["titre de l'annonce :Comptable", "Comptable"],
    ["Intitulé du poste : Comptable", "Comptable"],
    ["Intitulé de l'offre: Comptable", "Comptable"],
    ["Titre : Comptable", "Comptable"],
    ["  Titre du poste ou de l'offre : Comptable [cite: 2]", "Comptable"],
    ["Titre du poste : Comptable\nTitre du poste : seconde ligne", "Comptable\nTitre du poste : seconde ligne"],
  ];
  for (const [entree, sortie] of cas) expect(nettoyerPourAffichage(entree), entree).toBe(sortie);
  // Pas en tête, ou autre mot : inchangé.
  for (const t of ["Le titre du poste : Comptable", "Titres professionnels : Bac+2", "Titrisation : métier", "Intitulés de poste", "Offre : Comptable", "Chef de chantier", "Bonjour !", ""]) {
    expect(nettoyerPourAffichage(t), t).toBe(t);
  }
  // La publication n'enlève QUE les marques de copie, pas les préfixes (réservés à l'affichage).
  expect(retirerMarquesCopie("Titre du poste : Comptable [cite: 2]")).toBe("Titre du poste : Comptable");
  expect(nettoyerPourAffichage(null)).toBeNull();
  expect(nettoyerPourAffichage(undefined)).toBeUndefined();
});

test("nettoyerOffresAffichees et nettoyerCarteOffre : même nombre d'offres, même ordre, seuls les textes changent ; l'original n'est pas modifié", async () => {
  const { nettoyerOffresAffichees, nettoyerCarteOffre } = await nettoyage();
  const offres = [
    { id: "1", title: "Titre du poste ou de l'offre : A [cite: 1]", description: "Texte ![cite: 13]", contact_email: "a@b.sn" },
    { id: "2", title: "B", description: null },
    { id: "3", title: "C", description: "Propre" },
  ];
  const copie = JSON.parse(JSON.stringify(offres));
  const net = nettoyerOffresAffichees(offres);
  expect(net.map((o) => o.id)).toEqual(["1", "2", "3"]);
  expect(net[0]).toEqual({ id: "1", title: "A", description: "Texte", contact_email: "a@b.sn" });
  expect(net[1].description).toBeNull();
  expect(net[2]).toEqual(offres[2]);
  expect(offres).toEqual(copie);
  expect(nettoyerOffresAffichees(undefined)).toBeUndefined();
  expect(nettoyerCarteOffre({ id: "x", titleFR: "T ![cite: 3]", titleEN: "T ![cite: 3]", descFR: "Titre de l'offre : D", descEN: "D", tags: ["Dakar"] })).toEqual({
    id: "x", titleFR: "T", titleEN: "T", descFR: "D", descEN: "D", tags: ["Dakar"],
  });
});

test("liste des endroits où le texte d'une offre est affiché : tous passent par la fonction commune, aucune copie de l'expression n'existe ailleurs", () => {
  const endroits = {
    "src/app/page.js": ["nettoyerPourAffichage(offer.title)", "nettoyerPourAffichage(offer.description)"], // fil d'accueil, rendu serveur
    "src/app/HomeClient.jsx": ["nettoyerPourAffichage(offer.title)", "nettoyerPourAffichage(offer.description)", "parsed.map(nettoyerCarteOffre)"], // cartes, recommandées, « Autour de moi » (mode autour), cache navigateur
    "src/app/offres/OffresClient.jsx": ["nettoyerOffresAffichees("], // liste /offres (3 chargements)
    "src/app/recherche/page.js": ["nettoyerOffresAffichees(jobData"], // résultats de recherche
    "src/components/Header.jsx": ["nettoyerPourAffichage(off.title)", "nettoyerPourAffichage(o.title)"], // suggestions de recherche, notifications
    "src/app/candidat/page.js": ["nettoyerOffresAffichees(merged)", "nettoyerPourAffichage(c.job_title)"], // offres recommandées du tableau de bord, candidatures
    "src/app/candidat/candidatures/page.js": ["nettoyerPourAffichage(c.job_title)"],
    "src/app/candidat/extracteur/page.js": ["setPosterOffer(nettoyerOffreAffichee(data))"],
    "src/app/recruteurs/[id]/RecruiterShowcaseClient.jsx": ["nettoyerOffresAffichees(offersData"], // vitrine recruteur + fenêtre de candidature
    "src/app/offres/[id]/OffresSimilaires.js": ["nettoyerPourAffichage(o.title)"],
    "src/app/offres/[id]/OffreDetailClient.js": ["nettoyerPourAffichage(offer.title)", 'nettoyerPourAffichage(offer.description || "")'],
    "src/app/offres/[id]/page.js": ["nettoyerOffreAffichee("], // fiche, JobPosting, métadonnées
    "src/components/SocialShareButtons.jsx": ["nettoyerPourAffichage(offer?.title || offer?.titleFR)"], // partage, aide à la candidature
    "src/lib/titresReferencement.js": ["nettoyerPourAffichage(offre?.title)", "nettoyerPourAffichage(offre?.description)"], // balises title, description, og, twitter
    "src/lib/offresOuvertes.js": ["nettoyerPourAffichage(String(o.title).trim())"], // liens d'offres ouvertes dans le HTML de /offres
    "src/lib/offresParVille.js": ["nettoyerPourAffichage(l.title)"], // pastilles de la carte « Autour de moi »
  };
  for (const [fichier, attendus] of Object.entries(endroits)) {
    const code = lire(fichier);
    expect(code, fichier).toContain("nettoyerTexteOffre");
    for (const a of attendus) expect(code, `${fichier} : ${a}`).toContain(a);
    // Aucune copie de l'expression des marques ni du préfixe en dehors de la bibliothèque.
    expect(code, fichier).not.toMatch(/cite\(\?:_start|oaicite|PREFIXE_GABARIT/);
  }
  // Un seul endroit définit les expressions.
  const lib = lire("src/lib/nettoyerTexteOffre.js");
  expect(lib).toContain("PREFIXE_GABARIT");
  expect(lib.match(/export function /g)).toHaveLength(5);
});

test("métadonnées (titre, description, og, twitter) : titreOffre et descriptionOffre nettoient les marques et le préfixe de gabarit", async () => {
  const { titreOffre, descriptionOffre } = await import("../../src/lib/titresReferencement.js");
  const offre = {
    title: "Titre du poste ou de l'offre : Chargé de clientèle ![cite: 13]",
    company: "Foundever",
    description: "Titre de l'offre : Nous recrutons des conseillers clients pour un centre d'appels à Dakar, avec formation payée ![cite: 4] et primes mensuelles.",
    location: "Dakar",
  };
  expect(titreOffre(offre)).toBe("Chargé de clientèle – Foundever");
  const d = descriptionOffre(offre);
  expect(d).not.toMatch(/cite|Titre de l/i);
  expect(d.startsWith("Nous recrutons")).toBe(true);
});

test("aucune écriture en base ni masquage : la bibliothèque n'écrit rien (le test de longueur plus haut garantit qu'aucune offre n'est retirée)", () => {
  const lib = lire("src/lib/nettoyerTexteOffre.js");
  expect(lib).not.toMatch(/supabase|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});
