import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { AssistantPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de "Facilite", une plateforme professionnelle dédiée à l'aide à la création, l'optimisation et la valorisation de CVs professionnels, de lettres de motivation à fort impact, et à la préparation aux entretiens et conseils de carrière.

Instructions :
1. Sois bienveillant, chaleureux, extrêmement professionnel, constructif et concis (évite les longues réponses verbeuses, vas droit au but).
2. Fournis des conseils concrets et exploitables (ex: des verbes d'action, des tournures de phrases, des optimisations de structure pour les CV/lettres).
3. Adapte-toi à la langue de l'utilisateur (le français est la langue par défaut).
4. Ne sors pas de ton rôle de conseiller professionnel et de CV / lettres de motivation. Si on te pose des questions hors sujet, ramène poliment l'utilisateur à ton domaine de compétences.`;

// Clients providers Vercel AI SDK
const groqClient = createOpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseekClient = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

const googleClient = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req) {
  try {
    // 1. Authentification & Rate Limiting
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    // 2. Validation du payload
    const parsed = AssistantPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }
    const { messages, attachments } = parsed.data;

    let updatedMessages = [...messages];
    const imageAttachments = [];
    const documentAttachments = [];

    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.type === "image") {
          imageAttachments.push(att);
        } else if (att.type === "document") {
          documentAttachments.push(att);
        }
      }
    }

    // 3. Traitement des documents (ex. PDF, Word) : extraction de texte
    if (documentAttachments.length > 0) {
      let documentContext = "";
      for (const doc of documentAttachments) {
        try {
          const base64Data = doc.data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const extractedText = await extractTextFromFile(buffer, doc.name, doc.mimeType || "text/plain");
          if (extractedText) {
            documentContext += `Contenu du fichier joint [${doc.name}] :\n---\n${extractedText}\n---\n\n`;
          }
        } catch (docErr) {
          console.error(`Erreur d'extraction textuelle pour le document ${doc.name}:`, docErr);
        }
      }

      if (documentContext) {
        const lastUserIndex = [...updatedMessages].reverse().findIndex(msg => msg.role === "user");
        if (lastUserIndex !== -1) {
          const index = updatedMessages.length - 1 - lastUserIndex;
          updatedMessages[index] = {
            ...updatedMessages[index],
            content: `${documentContext}${updatedMessages[index].content}`
          };
        }
      }
    }

    // 4. Si des images sont jointes, appeler Gemini 1.5 Flash (Vision) en direct sans OCR local
    if (imageAttachments.length > 0) {
      console.log("Assistant: Images détectées, streaming via Gemini 1.5 Flash Vision.");
      
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      const contentParts = [
        { type: "text", text: lastMessage.content || "Analyse les documents ci-joints." }
      ];

      for (const img of imageAttachments) {
        const base64Data = img.data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
        contentParts.push({
          type: "image",
          image: Buffer.from(base64Data, "base64"),
          mimeType: img.mimeType || "image/png"
        });
      }

      const finalMessages = [
        ...updatedMessages.slice(0, -1),
        {
          role: "user",
          content: contentParts
        }
      ];

      const result = await streamText({
        model: googleClient("gemini-1.5-flash"),
        system: SYSTEM_PROMPT,
        messages: finalMessages,
        temperature: 0.4
      });

      return result.toDataStreamResponse();
    }

    // 5. Sans images, streaming cascade classique : Groq -> Gemini 1.5 Flash -> DeepSeek
    let resultStream;
    try {
      console.log("Assistant: Tentative streaming avec Groq (llama-3.3-70b-versatile)...");
      resultStream = await streamText({
        model: groqClient("llama-3.3-70b-versatile"),
        system: SYSTEM_PROMPT,
        messages: updatedMessages,
        temperature: 0.7
      });
    } catch (groqErr) {
      console.warn("Assistant: Échec Groq, bascule sur Gemini 1.5 Flash...", groqErr.message);
      try {
        resultStream = await streamText({
          model: googleClient("gemini-1.5-flash"),
          system: SYSTEM_PROMPT,
          messages: updatedMessages,
          temperature: 0.7
        });
      } catch (geminiErr) {
        console.warn("Assistant: Échec Gemini, bascule finale sur DeepSeek...", geminiErr.message);
        resultStream = await streamText({
          model: deepseekClient("deepseek-chat"),
          system: SYSTEM_PROMPT,
          messages: updatedMessages,
          temperature: 0.7
        });
      }
    }

    return resultStream.toDataStreamResponse();
  } catch (error) {
    console.error("[Assistant Streaming API Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la génération de la réponse de l'assistant." },
      { status: 500 }
    );
  }
}
