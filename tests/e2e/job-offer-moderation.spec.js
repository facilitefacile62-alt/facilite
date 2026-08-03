const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Étape 3 du chantier : modération des offres (draft/pending_review/
 * approved/rejected, 20260803040000_moderation_et_suspension.sql). Une
 * offre n'est jamais visible publiquement avant approbation explicite par
 * un admin, et toute modification substantielle repasse l'offre en attente
 * — testé contre l'API réelle (clé anon + JWT), pas une simulation.
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

function runPrivilegedSql(sql) {
  const tmpFile = path.join(os.tmpdir(), `moderation-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    const output = execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(output.slice(output.indexOf("{"))).rows || [];
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Modération des offres d'emploi", () => {
  let candidateClient, securityClient, adminClient, anonClient;
  let candidateId, securityId;
  const createdOfferIds = [];

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({ email: CANDIDATE_EMAIL, password: CANDIDATE_PASSWORD });
    candidateId = candAuth.user.id;
    const { data: secAuth } = await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    securityId = secAuth.user.id;
    await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    // Étape D (2026-08-03) : créer une offre exige désormais le badge
    // verified_recruiter (20260803110000_badge_gate_espace_recruteur.sql) —
    // accordé ici pour la durée de ce fichier seulement (workers:1 dans
    // playwright.config.js, exécution séquentielle, jamais en parallèle
    // avec recruiter-search-views.spec.js qui exige au contraire que ce
    // même compte reste NON badgé par défaut).
    runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id = '${candidateId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);
  });

  test.afterAll(() => {
    if (createdOfferIds.length > 0) {
      runPrivilegedSql(`DELETE FROM public.job_offers WHERE id IN (${createdOfferIds.map((id) => `'${id}'`).join(",")});`);
    }
    runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${candidateId}';`);
  });

  test("une nouvelle offre n'est PAS visible publiquement avant approbation", async () => {
    const { data: offer, error } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre modération test", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    expect(error).toBeNull();
    createdOfferIds.push(offer.id);
    expect(offer.status, "Une offre nouvelle doit démarrer en pending_review, jamais approuvée par défaut.").toBe("pending_review");

    const { data: publicView } = await anonClient.from("job_offers").select("id").eq("id", offer.id).maybeSingle();
    expect(publicView, "Une offre en attente ne doit jamais être lisible publiquement.").toBeNull();
  });

  test("un recruteur ne peut pas s'auto-approuver en insérant directement status: 'approved'", async () => {
    const { data: offer, error } = await candidateClient
      .from("job_offers")
      .insert({ title: "Tentative auto-approbation à l'insertion", company: "Test SARL", location: "Dakar", recruiter_id: candidateId, status: "approved" })
      .select()
      .single();
    expect(error).toBeNull();
    createdOfferIds.push(offer.id);
    expect(offer.status, "Le statut fourni côté client à l'INSERT doit être ignoré, jamais honoré.").toBe("pending_review");

    const { data: publicView } = await anonClient.from("job_offers").select("id").eq("id", offer.id).maybeSingle();
    expect(publicView, "Une offre auto-approbation-tentée ne doit jamais être publique.").toBeNull();
  });

  test("un utilisateur non-admin ne peut pas approuver sa propre offre", async () => {
    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Auto-approbation test", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    let threw = false;
    try {
      await candidateClient.rpc("moderate_job_offer", { offer_id: offer.id, decision: "approved" }).throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "moderate_job_offer() doit être réservée aux admins.").toBe(true);

    const { data: stillPending } = await securityClient.from("job_offers").select("status").eq("id", offer.id).maybeSingle();
    // securityClient n'est pas propriétaire, mais on vérifie via privilégié pour être sûr.
    const rows = runPrivilegedSql(`SELECT status FROM public.job_offers WHERE id = '${offer.id}';`);
    expect(rows[0].status).toBe("pending_review");
    void stillPending;
  });

  test("après approbation par un admin, l'offre devient visible publiquement", async () => {
    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre approuvée test", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { data: ok, error } = await adminClient.rpc("moderate_job_offer", { offer_id: offer.id, decision: "approved" });
    expect(error).toBeNull();
    expect(ok).toBe(true);

    const { data: publicView } = await anonClient.from("job_offers").select("id, status").eq("id", offer.id).maybeSingle();
    expect(publicView, "Une offre approuvée doit être lisible publiquement.").not.toBeNull();
    expect(publicView.status).toBe("approved");
  });

  test("modifier un champ substantiel d'une offre approuvée la repasse automatiquement en attente", async () => {
    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre à modifier", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    createdOfferIds.push(offer.id);
    await adminClient.rpc("moderate_job_offer", { offer_id: offer.id, decision: "approved" });

    const { error: updateErr } = await candidateClient
      .from("job_offers")
      .update({ description: "Nouvelle description substantielle" })
      .eq("id", offer.id);
    expect(updateErr).toBeNull();

    const rows = runPrivilegedSql(`SELECT status FROM public.job_offers WHERE id = '${offer.id}';`);
    expect(rows[0].status, "Une modification substantielle doit repasser l'offre en pending_review.").toBe("pending_review");

    const { data: publicView } = await anonClient.from("job_offers").select("id").eq("id", offer.id).maybeSingle();
    expect(publicView, "L'offre repassée en attente ne doit plus être publique.").toBeNull();
  });

  test("mettre en pause (is_active) une offre approuvée NE la repasse PAS en modération", async () => {
    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre pause test", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    createdOfferIds.push(offer.id);
    await adminClient.rpc("moderate_job_offer", { offer_id: offer.id, decision: "approved" });

    await candidateClient.from("job_offers").update({ is_active: false }).eq("id", offer.id);

    const rows = runPrivilegedSql(`SELECT status FROM public.job_offers WHERE id = '${offer.id}';`);
    expect(rows[0].status, "Une simple pause ne doit pas nécessiter une nouvelle modération.").toBe("approved");
  });

  test("un utilisateur ne peut pas changer le statut de modération directement", async () => {
    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre statut direct test", company: "Test SARL", location: "Dakar", recruiter_id: candidateId })
      .select()
      .single();
    createdOfferIds.push(offer.id);

    const { error } = await candidateClient.from("job_offers").update({ status: "approved" }).eq("id", offer.id);
    expect(error, "Un utilisateur ne doit pas pouvoir s'auto-approuver via un UPDATE direct du statut.").not.toBeNull();
  });
});

