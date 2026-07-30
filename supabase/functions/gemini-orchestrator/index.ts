// Edge Function Deno : point d'entrée unique côté Supabase pour les appels
// Gemini (génération de texte/multimodal + embeddings), afin que la logique
// de cascade multi-modèles et de formatage REST ne soit pas dupliquée entre
// les routes Next.js (src/lib/documentParser.js) et les futurs traitements
// asynchrones déclenchés en base (pg_cron / pg_net, cf. migration
// 20260730100000_ai_infrastructure.sql) qui n'ont pas accès au runtime Node.
//
// Déploiement (non fait depuis cette session) :
//   supabase functions deploy gemini-orchestrator
//   supabase secrets set GEMINI_API_KEY=...
//
// Cascade de modèles : la demande initiale listait
// gemini-1.5-flash -> gemini-2.0-flash -> gemini-1.5-pro, mais un test direct
// de l'API Gemini avec la clé réelle du projet (voir historique de la
// session, src/lib/documentParser.js) a montré que gemini-1.5-flash et
// gemini-1.5-pro n'existent plus pour ce compte (absents de ListModels) et
// que gemini-2.0-flash renvoie 429 quota=0 ; seuls gemini-flash-lite-latest
// et gemini-flash-latest répondent effectivement. On réutilise donc ici la
// même liste déjà vérifiée en production plutôt que des modèles qui
// échoueraient systématiquement.
const CANDIDATE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"];
const EMBEDDING_MODEL = "text-embedding-004";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Essaie chaque modèle de la cascade jusqu'à ce que l'un d'eux réponde 200.
 * `buildParts` construit les `contents[0].parts` Gemini (texte seul, ou
 * texte + inline_data pour un fichier joint) — identique pour tous les
 * modèles essayés.
 */
async function generateWithFallback(apiKey: string, parts: unknown[]) {
  let lastErrorDetail = "Erreur inconnue";

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      });

      if (!response.ok) {
        const errText = await response.text();
        lastErrorDetail = `[${model}] ${response.status} ${errText}`;
        console.warn(`[Gemini Fallback] Model ${model} failed, trying next...`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return { success: true as const, model, text, raw: data };
    } catch (err) {
      lastErrorDetail = `[${model}] ${err instanceof Error ? err.message : String(err)}`;
      console.warn(`[Gemini Fallback] Model ${model} threw, trying next...`);
    }
  }

  return { success: false as const, error: `Tous les modèles Gemini ont échoué. Dernière erreur : ${lastErrorDetail}` };
}

async function embedText(apiKey: string, text: string) {
  const response = await fetch(`${GEMINI_API_BASE}/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false as const, error: `[${EMBEDDING_MODEL}] ${response.status} ${errText}` };
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    return { success: false as const, error: "Réponse Gemini Embeddings sans vecteur exploitable." };
  }

  return { success: true as const, embedding: values };
}

/**
 * Normalise JSON et FormData vers une même forme :
 * { action, prompt?, text?, mimeType?, file? }
 */
async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    return {
      action: String(form.get("action") || "generate"),
      prompt: form.get("prompt") ? String(form.get("prompt")) : undefined,
      text: form.get("text") ? String(form.get("text")) : undefined,
      mimeType: form.get("mimeType") ? String(form.get("mimeType")) : (file instanceof File ? file.type : undefined),
      file: file instanceof File ? file : null,
    };
  }

  const body = await req.json().catch(() => ({}));
  return {
    action: body.action || "generate",
    prompt: body.prompt,
    text: body.text,
    mimeType: body.mimeType,
    file: null as File | null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Méthode non supportée, utilisez POST." }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ success: false, error: "GEMINI_API_KEY non configurée sur cette Edge Function." }, 500);
  }

  try {
    const { action, prompt, text, mimeType, file } = await parseRequestBody(req);

    if (action === "embed") {
      const source = text ?? prompt;
      if (!source) {
        return jsonResponse({ success: false, error: "Paramètre 'text' requis pour l'action 'embed'." }, 400);
      }
      const result = await embedText(apiKey, source);
      return jsonResponse(result, result.success ? 200 : 502);
    }

    if (action === "generate") {
      if (!prompt && !file) {
        return jsonResponse({ success: false, error: "Paramètre 'prompt' ou fichier requis pour l'action 'generate'." }, 400);
      }

      const parts: unknown[] = [];
      if (prompt) parts.push({ text: prompt });
      if (file) {
        const buffer = await file.arrayBuffer();
        parts.push({
          inline_data: {
            mime_type: mimeType || file.type || "application/octet-stream",
            data: arrayBufferToBase64(buffer),
          },
        });
      }

      const result = await generateWithFallback(apiKey, parts);
      return jsonResponse(result, result.success ? 200 : 502);
    }

    return jsonResponse({ success: false, error: `Action inconnue : '${action}'. Utilisez 'generate' ou 'embed'.` }, 400);
  } catch (err) {
    console.error("[gemini-orchestrator] Erreur inattendue:", err);
    return jsonResponse({ success: false, error: "Erreur interne de l'Edge Function." }, 500);
  }
});
