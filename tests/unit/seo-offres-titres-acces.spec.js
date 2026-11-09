const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Référencement des fiches d'offres :
 *  - une offre non validée n'est visible que de son propriétaire et d'un administrateur, porte noindex et n'est jamais dans le plan du site ;
 *  - titre « {Intitulé} à {Ville} – {Entreprise} | Offre d'emploi » (65 caractères au plus) et méta-description d'environ 150 caractères, avec les vraies données.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const visibilite = () => import("../../src/lib/visibiliteOffre.js");
const refer = () => import("../../src/lib/offreReferencement.js");
const titres = () => import("../../src/lib/titresReferencement.js");

// ---------- 1. Offres non validées ----------

test("offreValidee : approuvée ou sans statut (offres de secours) = validée ; en attente, refusée, brouillon, archivée = non validée", async () => {
  const { offreValidee } = await visibilite();
  for (const o of [{ status: "approved" }, {}, { status: null }, { status: "" }, null, undefined]) expect(offreValidee(o), JSON.stringify(o)).toBe(true);
  for (const s of ["pending_review", "rejected", "draft", "archived"]) expect(offreValidee({ status: s }), s).toBe(false);
});

test("offre non validée : visible du propriétaire et de l'administrateur connectés seulement ; visiteur anonyme ou autre compte : refus (404)", async () => {
  const { peutVoirOffreNonValidee } = await visibilite();
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: { userId: "r1", estAdmin: false } })).toBe(true); // propriétaire
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: { userId: "a1", estAdmin: true } })).toBe(true); // administrateur
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: null })).toBe(false); // visiteur anonyme
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: { userId: "u2", estAdmin: false } })).toBe(false); // autre compte
  expect(peutVoirOffreNonValidee({ recruteurId: null, visiteur: { userId: "u2", estAdmin: false } })).toBe(false); // offre sans propriétaire
  expect(peutVoirOffreNonValidee({ recruteurId: undefined, visiteur: { userId: undefined } })).toBe(false);
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: { userId: "r1", estAdmin: "oui" } })).toBe(true); // propriétaire même si estAdmin invalide
  expect(peutVoirOffreNonValidee({ recruteurId: "r1", visiteur: { userId: "u2", estAdmin: "oui" } })).toBe(false); // estAdmin doit valoir exactement true
  expect(peutVoirOffreNonValidee()).toBe(false);
});

test("la fiche applique la règle : visiteur lu seulement pour une offre non validée, 404 si refusé, refus en cas d'erreur de lecture", () => {
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("if (!offreValidee(data)) {");
  expect(page).toContain("const visiteur = await lireVisiteur(supabase);");
  expect(page).toContain("if (!peutVoirOffreNonValidee({ recruteurId, visiteur })) return null;");
  // L'ordre : la décision d'accès précède le badge et le retour de l'offre.
  expect(page.indexOf("if (!offreValidee(data)) {")).toBeLessThan(page.indexOf("let recruiterVerified = false;"));
  // Toute erreur de lecture du visiteur donne « inconnu » (donc refus).
  expect(page).toMatch(/async function lireVisiteur[\s\S]*?catch \{\s*return null;\s*\}\s*\}/);
  expect(page).toContain("getUserFromCookies");
  // Rôle administrateur lu dans user_roles (modèle RBAC), jamais dans la colonne obsolète profiles.role (invariant 11).
  expect(page).toContain('.from("user_roles").select("role").eq("user_id", user.id)');
  expect(page).not.toMatch(/from\("profiles"\)[^;]*select\("role"\)/);
  // Une offre introuvable mène au 404 de la page.
  expect(page).toContain("if (!offer) {\n    notFound();");
});

test("noindex et plan du site : toute offre non validée est hors référencement (même ouverte et active) ; une offre validée et ouverte reste référencée", async () => {
  const { offreHorsReferencement } = await refer();
  const ouverte = { is_active: true, created_at: new Date(Date.now() - 3 * 86400000).toISOString(), deadline: null };
  expect(offreHorsReferencement({ ...ouverte, status: "approved" })).toBe(false);
  for (const s of ["pending_review", "rejected", "draft", "archived"]) expect(offreHorsReferencement({ ...ouverte, status: s }), s).toBe(true);
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("...(offreHorsReferencement(offer) ? { robots: { index: false, follow: true } } : {}),");
  expect(page).toContain("{!horsReferencement && offer.listing_type");
  const sitemap = lire("src/app/sitemap.js");
  expect(sitemap).toContain("if (offreHorsReferencement(offer)) continue;");
  expect(sitemap).toContain(".select(\"id, updated_at, created_at, deadline, status, is_active\")");
  expect(lire("src/lib/offresOuvertes.js")).toContain("(o.status == null || o.status === \"approved\")");
});

