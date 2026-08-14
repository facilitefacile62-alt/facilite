import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { AiChatPayloadSchema } from "@/lib/validation";
import { extractTextFromFile } from "@/lib/documentParser";

export const runtime = "nodejs";

/**
 * Assistant IA de la messagerie, spécialisé par rôle (CV, coaching, orientation).
 *
 * Appel direct à l'API DeepSeek en `fetch`, sans Vercel AI SDK : les versions
 * installées sont incompatibles entre elles (`ai@7` côté serveur n'expose plus
 * `toDataStreamResponse`, alors que `@ai-sdk/react@4` côté client attend encore
 * l'ancien protocole). Un appel HTTP brut est ici le chemin le plus fiable, au
 * prix d'une réponse non streamée.
 */

const BASE_PROMPT = `Tu es l'assistant IA officiel de la plateforme Facilité (https://ffacilite.com/), fondée par Macoumba Samake.
Ton rôle est d'accompagner les utilisateurs, candidats et recruteurs au Sénégal et à l'international.
Tu es trilingue : réponds avec aisance en Français, en Wolof ou en Anglais selon la langue choisie par l'utilisateur.
Sois clair, dynamique, courtois, hautement professionnel et structuré dans tes réponses.`;

const ROLE_PROMPTS = {
  cv: " Spécialisation : Rédaction, correction et mise en valeur de CV et lettres de motivation.",
  coach: " Spécialisation : Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.",
  interview: " Spécialisation : Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.",
  orientation: " Spécialisation : Orientation académique, démarches administratives et conseils de carrière.",
};

const GEMINI_VISION_MODEL = "gemini-flash-latest";
const BASE64_PREFIXE = /^data:[a-zA-Z0-9/\-+.]+;base64,/;

/**
 * Extrait le texte des documents joints (PDF, Word...) pour l'injecter dans le
 * prompt. DeepSeek ne lit que du texte : sans cette étape, un CV joint était
 * transmis puis purement ignoré.
 */
async function extraireContexteDocuments(documents) {
  let contexte = "";

  for (const doc of documents) {
    try {
      const buffer = Buffer.from(doc.data.replace(BASE64_PREFIXE, ""), "base64");
      const texte = await extractTextFromFile(
        buffer,
        doc.name || "document",
        doc.mimeType || "application/octet-stream"
      );
      if (texte) {
        contexte += `Contenu du fichier joint [${doc.name || "document"}] :\n---\n${texte}\n---\n\n`;
      }
    } catch (err) {
      console.error(`ai-chat: extraction impossible pour ${doc.name}:`, err.message);
    }
  }

  return contexte;
}

/**
 * Analyse d'images via Gemini : DeepSeek n'a pas de capacité vision, une image
 * jointe ne peut donc pas être traitée par le chemin nominal.
 * Renvoie null si la clé manque ou si l'appel échoue — l'appelant retombe alors
 * sur DeepSeek en mode texte seul.
 */
async function appelerGeminiVision(systemPrompt, historique, images) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.includes("[") || geminiKey.trim() === "") return null;

  // Gemini nomme "model" le rôle assistant.
  const contents = historique.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const dernier = contents[contents.length - 1];
  for (const img of images) {
    dernier.parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/png",
        data: img.data.replace(BASE64_PREFIXE, ""),
      },
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // En-tête plutôt que query string : une clé en URL fuite dans les journaux.
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ai-chat: Gemini Vision rejeté:", response.status, err.slice(0, 300));
      return null;
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error("ai-chat: échec Gemini Vision:", err.message);
    return null;
  }
}

export async function POST(req) {
  try {
    // 1. Authentification & limitation de débit — alignées sur /api/assistant.
    // Sans elles, l'endpoint serait ouvert et n'importe qui pourrait consommer
    // le crédit DeepSeek du projet.
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!(await checkAiQuota(user.id))) {
      return NextResponse.json(
        { error: `Quota IA quotidien atteint (${AI_DAILY_QUOTA} requêtes/jour). Réessayez demain.` },
        { status: 429 }
      );
    }

    // 2. Validation du payload
    const parsed = AiChatPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }
    const { messages, message, activeAiRole, model: requestedModel, customSystemPrompt, temperature, attachments } = parsed.data;

    // Normalisation des deux formes acceptées vers un historique unique.
    const historique =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    const systemPrompt = customSystemPrompt?.trim() 
      ? customSystemPrompt.trim() 
      : (BASE_PROMPT + (ROLE_PROMPTS[activeAiRole] || ""));

    // 3. Pièces jointes
    const images = (attachments || []).filter((a) => a.type === "image");
    const documents = (attachments || []).filter((a) => a.type === "document");

    // Les documents sont convertis en texte et préfixés au dernier tour
    // utilisateur, qui est celui auquel ils étaient joints.
    if (documents.length > 0) {
      const contexte = await extraireContexteDocuments(documents);
      if (contexte) {
        const dernierUser = historique.map((m) => m.role).lastIndexOf("user");
        if (dernierUser !== -1) {
          historique[dernierUser] = {
            ...historique[dernierUser],
            content: `${contexte}${historique[dernierUser].content}`,
          };
        }
      }
    }

    // Les images exigent un modèle vision : DeepSeek n'en a pas.
    if (images.length > 0) {
      const reponseVision = await appelerGeminiVision(systemPrompt, historique, images);
      if (reponseVision) {
        return NextResponse.json({ reply: reponseVision });
      }
      console.warn("ai-chat: vision indisponible, repli sur DeepSeek en texte seul.");
      historique.push({
        role: "user",
        content:
          "[Note système : des images ont été jointes mais n'ont pas pu être analysées. " +
          "Indique-le à l'utilisateur et propose de coller le texte du document.]",
      });
    }

    const temp = typeof temperature === "number" ? temperature : 0.7;

    // 1. Tentative avec DeepSeek (si demandé ou par défaut)
    if (!requestedModel || requestedModel === "deepseek-chat") {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (apiKey && !apiKey.includes("[") && apiKey.trim() !== "") {
        try {
          const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ role: "system", content: systemPrompt }, ...historique],
              temperature: temp,
              stream: false,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content;
            if (reply) return NextResponse.json({ reply });
          }
        } catch (deepseekErr) {
          console.warn("ai-chat: échec DeepSeek, bascule sur Gemini Flash:", deepseekErr.message);
        }
      }
    }

    // 2. Tentative avec Google Gemini Flash
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !geminiKey.includes("[") && geminiKey.trim() !== "") {
      try {
        const contents = historique.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { temperature: temp },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (geminiErr) {
        console.warn("ai-chat: échec Gemini, bascule sur Groq:", geminiErr.message);
      }
    }

    // 3. Repli de secours : Groq (Llama 3.3 70B)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, ...historique],
            temperature: temp,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const reply = groqData.choices?.[0]?.message?.content;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (groqErr) {
        console.error("ai-chat: échec Groq:", groqErr.message);
      }
    }

    return NextResponse.json(
      { error: "Aucun fournisseur d'intelligence artificielle n'a pu répondre à la requête." },
      { status: 503 }
    );
  } catch (error) {
    console.error("ai-chat: Erreur serveur:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du traitement de la requête IA." },
      { status: 500 }
    );
  }
}
