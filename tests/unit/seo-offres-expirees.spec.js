const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Référencement des offres : date de fin FIXE (date limite, sinon publication + 60 jours), plus aucun JobPosting ni entrée de plan du site pour une offre
 * clôturée, page en noindex avec « Offre clôturée » et offres similaires, dates des pages fixes du plan du site stables.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const ref = () => import("../../src/lib/offreReferencement.js");
const sim = () => import("../../src/lib/offresSimilaires.js");
const J = 24 * 60 * 60 * 1000;
// Les tests ne dépendent pas de la date du jour : toutes les dates sont calculées par rapport à maintenant (isOfferExpired lit l'horloge réelle).
const NOW = Date.now();
const jour = (n) => new Date(NOW + n * J).toISOString().slice(0, 10);
const iso = (n) => new Date(NOW + n * J).toISOString();

test("date de fin : la date limite (toute la journée), sinon publication + 60 jours pour décider du référencement (FIXE d'une visite à l'autre) ; validThrough, lui, n'est déclaré qu'avec une vraie date limite", async () => {
  const { dateFinValidite, validThroughIso } = await ref();
  expect(validThroughIso({ deadline: "2026-11-05" })).toBe("2026-11-05T23:59:59.999Z");
  const sans = { created_at: "2026-09-01T10:00:00.000Z" };
  expect(dateFinValidite(sans).toISOString()).toBe(new Date(Date.parse("2026-09-01T10:00:00.000Z") + 60 * J).toISOString());
  expect(dateFinValidite(sans).getTime()).toBe(dateFinValidite(sans).getTime());
  expect(validThroughIso(sans)).toBeUndefined();
  expect(dateFinValidite({})).toBeNull();
  expect(validThroughIso({})).toBeUndefined();
});

test("hors référencement : date limite dépassée, statut de clôture, désactivée ou ancienne sans date limite ; une offre ouverte reste dedans", async () => {
  const { offreHorsReferencement, offreCloturee } = await ref();
  expect(offreHorsReferencement({ deadline: jour(-2) }, NOW)).toBe(true);
  expect(offreHorsReferencement({ deadline: jour(1) }, NOW)).toBe(false);
  expect(offreHorsReferencement({ deadline: jour(30), status: "closed" }, NOW)).toBe(true);
  expect(offreHorsReferencement({ deadline: jour(30), is_active: false }, NOW)).toBe(true);
  expect(offreHorsReferencement({ created_at: iso(-90) }, NOW)).toBe(true);
  expect(offreHorsReferencement({ created_at: iso(-10) }, NOW)).toBe(false);
  // Offre en attente de modération ou refusée : ni JobPosting ni indexation ; approuvée, ou sans statut (offres de secours), non concernée.
  expect(offreHorsReferencement({ status: "pending_review", deadline: jour(10), created_at: iso(-1) }, NOW)).toBe(true);
  expect(offreHorsReferencement({ status: "rejected", deadline: jour(10), created_at: iso(-1) }, NOW)).toBe(true);
  expect(offreHorsReferencement({ status: "approved", deadline: jour(10), created_at: iso(-1) }, NOW)).toBe(false);
  expect(offreHorsReferencement({ deadline: jour(10), created_at: iso(-1) }, NOW)).toBe(false);
  expect(offreHorsReferencement({ deadline: jour(20), created_at: iso(-90) }, NOW)).toBe(false);
  // « clôturée » (bandeau, bouton Postuler) ne regarde jamais la date de publication : une offre sans date limite n'est pas clôturée.
  expect(offreCloturee({ created_at: iso(-90) })).toBe(false);
});