// ---------- 2. Titres et descriptions ----------

test("villeDuLieu : première partie du lieu, capitale ; « Sénégal », « International » et vide ne sont pas des villes", async () => {
  const { villeDuLieu } = await refer();
  expect(villeDuLieu("Dakar, Sénégal")).toBe("Dakar");
  expect(villeDuLieu("dakar")).toBe("Dakar");
  expect(villeDuLieu("Dakar et ses environs, Sénégal")).toBe("Dakar");
  expect(villeDuLieu("Dakar / Diamniadio")).toBe("Dakar");
  expect(villeDuLieu("Tivaouane Peulh, Sénégal")).toBe("Tivaouane Peulh");
  expect(villeDuLieu("Pikine (Dakar)")).toBe("Pikine");
  for (const v of ["Sénégal", "SÉNÉGAL", "Senegal", "International (Multi-pays)", "", "  ", null, undefined]) expect(villeDuLieu(v), String(v)).toBe("");
});

test("titre de la fiche : « Intitulé à Ville – Entreprise | Offre d'emploi », 65 caractères au plus, sans texte vide ni « Non spécifié »", async () => {
  const { titreFicheOffre } = await titres();
  expect(titreFicheOffre({ title: "Chauffeur", company: "Pyxis Logistics", location: "Dakar, Sénégal" })).toBe("Chauffeur à Dakar – Pyxis Logistics | Offre d'emploi");
  // Ville absente (« Sénégal » seul, ou vide) : omise.
  expect(titreFicheOffre({ title: "Comptable", company: "Alpha Digital", location: "Sénégal" })).toBe("Comptable – Alpha Digital | Offre d'emploi");
  expect(titreFicheOffre({ title: "Comptable", company: "Alpha Digital", location: "" })).toBe("Comptable – Alpha Digital | Offre d'emploi");
  // Entreprise absente ou déjà nommée dans l'intitulé : omise.
  expect(titreFicheOffre({ title: "Comptable", company: "", location: "Thiès" })).toBe("Comptable à Thiès | Offre d'emploi");
  expect(titreFicheOffre({ title: "Pyxis Logistics recrute un Chauffeur", company: "Pyxis Logistics", location: "Dakar" })).toBe("Pyxis Logistics recrute un Chauffeur à Dakar | Offre d'emploi"); // 61 caractères : tient dans 65
  // Ville déjà dans l'intitulé : pas répétée.
  expect(titreFicheOffre({ title: "Agent de saisie à Dakar", company: "", location: "Dakar" })).toBe("Agent de saisie à Dakar | Offre d'emploi");
  // Rien du tout : l'intitulé par défaut, jamais de texte vide.
  expect(titreFicheOffre({})).toBe("Offre d'emploi | Offre d'emploi");
  // Trop long : l'entreprise est omise d'abord, puis l'intitulé est coupé proprement (la ville est gardée).
  expect(titreFicheOffre({ title: "Vendeur Commercial (H/F)", company: "GPF Recrutement", location: "Dakar, Sénégal" })).toBe("Vendeur Commercial (H/F) à Dakar | Offre d'emploi");
  // Le poste complet passe avant la ville (65 caractères pile avec le suffixe) : la ville ne tient pas, elle est omise, l'intitulé n'est pas coupé.
  const long = titreFicheOffre({ title: "Assistant(e) Achats et Coordinateur(trice) Stock", company: "Yassir", location: "dakar" });
  expect(long).toBe("Assistant(e) Achats et Coordinateur(trice) Stock | Offre d'emploi");
  expect(long.length).toBe(65);
  // L'entreprise est gardée quand le titre complet tient dans 65 caractères.
  expect(titreFicheOffre({ title: "Électricien", company: "Global Talent HR", location: "Dakar" })).toBe("Électricien à Dakar – Global Talent HR | Offre d'emploi");
  // GPF Recrutement : 67 caractères avec l'entreprise, donc omise (le poste et la ville passent avant).
  expect(titreFicheOffre({ title: "Vendeur Commercial (H/F)", company: "GPF Recrutement", location: "Dakar, Sénégal" }).length).toBeLessThanOrEqual(65);
  for (const o of [
    { title: "Responsable du développement commercial et de la relation client grand compte", company: "Société Générale Sénégal", location: "Dakar" },
    { title: "NVI Facility recrute 50 Agents de Sécurité à Dakar et dans les régions", company: "NVI Facility", location: "Dakar" },
    { title: "Chef de projet", company: "Entreprise à nom très très long pour dépasser", location: "Tivaouane Peulh, Sénégal" },
    { title: "Responsable de la coordination des opérations logistiques et du transport international", company: "Alpha", location: "Dakar" },
  ]) {
    const t = titreFicheOffre(o);
    expect(t.length, t).toBeLessThanOrEqual(65);
    expect(t.endsWith(" | Offre d'emploi"), t).toBe(true);
    expect(t).not.toMatch(/Non spécifié|undefined|null|\s{2,}|–\s*\||à\s*\|/i);
  }
});

