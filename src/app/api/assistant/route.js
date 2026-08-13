import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { AssistantPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de "Facilité" (https://ffacilite.com/), fondé par Macoumba Samake.
Facilité est un écosystème numérique tout-en-un d'insertion professionnelle, de recrutement intelligent, d'assistance administrative automatisée et de solutions numériques avancées.

Instructions fondamentales :
1. Tu es trilingue : tu réponds avec fluidité en Français, en Wolof (ex: "Na nga def", "Naka liggéey bi", "Jërejëf") et en Anglais selon la langue de l'utilisateur.
2. Tu es bienveillant, chaleureux, professionnel, constructif et concis.
3. Tu apportes des conseils concrets et exploitables :
   - Rédaction et optimisation de CVs professionnels et lettres de motivation conformes aux normes ATS (Formats National, Canadien, Anglais).
   - Recrutement intelligent & Matching RAG pour candidats et recruteurs.
   - Accompagnement dans les démarches administratives numériques au Sénégal (automatisées via n8n).
   - Informations sur les formations e-learning et les services d'agence publicitaire Meta Ads.
4. Si l'utilisateur pose une question hors contexte, ramène poliment la conversation vers les services et l'accompagnement de Facilité.`;

// Clients providers Vercel AI SDK.
//
// Important : on appelle systématiquement `.chat(...)` et jamais `client(...)`.
// Le raccourci `client(modelId)` de @ai-sdk/openai cible l'API *Responses*
// d'OpenAI (POST /responses), que ni Groq ni DeepSeek n'implémentent — l'appel
// échouait alors sans produire le moindre token (AI_NoOutputGeneratedError).
// `.chat(...)` cible POST /chat/completions, que les deux exposent.
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

// Alias suivant la version courante du modèle Flash. Les identifiants figés
// utilisés auparavant ne répondaient plus : `gemini-1.5-flash` est retiré
// (404 sur v1beta) et `gemini-2.5-flash` est fermé aux nouveaux comptes —
// le chemin vision comme le repli intermédiaire échouaient donc en silence.
const GEMINI_MODEL = "gemini-flash-latest";

export async function POST(req) {
  try {
    // 1. Authentification & Rate Limiting
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
    const parsed = AssistantPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }
    const { messages: uiMessages, attachments } = parsed.data;

    // Les UIMessage du client portent leur texte dans `parts`. On les aplatit en
    // messages { role, content } exploitables par streamText — et par la logique
    // d'injection de contexte documentaire ci-dessous, qui manipule du texte.
    const messages = uiMessages.map(m => ({
      role: m.role,
      content:
        typeof m.content === "string" && m.content.length > 0
          ? m.content
          : (m.parts || [])
              .filter(p => p.type === "text" && typeof p.text === "string")
              .map(p => p.text)
              .join("\n")
    }));

    // Un message vide ferait rejeter la requête par le fournisseur.
    if (messages.every(m => !m.content)) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }

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

    // 4. Si des images sont jointes, appeler Gemini Flash (Vision) en direct sans OCR local
    if (imageAttachments.length > 0) {
      console.log("Assistant: Images détectées, streaming via Gemini Flash (Vision).");
      
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
        model: googleClient(GEMINI_MODEL),
        system: SYSTEM_PROMPT,
        messages: finalMessages,
        temperature: 0.4
      });

      return result.toUIMessageStreamResponse();
    }

    // 5. Sans images, streaming cascade classique : Groq -> Gemini Flash -> DeepSeek
    //
    // Limite connue : `streamText` ne lève pas de façon synchrone sur une erreur
    // du fournisseur — celle-ci est émise DANS le flux. Ces try/catch n'attrapent
    // donc que les échecs de construction (clé absente, modèle inconnu), pas un
    // refus renvoyé pendant la génération. Les trois fournisseurs ont été
    // vérifiés individuellement ; un vrai repli en cours de flux imposerait de
    // bufferiser la réponse, donc de renoncer au streaming.
    let resultStream;
    try {
      console.log("Assistant: Tentative streaming avec Groq (llama-3.3-70b-versatile)...");
      resultStream = await streamText({
        model: groqClient.chat("llama-3.3-70b-versatile"),
        system: SYSTEM_PROMPT,
        messages: updatedMessages,
        temperature: 0.7
      });
    } catch (groqErr) {
      console.warn("Assistant: Échec Groq, bascule sur Gemini Flash...", groqErr.message);
      try {
        resultStream = await streamText({
          model: googleClient(GEMINI_MODEL),
          system: SYSTEM_PROMPT,
          messages: updatedMessages,
          temperature: 0.7
        });
      } catch (geminiErr) {
        console.warn("Assistant: Échec Gemini, bascule finale sur DeepSeek...", geminiErr.message);
        resultStream = await streamText({
          model: deepseekClient.chat("deepseek-chat"),
          system: SYSTEM_PROMPT,
          messages: updatedMessages,
          temperature: 0.7
        });
      }
    }

    return resultStream.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[Assistant Streaming API Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la génération de la réponse de l'assistant." },
      { status: 500 }
    );
  }
}
