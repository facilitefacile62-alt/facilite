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

// Nettoyage impératif pour les modèles de la famille DeepSeek-R1
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

const CV_EXTRACTION_PROMPT = `Tu es un moteur d'extraction de CV et de documents d'identité. Analyse le contenu texte et extrait impérativement un JSON structuré valide respectant la structure suivante :
{
  "fullName": "Nom complet",
  "firstName": "Prénom de la personne",
  "lastName": "Nom de famille de la personne",
  "email": "Adresse e-mail",
  "phone": "Numéro de téléphone",
  "jobTitle": "Titre du poste ou profil",
  "summary": "Résumé professionnel / Présentation / Bio",
  "city": "Ville de résidence",
  "country": "Pays",
  "birthDate": "Date de naissance",
  "gender": "Sexe/Genre (Homme ou Femme)",
  "maritalStatus": "Statut marital (ex: Marié, Célibataire)",
  "driverLicense": "Permis de conduire (ex: Permis B)",
  "skills": ["Compétence 1", "Compétence 2"],
  "experiences": [
    {
      "role": "Intitulé du poste (ex: Développeur Fullstack)",
      "company": "Entreprise (ex: Facilité Corp)",
      "period": "Dates (ex: 2021 - Present)",
      "description": "Missions réalisées"
    }
  ],
  "education": [
    {
      "degree": "Diplôme (ex: Master en Informatique)",
      "institution": "Établissement (ex: Université de Dakar)",
      "year": "Année (ex: 2023)"
    }
  ],
  "languages": ["Français", "Anglais"]
}`;

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

    // Tentative 1 : Groq (Inférence rapide avec deepseek-r1-distill-llama-70b)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && !groqKey.includes("[NOUVELLE_CLE_GROQ]") && groqKey.trim() !== "") {
      try {
        console.log("Appel Groq OpenAI Client (deepseek-r1-distill-llama-70b)...");
        const groqResponse = await groq.chat.completions.create({
          model: "deepseek-r1-distill-llama-70b",
          messages: [
            { role: "system", content: CV_EXTRACTION_PROMPT },
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

    // Tentative 2 : Fallback sur l'API officielle DeepSeek
    if (!parsedData) {
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (dsKey && !dsKey.includes("[NOUVELLE_CLE_DEEPSEEK]") && dsKey.trim() !== "") {
        try {
          console.log("Appel DeepSeek OpenAI Client (deepseek-chat)...");
          const dsResponse = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: CV_EXTRACTION_PROMPT },
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

    // Tentative 3 : Fallback regex local si les APIs IA échouent
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
