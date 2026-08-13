import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assurez-vous d'avoir défini GEMINI_API_KEY dans votre environnement
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("ERREUR: Veuillez définir la variable d'environnement GEMINI_API_KEY.");
  process.exit(1);
}

const SYSTEM_PROMPT = `Tu es un expert en analyse de données RH et en Traitement Automatique du Langage. Ta mission est d'extraire de manière exhaustive et structurée toutes les informations textuelles du CV.
Utilise exactement la structure JSON suivante :
{
  "etat_civil": {
    "nom": "Prénom et Nom complet",
    "titre_professionnel": "Intitulé du profil"
  },
  "contacts": {
    "telephone": "string",
    "email": "string",
    "localisation": "string",
    "permis": "string"
  },
  "profil_professionnel": "string (Le texte complet du profil / résumé)",
  "qualites_personnelles": [
    "string"
  ],
  "competences_informatiques": {
    "detail": [
      "string"
    ]
  },
  "langues": {
    "detail": [
      "string"
    ]
  },
  "centres_d_interet": [
    "string"
  ],
  "experiences_professionnelles": [
    {
      "dates": "string (ex: Octobre 2025 - Juin 2026)",
      "duree_mentionnee": "string (si applicable, sinon null)",
      "poste": "string",
      "entreprise": "string",
      "localisation": "string (si spécifié, sinon null)",
      "missions": [
        "string"
      ]
    }
  ],
  "competences_cles_hard_skills": [
    "string"
  ]
}
Règles impératives d'extraction :
- Si une information est absente, utilise la valeur null ou un tableau vide [].
- Extrais le texte verbatim.`;

async function extractCvWithGeminiVision(buffer, mimeType) {
  const cleanBase64 = buffer.toString("base64").replace(/^data:[^;]+;base64,/, "");
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: SYSTEM_PROMPT },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) continue;

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      let cleanedJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanedJson = jsonMatch[0];
      
      return JSON.parse(cleanedJson);
    } catch (err) {
      console.warn(`[Modèle ${model} échoué]`, err.message);
    }
  }
  throw new Error("Tous les modèles ont échoué.");
}

async function processDirectory() {
  const inputDir = path.join(__dirname, 'input_cvs');
  const outputDir = path.join(__dirname, 'output_jsons');

  if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const files = fs.readdirSync(inputDir);
  console.log(`Trouvé ${files.length} fichiers dans ${inputDir}`);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.pdf'].includes(ext)) continue;

    console.log(`Traitement de ${file}...`);
    const filePath = path.join(inputDir, file);
    const buffer = fs.readFileSync(filePath);
    let mimeType = "image/jpeg";
    if (ext === '.png') mimeType = "image/png";
    if (ext === '.pdf') mimeType = "application/pdf";

    try {
      const result = await extractCvWithGeminiVision(buffer, mimeType);
      const outPath = path.join(outputDir, `${path.parse(file).name}.json`);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(`  -> Succès: Sauvegardé dans ${outPath}`);
    } catch (error) {
      console.error(`  -> Erreur sur ${file}:`, error.message);
    }
  }
}

processDirectory().catch(console.error);
