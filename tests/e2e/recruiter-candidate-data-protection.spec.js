const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Étape 4 du chantier — protection des données candidat (non négociable) :
 * coordonnées masquées tant que le candidat n'a pas explicitement accepté
 * de les révéler à CE recruteur pour CETTE candidature, isolation stricte
 * entre recruteurs, pagination plafonnée côté serveur.
 * get_recruiter_candidatures()/reveal_contact_to_recruiter() —
 * 20260803060000_recruiter_dashboard_data_protection.sql.
 */

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Protection des données candidat — tableau de bord recruteur", () => {
  let candidateClient, securityClient;
  let candidateId, securityId;
  const createdOfferIds = [];
  const createdCandidatureIds = [];

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({ email: CANDIDATE_EMAIL, password: CANDIDATE_PASSWORD });
    candidateId = candAuth.user.id;
    const { data: secAuth } = await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    securityId = secAuth.user.id;

    // Étape D (2026-08-03) : "security" joue le recruteur dans ce fichier —
    // créer une offre exige désormais le badge verified_recruiter
    // (20260803110000_badge_gate_espace_recruteur.sql). Accordé pour la
    // durée de ce fichier seulement (workers:1, exécution séquentielle).
    await runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id = '${securityId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);
  });

  test.afterAll(async () => {
    // Étapes indépendantes (.catch) : voir docs/diagnostic-tests-bloquants.md.
    if (createdCandidatureIds.length > 0) {
      await runPrivilegedSql(`DELETE FROM public.candidatures WHERE id IN (${createdCandidatureIds.map((id) => `'${id}'`).join(",")});`).catch(
        (e) => console.error("Nettoyage échoué (non bloquant) :", e.message)
      );
    }
    if (createdOfferIds.length > 0) {
      await runPrivilegedSql(`DELETE FROM public.job_offers WHERE id IN (${createdOfferIds.map((id) => `'${id}'`).join(",")});`).catch(
        (e) => console.error("Nettoyage échoué (non bloquant) :", e.message)
      );
    }
    await runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${securityId}';`).catch((e) =>
      console.error("Nettoyage échoué (non bloquant) :", e.message)
    );
  });

  test("les coordonnées sont masquées tant que le candidat n'a pas révélé, puis visibles après", async () => {
    // "security" joue le recruteur (offre + candidature spontanée directe
    // à son intention), "candidate" joue le candidat qui postule.
    const { data: offer } = await securityClient
      .from("job_offers")
      .insert({ title: "Offre protection données", company: "Test SARL", location: "Dakar", recruiter_id: securityId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { data: candidature, error: insertErr } = await candidateClient
      .from("candidatures")
      .insert({
        user_id: candidateId,
        job_offer_id: offer.id,
        full_name: "Candidat Test Protection", job_title: offer.title, company: offer.company,
        email: "candidat-secret@example.com",
        cv_url: "resumes/secret-cv.pdf",
      })
      .select()
      .single();
    expect(insertErr, `Insertion candidature échouée : ${insertErr?.message}`).toBeNull();
    createdCandidatureIds.push(candidature.id);

    const { data: beforeReveal, error: beforeErr } = await securityClient.rpc("get_recruiter_candidatures", { p_job_offer_id: offer.id });
    expect(beforeErr).toBeNull();
    const rowBefore = beforeReveal.find((r) => r.id === candidature.id);
    expect(rowBefore.email, "L'email ne doit pas être visible avant consentement.").toBeNull();
    expect(rowBefore.cv_url, "Le CV ne doit pas être visible avant consentement.").toBeNull();
    expect(rowBefore.full_name, "Le nom reste visible (pas une coordonnée de contact).").toBe("Candidat Test Protection");

    const { data: revealed, error: revealErr } = await candidateClient.rpc("reveal_contact_to_recruiter", { candidature_id: candidature.id });
    expect(revealErr).toBeNull();
    expect(revealed).toBe(true);

    const { data: afterReveal } = await securityClient.rpc("get_recruiter_candidatures", { p_job_offer_id: offer.id });
    const rowAfter = afterReveal.find((r) => r.id === candidature.id);
    expect(rowAfter.email).toBe("candidat-secret@example.com");
    expect(rowAfter.cv_url).toBe("resumes/secret-cv.pdf");
  });

  test("un recruteur ne peut pas révéler lui-même les coordonnées d'un candidat", async () => {
    const { data: offer } = await securityClient
      .from("job_offers")
      .insert({ title: "Offre anti-auto-révélation", company: "Test SARL", location: "Dakar", recruiter_id: securityId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { data: candidature, error: insertErr } = await candidateClient
      .from("candidatures")
      .insert({ user_id: candidateId, job_offer_id: offer.id, full_name: "Candidat", email: "x@example.com", cv_url: "resumes/x.pdf", job_title: offer.title, company: offer.company })
      .select()
      .single();
    expect(insertErr, `Insertion candidature échouée : ${insertErr?.message}`).toBeNull();
    createdCandidatureIds.push(candidature.id);

    let threw = false;
    try {
      await securityClient.rpc("reveal_contact_to_recruiter", { candidature_id: candidature.id }).throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "Un recruteur ne doit jamais pouvoir révéler lui-même les coordonnées d'un candidat.").toBe(true);
  });

  test("isolation : un recruteur ne voit jamais les candidatures d'un autre recruteur", async () => {
    const { data: offer } = await securityClient
      .from("job_offers")
      .insert({ title: "Offre isolation test", company: "Test SARL", location: "Dakar", recruiter_id: securityId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { data: candidature, error: insertErr } = await candidateClient
      .from("candidatures")
      .insert({ user_id: candidateId, job_offer_id: offer.id, full_name: "Candidat Isolation", email: "isolation@example.com", cv_url: "resumes/isolation.pdf", job_title: offer.title, company: offer.company })
      .select()
      .single();
    expect(insertErr, `Insertion candidature échouée : ${insertErr?.message}`).toBeNull();
    createdCandidatureIds.push(candidature.id);

    // candidateClient n'est recruteur d'AUCUNE offre — appel direct à
    // l'API avec sa propre clé anon + JWT, pas une simulation.
    const { data: foreignView, error } = await candidateClient.rpc("get_recruiter_candidatures", { p_job_offer_id: offer.id });
    expect(error).toBeNull();
    expect(foreignView, "Un compte qui n'est recruteur d'aucune offre ne doit recevoir aucune candidature.").toEqual([]);
  });

  test("un recruteur ne peut plus contourner le masquage par une lecture directe de la table", async () => {
    const { data: offer } = await securityClient
      .from("job_offers")
      .insert({ title: "Offre anti-contournement", company: "Test SARL", location: "Dakar", recruiter_id: securityId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { data: candidature } = await candidateClient
      .from("candidatures")
      .insert({
        user_id: candidateId, job_offer_id: offer.id, full_name: "Candidat Anti-Contournement",
        email: "contournement@example.com", cv_url: "resumes/contournement.pdf",
        job_title: offer.title, company: offer.company,
      })
      .select()
      .single();
    createdCandidatureIds.push(candidature.id);

    // Le recruteur ne passe PAS par get_recruiter_candidatures() ici — un
    // SELECT direct sur la table brute, exactement ce qu'un appel API
    // direct à la clé anon ferait en contournant l'UI.
    const { data: directRead, error } = await securityClient.from("candidatures").select("id, email, cv_url").eq("id", candidature.id).maybeSingle();
    expect(error).toBeNull();
    expect(directRead, "Un recruteur ne doit plus avoir aucun accès SELECT direct à la table candidatures.").toBeNull();
  });

  test("la pagination est plafonnée en dur, quelle que soit la valeur demandée", async () => {
    // p_page très grand ou négatif : ne doit jamais planter ni renvoyer une
    // liste illimitée — juste une page vide ou la première page, selon la
    // borne, mais toujours au plus 50 lignes.
    const { data, error } = await securityClient.rpc("get_recruiter_candidatures", { p_page: -5 });
    expect(error).toBeNull();
    expect(data.length).toBeLessThanOrEqual(50);
  });
});
