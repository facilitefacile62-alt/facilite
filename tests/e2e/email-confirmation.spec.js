const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Lien de confirmation d'e-mail (inscription) : la personne doit être CONNECTÉE et arriver sur /bienvenue.
 *
 * Le compte est créé côté serveur par /api/auth/register : le lien est donc « implicite » (jetons dans le fragment #…,
 * jamais ?code=…). On reproduit exactement cela : lien d'inscription généré par le serveur du projet de test, suivi sans
 * redirection pour récupérer le fragment que le navigateur reçoit, puis ouverture de /auth/callback avec ce fragment.
 */
test.describe("Confirmation d'e-mail : arrivée connectée sur /bienvenue", () => {
  test.setTimeout(120_000);
  let admin;
  let env;
  const comptes = [];

  test.beforeAll(() => {
    env = loadTestEnv();
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  });
  test.afterAll(async () => {
    for (const id of comptes) await admin.auth.admin.deleteUser(id);
  });

  async function fragmentDeConfirmation() {
    const email = `e2e-confirm-${Date.now()}-${Math.floor(Math.random() * 1e4)}@facilite-demo.local`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: `Confirm-${Date.now()}-Aa1!`,
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fbienvenue" },
    });
    expect(error).toBeNull();
    comptes.push(data.user.id);
    const reponse = await fetch(data.properties.action_link, { redirect: "manual" });
    const destination = reponse.headers.get("location") || "";
    expect(destination).toContain("#access_token=");
    return destination.slice(destination.indexOf("#"));
  }

  test("le clic sur le lien ouvre la session et mène à /bienvenue en conservant ?redirect=", async ({ page }) => {
    const fragment = await fragmentDeConfirmation();
    const suivant = encodeURIComponent("/bienvenue?redirect=" + encodeURIComponent("/offres/abc"));
    await page.goto(`/auth/callback?next=${suivant}${fragment}`);
    await page.waitForURL((u) => u.pathname === "/bienvenue", { timeout: 60_000 });
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/offres/abc");
    await expect(page.getByText(/Bienvenue sur Facilité/)).toBeVisible({ timeout: 30_000 });
    // La session existe vraiment : une page protégée ne renvoie pas vers /login.
    await page.goto("/profil");
    await page.waitForLoadState("domcontentloaded");
    expect(new URL(page.url()).pathname).not.toBe("/login");
  });

  test("garde-fou : une destination externe est ignorée (jamais de redirection ouverte)", async ({ page }) => {
    const fragment = await fragmentDeConfirmation();
    await page.goto(`/auth/callback?next=${encodeURIComponent("//evil.example.com/piege")}${fragment}`);
    await page.waitForURL((u) => u.origin === "http://localhost:3000" && u.pathname !== "/auth/confirmation" && u.pathname !== "/auth/callback", { timeout: 60_000 });
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("lien expiré : message clair et lien vers la connexion, pas de page blanche", async ({ page }) => {
    await page.goto("/auth/callback?next=%2Fbienvenue#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await expect(page.getByRole("heading", { name: "Ce lien a expiré" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Aller à la connexion" })).toBeVisible();
  });
});
