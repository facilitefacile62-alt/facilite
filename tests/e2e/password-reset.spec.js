const { test, expect } = require("@playwright/test");

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
    await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
    await expect(page.locator("text=⚠️")).toBeVisible({ timeout: 10000 });
  });

  test("un compte email/mot de passe normal ne voit jamais le message de connexion Google en mode récupération", async ({ page }) => {
    // Connexion normale (pas via un lien de récupération) puis navigation
    // vers ?reset=true avec cette session réelle et déjà authentifiée —
    // reproduit fidèlement la condition qui déclenche la vérification
    // d'identité côté login/page.js (isRecoveryMode=true + session active).
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(CANDIDATE_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(CANDIDATE_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20000 });

    await page.goto("/login?reset=true");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/connexion Google/)).not.toBeVisible();
  });
});
