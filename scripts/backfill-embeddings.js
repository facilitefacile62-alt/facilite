/**
 * Backfill ponctuel des embeddings manquants (resumes.embedding /
 * job_offers.embedding) — appelle l'Edge Function gemini-orchestrator
 * (action "embed") pour chaque ligne où embedding IS NULL, déclenché
 * manuellement par un admin (node scripts/backfill-embeddings.js), jamais
 * automatique.
 *
 * Prérequis constaté le 21/08 : la génération d'embedding est déjà câblée
 * dans les flux normaux (traitement de CV, publication d'offre) mais la
 * quasi-totalité des lignes existantes n'a jamais été rétro-calculée
 * (4/53 offres, 4/186 CV avaient un embedding avant ce script).
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = 5;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function embedText(text) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ action: "embed", text: text.slice(0, 7000) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !Array.isArray(data.embedding)) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return `[${data.embedding.join(",")}]`;
}

async function runBatch(items, worker) {
  let done = 0;
  let failed = 0;
  const queue = [...items];

  async function runner() {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        await worker(item);
        done++;
      } catch (err) {
        failed++;
        console.error(`  échec ${item.id}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
  return { done, failed };
}

/**
 * type="created" (généré par l'éditeur interne Facilite) n'a jamais de
 * content.extractedText — ce champ n'existe que pour type="imported"/"CV"
 * (document source analysé). Constaté en production le 21/08 : sur 186 CV,
 * 113 sont "created" (contenu structuré : profile/skills/experiences/
 * educations/languages, jamais de texte brut) et 72 "imported" avec
 * content = {} (aucun texte extrait persisté nulle part pour ceux-là — hors
 * périmètre de ce backfill, signalé séparément).
 */
function flattenCreatedResumeContent(content) {
  const parts = [];
  if (content.profile) parts.push(content.profile);
  if (Array.isArray(content.skills)) {
    parts.push("Compétences : " + content.skills.map((s) => s.name).filter(Boolean).join(", "));
  }
  if (Array.isArray(content.experiences)) {
    for (const exp of content.experiences) {
      parts.push([exp.title, exp.employer, exp.description].filter(Boolean).join(" — "));
    }
  }
  if (Array.isArray(content.educations)) {
    for (const edu of content.educations) {
      parts.push([edu.degree, edu.school, edu.description].filter(Boolean).join(" — "));
    }
  }
  if (Array.isArray(content.languages)) {
    parts.push("Langues : " + content.languages.map((l) => l.name).filter(Boolean).join(", "));
  }
  return parts.filter(Boolean).join("\n");
}

// Deviné depuis l'extension — même logique de branchement que
// extractTextFromFile (src/lib/documentParser.js), qui se fie d'abord au nom
// de fichier avant le mimeType exact.
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function extractTextFromResumeFile(admin, extractTextFromFile, fileUrl) {
  const { data: blob, error: downloadError } = await admin.storage.from("resumes").download(fileUrl);
  if (downloadError) throw new Error(`téléchargement Storage: ${downloadError.message}`);

  const buffer = Buffer.from(await blob.arrayBuffer());
  const ext = (fileUrl.split(".").pop() || "").toLowerCase();
  const mimeType = MIME_BY_EXTENSION[ext] || blob.type || "application/octet-stream";
  const filename = fileUrl.split("/").pop();

  return extractTextFromFile(buffer, filename, mimeType);
}

async function backfillResumes() {
  const { data: rows, error } = await admin
    .from("resumes")
    .select("id, user_id, type, content, file_url")
    .is("embedding", null)
    .eq("status", "completed");

  if (error) throw new Error(`Lecture resumes: ${error.message}`);
  console.log(`\nCV sans embedding : ${rows.length}`);

  // documentParser.js est en ESM ; ce script tourne en CommonJS (hors
  // pipeline de build Next.js, comme webhooksWorker.js) — import()
  // dynamique, seul moyen fiable de consommer un module ESM depuis du CJS.
  const { extractTextFromFile } = await import("../src/lib/documentParser.js");

  const result = await runBatch(rows, async (row) => {
    let text =
      row.content?.extractedText ||
      row.content?.rawText ||
      (row.type === "created" ? flattenCreatedResumeContent(row.content || {}) : "");

    // type="imported" (fichier réellement téléversé, jamais de contenu
    // structuré) : même pipeline d'extraction que /api/process-resume,
    // depuis le fichier Storage plutôt qu'un champ déjà en base.
    if (!text.trim() && row.type === "imported" && row.file_url) {
      text = await extractTextFromResumeFile(admin, extractTextFromFile, row.file_url);
    }

    if (!text || !text.trim()) throw new Error(`aucun texte exploitable (type=${row.type})`);
    const embeddingLiteral = await embedText(text);

    const updatePayload = { embedding: embeddingLiteral };
    // content restait {} pour les CV importés avant ce correctif — même
    // format que /api/process-resume, pour que les prochaines lectures
    // (rag-matching, etc.) trouvent le texte au même endroit que pour les
    // CV traités via le flux normal.
    if (row.type === "imported" && (!row.content || Object.keys(row.content).length === 0)) {
      updatePayload.content = { extractedText: text.slice(0, 5000), analyzedAt: new Date().toISOString() };
    }

    const { error: updateError } = await admin.from("resumes").update(updatePayload).eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
  });

  return result;
}

async function backfillJobOffers() {
  const { data: rows, error } = await admin
    .from("job_offers")
    .select("id, title, description")
    .is("embedding", null);

  if (error) throw new Error(`Lecture job_offers: ${error.message}`);
  console.log(`\nOffres sans embedding : ${rows.length}`);

  const result = await runBatch(rows, async (row) => {
    const text = `${row.title || ""}\n\n${row.description || ""}`.trim();
    if (!text) throw new Error("titre et description vides");
    const embeddingLiteral = await embedText(text);
    const { error: updateError } = await admin.from("job_offers").update({ embedding: embeddingLiteral }).eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
  });

  return result;
}

(async () => {
  const start = Date.now();

  const resumesResult = await backfillResumes();
  const offersResult = await backfillJobOffers();

  const elapsedS = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n--- Résumé ---`);
  console.log(`CV      : ${resumesResult.done} traités, ${resumesResult.failed} échecs`);
  console.log(`Offres  : ${offersResult.done} traités, ${offersResult.failed} échecs`);
  console.log(`Durée   : ${elapsedS}s`);
})().catch((err) => {
  console.error("ÉCHEC:", err.message);
  process.exit(1);
});
