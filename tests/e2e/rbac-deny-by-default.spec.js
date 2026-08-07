const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Vérifie le verrouillage deny-by-default de profiles (20260802060000) :
 * l'édition légitime du profil doit continuer à fonctionner (le vrai risque
 * d'un REVOKE ON TABLE + regrant colonne par colonne est d'oublier une
 * colonne réellement utilisée et de casser l'édition de profil en
 * silence), et badges/role restent bloqués.
 */


const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

test.describe("RBAC — profiles deny-by-default", () => {
  let supabase;
  let userId;
  let originalBio;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(error, `Connexion candidat échouée : ${error?.message}`).toBeNull();
    userId = data.user.id;

    const { data: profile } = await supabase.from("profiles").select("bio").eq("id", userId).single();
    originalBio = profile.bio;
  });

  test.afterAll(async () => {
    if (supabase && userId) {
      await supabase.from("profiles").update({ bio: originalBio }).eq("id", userId);
    }
  });

  test("l'édition d'un champ de profil légitime (bio) fonctionne toujours", async () => {
    const newBio = `Test deny-by-default ${Date.now()}`;
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: CANDIDATE_EMAIL,
      bio: newBio,
      updated_at: new Date().toISOString(),
    });
    expect(error, `L'édition légitime du profil a échoué : ${error?.message}`).toBeNull();

    const { data: profile } = await supabase.from("profiles").select("bio").eq("id", userId).single();
    expect(profile.bio).toBe(newBio);
  });

  test("badges reste bloqué après le REVOKE ON TABLE", async () => {
    const { data: before } = await supabase.from("profiles").select("badges").eq("id", userId).single();
    await supabase.from("profiles").update({ badges: ["official_staff"] }).eq("id", userId);
    const { data: after } = await supabase.from("profiles").select("badges").eq("id", userId).single();
    expect(after.badges).toEqual(before.badges);
  });
});
