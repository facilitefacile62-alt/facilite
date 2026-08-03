const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Vague 2 (Partie 1 du chantier, docs/grants-matrix.md) : DELETE est révoqué
 * de authenticated sur les 17 tables. 3 usages client existants ont été
 * remplacés par des fonctions SECURITY DEFINER — ce fichier prouve que
 * chacune fonctionne pour son propriétaire, refuse un non-propriétaire, et
 * qu'un DELETE brut (contournant la fonction) échoue désormais au niveau
 * PostgreSQL, pas seulement dans l'UI.
 *
 * Le nettoyage des fixtures utilise une connexion CLI privilégiée
 * (runPrivilegedSql, même pattern que test-account-isolation.spec.js) : le
 * compte admin de test N'A PLUS le droit de DELETE non plus depuis la
 * Vague 2 — un client "admin" logué reste soumis aux mêmes GRANT que
 * n'importe quel authenticated, ce n'est pas service_role.
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
  const tmpFile = path.join(os.tmpdir(), `wave2-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Vague 2 — remplacement des DELETE client par des fonctions SECURITY DEFINER", () => {
  let candidateClient, securityClient, anonClient;
  let candidateId, securityId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr, `Connexion candidat échouée : ${candErr?.message}`).toBeNull();
    candidateId = candAuth.user.id;

    const { data: secAuth, error: secErr } = await securityClient.auth.signInWithPassword({
      email: SECURITY_EMAIL,
      password: SECURITY_PASSWORD,
    });
    expect(secErr, `Connexion security échouée : ${secErr?.message}`).toBeNull();
    securityId = secAuth.user.id;

    // Étape D (2026-08-03) : créer une offre exige désormais le badge
    // verified_recruiter (20260803110000_badge_gate_espace_recruteur.sql) —
    // les deux comptes créent une offre plus bas dans ce fichier. Accordé
    // pour la durée de ce fichier seulement (workers:1, exécution
    // séquentielle, jamais en parallèle avec recruiter-search-views.spec.js
    // qui exige candidateId NON badgé par défaut).
    runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id IN ('${candidateId}', '${securityId}') AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);
  });

  test.afterAll(() => {
    runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges - 'verified_recruiter'
      WHERE id IN ('${candidateId}', '${securityId}');
    `);
  });

  test("DELETE brut sur resumes échoue désormais au niveau PostgreSQL pour authenticated", async () => {
    const { data: resume, error: insertErr } = await candidateClient
      .from("resumes")
      .insert({ user_id: candidateId, title: "Test raw delete", type: "created", content: {} })
      .select()
      .single();
    expect(insertErr, `Insertion resume échouée : ${insertErr?.message}`).toBeNull();

    const { error, count } = await candidateClient.from("resumes").delete({ count: "exact" }).eq("id", resume.id);
    // Sans le GRANT, PostgREST peut soit renvoyer une erreur 42501 explicite,
    // soit un DELETE "silencieux" de 0 ligne selon la version — dans tous
    // les cas, la ligne doit être TOUJOURS là ensuite, ce qui est la seule
    // garantie qui compte réellement.
    if (!error) {
      expect(count, "Un DELETE brut ne devrait affecter aucune ligne (GRANT révoqué).").toBe(0);
    }

    const { data: stillThere } = await candidateClient.from("resumes").select("id").eq("id", resume.id).maybeSingle();
    expect(stillThere, "La ligne devait survivre à un DELETE brut sans privilège.").not.toBeNull();

    runPrivilegedSql(`DELETE FROM public.resumes WHERE id = '${resume.id}';`);
  });

  test("delete_own_resume() supprime la ligne pour le propriétaire et renvoie le chemin Storage à nettoyer", async () => {
    const storagePath = `${candidateId}/wave2-test-${Date.now()}.pdf`;
    const { error: uploadErr } = await candidateClient.storage
      .from("resumes")
      .upload(storagePath, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }));
    expect(uploadErr, `Upload de test échoué : ${uploadErr?.message}`).toBeNull();

    const { data: resume, error: insertErr } = await candidateClient
      .from("resumes")
      .insert({ user_id: candidateId, title: "Test delete_own_resume", type: "imported", file_url: storagePath, content: {} })
      .select()
      .single();
    expect(insertErr, `Insertion resume échouée : ${insertErr?.message}`).toBeNull();

    const { data: returnedPath, error: rpcErr } = await candidateClient.rpc("delete_own_resume", { resume_id: resume.id });
    expect(rpcErr).toBeNull();
    expect(returnedPath).toBe(storagePath);

    const { data: rowAfter } = await candidateClient.from("resumes").select("id").eq("id", resume.id).maybeSingle();
    expect(rowAfter, "La ligne resumes aurait dû être supprimée.").toBeNull();

    // Le chemin renvoyé permet à l'appelant de nettoyer le fichier via l'API
    // Storage (comme le fait profil/page.js) — on le fait ici pour vérifier
    // que le chemin renvoyé est bien exploitable, et pour nettoyer le test.
    const { error: removeErr } = await candidateClient.storage.from("resumes").remove([returnedPath]);
    expect(removeErr).toBeNull();
    const { data: filesAfter } = await candidateClient.storage.from("resumes").list(candidateId);
    const stillThere = (filesAfter || []).some((f) => storagePath.endsWith(f.name));
    expect(stillThere, "Le fichier Storage aurait dû être supprimable via le chemin renvoyé.").toBe(false);
  });

  test("delete_own_resume() refuse de supprimer le CV d'un autre utilisateur", async () => {
    const { data: resume, error: insertErr } = await securityClient
      .from("resumes")
      .insert({ user_id: securityId, title: "Appartient à security", type: "created", content: {} })
      .select()
      .single();
    expect(insertErr, `Insertion resume échouée : ${insertErr?.message}`).toBeNull();

    let threw = false;
    try {
      await candidateClient.rpc("delete_own_resume", { resume_id: resume.id }).throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "candidate n'aurait pas dû pouvoir supprimer un CV appartenant à security.").toBe(true);

    const { data: stillThere } = await securityClient.from("resumes").select("id").eq("id", resume.id).maybeSingle();
    expect(stillThere, "Le CV de security doit toujours exister.").not.toBeNull();

    runPrivilegedSql(`DELETE FROM public.resumes WHERE id = '${resume.id}';`);
  });

  test("archive_own_job_offer() archive l'offre et la rend invisible publiquement", async () => {
    const { data: offer, error: insertErr } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre test Vague 2", company: "Test SARL", location: "Dakar", recruiter_id: candidateId, is_active: true })
      .select()
      .single();
    expect(insertErr, `Insertion offre échouée : ${insertErr?.message}`).toBeNull();

    const { data: archived, error: rpcErr } = await candidateClient.rpc("archive_own_job_offer", { offer_id: offer.id });
    expect(rpcErr).toBeNull();
    expect(archived).toBe(true);

    const { data: rowAfter } = await candidateClient
      .from("job_offers")
      .select("archived_at, is_active")
      .eq("id", offer.id)
      .single();
    expect(rowAfter.archived_at).not.toBeNull();
    expect(rowAfter.is_active).toBe(false);

    // Invisibilité publique vérifiée via un client SANS session (le visiteur
    // anonyme de /offres) — pas juste que la ligne existe, mais que la
    // policy RLS de lecture publique l'exclut réellement.
    const { data: publicView } = await anonClient.from("job_offers").select("id").eq("id", offer.id).maybeSingle();
    expect(publicView, "Une offre archivée ne doit plus être lisible publiquement (RLS).").toBeNull();

    runPrivilegedSql(`DELETE FROM public.job_offers WHERE id = '${offer.id}';`);
  });

  test("archive_own_job_offer() refuse d'archiver l'offre d'un autre recruteur", async () => {
    const { data: offer, error: insertErr } = await securityClient
      .from("job_offers")
      .insert({ title: "Offre appartenant à security", company: "Test SARL", location: "Dakar", recruiter_id: securityId, is_active: true })
      .select()
      .single();
    expect(insertErr, `Insertion offre échouée : ${insertErr?.message}`).toBeNull();

    let threw = false;
    try {
      await candidateClient.rpc("archive_own_job_offer", { offer_id: offer.id }).throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "candidate n'aurait pas dû pouvoir archiver une offre appartenant à security.").toBe(true);

    const { data: rowAfter } = await securityClient.from("job_offers").select("archived_at").eq("id", offer.id).single();
    expect(rowAfter.archived_at).toBeNull();

    runPrivilegedSql(`DELETE FROM public.job_offers WHERE id = '${offer.id}';`);
  });

  test("clear_own_assistant_messages() efface uniquement les messages du propriétaire pour cette conversation", async () => {
    const convId = `11111111-0000-4000-a000-${Date.now().toString().slice(-12).padStart(12, "0")}`;

    await candidateClient.from("assistant_messages").insert([
      { user_id: candidateId, conversation_id: convId, role: "user", content: "bonjour" },
      { user_id: candidateId, conversation_id: convId, role: "assistant", content: "bonjour !" },
    ]);
    // Même conversation_id "deviné", mais appartenant à security — ne doit
    // jamais être touché par l'appel de candidate.
    await securityClient.from("assistant_messages").insert([
      { user_id: securityId, conversation_id: convId, role: "user", content: "message de security" },
    ]);

    const { data: deletedCount, error: rpcErr } = await candidateClient.rpc("clear_own_assistant_messages", { conv_id: convId });
    expect(rpcErr).toBeNull();
    expect(deletedCount).toBe(2);

    const { data: candidateRows } = await candidateClient
      .from("assistant_messages")
      .select("id")
      .eq("conversation_id", convId);
    expect(candidateRows).toEqual([]);

    const { data: securityRows } = await securityClient
      .from("assistant_messages")
      .select("id")
      .eq("conversation_id", convId);
    expect(securityRows.length, "Les messages de security n'auraient jamais dû être touchés.").toBe(1);

    runPrivilegedSql(`DELETE FROM public.assistant_messages WHERE conversation_id = '${convId}';`);
  });
});
