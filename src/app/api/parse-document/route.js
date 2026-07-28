import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractTextFromFile, mapTextToProfileFields } from "@/lib/documentParser";

export const runtime = "nodejs"; // Évite les restrictions de durée Edge en production

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

// Nettoyage impératif pour les modèles de la famille DeepSeek-R1 / Gemini
function extractAndParseJSON(rawText) {
  if (!rawText) throw new Error("Réponse vide du modèle");
  
  // 1. Supprimer les balises de pensée <think>...</think> générées par R1
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "");
  
  // 2. Supprimer les blocs de code Markdown ```json ... ```
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  
  // 3. Extraire le bloc JSON principal si du texte entoure l'objet
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `Tu es un moteur d'extraction de CV ultra-précis. Analyse le document et extrait les données au format JSON strict suivant :
{
  "prenom": "Prénom du candidat",
  "nom": "Nom de famille",
  "email": "Adresse e-mail extraite du document, sinon null",
  "telephone": "Numéro de téléphone extrait du document, sinon null",
  "ville": "Ville ou quartier",
  "pays": "Pays si indiqué, sinon null",
  "sexe": "Ne devine JAMAIS. Renvoie null sauf si le terme Homme ou Femme est explicitement écrit dans le texte",
  "titre": "Intitulé du poste",
  "resume": "Résumé professionnel",
  "competences": ["Compétence 1", "Compétence 2"],
  "centres_interet": ["Centre d'intérêt 1", "Centre d'intérêt 2"],
  "experiences": [
    {
      "poste": "Intitulé du poste",
      "entreprise": "Nom de l'entreprise",
      "periode": "Dates ou période obligatoire si présente dans le texte (ex: 'Février 2025', 'Fin 2024', 'Février - Juin 2024', '2021 - 2023'). Ne renvoie jamais une chaîne vide si une date apparaît près de cette expérience dans le document.",
      "description": "Missions"
    }
  ],
  "formations": [
    {
      "diplome": "Diplôme obtenu",
      "ecole": "Établissement",
      "annee": "Année ou période obligatoire si présente dans le texte (ex: '2021-2022', '2018-2019', '2020'). Ne renvoie jamais une chaîne vide si une date apparaît près de cette formation dans le document."
    }
  ],
  "langues": [
    {
      "nom": "Nom de la langue (ex: Français)",
      "niveau": "Niveau de maîtrise (ex: Excellent, Lu/parlé/écrit, Intermédiaire)"
    }
  ]
}

Règles impératives :
- Recherche systématiquement les dates, périodes ou années situées à proximité de chaque expérience et de chaque formation (même sur une ligne séparée, entre parenthèses, ou en fin de bloc) et reporte-les fidèlement dans "periode" / "annee".
- Si le document contient une section intitulée "INFORMATIQUE", "COMPÉTENCES INFORMATIQUES" ou équivalente (ex: "Réseaux sociaux (Excellent)", "Internet/Web", "Emails et messageries", "Pack Office"), intègre chacun de ces éléments tel quel comme entrée supplémentaire du tableau "competences", sans les omettre ni les fusionner avec les autres compétences.
- Recherche l'adresse e-mail (motif contenant "@") et le numéro de téléphone (chiffres regroupés, souvent précédés d'un indicatif comme "+221") n'importe où dans le document, y compris dans l'en-tête ou les coordonnées, et reporte-les fidèlement dans "email" et "telephone".
- Si le document contient une section intitulée "CENTRES D'INTÉRÊT", "LOISIRS", "HOBBIES" ou équivalente, reporte chaque élément tel quel dans le tableau "centres_interet" (ex: "Activités sportives et lecture", "Voyages et découvertes", "Veille technologique").

Exemple de sortie attendue pour un CV contenant ces informations :
{
  "email": "Florencecoly264@gmail.com",
  "telephone": "+221 77 215 83 72",
  "centres_interet": ["Activités sportives et lecture", "Voyages et découvertes", "Veille technologique"]
}`;