test("offres similaires : jamais l'offre elle-même ni une offre clôturée ; même type, même lieu et mots du titre d'abord", async () => {
  const { choisirOffresSimilaires } = await sim();
  const offre = { id: "a", title: "Comptable confirmé", location: "Dakar, Sénégal", listing_type: "offre_emploi" };
  const c = [
    { id: "a", title: "Comptable confirmé", location: "Dakar", listing_type: "offre_emploi", deadline: jour(30), created_at: iso(-10) },
    { id: "b", title: "Chauffeur", location: "Thiès", listing_type: "concours", deadline: jour(30), created_at: iso(-6) },
    { id: "c", title: "Assistant comptable", location: "Dakar", listing_type: "offre_emploi", deadline: jour(30), created_at: iso(-21) },
    { id: "d", title: "Comptable senior", location: "Dakar", listing_type: "offre_emploi", deadline: jour(-30), created_at: iso(-80) },
    { id: "e", title: "Secrétaire", location: "Dakar", listing_type: "offre_emploi", deadline: jour(30), created_at: iso(-3) },
  ];
  const ids = choisirOffresSimilaires(offre, c, 4, NOW).map((o) => o.id);
  expect(ids).toEqual(["c", "e", "b"]);
  expect(ids).not.toContain("a");
  expect(ids).not.toContain("d");
});

test("page offre : JobPosting seulement pour une offre ouverte, noindex sinon, validThrough fixe, bandeau « Offre clôturée » et offres similaires", () => {
  const p = lire("src/app/offres/[id]/page.js");
  expect(p).toContain('{!horsReferencement && offer.listing_type !== "autre" && (');
  expect(p).toContain("validThrough: validThroughIso(offer),");
  expect(p).toContain("robots: { index: false, follow: true }");
  expect(p).toContain("{offreCloturee(offer) && <OffresSimilaires");
  expect(p).not.toContain("Date.now() + 60 * 24 * 60 * 60 * 1000");
  expect(lire("src/app/offres/[id]/OffreDetailClient.js")).toContain("Offre clôturée");
});

test("plan du site : plus d'offre clôturée, pages fixes à date stable, offre de secours soumise à sa date limite (identique à celle de la fiche)", () => {
  const s = lire("src/app/sitemap.js");
  expect(s).toContain("if (offreHorsReferencement(offer)) continue;");
  expect(s).toContain("export const revalidate = 3600;");
  expect(s).toContain("lastModified: DATE_PAGES_FIXES,");
  expect(s).not.toMatch(/lastModified: now,\n\s+changeFrequency: route/);
  const secours = /OFFRE_SECOURS = \{ id: "([^"]+)", deadline: "([^"]+)" \}/.exec(s);
  const fiche = lire("src/lib/offresSecours.js");
  const bloc = fiche.slice(fiche.indexOf(`"${secours[1]}": {`));
  expect(/deadline: "([^"]+)"/.exec(bloc)[1]).toBe(secours[2]);
});

test("JobPosting : la ville vient du lieu (jamais recopié en rue ni en région) ; type de contrat omis quand il n'est pas renseigné", async () => {
  const { adresseJobPosting } = await ref();
  expect(adresseJobPosting("Dakar, Sénégal")).toEqual({ "@type": "PostalAddress", addressLocality: "Dakar", addressCountry: "SN" });
  expect(adresseJobPosting("Tivaouane Peulh, Sénégal").addressLocality).toBe("Tivaouane Peulh");
  expect(adresseJobPosting("Dakar / Diamniadio, Sénégal").addressLocality).toBe("Dakar");
  expect(adresseJobPosting("Auchan Hypermarché Mermoz, Dakar").addressLocality).toBe("Auchan Hypermarché Mermoz");
  expect(adresseJobPosting("Sénégal")).toEqual({ "@type": "PostalAddress", addressCountry: "SN" });
  expect(adresseJobPosting("")).toEqual({ "@type": "PostalAddress", addressCountry: "SN" });
  expect(adresseJobPosting(null).addressLocality).toBeUndefined();
  const page = lire("src/app/offres/[id]/page.js");
  expect(page).toContain("address: adresseJobPosting(offer.location),");
  expect(page).not.toMatch(/streetAddress:|addressRegion:/);
  expect(page).toContain("if (!normalized.trim()) return undefined;");
});
