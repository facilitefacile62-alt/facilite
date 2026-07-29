import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { AiChatPayloadSchema } from "@/lib/validation";

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

const BASE_PROMPT = `Tu es l'assistant IA officiel de la plateforme Facilite (facilitefacile.com).
Ton rôle est d'aider les utilisateurs professionnels et candidats au Sénégal.
Sois clair, dynamique, courtois et structuré dans tes réponses.`;

const ROLE_PROMPTS = {
  cv: " Spécialisation : Rédaction, correction et mise en valeur de CV et lettres de motivation.",
  coach: " Spécialisation : Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.",
  interview: " Spécialisation : Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.",
  orientation: " Spécialisation : Orientation académique, démarches administratives et conseils de carrière.",
};

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
    const { messages, message, activeAiRole } = parsed.data;

    // Normalisation des deux formes acceptées vers un historique unique.
    const historique =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("Clé DEEPSEEK_API_KEY manquante dans .env");
      return NextResponse.json(
        { error: "Configuration serveur incomplète (Clé API DeepSeek manquante)." },
        { status: 500 }
      );
    }

    const systemPrompt = BASE_PROMPT + (ROLE_PROMPTS[activeAiRole] || "");

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
