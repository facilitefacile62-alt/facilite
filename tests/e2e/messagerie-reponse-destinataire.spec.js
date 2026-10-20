const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Messagerie : la réponse dans une discussion existante part vers l'AUTRE PARTICIPANT de cette discussion, jamais vers le
 * support (bug constaté le 19/10/2026 : un vendeur qui répondait depuis la liste écrivait en réalité au compte support).
 *
 * Parcours : acheteur → message au vendeur ; le vendeur ouvre la discussion DEPUIS LA LISTE (sans ?recipient=), répond ;
 * l'acheteur reçoit la réponse. On vérifie aussi le marquage « lu » en base et le garde-fou côté base (un message dont le
 * destinataire n'est pas dans la conversation est refusé).
 *
 * Le projet de test n'a pas les tables de la Marketplace : la discussion est une discussion directe ordinaire, qui passe
 * par le même code (cartes « directes » de MessagerieClient.js). Les noms Locaux sont vérifiés à la main (voir le rapport).
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Messagerie : réponse dans une discussion existante", () => {
  test.setTimeout(240_000);
  let env;
  let admin;
  const ids = [];
  const horodatage = Date.now();
  const acheteur = { email: `e2e-ach-${horodatage}@facilite-demo.local`, mdp: `Ach-${horodatage}-Aa1!`, nom: "Acheteur E2E" };
  const vendeur = { email: `e2e-ven-${horodatage}@facilite-demo.local`, mdp: `Ven-${horodatage}-Aa1!`, nom: "Vendeur E2E" };
  const support = { email: `e2e-sup-${horodatage}@facilite-demo.local`, mdp: `Sup-${horodatage}-Aa1!` };
  const texteAcheteur = `Bonjour, message de l'acheteur ${horodatage}`;
  const texteReponse = `Réponse du vendeur ${horodatage}`;

  async function creer(c, nom) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: c.mdp, email_confirm: true });
    expect(error).toBeNull();
    ids.push(data.user.id);
    c.id = data.user.id;
    await new Promise((r) => setTimeout(r, 3500));
    if (nom) await admin.from("profiles").update({ full_name: nom }).eq("id", c.id);
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
    env = loadTestEnv();
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await creer(acheteur, acheteur.nom);
    await creer(vendeur, vendeur.nom);
    // Le compte support (administrateur du projet de TEST) est celui qui recevait à tort les réponses.
    await creer(support, "Support E2E");
    await admin.from("user_roles").upsert({ user_id: support.id, role: "admin", status: "active" });
  });
  test.afterAll(async () => {
    for (const id of ids) {
      await admin.from("messages").delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`);
      await admin.from("conversations").delete().or(`user_1_id.eq.${id},user_2_id.eq.${id}`);
    }
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  test("acheteur → vendeur → réponse du vendeur depuis la liste → acheteur", async ({ page, browser }) => {
    // 1. L'acheteur écrit au vendeur (ouverture avec ?recipient=, comme le bouton « Contacter »).
    await connecter(page, acheteur);
    await page.goto(`/messagerie?recipient=${vendeur.id}`);
    await page.getByPlaceholder("Message").first().waitFor({ timeout: 60_000 });
    await page.getByPlaceholder("Message").first().fill(texteAcheteur);
    await page.getByPlaceholder("Message").first().press("Enter");
    await expect.poll(async () => (await admin.from("messages").select("id").eq("sender_id", acheteur.id).eq("receiver_id", vendeur.id)).data?.length, { timeout: 30_000 }).toBe(1);
    const { data: premier } = await admin.from("messages").select("conversation_id,is_read").eq("sender_id", acheteur.id).single();
    expect(premier.is_read).toBe(false);

    // 2. Le vendeur ouvre la discussion DEPUIS LA LISTE (aucun ?recipient=) et répond.
    const ctxVendeur = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageVendeur = await ctxVendeur.newPage();
    await connecter(pageVendeur, vendeur);
    await pageVendeur.goto("/messagerie");
    await pageVendeur.getByText(texteAcheteur).first().click({ timeout: 60_000 });
    await pageVendeur.getByPlaceholder("Message").first().waitFor({ timeout: 30_000 });

    // Marquage « lu » : le message de l'acheteur passe à lu en base dès l'ouverture de la discussion.
    await expect
      .poll(async () => (await admin.from("messages").select("is_read").eq("sender_id", acheteur.id).single()).data?.is_read, { timeout: 30_000 })
      .toBe(true);

    await pageVendeur.getByPlaceholder("Message").first().fill(texteReponse);
    await pageVendeur.getByPlaceholder("Message").first().press("Enter");
    await expect.poll(async () => (await admin.from("messages").select("id").eq("sender_id", vendeur.id)).data?.length, { timeout: 30_000 }).toBe(1);

    // 3. La réponse est adressée à l'ACHETEUR, dans la MÊME conversation — jamais au support.
    const { data: reponse } = await admin.from("messages").select("receiver_id,conversation_id").eq("sender_id", vendeur.id).single();
    expect(reponse.receiver_id).toBe(acheteur.id);
    expect(reponse.receiver_id).not.toBe(support.id);
    expect(reponse.conversation_id).toBe(premier.conversation_id);
    const { data: versSupport } = await admin.from("messages").select("id").eq("sender_id", vendeur.id).eq("receiver_id", support.id);
    expect(versSupport).toHaveLength(0);

    // 4. L'acheteur voit la réponse en rouvrant sa messagerie.
    await page.goto(`/messagerie?recipient=${vendeur.id}`);
    await expect(page.getByText(texteReponse).locator("visible=true").first()).toBeVisible({ timeout: 60_000 });
    await ctxVendeur.close();
  });

  test("garde-fou côté base : un message dont le destinataire n'est pas dans la conversation est refusé", async () => {
    // Test autonome : la conversation acheteur ↔ vendeur (une seule par paire), créée côté base si elle n'existe pas encore.
    let { data: conv } = await admin.from("conversations").select("id").eq("user_1_id", acheteur.id).eq("user_2_id", vendeur.id).maybeSingle();
    if (!conv) {
      const { data: creee, error: erreurConv } = await admin.from("conversations").insert({ user_1_id: acheteur.id, user_2_id: vendeur.id }).select("id").single();
      expect(erreurConv).toBeNull();
      conv = creee;
    }
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email: vendeur.email, password: vendeur.mdp });
    // Le vendeur tente d'écrire dans la conversation acheteur↔vendeur en désignant le support comme destinataire.
    const refus = await client.from("messages").insert({ sender_id: vendeur.id, receiver_id: support.id, conversation_id: conv.id, content: "mauvais destinataire", type_discussion: "ECHANGE" });
    expect(refus.error, "le message doit être refusé").not.toBeNull();
    expect(refus.error.message).toMatch(/Destinataire invalide/);
    // Le bon destinataire reste accepté.
    const ok = await client.from("messages").insert({ sender_id: vendeur.id, receiver_id: acheteur.id, conversation_id: conv.id, content: "bon destinataire", type_discussion: "ECHANGE" });
    expect(ok.error).toBeNull();
  });
});
