import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { supabaseAdmin, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 35;

const CANDIDATE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"];

/**
 * Heuristique NLP rapide pour classifier le type de document si l'IA est indisponible
 */
function classifyWithHeuristics(text = "", filename = "") {
  const lowerText = text.toLowerCase();
  const lowerName = filename.toLowerCase();

  // Indicateurs Lettre de motivation
  const letterKeywords = [
    "madame, monsieur",
    "madame monsieur",
    "à l'attention de",
    "a l'attention de",
    "veuillez agréer",
    "veuillez agreer",
    "salutations distinguées",
    "salutations distinguees",
    "haute considération",
    "haute consideration",
    "candidature au poste",
    "lettre de motivation",
    "ma motivation",
    "cordialement",
    "sincères salutations",
    "dear hiring manager",
    "cover letter",
  ];

  // Indicateurs CV
  const cvKeywords = [
    "curriculum vitae",
    "expérience professionnelle",
    "experiences professionnelles",
    "formation",
    "formations",
    "compétences",
    "competences",
    "hard skills",
    "soft skills",
    "parcours académique",
    "diplômes",
    "diplomes",
    "centres d'intérêt",
    "langues",
    "atouts",
    "profil professionnel",
    "projets réalisés",
  ];

  let letterScore = 0;
  let cvScore = 0;

  if (lowerName.includes("lettre") || lowerName.includes("cover") || lowerName.includes("motivation")) {
    letterScore += 3;
  }
  if (lowerName.includes("cv") || lowerName.includes("curriculum") || lowerName.includes("resume")) {
    cvScore += 3;
  }

  for (const kw of letterKeywords) {
    if (lowerText.includes(kw)) letterScore += 2;
  }
  for (const kw of cvKeywords) {
    if (lowerText.includes(kw)) cvScore += 2;
  }

  // Vérification de dates de parcours type "2020 - 2023" ou "2019 à présent"
  const dateMatches = lowerText.match(/\b(19\d\d|20\d\d)\s*[-–—/àa]\s*(19\d\d|20\d\d|présent|present|actuel|aujourd'hui)\b/g);
  if (dateMatches && dateMatches.length >= 2) {
    cvScore += 3;
  }

  // Mots interdits / hors-sujet flagrants (factures, reçus, etc.)
  const invalidKeywords = ["facture n°", "total ttc", "montant tva", "bon de commande", "reçu de paiement", "carte nationale d'identité", "bulletin de salaire"];
  for (const kw of invalidKeywords) {
    if (lowerText.includes(kw)) return "invalide";
  }

  if (text.trim().length < 30 && !lowerName.includes("cv") && !lowerName.includes("lettre")) {
    return "invalide";
  }

  if (letterScore > cvScore && letterScore >= 2) return "Lettre de motivation";
  if (cvScore >= 2) return "CV";

  // Repli selon le nom si score faible
  if (lowerName.includes("lettre") || lowerName.includes("motivation")) return "Lettre de motivation";
  if (lowerName.includes("cv") || cvScore > 0) return "CV";

  return "invalide";
}

/**
 * Classification avec Gemini Flash
 */
async function classifyWithAI(documentText, filename) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return null;

  const prompt = `Tu es un expert RH. Analyse le texte de ce document professionnel (nom de fichier: "${filename}").
Détermine si c'est :
1. "CV" (Curriculum Vitae détaillant parcours, expériences, compétences, études)
2. "Lettre de motivation" (Lettre d'accompagnement ou de motivation adressée à un recruteur)
3. "invalide" (Facture, reçu, pièce d'identité, document sans rapport, texte vide ou non pertinent)

Réponds STRICTEMENT en JSON :
{
  "type": "CV" | "Lettre de motivation" | "invalide",
  "reason": "explication concise en français"
}`;

  const snippet = documentText.slice(0, 3000); // 3000 caractères suffisent largement

  for (const model of CANDIDATE_MODELS) {
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
                parts: [{ text: `${prompt}\n\nCONTENU DU DOCUMENT :\n${snippet}` }],
              },
            ],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) continue;

      const resJson = await response.json();
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let cleaned = responseText.trim();
      if (cleaned.includes("```")) {
        cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
      }

      const parsed = JSON.parse(cleaned);
      if (parsed && (parsed.type === "CV" || parsed.type === "Lettre de motivation" || parsed.type === "invalide")) {
        return parsed.type;
      }
    } catch {
      // continuer au modèle suivant
    }
  }

  return null;
}

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validation sécurité (taille, extension, magic bytes)
    const check = validateUploadedFile(buffer, file.type, file.size);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    // 1. Extraction du texte
    const extractedText = await extractTextFromFile(buffer, file.name, file.type);

    // 2. Classification IA avec repli heuristique
    let docType = await classifyWithAI(extractedText, file.name);
    if (!docType) {
      docType = classifyWithHeuristics(extractedText, file.name);
    }

    // 3. Vérification de conformité
    if (docType === "invalide") {
      return NextResponse.json(
        {
          success: false,
          error: "Document non autorisé : ce fichier ne correspond ni à un Curriculum Vitae (CV) ni à une Lettre de motivation valide.",
          detectedType: "invalide",
        },
        { status: 400 }
      );
    }

    // 4. Vérification de la règle d'unicité (1 seul CV + 1 seule Lettre de motivation)
    const admin = getSupabaseAdmin();
    const { data: existingDocs, error: fetchErr } = await admin
      .from("resumes")
      .select("id, title, type")
      .eq("user_id", user.id);

    if (!fetchErr && existingDocs) {
      // Normalisation des types existants
      const hasCv = existingDocs.some((d) => d.type === "CV" || d.type === "created" || d.type === "imported" || (!d.type?.toLowerCase().includes("lettre") && !d.title?.toLowerCase().includes("lettre")));
      const hasLettre = existingDocs.some((d) => d.type === "Lettre de motivation" || d.type?.toLowerCase().includes("lettre") || d.title?.toLowerCase().includes("lettre"));

      if (docType === "CV" && hasCv) {
        return NextResponse.json(
          {
            success: false,
            error: "Vous possédez déjà un CV enregistré. Vous ne pouvez pas ajouter deux CVs à la fois. Supprimez votre CV actuel pour en importer un nouveau, ou ajoutez une lettre de motivation.",
            detectedType: "CV",
            alreadyExists: true,
          },
          { status: 409 }
        );
      }

      if (docType === "Lettre de motivation" && hasLettre) {
        return NextResponse.json(
          {
            success: false,
            error: "Vous possédez déjà une Lettre de motivation enregistrée. Vous ne pouvez pas ajouter deux lettres à la fois. Supprimez votre lettre actuelle pour en importer une nouvelle, ou ajoutez un CV.",
            detectedType: "Lettre de motivation",
            alreadyExists: true,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      documentType: docType,
      message: `Document identifié avec succès : ${docType}`,
    });
  } catch (error) {
    console.error("[Classify Document Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'analyse du document. Veuillez réessayer avec un fichier PDF ou DOCX valide.",
      },
      { status: 500 }
    );
  }
}
