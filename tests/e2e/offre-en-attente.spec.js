const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Offre en attente de modération : un candidat qui ouvre la fiche voit un message clair avec le bouton désactivé (au
 * lieu d'une candidature qui échoue en 404).
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Offre en attente de modération", () => {
  test.setTimeout(180_000);
  let admin;
  const comptes = [];
  const horodatage = Date.now();
  const recruteur = { email: `e2e-recr-${horodatage}@facilite-demo.local`, mdp: `Recr-${horodatage}-Aa1!` };
  const candidat = { email: `e2e-cand-${horodatage}@facilite-demo.local`, mdp: `Cand-${horodatage}-Aa1!` };
  const titre = `E2E offre en attente ${horodatage}`;
  let offreId;

  async function creer(c, nom, extra = {}) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: c.mdp, email_confirm: true });
    expect(error).toBeNull();
    comptes.push(data.user.id);
    await new Promise((r) => setTimeout(r, 3500));
    // Le schéma du projet de test n'a pas toutes les colonnes de production (ex. onboarding_done) : on ne pose que ce qui existe.
    await admin.from("profiles").update({ full_name: nom, ...extra }).eq("id", data.user.id);
    c.id = data.user.id;
  }
  async function connecter(page, c) {
    await page.goto("/login");
    await page.getByPlaceholder("nom@exemple.com").fill(c.email);
    await page.getByRole("button", { name: "Continuer avec l'e-mail" }).click();
    await page.getByPlaceholder("Saisissez votre mot de passe").fill(c.mdp);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }

  test.beforeAll(async () => {
    const env = loadTestEnv();
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await creer(recruteur, "Recruteur E2E");
    await creer(candidat, "Candidat E2E");
  });
  test.afterAll(async () => {
    await admin.from("job_offers").delete().eq("recruiter_id", recruteur.id);
    for (const id of comptes) await admin.auth.admin.deleteUser(id);
  });

  test("un candidat qui ouvre une offre en attente voit un message clair et un bouton désactivé", async ({ page }) => {
    // Le projet de test n'a ni la table feature_flags ni les rôles de production : le parcours recruteur (publication par
    // l'interface) n'y est pas jouable. On crée donc l'offre côté base, en attente comme le fait la publication réelle ;
    // le message du recruteur est couvert par tests/unit/message-publication.spec.js.
    const { data: o, error } = await admin
      .from("job_offers")
      .insert({ title: titre, company: "Entreprise E2E", location: "Dakar", description: "Offre de test automatisé.", recruiter_id: recruteur.id, is_active: true })
      .select("id")
      .single();
    expect(error).toBeNull();
    offreId = o.id;
    await admin.from("job_offers").update({ status: "pending_review" }).eq("id", offreId);

    await connecter(page, candidat);
    await page.goto(`/offres/${offreId}`);
    await expect(page.getByText(/Cette offre est en cours de validation/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /En cours de validation/ }).first()).toBeDisabled();
  });
});
