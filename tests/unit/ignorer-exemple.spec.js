const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Compétences d'EXEMPLE des anciens profils (« Gestion de projet / Développement Web / Stratégie Digitale ») : ignorées — sans toucher aux données — dans la
 * recherche et la fiche des candidats, la mise en correspondance par l'IA, le score de candidature et la complétude. Seule la liste EXACTE est ignorée.
 */
const charger = () => import("../../src/lib/valeursExemple.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const EXEMPLE = ["Gestion de projet", "Développement Web", "Stratégie Digitale"];

test.describe("règle stricte : seule la forme exacte de l'exemple est ignorée", () => {
  test("la liste exacte est ignorée (renvoie une liste vide)", async () => {
    const { competencesReelles, sontCompetencesExemple } = await charger();
    expect(sontCompetencesExemple([...EXEMPLE])).toBe(true);
    expect(competencesReelles([...EXEMPLE])).toEqual([]);
  });
  test("une vraie compétence « Gestion de projet » n'est jamais ignorée : seule, avec d'autres, en plus de l'exemple, ou dans un autre ordre", async () => {
    const { competencesReelles } = await charger();
    for (const liste of [
      ["Gestion de projet"],
      ["Gestion de projet", "Excel"],
      ["Excel", "Gestion de projet"],
      [...EXEMPLE, "Excel"],
      ["Excel", ...EXEMPLE],
      ["Développement Web", "Gestion de projet", "Stratégie Digitale"],
      ["Gestion de projet", "Développement Web"],
      ["gestion de projet", "Développement Web", "Stratégie Digitale"],
      ["Gestion de projet ", "Développement Web", "Stratégie Digitale"],
    ]) {
      expect(competencesReelles(liste), JSON.stringify(liste)).toBe(liste);
    }
  });
  test("valeurs inattendues : renvoyées telles quelles, jamais d'erreur", async () => {
    const { competencesReelles, sontCompetencesExemple } = await charger();
    expect(competencesReelles(undefined)).toBeUndefined();
    expect(competencesReelles(null)).toBeNull();
    expect(competencesReelles("Gestion de projet")).toBe("Gestion de projet");
    expect(competencesReelles([])).toEqual([]);
    expect(sontCompetencesExemple({ 0: "Gestion de projet" })).toBe(false);
  });
});

test.describe("tous les endroits concernés l'utilisent", () => {
  test("mise en correspondance par l'IA : ni dans le texte envoyé à l'IA, ni dans les points forts, ni dans les compétences renvoyées", () => {
    const s = lire("src/app/api/recruteur/rag-matching/route.js");
    expect(s).toContain('import { competencesReelles } from "@/lib/valeursExemple";');
    expect(s).toContain("const skillsDeclarees = competencesReelles(p.skills);");
    expect(s).not.toMatch(/p\.skills\.join|p\.skills\.slice|p\.skills :/);
    expect(s.match(/competencesReelles\(p\.skills\)/g).length).toBeGreaterThanOrEqual(5);
  });
  test("score de candidature (serveur) et avertissement avant de postuler (modale)", () => {
    expect(lire("src/app/api/postuler/route.js")).toContain("computeScore(competencesReelles(candidateProfile?.skills) || []");
    expect(lire("src/components/ApplyModal.jsx")).toContain("candidateSkills: competencesReelles(candidateProfile?.skills),");
  });
  test("espace recruteur : recherche par compétence et fiche du candidat", () => {
    const s = lire("src/app/recruteur/page.js");
    expect(s).toContain("competencesReelles(c.skills).join(\" \")");
    expect(s).toContain("competencesReelles(selectedCandidate.skills).map((skill, i) =>");
    expect(s).not.toMatch(/selectedCandidate\.skills\.map/);
  });
});

test.describe("base de données : migration additive, non appliquée tant qu'elle n'est pas validée", () => {
  const sql = lire("supabase/migrations/20261025170000_ignorer_competences_exemple.sql").replace(/--.*$/gm, "");
  test("même règle exacte en SQL ; les deux fonctions gardent signature et SECURITY DEFINER ; aucune donnée modifiée", () => {
    expect(sql).toContain(`p_skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb`);
    expect(sql).toContain("public.competences_reelles(skills)");
    expect(sql).toContain("jsonb_array_length(COALESCE(public.competences_reelles(p.skills), '[]'::jsonb)) > 0");
    expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(2);
    expect(sql.match(/SET search_path/g).length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bINSERT\b|\bDROP\b|\bALTER\b|TRUNCATE/i);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.competences_reelles(JSONB) FROM PUBLIC, anon;");
  });
  test("le retour arrière remet les deux fonctions d'origine et supprime la fonction d'aide", () => {
    const retour = fs.readFileSync(path.join(__dirname, "../../docs/rollbacks/20261025170000_ignorer_competences_exemple.down.sql"), "utf8");
    expect(retour).toContain("DROP FUNCTION IF EXISTS public.competences_reelles(JSONB);");
    expect(retour).toContain("jsonb_array_length(COALESCE(p.skills, '[]'::jsonb)) > 0");
    expect(retour).not.toContain("competences_reelles(skills)");
  });
});
