import { NextResponse } from "next/server";
import { extractTextFromFile, mapTextToProfileFields } from "@/lib/documentParser";

export const runtime = "nodejs";

function cleanAndParseJSON(text) {
  if (!text) return null;
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Erreur de parsing JSON de la réponse de l'IA :", e);
    return null;
  }
}

async function callAIModel(rawText) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  const systemPrompt = `Tu es un expert en recrutement et en extraction de données de documents (CV, CNI, Passeport, etc.).
Analyse le texte brut fourni et extrait TOUTES les informations possibles sous forme d'un objet JSON strict.
Ne renvoie AUCUNE explication, aucun texte d'introduction ni de conclusion, seulement du JSON pur et valide.
Voici le schéma exact attendu du JSON :
{
  "firstName": "Prénom de la personne",
  "lastName": "Nom de famille de la personne",
  "title": "Titre professionnel (ex: Développeur Fullstack)",
  "summary": "Bio courte, présentation du profil",
  "city": "Ville",
  "country": "Pays",
  "birthDate": "Date de naissance (ex: 14 juillet 1995)",
  "gender": "Homme ou Femme",
  "maritalStatus": "Statut marital (ex: Marié, Célibataire)",
  "driverLicense": "Permis de conduire (ex: Permis B)",
  "skills": ["compétence 1", "compétence 2"],
  "experiences": [
    {
      "title": "Poste occupé",
      "employer": "Nom de l'entreprise",
      "city": "Ville (optionnel)",
      "current": true ou false,
      "startDate": "Année ou Mois/Année de début",
      "endDate": "Année ou Mois/Année de fin, ou vide si en cours",
      "description": "Description des tâches"
    }
  ],
  "educations": [
    {
      "school": "Nom de l'école/université",
      "degree": "Diplôme",
      "startYear": "Année de début",
      "endYear": "Année de fin"
    }
  ],
  "languages": ["Langue 1", "Langue 2"]
}`;

  let parsedData = null;

  // 1. Premier essai : Groq API (deepseek-r1-distill-llama-70b)
  if (groqApiKey && !groqApiKey.includes("[NOUVELLE_CLE_GROQ]") && groqApiKey.trim() !== "") {
    try {
      console.log("Tentative d'appel à Groq API...");
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-r1-distill-llama-70b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Voici le texte du document :\n\n${rawText}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        parsedData = cleanAndParseJSON(content);
        if (parsedData) {
          console.log("Extraction réussie via Groq.");
          return parsedData;
        }
      } else {
        console.warn(`Groq API a retourné un statut de rejet : ${response.status}`);
      }
    } catch (err) {
      console.error("Échec de l'appel à Groq API :", err);
    }
  }

  // 2. Deuxième essai (Fallback) : DeepSeek API officielle (deepseek-chat)
  if (deepseekApiKey && !deepseekApiKey.includes("[NOUVELLE_CLE_DEEPSEEK]") && deepseekApiKey.trim() !== "") {
    try {
      console.log("Tentative d'appel de secours à l'API DeepSeek...");
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deepseekApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Voici le texte du document :\n\n${rawText}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content;
        parsedData = cleanAndParseJSON(content);
        if (parsedData) {
          console.log("Extraction réussie via DeepSeek.");
          return parsedData;
        }
      } else {
        console.warn(`DeepSeek API a retourné un statut de rejet : ${response.status}`);
      }
    } catch (err) {
      console.error("Échec de l'appel à DeepSeek API :", err);
    }
  }

  return null;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extraction du texte brut
    const rawText = await extractTextFromFile(buffer, file.name, file.type);
    
    // Extraction via l'IA avec fallback
    let fields = await callAIModel(rawText);

    // Fallback local regex si les APIs IA échouent
    if (!fields) {
      console.log("Fallback vers l'extraction regex locale.");
      fields = mapTextToProfileFields(rawText);
    }

    return NextResponse.json({ fields, rawTextLength: rawText.length });
  } catch (error) {
    console.error("Erreur d'extraction du document:", error);
    return NextResponse.json(
      { error: "Impossible d'analyser le contenu du document." },
      { status: 500 }
    );
  }
}
