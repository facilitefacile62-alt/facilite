#!/usr/bin/env node
/**
 * Backfill des embeddings pour les CV réels existants (resumes.embedding
 * IS NULL), qui n'ont jamais transité par /api/process-resume (route mise
 * en place seulement depuis le 30/07, pour les nouveaux uploads via
 * /profil). Les nouveaux CV s'embeddent déjà automatiquement à l'upload —
 * ce script ne traite que le rattrapage ponctuel.
 *
 * Exclut volontairement les comptes de test (préfixes 30000000 et 40000000, ~170
 * lignes sur 178) : seuls les CV de vrais utilisateurs sont backfillés,
 * décision explicite (2026-08-14) pour ne pas gaspiller d'appels Gemini
 * sur des données factices ni polluer match_resumes() côté recruteur.
 *
 * Deux sources de texte selon le type de CV :
 *   - file_url renseigné (CV uploadé, PDF/Word réel) : téléchargement
 *     depuis le bucket Storage "resumes" + extraction PDF (unpdf) ou DOCX
 *     (mammoth) — même logique que src/lib/documentParser.js, réimplémentée
 *     ici en ESM pur (documentParser.js est en syntaxe export ESM sans
 *     "type":"module" dans package.json ; un import direct depuis un script
 *     Node autonome échoue, Next.js seul sait le transpiler).
 *   - file_url absent (CV construit via /creer-cv, ~113/178) : le texte
 *     est composé directement depuis la colonne content (JSONB déjà
 *     structuré — profil, expériences, formations...), pas de fichier à
 *     télécharger.
 *
 * Idempotent/reprenable : ne sélectionne que embedding IS NULL, donc un
 * ré-appel après une exécution partielle ne retraite jamais ce qui a déjà
 * réussi. --limit=N (défaut : tout) pour tester sur un petit échantillon
 * avant de lancer le reste.
 *
 * Jamais supabase db push / config push — ce script n'exécute aucune
 * migration, uniquement des lectures Storage + un appel HTTP à l'Edge
 * Function déjà déployée + des UPDATE via le client service_role.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { getDocumentProxy, extractText } from "unpdf";
import mammoth from "mammoth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const content = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESUME_BUCKET = "resumes";
const MAX_EMBEDDING_INPUT_CHARS = 8000; // même limite que /api/process-resume
const MIN_PDF_TEXT_LENGTH = 30;
const THROTTLE_MS = 1500;

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function composeTextFromCvContent(content) {
  const parts = [];
  const name = `${content.firstName || ""} ${content.lastName || ""}`.trim();
  if (name) parts.push(name);
  if (content.jobTitle) parts.push(content.jobTitle);
  if (content.profile) parts.push(content.profile);

  for (const exp of content.experiences || []) {
    const period = `${exp.startDate || ""}${exp.startDate ? " - " : ""}${exp.current ? "Présent" : exp.endDate || ""}`;
    parts.push(`${exp.title || ""} chez ${exp.employer || ""} (${period}). ${exp.description || ""}`.trim());
  }
  for (const edu of content.educations || []) {
    const period = `${edu.startDate || ""}${edu.startDate ? " - " : ""}${edu.endDate || ""}`;
    parts.push(`${edu.degree || ""} - ${edu.school || ""} (${period})`.trim());
  }
  const skills = (content.skills || []).map((s) => s.name).filter(Boolean);
  if (skills.length) parts.push("Compétences : " + skills.join(", "));
  const languages = (content.languages || []).map((l) => `${l.name} (${l.level || ""})`).filter(Boolean);
  if (languages.length) parts.push("Langues : " + languages.join(", "));
  const qualities = (content.qualities || []).map((q) => q.name).filter(Boolean);
  if (qualities.length) parts.push("Qualités : " + qualities.join(", "));
  const itSkills = (content.itSkills || []).map((s) => s.name).filter(Boolean);
  if (itSkills.length) parts.push("Informatique : " + itSkills.join(", "));

  return parts.filter(Boolean).join("\n");
}

async function extractTextFromStorageFile(path) {
  const { data: blob, error } = await admin.storage.from(RESUME_BUCKET).download(path);
  if (error) throw new Error(`Téléchargement Storage échoué (${path}) : ${error.message}`);

  const buffer = Buffer.from(await blob.arrayBuffer());
  const ext = path.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text || text.trim().length < MIN_PDF_TEXT_LENGTH) {
      throw new Error("PDF scanné/vide détecté (texte < 30 caractères) — OCR non implémenté dans ce script, à traiter manuellement si besoin.");
    }
    return text;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  throw new Error(`Extension non gérée par ce script : .${ext}`);
}

async function embedText(text) {
  const truncated = text.slice(0, MAX_EMBEDDING_INPUT_CHARS);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ action: "embed", text: truncated }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success || !Array.isArray(result.embedding)) {
    throw new Error(`Échec embedding : ${result?.error || res.status}`);
  }
  return { embedding: result.embedding, truncatedLength: truncated.length };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Filtre les comptes de test côté JS plutôt qu'en SQL : user_id est uuid,
  // pas text — un NOT LIKE direct dans PostgREST échoue ("operator does not
  // exist: uuid ~~ unknown") sans cast explicite, plus simple à éviter ici
  // vu le faible volume total (178 lignes).
  const { data: allNullEmbedding, error } = await admin
    .from("resumes")
    .select("id, user_id, title, file_url, content")
    .is("embedding", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Erreur de lecture resumes :", error.message);
    process.exit(1);
  }

  let rows = allNullEmbedding.filter(
    (r) => !r.user_id.startsWith("30000000") && !r.user_id.startsWith("40000000")
  );
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`${rows.length} CV réel(s) à traiter${LIMIT ? ` (limite : ${LIMIT})` : ""}.\n`);

  const results = [];

  for (const row of rows) {
    const label = `${row.id} (${row.title || "sans titre"})`;
    try {
      let text;
      let source;
      if (row.file_url) {
        source = `fichier Storage (${row.file_url})`;
        text = await extractTextFromStorageFile(row.file_url);
      } else {
        source = "content JSONB (CV généré via /creer-cv)";
        text = composeTextFromCvContent(row.content || {});
      }

      if (!text || text.trim().length < 20) {
        throw new Error("Texte extrait/composé trop court (< 20 caractères) — CV vide ou champ content incomplet.");
      }

      const { embedding, truncatedLength } = await embedText(text);
      const embeddingLiteral = `[${embedding.join(",")}]`;

      const { error: updateErr } = await admin
        .from("resumes")
        .update({
          content: {
            ...(row.content || {}),
            extractedText: text.slice(0, 5000),
            embeddedAt: new Date().toISOString(),
          },
          embedding: embeddingLiteral,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateErr) throw new Error(`Échec UPDATE : ${updateErr.message}`);

      console.log(`[OK]    ${label} — source: ${source}, ${truncatedLength} caractères envoyés à l'embedder.`);
      results.push({ id: row.id, status: "success", source });
    } catch (err) {
      console.log(`[ÉCHEC] ${label} — ${err.message}`);
      results.push({ id: row.id, status: "failed", reason: err.message });
    }

    await sleep(THROTTLE_MS);
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`\n=== Résumé : ${succeeded} réussi(s), ${failed} échoué(s) sur ${results.length} traité(s). ===`);
  if (failed > 0) {
    console.log("Échecs :", JSON.stringify(results.filter((r) => r.status === "failed"), null, 2));
  }
}

main().catch((e) => {
  console.error("ERREUR FATALE :", e.message);
  process.exit(1);
});
