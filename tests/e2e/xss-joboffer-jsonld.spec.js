const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Régression pour le XSS stocké trouvé lors de l'audit sécurité (point 107
 * du référentiel) : JSON.stringify() n'échappe pas "</script>", donc une
 * offre d'emploi dont la description contient cette séquence casse hors du
 * bloc <script type="application/ld+json"> de /offres/[id] et exécute du JS
 * arbitraire pour tout visiteur. Un compte recruteur (auto-inscription
 * libre) suffit à publier l'offre piégée — ce test reproduit exactement ce
 * chemin : connexion recruteur réelle, insertion RLS-scopée (pas de
 * service_role), puis visite anonyme de la page publique.
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

const RECRUITER_EMAIL = process.env.E2E_RECRUITER_EMAIL || "demo.senetech@facilite-demo.local";
const RECRUITER_PASSWORD = process.env.E2E_RECRUITER_PASSWORD || "FaciliteDemo2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const XSS_MARKER = "__xss_json_ld_audit__";

test.describe("Sécurité — XSS stocké via JSON-LD (offre d'emploi)", () => {
  let supabase;
  let offerId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: RECRUITER_EMAIL,
      password: RECRUITER_PASSWORD,
    });
    expect(authError, `Connexion recruteur de test échouée : ${authError?.message}`).toBeNull();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Payload identique à celui qu'un vrai recruteur malveillant saisirait
    // dans le champ "Description" du formulaire d'offre.
    const maliciousDescription =
      `Poste normal.</script><script>window.${XSS_MARKER}=true;</script>`;

    const { data, error } = await supabase
      .from("job_offers")
      .insert({
        title: "Test audit sécurité — à ignorer",
        company: "Audit Sécurité Facilite",
        location: "Dakar",
        contract_type: "CDI",
        description: maliciousDescription,
        is_active: true,
        recruiter_id: user.id,
      })
      .select("id")
      .single();

    expect(error, `Insertion de l'offre de test échouée : ${error?.message}`).toBeNull();
    offerId = data.id;

    // Depuis la modération des offres (Étape 3) : une offre naît en
    // pending_review et n'est lisible par personne d'autre que son
    // recruteur tant qu'elle n'est pas approuvée. Ce test vérifie
    // l'échappement JSON-LD sur la page publique, pas le circuit de
    // modération lui-même — approbation explicite nécessaire ici pour que
    // la page /offres/[id] soit atteignable anonymement.
    const { error: adminErr } = await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(adminErr, `Connexion admin de test échouée : ${adminErr?.message}`).toBeNull();
    const { error: modErr } = await adminClient.rpc("moderate_job_offer", { offer_id: offerId, decision: "approved" });
    expect(modErr, `Approbation de l'offre de test échouée : ${modErr?.message}`).toBeNull();
  });

  test.afterAll(async () => {
    // DELETE est révoqué de authenticated depuis la Vague 2 (Partie 1) —
    // seule une connexion privilégiée peut encore nettoyer cette ligne de
    // test, un simple .delete() côté client échouerait silencieusement.
    if (offerId) {
      await runPrivilegedSql(`DELETE FROM public.job_offers WHERE id = '${offerId}';`);
    }
  });

  test("la description d'une offre ne peut pas casser hors du bloc JSON-LD", async ({ request }) => {
    // Test au niveau HTML brut plutôt qu'exécution navigateur : la faille
    // est une concaténation de chaîne côté serveur (SSR), elle est donc
    // prouvable directement sur la réponse HTTP, indépendamment du fait que
    // le navigateur exécute ou non le script injecté.
    const response = await request.get(`/offres/${offerId}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();

    const injectedScriptTag = `<script>window.${XSS_MARKER}=true;</script>`;
    expect(
      html.includes(injectedScriptTag),
      "La séquence </script> de la description a cassé hors du bloc JSON-LD et forme une vraie balise <script> exécutable dans le HTML renvoyé."
    ).toBe(false);

    // Le marqueur doit malgré tout être présent, mais neutralisé (échappé)
    // à l'intérieur du JSON-LD — preuve que la description est bien passée
    // au client, juste sans pouvoir casser la structure HTML.
    expect(html.includes(XSS_MARKER)).toBe(true);
  });
});
