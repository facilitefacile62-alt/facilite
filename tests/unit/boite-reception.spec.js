const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");
const migration = () => lire("supabase/migrations/20261127130000_boite_reception_recruteur.sql");

const niveaux = [
  { code: "BFEM", rang: 2, comparable: true, libelle: "BFEM" },
  { code: "BAC", rang: 3, comparable: true, libelle: "Baccalauréat" },
  { code: "L3", rang: 6, comparable: true, libelle: "Licence" },
  { code: "DAARA", rang: null, comparable: false, libelle: "Daara" },
];
const candidature = (id, champs) => ({ candidature_id: id, statut: "pending", score: null, niveau_code: null, recue_le: "2026-11-01T10:00:00Z", ...champs });

test("filtres et tris : statut, niveau minimum, correspondance, date", async () => {
  const { filtrerEtTrier } = await import("../../src/lib/boiteReception.js");
  const liste = [
    candidature("a", { score: 80, niveau_code: "BFEM", recue_le: "2026-11-01T10:00:00Z" }),
    candidature("b", { score: 40, niveau_code: "L3", recue_le: "2026-11-03T10:00:00Z", statut: "reviewed" }),
    candidature("c", { score: null, niveau_code: "DAARA", recue_le: "2026-11-02T10:00:00Z" }),
  ];
  const ids = (options) => filtrerEtTrier(liste, options, niveaux).map((c) => c.candidature_id);
  expect(ids({})).toEqual(["b", "c", "a"]);
  expect(ids({ tri: "correspondance" })).toEqual(["a", "b", "c"]);
  expect(ids({ tri: "niveau" })).toEqual(["b", "a", "c"]);
  expect(ids({ statut: "reviewed" })).toEqual(["b"]);
  expect(ids({ niveauMin: "BAC" })).toEqual(["b"]);
  expect(ids({ scoreMin: 75 })).toEqual(["a"]);
});

test("le candidat voit son vrai statut ; « Contacté » n'est plus affiché « Envoyée »", async () => {
  const { infoStatut, STATUTS_CHOISISSABLES } = await import("../../src/lib/statutsCandidature.js");
  expect(infoStatut("contacted").candidat).toBe("Contactée");
  expect(infoStatut("viewed").recruteur).toBe("Vu");
  expect(STATUTS_CHOISISSABLES.map((s) => s.recruteur)).toEqual(["Nouveau", "Vu", "Présélectionné", "Entretien", "Retenu", "Refusé"]);
  expect(lire("src/app/candidat/candidatures/page.js")).not.toContain("KNOWN_STATUSES");
});

test("la migration : propriété et offre approuvée, comptes de test exclus, notes et journal sans écriture directe", () => {
  const sql = migration();
  expect(sql).toContain("and p.is_test_account");
  expect(sql).toContain("o.recruiter_id = auth.uid() and o.status = 'approved'");
  expect(sql).toContain("insert into public.journal_consultations_cv");
  expect(sql).toMatch(/revoke all on public\.candidature_notes from public, anon, authenticated;/);
  // Aucun GRANT d'écriture à un client (invariant 1) et chaque fonction définie avec un search_path figé (invariant 3).
  expect(sql).not.toMatch(/grant\s+(insert|update|delete)\b/i);
  const definies = sql.match(/security definer/g).length;
  expect(sql.match(/security definer set search_path = ''/g)).toHaveLength(definies);
  // La règle de stockage ne laisse plus passer un recruteur.
  const politique = sql.slice(sql.indexOf('create policy "Proprietaire et administrateur lisent les CV"'));
  expect(politique).not.toContain("has_badge");
  expect(fs.existsSync(path.join(racine, "supabase/retours_arriere/20261127130000_boite_reception_recruteur.sql"))).toBe(true);
});

test("le CV ne sort que par un lien signé court, après contrôle et journal en base", () => {
  const route = lire("src/app/api/recruteur/candidatures/[id]/cv/route.js");
  expect(route.indexOf('rpc("ouvrir_cv_candidature"')).toBeLessThan(route.indexOf("createSignedUrl"));
  expect(route).toContain("const DUREE_LIEN_S = 60;");
  expect(route).toContain("checkRateLimit(user.id)");
  expect(lire("src/components/recruteur/LecteurCv.jsx")).not.toMatch(/download=/);
});
