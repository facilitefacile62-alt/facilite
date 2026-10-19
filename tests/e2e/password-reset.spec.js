const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Parcours de récupération de mot de passe (Priorité 1, SMTP Resend).
 *
 * Ce qui EST testé ici, contre l'UI réelle (pas une simulation) :
 * - anti-énumération : le message affiché est identique qu'un compte existe
 *   ou non pour l'adresse saisie ;
 * - le formulaire "nouveau mot de passe" s'affiche correctement via
 *   /login?reset=true, y compris sans session de récupération active
 *   (comportement attendu : la mise à jour échoue proprement, pas de crash) ;
 * - un compte email/mot de passe normal ne voit JAMAIS le message
 *   "connexion Google" en mode récupération.
 *
 * Ce qui N'EST PAS testé ici, et pourquoi : la détection positive d'un
 * compte réellement Google-only (isGoogleOnlyAccount=true) exige une
 * session de récupération active pour CE compte — soit un vrai clic sur un
 * lien magique reçu par email (aucun accès boîte mail depuis ce test), soit
 * `supabase.auth.admin.generateLink()` (nécessite SUPABASE_SERVICE_ROLE_KEY,
 * absent en local — même limitation déjà documentée pour d'autres routes
 * admin cette session). Le cas négatif (un compte normal ne déclenche jamais
 * ce message) est testé à la place, ce qui couvre le risque de faux positif
 * le plus dangereux (afficher "Google" à qui ne l'est pas).
 */

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Parcours de récupération de mot de passe", () => {
  test("le message de confirmation est identique qu'un compte existe ou non (anti-énumération)", async ({ page }) => {
    // Seul ce test envoie un vrai e-mail : le SMTP n'est pas configuré sur le projet de test (facilite-e2e-test).
    // Les autres tests de ce fichier n'en ont pas besoin et s'exécutent.
    test.skip(!!process.env.TEST_SUPABASE_URL, "Le SMTP n'est pas configuré sur le projet de test (facilite-e2e-test) — ce comportement est normal et attendu.");
    await page.goto("/forgot-password");
    await page.getByPlaceholder("Enter your registered email").fill(CANDIDATE_EMAIL);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByText("E-mail envoyé !")).toBeVisible();
    const messageReal = await page.getByText(/Si un compte existe pour/).textContent();

    await page.goto("/forgot-password");
    await page.getByPlaceholder("Enter your registered email").fill("ce-compte-n-existe-clairement-pas-xyz@example.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByText("E-mail envoyé !")).toBeVisible();
    const messageFake = await page.getByText(/Si un compte existe pour/).textContent();

    // Les deux messages ne contiennent que l'adresse saisie en plus du texte
    // générique — on compare le texte générique en retirant l'adresse, pas
    // le message brut (qui diffère forcément par l'email lui-même).
    const generic = (msg) => msg.replace(CANDIDATE_EMAIL, "").replace("ce-compte-n-existe-clairement-pas-xyz@example.com", "");
    expect(generic(messageReal)).toBe(generic(messageFake));
  });

  test("/login?reset=true affiche le formulaire de nouveau mot de passe, sans session de récupération", async ({ page }) => {
    await page.goto("/login?reset=true");
    await expect(page.getByRole("heading", { name: "Nouveau mot de passe" })).toBeVisible();
    await expect(page.getByPlaceholder("Au moins 6 caractères")).toBeVisible();
    await expect(page.getByPlaceholder("Confirmez le mot de passe")).toBeVisible();

    // Sans session de récupération active, updateUser() doit échouer
    // proprement (message d'erreur affiché), jamais planter la page.
    await page.getByPlaceholder("Au moins 6 caractères").fill("NouveauMotDePasse2026!");
    await page.getByPlaceholder("Confirmez le mot de passe").fill("NouveauMotDePasse2026!");
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.getByText(/Ce lien a expiré ou a déjà été utilisé/)).toBeVisible({ timeout: 10000 });
  });

  test("un compte email/mot de passe normal ne voit jamais le message de connexion Google en mode récupération", async ({ page }) => {
    // Connexion normale (pas via un lien de récupération) puis navigation
    // vers ?reset=true avec cette session réelle et déjà authentifiée —
    // reproduit fidèlement la condition qui déclenche la vérification
    // d'identité côté login/page.js (isRecoveryMode=true + session active).
    await page.goto("/login");
    await page.getByPlaceholder("nom@exemple.com").fill(CANDIDATE_EMAIL);
    await page.getByRole("button", { name: "Continuer avec l'e-mail" }).click();
    await page.getByPlaceholder("Saisissez votre mot de passe").fill(CANDIDATE_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    // La page d'arrivée après connexion a changé au fil des refontes : on attend seulement d'avoir quitté /login.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });

    await page.goto("/login?reset=true");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/connexion Google/)).not.toBeVisible();
  });

  test("nouveau mot de passe enregistré : l'ancien est refusé, le nouveau accepté, les autres appareils sont déconnectés", async ({ page }) => {
    // Limite assumée : le navigateur du site utilise le flux PKCE (lien reçu = ?code=… échangé contre une session), qu'un
    // lien généré côté serveur ne peut pas reproduire sans boîte mail (le projet de test n'a pas de SMTP). On ouvre donc
    // une session par connexion normale, puis on passe par le MÊME formulaire /login?reset=true et le même appel
    // (updateUser + déconnexion globale). Le point propre au lien — l'échange du code — n'est pas couvert ici.
    test.setTimeout(120_000);
    const env = loadTestEnv();
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const email = `e2e-recup-${Date.now()}@facilite-demo.local`;
    const ancien = `Ancien-${Date.now()}-Aa1!`;
    const nouveau = `Nouveau-${Date.now()}-Bb2!`;
    const { data: cree, error } = await admin.auth.admin.createUser({ email, password: ancien, email_confirm: true });
    expect(error).toBeNull();
    try {
      // « Autre appareil » : une seconde session du même compte, qui doit être fermée par le changement.
      const autreAppareil = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data: sessionAutre } = await autreAppareil.auth.signInWithPassword({ email, password: ancien });
      expect(sessionAutre.session).toBeTruthy();

      await page.goto("/login");
      await page.getByPlaceholder("nom@exemple.com").fill(email);
      await page.getByRole("button", { name: "Continuer avec l'e-mail" }).click();
      await page.getByPlaceholder("Saisissez votre mot de passe").fill(ancien);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

      await page.goto("/login?reset=true");
      await page.getByPlaceholder("Au moins 6 caractères").fill(nouveau);
      await page.getByPlaceholder("Confirmez le mot de passe").fill(nouveau);
      await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
      await page.waitForURL((url) => url.pathname === "/login" && !url.search.includes("reset"), { timeout: 30_000 });

      const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      expect((await anon.auth.signInWithPassword({ email, password: nouveau })).error).toBeNull();
      expect((await anon.auth.signInWithPassword({ email, password: ancien })).error).not.toBeNull();
      const rafraichi = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
        .auth.refreshSession({ refresh_token: sessionAutre.session.refresh_token });
      expect(rafraichi.error, "l'autre appareil doit être déconnecté").not.toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(cree.user.id);
    }
  });
});