test("titre de la fiche : marques de copie et préfixe de gabarit retirés", async () => {
  const { titreFicheOffre } = await titres();
  expect(titreFicheOffre({ title: "Titre du poste ou de l’offre : Conseiller clientèle ![cite: 13]", company: "Concentrix", location: "Sénégal" })).toBe("Conseiller clientèle – Concentrix | Offre d'emploi");
  expect(titreFicheOffre({ title: "Comptable [cite: 2]", company: "", location: "Dakar" })).toBe("Comptable à Dakar | Offre d'emploi");
});

test("méta-description : environ 150 caractères, vraies données (poste, entreprise, ville, contrat s'il est connu), jamais « Non spécifié »", async () => {
  const { descriptionFicheOffre } = await titres();
  const base = { title: "Vendeur Commercial (H/F)", company: "GPF Recrutement", location: "Dakar, Sénégal", contract_type: "CDI", description: "GPF Recrutement recrute un Vendeur Commercial pour une enseigne de distribution. Vous accueillez les clients, conseillez et vendez les produits." };
  const d = descriptionFicheOffre(base);
  expect(d.startsWith("GPF Recrutement recrute : Vendeur Commercial (H/F) à Dakar. Contrat : CDI.")).toBe(true);
  expect(d.length).toBeGreaterThanOrEqual(110);
  expect(d.length).toBeLessThanOrEqual(155);
  // Contrat absent ou « Non spécifié » : omis.
  for (const contrat of ["", "Non spécifié", null, undefined]) {
    const sans = descriptionFicheOffre({ ...base, contract_type: contrat });
    expect(sans, String(contrat)).not.toMatch(/Contrat :|Non spécifié/);
  }
  // Ville absente, entreprise absente : omises sans texte vide.
  const minimal = descriptionFicheOffre({ title: "Comptable", company: "", location: "Sénégal", contract_type: "", description: "" });
  expect(minimal).toBe("Comptable. Postulez en ligne sur Facilité.");
  // Unique : deux offres différentes donnent deux descriptions différentes.
  expect(descriptionFicheOffre({ ...base, title: "Caissier (H/F)", description: "Encaissement et accueil en magasin." })).not.toBe(d);
  // Annonce qui répète l'intitulé en tête : pas de redite.
  const rep = descriptionFicheOffre({ title: "Global Talent HR recrute 18 Électriciens (H/F)", company: "Global Talent HR", location: "Sénégal", description: "Global Talent HR recrute 18 Électriciens (H/F) ! Localisation : Dakar, Sénégal" });
  expect(rep).toBe("Global Talent HR recrute 18 Électriciens (H/F). Localisation : Dakar, Sénégal");
  // Texte long : coupé proprement, 155 au plus, pictogrammes et marques retirés.
  const longue = descriptionFicheOffre({ ...base, description: `📢 ${"Mission très détaillée du poste. ".repeat(20)}![cite: 13]` });
  expect(longue.length).toBeLessThanOrEqual(155);
  expect(longue).not.toMatch(/cite|📢/);
  expect(longue.endsWith("…")).toBe(true);
});

test("la fiche publie ces titre et description tels quels (title.absolute, sans la marque en double), pour la page, Open Graph et Twitter", () => {
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("const title = titreFicheOffre(offer);");
  expect(page).toContain("const description = descriptionFicheOffre(offer);");
  expect(page).toContain("title: { absolute: title },");
  expect(page).not.toContain("`${title} | Facilite`");
  const og = page.slice(page.indexOf("openGraph: {"), page.indexOf("twitter: {"));
  expect(og).toContain("      title,\n");
  const tw = page.slice(page.indexOf("twitter: {"));
  expect(tw).toContain("      title,\n");
  // Les anciens titres génériques restent pour une panne ou une offre introuvable.
  expect(page).toContain('return { title: "Offre d\'emploi introuvable" };');
});
