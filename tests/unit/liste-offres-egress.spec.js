const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Listes d'offres (accueil, offres, recherche) : colonnes utiles seulement.
 * Le but est de ne RIEN changer à ce que la personne voit : on garde exactement les colonnes que les écrans lisent, et rien d'autre.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const colonnes = () => import("../../src/lib/colonnesOffres.js");

// Colonnes réelles de public.job_offers (structure de la production exportée le 29/10/2026) + la colonne générée recherche_norm.
const COLONNES_REELLES = [
  "id", "title", "company", "location", "description", "created_at", "updated_at", "status", "status_updated_at", "is_active", "deadline", "contract_type",
  "salary_range", "image_url", "audio_url", "contact_email", "contact_phone", "contact_whatsapp", "external_link", "application_url", "application_email",
  "additional_info", "recruiter_id", "listing_type", "min_education_level", "min_education_level_code", "requires_cover_letter", "is_sponsored",
  "sponsor_priority", "sponsored_until", "view_count", "archived_at", "is_test_account", "embedding", "recherche_norm",
];
// Lues par les écrans de liste (voir l'audit dans la description de la PR) : tout le reste est exclu des listes.
const EXCLUES = ["embedding", "recherche_norm", "additional_info", "updated_at", "status_updated_at", "archived_at", "min_education_level", "is_test_account", "requires_cover_letter"];
const FICHIERS_LISTES = ["src/app/page.js", "src/app/HomeClient.jsx", "src/app/offres/OffresClient.jsx", "src/app/recherche/page.js"];

test.describe("colonnes des listes d'offres", () => {
  test("26 colonnes, toutes réelles, sans doublon ; ni embedding, ni recherche_norm, ni les six colonnes jamais lues", async () => {
    const { COLONNES_LISTE_OFFRES, SELECT_LISTE_OFFRES } = await colonnes();
    expect(COLONNES_LISTE_OFFRES).toHaveLength(26);
    expect(new Set(COLONNES_LISTE_OFFRES).size).toBe(26);
    for (const c of COLONNES_LISTE_OFFRES) expect(COLONNES_REELLES, c).toContain(c);
    for (const c of EXCLUES) expect(COLONNES_LISTE_OFFRES, c).not.toContain(c);
    expect(SELECT_LISTE_OFFRES.split(", ")).toEqual(COLONNES_LISTE_OFFRES);
    expect(SELECT_LISTE_OFFRES).not.toContain("*");
  });
  test("les colonnes que l'accueil lit mais qui n'existent pas dans la table (positions_count, sector, category, project, domain) ne sont PAS sélectionnées : la requête échouerait", async () => {
    const { COLONNES_LISTE_OFFRES } = await colonnes();
    for (const c of ["positions_count", "sector", "category", "project", "domain"]) expect(COLONNES_LISTE_OFFRES, c).not.toContain(c);
    for (const c of ["id", "title", "company", "location", "description", "created_at", "contract_type", "image_url", "audio_url", "contact_email", "contact_phone", "contact_whatsapp", "external_link", "deadline", "status", "is_active", "listing_type", "is_sponsored", "sponsor_priority", "recruiter_id"]) {
      expect(COLONNES_LISTE_OFFRES, c).toContain(c);
    }
  });
  test("les quatre listes utilisent la liste commune ; plus aucun select(\"*\") sur job_offers dans ces écrans", () => {
    for (const f of FICHIERS_LISTES) {
      const code = lire(f);
      expect(code, f).toContain('import { SELECT_LISTE_OFFRES } from "@/lib/colonnesOffres";');
      expect(code, f).toMatch(/\.select\(SELECT_LISTE_OFFRES[,)]/);
      expect(code, f).not.toMatch(/from\("job_offers"\)\s*\.select\(\s*"\*"/);
    }
  });
  test("aucun de ces écrans (ni les petites bibliothèques qu'ils utilisent) ne lit une colonne exclue d'une offre", () => {
    const fichiers = [...FICHIERS_LISTES, "src/lib/sponsoredFeed.js", "src/lib/listingTypes.js", "src/lib/offerContact.js", "src/lib/offerExpiration.js", "src/lib/niveauxEtudes.js"];
    const motif = new RegExp(`\\.(${EXCLUES.join("|")})\\b|\\[["'](${EXCLUES.join("|")})["']\\]`);
    const trouves = [];
    for (const f of fichiers) {
      lire(f).split("\n").forEach((l, i) => {
        if (!motif.test(l)) return;
        if (/embedData/.test(l)) return; // vecteur de la requête de recherche sémantique, pas une colonne d'offre
        trouves.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`);
      });
    }
    expect(trouves).toEqual([]);
  });
});
