const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Valeurs d'exemple des profils (langue « Français — Principal / Courant » et trois compétences) : arrêt à la source pour les nouveaux comptes et nettoyage
 * STRICT des comptes existants. Les deux migrations sont préparées, testées en transaction annulée, et NON appliquées : elles attendent un « go ».
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const sansCommentaires = (s) => s.replace(/--.*$/gm, "");
const LANGUE = `'[{"name": "Français", "level": "Principal / Courant"}]'::jsonb`;
const COMPETENCES = `'["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb`;

test.describe("arrêt à la source (nouveaux comptes)", () => {
  const sql = sansCommentaires(lire("supabase/migrations/20261025150000_profiles_valeurs_par_defaut_vides.sql"));
  test("seules les valeurs par défaut des deux colonnes changent (listes vides) ; aucune ligne existante n'est touchée", () => {
    expect(sql).toContain("ALTER COLUMN languages SET DEFAULT '[]'::jsonb");
    expect(sql).toContain("ALTER COLUMN skills SET DEFAULT '[]'::jsonb");
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b/i);
    const retour = sansCommentaires(lire("docs/rollbacks/20261025150000_profiles_valeurs_par_defaut_vides.down.sql"));
    expect(retour).toContain(LANGUE);
    expect(retour).toContain(COMPETENCES);
  });
});

test.describe("nettoyage des comptes existants", () => {
  const sql = sansCommentaires(lire("supabase/migrations/20261025160000_nettoyage_valeurs_exemple_profils.sql"));
  test("valeur EXACTEMENT celle de l'exemple ET profil jamais modifié (updated_at au plus 5 s après created_at)", () => {
    expect(sql).toContain(`p.languages = ${LANGUE}`);
    expect(sql).toContain(`p.skills = ${COMPETENCES}`);
    expect(sql.match(/p\.updated_at <= p\.created_at \+ interval '5 seconds'/g)).toHaveLength(2); // sauvegarde ET mise à jour : mêmes conditions
    expect(sql).not.toMatch(/\bLIKE\b|ILIKE|jsonb_array_length|DELETE|TRUNCATE|DROP\s+(TABLE|COLUMN)/i);
  });
  test("chaque colonne est jugée séparément ; seules languages et skills sont écrites ; updated_at n'est pas modifié", () => {
    const maj = sql.slice(sql.indexOf("UPDATE public.profiles"));
    expect(maj).toMatch(/SET languages = CASE WHEN p\.languages = [\s\S]*ELSE p\.languages END,\s*skills = CASE WHEN p\.skills = [\s\S]*ELSE p\.skills END/);
    expect(maj).not.toMatch(/updated_at\s*=/);
  });
  test("l'ancienne valeur est gardée avant de vider (retour arrière) dans une table fermée aux clients", () => {
    expect(sql.indexOf("INSERT INTO public.profils_valeurs_exemple_nettoyees")).toBeLessThan(sql.indexOf("UPDATE public.profiles"));
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.profils_valeurs_exemple_nettoyees FROM PUBLIC, anon, authenticated;");
    expect(sql).not.toMatch(/GRANT[^;]*profils_valeurs_exemple_nettoyees|CREATE POLICY/i);
  });
  test("le retour arrière ne remet l'exemple que là où la colonne est encore vide", () => {
    const retour = sansCommentaires(lire("docs/rollbacks/20261025160000_nettoyage_valeurs_exemple_profils.down.sql"));
    expect(retour).toContain("p.languages = '[]'::jsonb");
    expect(retour).toContain("p.skills = '[]'::jsonb");
    expect(retour).toContain("DROP TABLE IF EXISTS public.profils_valeurs_exemple_nettoyees");
  });
});
