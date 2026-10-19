const { test, expect } = require("@playwright/test");

/** La page d'inscription est entièrement en français (elle affichait « Sign Up », « Create Account »…). */
test("la page /register est en français", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Inscription" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await expect(page.getByPlaceholder("Créez un mot de passe")).toBeVisible();
  await expect(page.getByPlaceholder("Confirmez votre mot de passe")).toBeVisible();
  await expect(page.getByText("Continuer avec Google")).toBeVisible();
  await expect(page.getByText("Vous avez déjà un compte ?")).toBeVisible();
  const texte = await page.locator("main").innerText();
  for (const anglais of ["Sign Up", "Create Account", "Already have an account", "Log In", "Continue with Google", "Confirm Password"]) {
    expect(texte, anglais).not.toContain(anglais);
  }
});
