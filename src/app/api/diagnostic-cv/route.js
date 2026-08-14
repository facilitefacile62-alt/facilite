import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { DiagnosticPayloadSchema, validateUploadedFile } from "@/lib/validation";

export const runtime = "nodejs";
// L'OCR (Vision + repli Tesseract, jusqu'à ~33s dans le pire cas) doit avoir
// le temps de se terminer proprement avant que Vercel ne tue la fonction.
export const maxDuration = 55;

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

function buildDiagnosticSystemPrompt(customRules) {
  return `Tu es un consultant en recrutement senior et expert en audit de CV pour Facilité.
${customRules ? `\nRÈGLES ET CRITÈRES OFFICIELS DU DIAGNOSTIC CV À APPLIQUER :\n${customRules}\n` : ""}
Analyse le CV fourni et retourne impérativement un rapport d'audit détaillé sous format JSON strict respectant la structure suivante :
{
  "score_global": 75, // Note entière sur 100 basée sur la pertinence, la clarté, le design et le respect des critères
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
}

const DEFAULT_SYSTEM_PROMPT = buildDiagnosticSystemPrompt();

// Modèles vision essayés dans l'ordre. `gemini-flash-latest` est un alias qui
// suit la version courante : les identifiants figés utilisés auparavant ne
// répondaient plus (`gemini-1.5-flash` retiré, `gemini-2.5-flash` fermé aux
// nouveaux comptes), ce qui rendait tout le diagnostic par image inopérant.
const GEMINI_VISION_MODELS = ["gemini-flash-latest", "gemini-2.0-flash"];

async function callGeminiVision(base64Data, mimeType, customRules = null) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.includes("[") || geminiApiKey.trim() === "") return null;

  const pureBase64 = base64Data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
  const systemPrompt = customRules ? buildDiagnosticSystemPrompt(customRules) : DEFAULT_SYSTEM_PROMPT;

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: `${systemPrompt}\n\nAnalyse cette image de CV et renvoie le JSON d'audit.` },
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
  });

  for (const model of GEMINI_VISION_MODELS) {
    try {
      console.log(`Diagnostic: Appel Gemini Vision (${model})...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Clé transmise en en-tête plutôt qu'en paramètre d'URL : une query
            // string se retrouve dans les journaux d'accès et les proxys.
            "x-goog-api-key": geminiApiKey
          },
          body: requestBody
        }
      );

      // Un rejet HTTP doit faire passer au modèle suivant. La version
      // précédente se contentait de journaliser puis retournait null : le
      // second modèle n'était atteint que sur exception réseau, donc jamais
      // sur un 404 — le repli était du code mort.
      if (!response.ok) {
        const err = await response.text();
        console.error(`Diagnostic: Gemini Vision ${model} rejeté:`, response.status, err.slice(0, 300));
        continue;
      }

      const json = await response.json();
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
      return cleanAndParseJSON(content);
    } catch (err) {
      console.error(`Diagnostic: Échec Gemini Vision ${model}:`, err.message);
    }
  }

  return null;
}

async function callAITextModel(extractedText, customRules = null) {
  const systemPrompt = customRules ? buildDiagnosticSystemPrompt(customRules) : DEFAULT_SYSTEM_PROMPT;

  // Essayons avec Groq en premier
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
    try {
      console.log("Diagnostic: Appel Groq (llama-3.3-70b-versatile)...");
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
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
          { role: "system", content: systemPrompt },
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

    const parsed = DiagnosticPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Les données du fichier sont requises." },
        { status: 400 }
      );
    }
    const { fileData, fileName, mimeType, customRules } = parsed.data;

    // Contrôle taille + type déclaré + magic bytes sur le binaire réel
    const base64Payload = fileData.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
    const fileBuffer = Buffer.from(base64Payload, "base64");
    const check = validateUploadedFile(fileBuffer, mimeType, fileBuffer.length);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    let result = null;
    const isImage = mimeType?.startsWith("image/");

    // 1. Analyse de l'image via Gemini Vision
    if (isImage) {
      result = await callGeminiVision(fileData, mimeType, customRules);
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

      if (extractedText && extractedText.trim().length > 10) {
        result = await callAITextModel(extractedText, customRules);
      }
    }

    // 3. Fallback local structuré et cohérent si toutes les requêtes d'IA échouent
    //
    // Ce contenu est GÉNÉRIQUE : il ne résulte d'aucune analyse du CV envoyé.
    // Le drapeau `degraded` permet à l'interface de le signaler plutôt que de
    // présenter un score inventé comme un audit réel. Il est additif : les
    // clients qui l'ignorent gardent le comportement actuel.
    let degraded = false;
    if (!result) {
      console.warn("Diagnostic: Tous les modèles IA ont échoué, utilisation du diagnostic de secours.");
      degraded = true;
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

    return NextResponse.json({ success: true, degraded, result });
  } catch (error) {
    console.error("[Diagnostic API Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de la génération du diagnostic." },
      { status: 500 }
    );
  }
}
