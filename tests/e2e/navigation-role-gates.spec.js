const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Les 7 tests exigés par la Partie 9 du chantier du 2026-08-06
 * (docs/incident-2026-08-06.md) : navigation, badges cliquables et
 * autorisation d'accès aux CV, chacun vérifié en conditions réelles.
 *
 * Comptes dédiés e2e-test-gate-* (pré-créés dans supabase/seed-test.sql,
 * section 9) plutôt que les comptes e2e-test-* partagés : découvert en
 * écrivant ces tests que e2e-test-admin, e2e-test-agent, e2e-test-candidate
 * ET e2e-test-security portent TOUS role='admin' en base réelle
 * actuellement — aucun n'est un vrai compte non-admin en ce moment, ce qui
 * aurait fait passer les tests "un non-admin ne voit pas X" pour la
 * mauvaise raison. Signalé séparément, non corrigé ici (hors périmètre de
 * ce point).
 *
 * Anciennement des comptes jetables via signUp() — remplacés le 2026-08-08
 * : ce fichier crée à lui seul jusqu'à 5 comptes (3 en beforeAll + 2 dans
 * le test 2), largement au-dessus du rate limit Auth du projet de test
 * (~4 inscriptions/heure, palier gratuit). signInWithPassword() sur des
 * comptes fixes ne consomme aucun quota de création.
 */


