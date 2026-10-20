const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Bandeau « Vérifiez votre numéro » : en haut de page, dans le flux (il ne recouvre plus « Discuter », « WhatsApp » ni
 * le bas des formulaires sur mobile) ; fermé, il ne revient pas à la session suivante.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Bandeau « Vérifiez votre numéro »", () => {
  test.setTimeout(120_000);
  let admin;
  let compte;
  const email = `e2e-bandeau-${Date.now()}@facilite-demo.local`;
  const mdp = `Bandeau-${Date.now()}-Aa1!`;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password: mdp, email_confirm: true });
    expect(error).toBeNull();
    compte = data.user;
    await new Promise((r) => setTimeout(r, 3500));
    await admin.from("profiles").upsert({ id: compte.id, full_name: "Test Bandeau", onboarding_done: true });
  });
  test.afterAll(async () => {
    if (compte) await admin.auth.admin.deleteUser(compte.id);
  });

  test("bandeau dans le flux, en haut, qui ne couvre aucun bouton ; fermé, il ne revient pas", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByPlaceholder("nom@exemple.com").fill(email);
    await page.getByRole("button", { name: "Continuer avec l'e-mail" }).click();
    await page.getByPlaceholder("Saisissez votre mot de passe").fill(mdp);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

    const bandeau = page.getByRole("status").filter({ hasText: "Vérifiez votre numéro" });
    await expect(bandeau).toBeVisible({ timeout: 30_000 });
    const position = await bandeau.evaluate((el) => ({ css: getComputedStyle(el).position, y: el.getBoundingClientRect().top + window.scrollY }));
    expect(position.css).not.toBe("fixed");
    expect(position.y).toBeLessThan(80); // tout en haut de la page

    // Rien de fixe en bas d'écran ne contient ce texte.
    const fixesEnBas = await page.evaluate(() =>
      Array.from(document.querySelectorAll("*")).filter((el) => {
        const s = getComputedStyle(el);
        return s.position === "fixed" && el.getBoundingClientRect().bottom > window.innerHeight - 200 && /Vérifiez votre numéro/.test(el.textContent || "");
      }).length
    );
    expect(fixesEnBas).toBe(0);

    await page.getByRole("button", { name: "Fermer le bandeau" }).click();
    await expect(bandeau).toHaveCount(0);

    // Nouvelle « session » du même navigateur (nouvelle page, même profil) : il ne revient pas.
    const autre = await context.newPage();
    await autre.goto("/offres");
    await autre.waitForLoadState("networkidle");
    await expect(autre.getByText("Vérifiez votre numéro")).toHaveCount(0);
  });
});
