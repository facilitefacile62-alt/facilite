const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Preuve, contre l'API Supabase réelle (clé anon, appel direct — pas
 * l'interface), qu'un utilisateur authentifié ne peut ni se promouvoir
 * admin, ni s'attribuer un badge, ni lire les rôles d'un autre utilisateur.
 * Section 2 du chantier RBAC (20260802050000_rbac_user_roles.sql).
 */


const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("RBAC — escalade de privilèges via l'API directe", () => {
  let supabase;
  let userId;
  let adminUserId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(error, `Connexion candidat échouée : ${error?.message}`).toBeNull();
    userId = data.user.id;

    // Session admin temporaire, uniquement pour récupérer son user_id (cible
    // du test de lecture croisée ci-dessous) — signOut juste après, la suite
    // des tests continue avec la session candidat de "supabase".
    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: adminAuth, error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();
    adminUserId = adminAuth.user.id;
    await adminClient.auth.signOut();
  });

  test("un utilisateur authentifié ne peut pas s'attribuer le rôle admin", async () => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", userId);

    // REVOKE UPDATE ... FROM authenticated : erreur de privilège de colonne
    // avant même que RLS n'entre en jeu.
    expect(error, "L'UPDATE sur user_roles a réussi alors qu'aucun privilège n'est accordé.").not.toBeNull();

    const { data: profile } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    expect(profile.role, "Le rôle a changé malgré l'erreur.").toBe("user");
  });

  test("un utilisateur authentifié ne peut pas s'attribuer un badge", async () => {
    // Contrairement à user_roles (REVOKE total -> erreur explicite),
    // profiles.badges est protégé par un trigger (trg_protect_cosmetic_columns)
    // qui annule silencieusement le changement sans lever d'exception — même
    // mécanique que l'ancien anti-escalade de "role" avant sa migration vers
    // user_roles. L'UPDATE réussit donc (pas d'erreur attendue), seule la
    // valeur ne doit pas avoir bougé.
    //
    // Comparaison avant/après plutôt qu'une valeur absolue attendue ([]) :
    // un run précédent (avant que ce test n'existe sous sa forme actuelle)
    // a laissé une escalade réussie en base, jamais nettoyée puisque seul
    // service_role peut réécrire cette colonne — un test qui suppose l'état
    // initial serait fragile face à exactement ce genre de résidu.
    const { data: before } = await supabase.from("profiles").select("badges").eq("id", userId).single();

    const attemptedBadges = [...(before.badges || []), `escalation-attempt-${Date.now()}`];
    await supabase.from("profiles").update({ badges: attemptedBadges }).eq("id", userId);

    const { data: after } = await supabase.from("profiles").select("badges").eq("id", userId).single();
    expect(after.badges, "Le tableau de badges a changé malgré le trigger anti-escalade.").toEqual(before.badges);
  });

  test("un utilisateur authentifié ne peut pas lire le rôle d'un autre utilisateur", async () => {
    // La policy SELECT de user_roles est "auth.uid() = user_id" : lire la
    // ligne d'un autre utilisateur (ici le compte admin de démo) ne doit
    // renvoyer aucune ligne — RLS filtre silencieusement, pas d'erreur
    // explicite, comportement normal de PostgREST.
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, status")
      .eq("user_id", adminUserId);

    expect(error).toBeNull();
    expect(data, "Le rôle d'un autre utilisateur a été lisible.").toEqual([]);
  });
});