test.describe("Signalements (reports)", () => {
  let candidateClient, securityClient, adminClient;
  let candidateId;
  const createdReportIds = [];

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({ email: CANDIDATE_EMAIL, password: CANDIDATE_PASSWORD });
    candidateId = candAuth.user.id;
    await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  });

  test.afterAll(() => {
    if (createdReportIds.length > 0) {
      runPrivilegedSql(`DELETE FROM public.reports WHERE id IN (${createdReportIds.map((id) => `'${id}'`).join(",")});`);
    }
  });

  test("un utilisateur peut signaler, et ne lit que ses propres signalements", async () => {
    const { data: report, error } = await candidateClient
      .from("reports")
      .insert({ reporter_id: candidateId, target_type: "job_offer", target_id: "00000000-0000-4000-a000-000000000000", reason: "Offre suspecte" })
      .select()
      .single();
    expect(error).toBeNull();
    createdReportIds.push(report.id);

    const { data: otherView } = await securityClient.from("reports").select("id").eq("id", report.id).maybeSingle();
    expect(otherView, "Un autre utilisateur ne doit pas voir ce signalement.").toBeNull();
  });

  test("un admin lit et résout un signalement, jamais ne le supprime", async () => {
    const { data: report } = await candidateClient
      .from("reports")
      .insert({ reporter_id: candidateId, target_type: "job_offer", target_id: "00000000-0000-4000-a000-000000000001", reason: "Autre" })
      .select()
      .single();
    createdReportIds.push(report.id);

    const { data: adminView } = await adminClient.from("reports").select("id").eq("id", report.id).maybeSingle();
    expect(adminView, "Un admin doit voir tous les signalements.").not.toBeNull();

    const { error: resolveErr } = await adminClient.from("reports").update({ status: "resolved" }).eq("id", report.id);
    expect(resolveErr).toBeNull();

    const { error: deleteErr, count } = await adminClient.from("reports").delete({ count: "exact" }).eq("id", report.id);
    if (!deleteErr) {
      expect(count, "Aucun rôle, admin compris, ne doit pouvoir supprimer un signalement.").toBe(0);
    }
    const rows = runPrivilegedSql(`SELECT id FROM public.reports WHERE id = '${report.id}';`);
    expect(rows.length, "Le signalement doit toujours exister après une tentative de suppression.").toBe(1);
  });
});
