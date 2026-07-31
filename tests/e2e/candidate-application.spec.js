const { test, expect } = require("@playwright/test");
const path = require("node:path");

/**
 * Parcours candidat complet : connexion -> vitrine recruteur publique ->
 * ouverture d'une affiche -> vérification d'éligibilité -> candidature.
 *
 * Nécessite les données créées par `supabase/seed.sql` (recruteur de démo
 * "SeneTech Solutions" + ses offres actives) et un compte candidat de test.
 * Les deux sont surchargeables via variables d'environnement pour pouvoir
 * lancer ce test contre n'importe quel environnement (staging, autre projet
 * Supabase...) sans modifier le code.
 *
 * Note sur "L'Examinateur" (cahier des charges initial) : aucun module de ce
 * nom n'existe dans l'application. Le plus proche fonctionnellement est soit
 * la vérification d'éligibilité (niveau d'étude requis vs profil du
 * candidat, qui active/désactive le bouton "Postuler"), soit le "Diagnostic
 * CV" de la page d'accueil (`DiagnosticModal`, sans rapport avec le parcours
 * vitrine -> candidature). Ce test couvre le premier, qui fait réellement
 * partie de ce parcours.
 */

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
// "SeneTech Solutions", créé par supabase/seed.sql.
const RECRUITER_ID = process.env.E2E_RECRUITER_ID || "00000000-0000-4000-a000-000000000001";

const TEST_CV_PATH = path.join(__dirname, "fixtures", "test-cv.pdf");

test.describe("Parcours candidat : vitrine recruteur -> candidature", () => {
  test("connexion, consultation d'une offre, vérification d'éligibilité et candidature", async ({ page }) => {
    // 1. Connexion du candidat de test.
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(CANDIDATE_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(CANDIDATE_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();

    // Connexion réussie : src/app/login/page.js redirige via
    // window.location.replace() après un délai fixe de 500ms (setTimeout).
    // Attendre précisément l'URL finale /messagerie, puis l'état "réseau
    // inactif", évite une course avec ce setTimeout qui écraserait sinon la
    // navigation suivante en plein vol.
    await page.waitForURL("**/messagerie", { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // 2. Navigation vers la vitrine publique du recruteur.
    await page.goto(`/recruteurs/${RECRUITER_ID}`);
    await expect(page.getByRole("heading", { name: "SeneTech Solutions" })).toBeVisible();

    // 3. Ouverture d'une affiche d'emploi depuis la galerie.
    const offerCard = page.getByRole("button", { name: /Développeur Full-Stack/ });
    await expect(offerCard).toBeVisible();
    await offerCard.click();

    const applyButton = page.getByRole("button", { name: /Postuler à cette offre|Offre clôturée|Niveau insuffisant/ });
    await expect(applyButton).toBeVisible();

    // 4. Vérification d'éligibilité (le plus proche fonctionnel de
    // "L'Examinateur" dans cette application — voir note en tête de fichier) :
    // le bouton doit être activé et libellé "Postuler à cette offre" pour
    // que la candidature soit possible. Le candidat de test a
    // education_level='Master' >= 'Licence' requis par cette offre.
    await expect(applyButton).toHaveText("Postuler à cette offre");
    await expect(applyButton).toBeEnabled();
    await applyButton.click();

    // 5. Formulaire de candidature (ApplyModal — le plus proche de "style
    // Gmail" dans cette application : objet implicite via le titre, corps de
    // message, pièce jointe CV, bouton d'envoi).
    await expect(page.getByRole("heading", { name: "Candidature Rapide" })).toBeVisible();

    await page.getByPlaceholder("Parlez-nous brièvement de vos motivations ou ajoutez un message à l'attention du recruteur...")
      .fill("Candidature automatisée par le test E2E Playwright — merci de ne pas en tenir compte.");

    // Aucun CV existant pour ce compte de test : la modale bascule sur
    // l'import d'un nouveau fichier par défaut. Sélecteur scopé à la modale
    // (#apply-modal-overlay) : le widget assistant IA, toujours monté en
    // arrière-plan, a aussi son propre input[type="file"] caché.
    await page.locator('#apply-modal-overlay input[type="file"]').setInputFiles(TEST_CV_PATH);

    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();

    // 6. Soumission réussie.
    await expect(page.getByText("Candidature transmise !")).toBeVisible({ timeout: 30_000 });
  });
});
