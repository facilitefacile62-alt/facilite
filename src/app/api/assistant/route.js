import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

const SYSTEM_PROMPT = `Tu es l'assistant IA officiel de "Facilite", une plateforme professionnelle dédiée à l'aide à la création, l'optimisation et la valorisation de CVs professionnels, de lettres de motivation à fort impact, et à la préparation aux entretiens et conseils de carrière.

Instructions :
1. Sois bienveillant, chaleureux, extrêmement professionnel, constructif et concis (évite les longues réponses verbeuses, vas droit au but).
2. Fournis des conseils concrets et exploitables (ex: des verbes d'action, des tournures de phrases, des optimisations de structure pour les CV/lettres).
3. Adapte-toi à la langue de l'utilisateur (le français est la langue par défaut).
4. Ne sors pas de ton rôle de conseiller professionnel et de CV / lettres de motivation. Si on te pose des questions hors sujet, ramène poliment l'utilisateur à ton domaine de compétences.`;

function cleanAIResponse(text) {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  return cleaned.trim();
}

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return null;

  try {
    console.log("Assistant: Appel Groq (llama-3.3-70b-versatile)...");
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    return response.choices[0]?.message?.content || null;
  } catch (err) {
    console.error("Assistant: Échec Groq (llama-3.3-70b-versatile), tentative avec deepseek-r1-distill-llama-70b...", err.message);
    try {
      const response = await groq.chat.completions.create({
        model: "deepseek-r1-distill-llama-70b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.6,
        max_tokens: 1024,
      });
      return response.choices[0]?.message?.content || null;
    } catch (groqErr2) {
      console.error("Assistant: Échec complet de Groq:", groqErr2.message);
      return null;
    }
  }
}

async function callGemini(messages) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.includes("[") || geminiApiKey.trim() === "") return null;

  const contents = messages.map(msg => {
    let role = "user";
    if (msg.role === "assistant") role = "model";
    return {
      role: role,
      parts: [{ text: msg.content }]
    };
  });

  try {
    console.log("Assistant: Appel Gemini (gemini-2.5-flash)...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    });

    if (response.ok) {
      const json = await response.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } else {
      const errText = await response.text();
      console.error("Assistant: Gemini rejeté:", response.status, errText);
    }
  } catch (err) {
    console.error("Assistant: Échec Gemini 2.5-flash, essai Gemini 1.5-flash...", err.message);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    } catch (geminiErr2) {
      console.error("Assistant: Échec complet de Gemini:", geminiErr2.message);
    }
  }
  return null;
}

async function callDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return null;

  try {
    console.log("Assistant: Appel DeepSeek (deepseek-chat)...");
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    return response.choices[0]?.message?.content || null;
  } catch (err) {
    console.error("Assistant: Échec DeepSeek:", err.message);
    return null;
  }
}

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }

    let responseText = null;

    // 1. Moteur Principal : Groq
    responseText = await callGroq(messages);

    // 2. Secours #1 : Gemini
    if (!responseText) {
      responseText = await callGemini(messages);
    }

    // 3. Secours #2 : DeepSeek
    if (!responseText) {
      responseText = await callDeepSeek(messages);
    }

    if (!responseText) {
      return NextResponse.json(
        { error: "Tous les services d'intelligence artificielle ont échoué ou ne sont pas configurés." },
        { status: 503 }
      );
    }

    const cleanedMessage = cleanAIResponse(responseText);

    return NextResponse.json({ success: true, message: cleanedMessage });
  } catch (error) {
    console.error("[Assistant Route Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la communication avec l'assistant.", details: error.message },
      { status: 500 }
    );
  }
}