async function callGemini(documentText, systemPrompt) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.includes("[") || geminiApiKey.trim() === "") {
    console.warn("Gemini API key non configurée ou placeholder.");
    return null;
  }

  try {
    console.log("Tentative d'appel à l'API Gemini (gemini-2.5-flash)...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nVoici le texte du document à analyser :\n\n${documentText}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    if (response.ok) {
      const json = await response.json();
      const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedData = extractAndParseJSON(rawContent);
      if (parsedData) {
        console.log("Extraction Gemini réussie.");
        return parsedData;
      }
    } else {
      const errText = await response.text();
      console.error(`Gemini API rejetée. Statut: ${response.status}. Message: ${errText}`);
    }
  } catch (err) {
    console.error("Échec de l'appel à l'API Gemini :", err);
  }

  // Fallback sur gemini-1.5-flash en cas de problème de version
  try {
    console.log("Tentative d'appel de secours à l'API Gemini (gemini-1.5-flash)...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nVoici le texte du document à analyser :\n\n${documentText}` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    if (response.ok) {
      const json = await response.json();
      const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedData = extractAndParseJSON(rawContent);
      if (parsedData) {
        console.log("Extraction Gemini 1.5 réussie.");
        return parsedData;
      }
    }
  } catch (err) {
    console.error("Échec de l'appel à l'API Gemini 1.5 :", err);
  }

  return null;
}

export async function POST(req) {
  let documentText = "";
  let filename = "document.txt";
  let mimeType = "text/plain";
  
  try {
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const body = await req.json();
      documentText = body.documentText || "";
    } else {
      // Extraction depuis FormData
      const formData = await req.formData();
      const file = formData.get("file");
      if (file && typeof file !== "string") {
        filename = file.name;
        mimeType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        documentText = await extractTextFromFile(buffer, filename, mimeType);
      }
    }

    if (!documentText) {
      console.warn("Texte de document vide.");
      const fallbackFields = mapTextToProfileFields("");
      return NextResponse.json({ success: true, data: fallbackFields, fields: fallbackFields });
    }

    let parsedData = null;

    // Tentative 1 : Gemini (Inférence ultra-rapide et structurée nativement)
    try {
      parsedData = await callGemini(documentText, SYSTEM_PROMPT);
    } catch (geminiErr) {
      console.error("[Gemini Pipeline Failed]", geminiErr?.message);
    }

    // Tentative 2 : Groq (Fallback 1 avec deepseek-r1-distill-llama-70b)
    if (!parsedData) {
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
        try {
          console.log("Appel Groq OpenAI Client (llama-3.3-70b-versatile)...");
          const groqResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Voici le texte du document à analyser :\n\n${documentText}` },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const rawContent = groqResponse.choices[0]?.message?.content;
          parsedData = extractAndParseJSON(rawContent);
          console.log("Extraction Groq réussie.");
        } catch (groqError) {
          console.error("[Groq Fallback Triggered]", groqError?.message);
        }
      }
    }

    // Tentative 3 : Fallback 2 sur l'API officielle DeepSeek
    if (!parsedData) {
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (dsKey && !dsKey.includes("[") && dsKey.trim() !== "") {
        try {
          console.log("Appel DeepSeek OpenAI Client (deepseek-chat)...");
          const dsResponse = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `Voici le texte du document à analyser :\n\n${documentText}` },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const fallbackContent = dsResponse.choices[0]?.message?.content;
          parsedData = extractAndParseJSON(fallbackContent);
          console.log("Extraction DeepSeek réussie.");
        } catch (dsError) {
          console.error("[DeepSeek Failure]", dsError?.message);
        }
      }
    }

    // Tentative 4 : Fallback regex local si toutes les APIs IA échouent
    if (!parsedData) {
      console.log("Appel regex local fallback.");
      parsedData = mapTextToProfileFields(documentText);
    }

    return NextResponse.json({ success: true, data: parsedData, fields: parsedData, rawTextLength: documentText.length });
  } catch (error) {
    console.error("[Parsing Route Error]", error);
    const fallbackFields = mapTextToProfileFields(documentText);
    return NextResponse.json({ 
      success: true, 
      data: fallbackFields, 
      fields: fallbackFields, 
      error: error.message 
    });
  }
}
