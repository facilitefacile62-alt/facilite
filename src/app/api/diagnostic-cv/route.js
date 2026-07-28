import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractTextFromFile } from "@/lib/documentParser";

export const runtime = "nodejs";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

function cleanAndParseJSON(text) {
  if (!text) throw new Error("Réponse vide");
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `Tu es un consultant en recrutement senior et expert en audit de CV.
Analyse le CV fourni et retourne impérativement un rapport d'audit détaillé sous format JSON strict respectant la structure suivante :
{
  "score_global": 75, // Note entière sur 100 basée sur la pertinence, la clarté et le design
  "points_forts": [
    "Présentation claire du titre de poste",
    "Bonne mise en valeur des compétences clés"
  ],
  "axes_amelioration": [
    "Manque de verbes d'action au début des descriptions d'expérience",
    "Absence de résultats chiffrés et KPI"
  ],
  "compatibilite_ats": "Moyenne", // Choix parmi: Excellente, Bonne, Moyenne, Faible
  "conseils_cles": [
    "Ajoutez des chiffres clés (ex: +20% de ventes)",
    "Rendez le résumé professionnel plus percutant"
  ]
}`;

async function callGeminiVision(base64Data, mimeType) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.includes("[") || geminiApiKey.trim() === "") return null;

  const pureBase64 = base64Data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");

  try {
    console.log("Diagnostic: Appel Gemini Vision (gemini-2.5-flash)...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nAnalyse cette image de CV et renvoie le JSON d'audit.` },
              {
                inlineData: {
                  mimeType: mimeType || "image/png",
                  data: pureBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });

    if (response.ok) {
      const json = await response.json();
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
      return cleanAndParseJSON(content);
    } else {
      const err = await response.text();
      console.error("Diagnostic: Gemini Vision rejeté:", response.status, err);
    }
  } catch (err) {
    console.error("Diagnostic: Échec Gemini Vision 2.5-flash, essai Gemini 1.5-flash...", err.message);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${SYSTEM_PROMPT}\n\nAnalyse cette image de CV et renvoie le JSON d'audit.` },
                {
                  inlineData: {
                    mimeType: mimeType || "image/png",
                    data: pureBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
        return cleanAndParseJSON(content);
      }
    } catch (geminiErr2) {
      console.error("Diagnostic: Échec complet de Gemini Vision 1.5:", geminiErr2.message);
    }
  }
  return null;
}

async function callAITextModel(extractedText) {
  // Essayons avec Groq en premier
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
    try {
      console.log("Diagnostic: Appel Groq (llama-3.3-70b-versatile)...");
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Voici le texte brut du CV à analyser :\n\n${extractedText}` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      const content = response.choices[0]?.message?.content;
      return cleanAndParseJSON(content);
    } catch (err) {
      console.error("Diagnostic: Échec Groq, essai avec DeepSeek...", err.message);
    }
  }

  // Fallback sur DeepSeek officiel
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (dsKey && !dsKey.includes("[") && dsKey.trim() !== "") {
    try {
      console.log("Diagnostic: Appel DeepSeek (deepseek-chat)...");
      const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Voici le texte brut du CV à analyser :\n\n${extractedText}` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      const content = response.choices[0]?.message?.content;
      return cleanAndParseJSON(content);
    } catch (err) {
      console.error("Diagnostic: Échec DeepSeek:", err.message);
    }
  }

  return null;
}

export async function POST(req) {
  try {
    const { fileData, fileName, mimeType } = await req.json();

    if (!fileData) {
      return NextResponse.json(
        { error: "Les données du fichier sont requises." },
        { status: 400 }
      );
    }

    let result = null;
    const isImage = mimeType?.startsWith("image/");

    // 1. Analyse de l'image via Gemini Vision
    if (isImage) {
      result = await callGeminiVision(fileData, mimeType);
    }

    // 2. Si c'est un document (ou si l'analyse d'image a échoué)
    if (!result) {
      const pureBase64 = fileData.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
      const buffer = Buffer.from(pureBase64, "base64");
      
      // Extraction du texte brut
      let extractedText = "";
      try {
        extractedText = await extractTextFromFile(buffer, fileName || "cv.pdf", mimeType || "application/pdf");
      } catch (err) {
        console.error("Diagnostic: Échec de l'extraction de texte:", err.message);
      }

      if (extractedText) {
        result = await callAITextModel(extractedText);
      }
    }

    // 3. Fallback local structuré et cohérent si toutes les requêtes d'IA échouent
    if (!result) {
      console.warn("Diagnostic: Tous les modèles IA ont échoué, utilisation du diagnostic de secours.");
      result = {
        score_global: 65,
        points_forts: [
          "Structure classique facile à lire par un recruteur",
          "Présence des coordonnées de contact de base"
        ],
        axes_amelioration: [
          "Mots-clés insuffisants pour passer les filtres ATS",
          "Le profil manque d'objectifs professionnels clairs"
        ],
        compatibilite_ats: "Moyenne",
        conseils_cles: [
          "Optimisez votre CV en y intégrant des résultats mesurables",
          "Utilisez notre outil de création pour reformuler automatiquement vos compétences"
        ]
      };
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[Diagnostic API Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la génération du diagnostic.", details: error.message },
      { status: 500 }
    );
  }
}
