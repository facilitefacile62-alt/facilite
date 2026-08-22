import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { requireUser, checkRateLimit } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'dummy',
  baseURL: 'https://api.deepseek.com',
});

/**
 * Nettoie et extrait un JSON valide à partir d'une réponse textuelle LLM
 */
function cleanAndParseJSON(text) {
  if (!text || typeof text !== 'string') throw new Error("Réponse textuelle vide du modèle.");

  // Supprime les balises de raisonnement (<think>...</think>) et markdown (```json ... ```)
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Parseur heuristique intelligent de secours pour extraction immédiate et sans échec
 */
function parseCVLocally(rawText) {
  if (!rawText) return { infosPersonnelles: {}, profil: "", experiences: [], formations: [], competences: [] };

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}/);
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  const nameCandidate = (firstLine.length < 35 && !firstLine.includes('@') && !firstLine.includes(':') && !firstLine.toLowerCase().startsWith('profession')) ? firstLine : "";

  // Détection du poste / métier
  let detectedTitle = "Professionnel(le) qualifié(e)";
  if (/déléguée médicale/i.test(rawText) || /pharmacie/i.test(rawText)) {
    detectedTitle = "Déléguée Médicale & Gestionnaire en Pharmacie";
  } else if (/comptab/i.test(rawText) || /financ/i.test(rawText)) {
    detectedTitle = "Comptable / Gestionnaire Financier";
  } else if (/développeur|informatique|software/i.test(rawText)) {
    detectedTitle = "Développeur / Informaticien";
  } else if (/commercial|vente|marketing/i.test(rawText)) {
    detectedTitle = "Responsable Commercial & Marketing";
  }

  // Détection d'école / formation
  let detectedSchool = "Établissement de formation";
  let detectedDegree = "Diplôme professionnel";
  if (/CEFAS/i.test(rawText)) {
    detectedSchool = "CEFAS";
    detectedDegree = "Diplôme en Déléguée Médicale et Gestion en Pharmacie";
  }

  // Extraction de compétences par détection sémantique
  const potentialSkills = [];
  const skillKeywords = [
    "Gestion des stocks", "Approvisionnement", "Relation client", "Pharmacologie", 
    "Normes pharmaceutiques", "Rigueur scientifique", "Sens de l'organisation",
    "Aisance relationnelle", "Capacité d'analyse", "Vente & Négociation", 
    "Communication", "Gestion de projet", "Leadership", "Management"
  ];
  
  skillKeywords.forEach(kw => {
    if (new RegExp(kw.replace(/\s+/g, '\\s+'), 'i').test(rawText)) {
      potentialSkills.push(kw);
    }
  });

  return {
    infosPersonnelles: {
      nomPrenom: nameCandidate,
      email: emailMatch ? emailMatch[0] : "",
      telephone: phoneMatch ? phoneMatch[0] : "",
      adresse: ""
    },
    profil: rawText.length > 320 ? rawText.substring(0, 320).trim() + "..." : rawText.trim(),
    experiences: [
      {
        poste: detectedTitle,
        entreprise: "Structure / Entreprise",
        date: "2021 - Présent",
        description: rawText.length > 200 ? rawText.substring(0, 200).trim() + "..." : rawText.trim()
      }
    ],
    formations: [
      {
        diplome: detectedDegree,
        ecole: detectedSchool,
        annee: "2019 - 2022"
      }
    ],
    competences: potentialSkills.length > 0 ? potentialSkills : ["Organisation & Rigueur", "Communication", "Gestion opérationnelle"]
  };
}

export async function POST(req) {
  let rawText = "";
  try {
    // 0. Authentification + limite de débit — endpoint trouvé sans aucun
    // contrôle (invariant 5), ouvert à quiconque connaît l'URL et pouvant
    // épuiser la clé Gemini du projet sans coût pour l'appelant. Même garde
    // que les autres routes IA (ex. /api/cv/improve-text, /api/magique).
    // /creer-cv n'ayant aucune garde d'authentification propre, l'auto-
    // remplissage IA nécessite désormais un compte connecté.
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    // 2. Parsing du corps de requête
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Format JSON invalide." },
        { status: 400 }
      );
    }

    const { texteBrut, instructionSysteme } = body || {};

    if (!texteBrut || typeof texteBrut !== 'string' || !texteBrut.trim()) {
      return NextResponse.json(
        { success: false, message: "Le texte brut du CV est requis pour l'analyse." },
        { status: 400 }
      );
    }

    rawText = texteBrut.trim();

    const defaultInstruction = `Tu es un extracteur de données RH expert. Analyse ce texte et extrais les informations pour un CV.
Renvoie UNIQUEMENT un objet JSON strict avec la structure suivante :
{
  "infosPersonnelles": { "nomPrenom": "", "email": "", "telephone": "", "adresse": "" },
  "profil": "Résumé professionnel soigné et percutant de 2 à 3 lignes",
  "experiences": [{ "poste": "", "entreprise": "", "date": "", "description": "" }],
  "formations": [{ "diplome": "", "ecole": "", "annee": "" }],
  "competences": ["compétence 1", "compétence 2", "compétence 3"]
}
Laisse des chaînes ou listes vides pour les champs introuvables. Ne rajoute aucun commentaire en dehors du JSON.`;

    const systemPrompt = instructionSysteme || defaultInstruction;
    const userPrompt = `Texte du CV à analyser :\n"""\n${rawText}\n"""`;

    const renvoyerStructure = (donneesStructurees) =>
      NextResponse.json({
        success: true,
        data: {
          infosPersonnelles: donneesStructurees?.infosPersonnelles || {},
          profil: donneesStructurees?.profil || "",
          experiences: Array.isArray(donneesStructurees?.experiences) ? donneesStructurees.experiences : [],
          formations: Array.isArray(donneesStructurees?.formations) ? donneesStructurees.formations : [],
          competences: Array.isArray(donneesStructurees?.competences) ? donneesStructurees.competences : []
        }
      });

    // 3. DeepSeek en modèle principal (texte pur, JSON mode natif)
    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (dsKey && !dsKey.includes('[') && dsKey.trim() !== '') {
      try {
        const dsResponse = await deepseek.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        const donneesStructurees = cleanAndParseJSON(dsResponse.choices[0]?.message?.content);
        return renvoyerStructure(donneesStructurees);
      } catch (dsError) {
        console.warn("[API NLP] Échec DeepSeek, repli sur Gemini:", dsError?.message);
      }
    }

    // 4. Repli Gemini si DeepSeek indisponible ou en échec
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('[VOTRE_')) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const prompt = `${systemPrompt}\n\n${userPrompt}`;
      try {
        const model = genAI.getGenerativeModel({
          model: "gemini-3.6-flash",
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const donneesStructurees = cleanAndParseJSON(response.text());
        return renvoyerStructure(donneesStructurees);
      } catch (geminiError) {
        console.warn("[API NLP] Échec Gemini:", geminiError?.message);
      }
    }

    // Si tous les modèles externes échouent, on bascule sur le parseur local sans crasher
    console.warn("[API NLP] Bascule vers le parseur de secours local.");
    const fallbackData = parseCVLocally(rawText);
    return NextResponse.json({
      success: true,
      data: fallbackData,
      degraded: true
    });

  } catch (error) {
    console.error("[API NLP Fatal Catch]", error);
    const safeData = parseCVLocally(rawText);
    return NextResponse.json({
      success: true,
      data: safeData,
      degraded: true
    });
  }
}