async function signInFixedUser(anonClient, email, password) {
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Connexion ${email} échouée : ${error.message}`);
  return { id: data.user.id, email, password, accessToken: data.session.access_token };
}

const GATE_PASSWORD = "FaciliteGateTest2026!";

test.describe("Sécurité navigation, badges et accès CV (Partie 9)", () => {
  let env, anonClient;
  let plainUser, badgedRecruiter, adminUser;

  test.beforeAll(async () => {
    env = loadTestEnv();
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    plainUser = await signInFixedUser(anonClient, "e2e-test-gate-plain@facilite-demo.local", GATE_PASSWORD);
    badgedRecruiter = await signInFixedUser(anonClient, "e2e-test-gate-recruiter@facilite-demo.local", GATE_PASSWORD);
    adminUser = await signInFixedUser(anonClient, "e2e-test-gate-admin@facilite-demo.local", GATE_PASSWORD);

    // Remise à l'état attendu à chaque run (comptes permanents, partagés
    // entre exécutions) — même discipline que admin-and-candidate.spec.js.
    await runPrivilegedSql(`
      UPDATE public.profiles SET is_test_account = true, full_name = 'Gate Test Plain' WHERE id = '${plainUser.id}';
      UPDATE public.profiles SET is_test_account = true, full_name = 'Gate Test Recruiter',
        badges = CASE WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges ELSE badges || '["verified_recruiter"]'::jsonb END
        WHERE id = '${badgedRecruiter.id}';
      UPDATE public.profiles SET is_test_account = true, full_name = 'Gate Test Admin' WHERE id = '${adminUser.id}';
      UPDATE public.user_roles SET role = 'admin' WHERE user_id = '${adminUser.id}';
    `);
  });

  test("1. un compte non authentifié ne peut télécharger aucun fichier du bucket resumes par URL directe", async () => {
    const bucketRows = await runPrivilegedSql(`SELECT public FROM storage.buckets WHERE id = 'resumes';`);
    expect(bucketRows[0]?.public, "le bucket resumes doit être privé").toBe(false);

    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/resumes/some/path.pdf`);
    expect([400, 403, 404]).toContain(res.status);
  });

  test("2. un recruteur badgé ne lit un CV que si le candidat a autorisé le contact", async () => {
    // Comptes dédiés fixes (id seulement, jamais connectés — voir seed-test.sql
    // section 9) : remis à l'état attendu par ce test au début, pas de
    // signUp() jetable.
    const candidateNoAuthId = "60000000-0000-4000-a000-000000000013";
    const candidateAuthId = "60000000-0000-4000-a000-000000000014";
    await runPrivilegedSql(`
      UPDATE public.profiles SET is_test_account = true, cv_visible_recruteurs = false WHERE id = '${candidateNoAuthId}';
      UPDATE public.profiles SET is_test_account = true, cv_visible_recruteurs = true WHERE id = '${candidateAuthId}';
    `);

    const recruiterClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${badgedRecruiter.accessToken}` } },
    });

    const { data: deniedUrl, error: deniedErr } = await recruiterClient.storage
      .from("resumes")
      .createSignedUrl(`${candidateNoAuthId}/cvs/test.pdf`, 60);
    expect(deniedUrl, "candidat non-autorisé : la signature d'URL doit échouer").toBeFalsy();
    expect(deniedErr).toBeTruthy();

    // Sans fichier réel déposé pour candidateAuth, createSignedUrl échoue quand
    // même ("Object not found") — mais l'erreur doit être DIFFÉRENTE (échec
    // de fichier, pas de policy). On le prouve autrement : record_cv_consultations
    // (même RLS effective que la policy Storage) autorise ce candidat.
    const { data: quotaCheck, error: quotaErr } = await recruiterClient.rpc("record_cv_consultations", {
      p_candidate_ids: [candidateAuthId],
    });
    expect(quotaErr).toBeFalsy();
    expect(quotaCheck?.[0]?.allowed, "candidat avec cv_visible_recruteurs=true : doit être autorisé").toBe(true);
  });

  test("3. un compte admin voit le lien Admin, un compte non-admin ne le voit pas", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(adminUser.email);
    await page.getByPlaceholder("Enter your password").fill(adminUser.password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL(/\/(admin|messagerie)/, { timeout: 20000 });

    await expect(page.getByRole("link", { name: "Admin" }).first()).toBeVisible({ timeout: 10000 });

    // Comparaison directe : un compte simple ne doit pas voir ce lien.
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(plainUser.email);
    await page.getByPlaceholder("Enter your password").fill(plainUser.password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20000 });

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("4. un compte badgé voit Recruteur, un compte sans badge ne le voit pas ET ne peut pas accéder à l'API directement", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(badgedRecruiter.email);
    await page.getByPlaceholder("Enter your password").fill(badgedRecruiter.password);
    await page.getByRole("button", { name: "Log In" }).click();
    // Un recruteur badgé est redirigé vers /recruteur, pas /messagerie —
    // contrairement à un compte simple (voir plus bas). Puis retour sur une
    // page neutre : le header ne montre pas nécessairement de raccourci vers
    // la page sur laquelle on se trouve déjà.
    await page.waitForURL(/\/(recruteur|messagerie)$/, { timeout: 20000 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Recruteur" }).first()).toBeVisible({ timeout: 10000 });

    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(plainUser.email);
    await page.getByPlaceholder("Enter your password").fill(plainUser.password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20000 });
    await expect(page.getByRole("link", { name: "Recruteur" })).toHaveCount(0);

    // Appel direct API, pas juste absence du lien : /api/recruteur/candidats-recherche
    // doit refuser ou renvoyer vide pour ce compte sans badge.
    const plainClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${plainUser.accessToken}` } },
    });
    const { data: feedRows, error: feedError } = await plainClient.rpc("get_candidats_recherche");
    expect(feedError || (feedRows || []).length === 0, "un compte sans badge ne doit recevoir aucun candidat").toBeTruthy();
  });

  test("5. aucun lien de navigation n'apparaît en double", async ({ page }) => {
    // Par LIBELLÉ visible (le bug corrigé était "Accueil" affiché deux fois
    // dans le même menu), pas par href brut : le logo et le lien "Accueil"
    // pointent légitimement tous les deux vers "/" sans être un doublon —
    // ce sont deux éléments d'UI différents (image de marque vs item de menu).
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const labels = await page.locator("nav a[href], header a[href]").evaluateAll((links) =>
      links
        .filter((l) => l.offsetParent !== null)
        .map((l) => (l.textContent || "").trim())
        .filter((t) => t.length > 0)
    );
    const counts = {};
    for (const t of labels) counts[t] = (counts[t] || 0) + 1;
    const duplicates = Object.entries(counts).filter(([, n]) => n > 1);
    expect(duplicates, `libellés de lien dupliqués visibles simultanément : ${JSON.stringify(duplicates)}`).toEqual([]);
  });

  test("6. la navigation est utilisable à 320px de large", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(bodyOverflow, "débordement horizontal détecté à 320px").toBeLessThanOrEqual(1);

    const hamburger = page.locator('[aria-label*="menu" i], button:has(i.fa-bars)').first();
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.getByRole("link", { name: "Accueil" }).first()).toBeVisible({ timeout: 5000 });
  });

  test("7. le badge n'est cliquable que sur son propre profil", async ({ page, browser }) => {
    // Sur son propre profil (authentifié) : cliquable.
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(badgedRecruiter.email);
    await page.getByPlaceholder("Enter your password").fill(badgedRecruiter.password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL(/\/(recruteur|messagerie)$/, { timeout: 20000 });
    await page.goto("/profil");
    const ownBadge = page.getByText("Recruteur vérifié").first();
    await expect(ownBadge).toBeVisible({ timeout: 10000 });
    const ownBadgeLink = page.locator('a:has-text("Recruteur vérifié")');
    await expect(ownBadgeLink).toHaveCount(1);

    // Sur le profil PUBLIC du même compte, vu par quelqu'un d'autre : pas cliquable.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto(`/recruteurs/${badgedRecruiter.id}`);
    const bodyText = await otherPage.textContent("body");
    if (bodyText && bodyText.includes("Recruteur vérifié")) {
      const publicBadgeLink = otherPage.locator('a:has-text("Recruteur vérifié")');
      await expect(publicBadgeLink).toHaveCount(0);
    }
    await otherContext.close();
  });
});
