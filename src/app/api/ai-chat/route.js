import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
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

const BASE_PROMPT = `Tu es l'assistant IA officiel de la plateforme Facilite (ffacilite.com).
Ton rôle est d'aider les utilisateurs professionnels et candidats au Sénégal.
Sois clair, dynamique, courtois et structuré dans tes réponses.`;

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

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    // 2. Validation du payload
    const parsed = AiChatPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }
    const { messages, message, activeAiRole, attachments } = parsed.data;

    // Normalisation des deux formes acceptées vers un historique unique.
    const historique =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    const systemPrompt = BASE_PROMPT + (ROLE_PROMPTS[activeAiRole] || "");

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

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("Clé DEEPSEEK_API_KEY manquante dans .env");
      return NextResponse.json(
        { error: "Configuration serveur incomplète (Clé API DeepSeek manquante)." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: systemPrompt }, ...historique],
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Erreur réponse DeepSeek:", response.status, errorData);
      // Le détail de l'erreur amont n'est pas renvoyé au client : il peut
      // contenir des informations de configuration côté fournisseur.
      return NextResponse.json(
        { error: `Erreur API DeepSeek (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Erreur serveur lors de l'appel DeepSeek:", error);
    return NextResponse.json(
      { error: "Erreur serveur interne lors du traitement de votre demande." },
      { status: 500 }
    );
  }
}
