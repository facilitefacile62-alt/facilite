const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Partie 2 du chantier (invariant 4) : chat-attachments était un bucket
 * PUBLIC sans aucune policy Storage dédiée — n'importe qui obtenant une URL
 * (partagée, mise en cache, indexée) pouvait lire une pièce jointe de
 * conversation, participant ou non. Désormais privé, avec une policy de
 * lecture restreinte aux participants du message (sender_id/receiver_id)
 * ou à un admin/publisher — testé directement contre l'API Storage réelle,
 * pas une simulation.
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

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Sécurité — chat-attachments privé, participants uniquement", () => {
  let candidateClient, securityClient, adminClient, anonClient;
  let candidateId, storagePath, messageId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    candidateId = candAuth.user.id;

    await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    // Le candidat téléverse une pièce jointe dans son propre dossier, puis
    // envoie un message qui la référence — c'est ce message qui détermine
    // qui a le droit de la lire (sender_id = candidateId ici, aucun
    // destinataire précis : receiver_id NULL, cas "conversation à soi-même"
    // suffisant pour prouver l'isolation vis-à-vis d'un TIERS non participant).
    storagePath = `${candidateId}/isolation-test-${Date.now()}.pdf`;
    const { error: uploadErr } = await candidateClient.storage
      .from("chat-attachments")
      .upload(storagePath, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }));
    expect(uploadErr, `Upload échoué : ${uploadErr?.message}`).toBeNull();

    const { data: msg, error: insertErr } = await candidateClient
      .from("messages")
      .insert({
        sender_id: candidateId,
        receiver_id: candidateId,
        content: "Pièce jointe de test",
        attachment_url: storagePath,
        attachment_type: "pdf",
      })
      .select()
      .single();
    expect(insertErr, `Insertion message échouée : ${insertErr?.message}`).toBeNull();
    messageId = msg.id;
  });

  test.afterAll(async () => {
    if (messageId) await runPrivilegedSql(`DELETE FROM public.messages WHERE id = '${messageId}';`);
    if (candidateId && storagePath) {
      await candidateClient.storage.from("chat-attachments").remove([storagePath]);
    }
  });

  test("le bucket chat-attachments n'est plus public", async () => {
    const { data } = anonClient.storage.from("chat-attachments").getPublicUrl(storagePath);
    // getPublicUrl() renvoie toujours une URL construite côté client, même
    // pour un bucket privé — la vraie preuve est que cette URL ne fonctionne
    // plus, testé juste en dessous via un fetch réel.
    const res = await fetch(data.publicUrl);
    expect(res.status, "L'ancienne URL publique ne doit plus servir le fichier.").not.toBe(200);
  });

  test("le participant (expéditeur) peut générer une URL signée pour sa pièce jointe", async () => {
    const { data, error } = await candidateClient.storage.from("chat-attachments").createSignedUrl(storagePath, 300);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();

    const res = await fetch(data.signedUrl);
    expect(res.status).toBe(200);
  });

  test("un tiers non-participant NE PEUT PAS générer d'URL signée pour cette pièce jointe", async () => {
    const { data, error } = await securityClient.storage.from("chat-attachments").createSignedUrl(storagePath, 300);
    expect(error, "Un non-participant ne devrait pas pouvoir signer ce chemin.").not.toBeNull();
    expect(data?.signedUrl).toBeFalsy();
  });

  test("un tiers non-participant ne peut pas non plus lister/télécharger directement le fichier", async () => {
    const { data, error } = await securityClient.storage.from("chat-attachments").download(storagePath);
    expect(data).toBeFalsy();
    expect(error).toBeTruthy();
  });

  test("un admin peut générer une URL signée (modération)", async () => {
    const { data, error } = await adminClient.storage.from("chat-attachments").createSignedUrl(storagePath, 300);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  test("l'upload est refusé hors du dossier de l'utilisateur", async () => {
    const foreignPath = `${(await securityClient.auth.getUser()).data.user.id}/hack-${Date.now()}.pdf`;
    const { error } = await candidateClient.storage
      .from("chat-attachments")
      .upload(foreignPath, new Blob(["x"], { type: "application/pdf" }));
    expect(error, "Un upload en dehors de son propre dossier doit être refusé.").not.toBeNull();
  });

  test("les anciennes pièces jointes (migration du 2026-08-03) sont récupérées, plus d'URL publique en base", async () => {
    const { data } = await adminClient
      .from("messages")
      .select("id, attachment_url")
      .not("attachment_url", "is", null)
      .like("attachment_url", "http%");
    expect(data, "Aucune ligne messages.attachment_url ne devrait plus contenir une URL http(s) (chat-attachments).").toEqual([]);
  });
});
