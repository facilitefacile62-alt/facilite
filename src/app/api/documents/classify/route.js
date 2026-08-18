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
 * Normalisation de chaîne pour comparaison robuste (sans accents, minuscules)
 */
function normalizeName(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Vérifie si deux noms désignent la même personne (au moins un mot-clé de nom/prénom en commun)
 */
function checkNameMatch(nameA = "", nameB = "") {
  if (!nameA || !nameB) return true; // Si l'un des deux n'a pas pu être extrait, pas de faux positif
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true;

  const tokensA = normA.split(/\s+/).filter((t) => t.length >= 3);
  const tokensB = normB.split(/\s+/).filter((t) => t.length >= 3);

  if (tokensA.length === 0 || tokensB.length === 0) return true;

  // Vérifier si au moins 1 token significatif (nom de famille ou prénom) correspond
  const hasCommonToken = tokensA.some((tA) => tokensB.includes(tA));
  return hasCommonToken;
}

/**
 * Extraction d'identité par heuristique regex locale
 */
function extractIdentityHeuristics(text = "", filename = "") {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  const phoneMatch = text.match(/(?:\+221|00221)?\s*(?:7[05678]|33)\s*\d{3}\s*\d{2}\s*\d{2}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : null;

  // Tentative d'extraction de nom depuis le nom du fichier ou les premières lignes
  let extractedName = null;
  const cleanFileName = filename.replace(/\.(pdf|docx|doc)$/i, "").replace(/[-_]/g, " ");
  
  // Ex: "CV Macoumba Samake" ou "Mouhamet DIA lettre de motivation"
  const cleanedFileWords = cleanFileName
    .replace(/\b(cv|curriculum|vitae|lettre|de|motivation|cover|letter|passe|partout|final|v1|v2)\b/gi, "")
    .trim();

  if (cleanedFileWords.length >= 3) {
    extractedName = cleanedFileWords;
  }

  return { fullName: extractedName, email, phone };
}

/**
 * Classification et extraction d'identité avec Gemini Flash
 */
async function classifyWithAI(documentText, filename) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return null;

  const prompt = `Tu es un expert RH et vérificateur d'identité. Analyse le texte de ce document professionnel (nom de fichier: "${filename}").
Tâches :
1. Détermine la nature du document : "CV", "Lettre de motivation" ou "invalide" (facture, reçu, pièce d'identité sans rapport, texte hors sujet).
2. Extrais les coordonnées et l'identité du candidat (nom et prénom complet, email, téléphone, adresse/ville).

Réponds STRICTEMENT en JSON :
{
  "type": "CV" | "Lettre de motivation" | "invalide",
  "fullName": "Prénom et Nom complet du candidat ou null",
  "email": "email ou null",
  "phone": "numéro de téléphone ou null",
  "reason": "explication concise en français"
}`;

  const snippet = documentText.slice(0, 3500);

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
        return parsed;
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

    // 2. Classification IA & Extraction d'identité avec repli heuristique
    let aiResult = await classifyWithAI(extractedText, file.name);
    let docType = aiResult?.type;
    let extractedFullName = aiResult?.fullName;
    let extractedEmail = aiResult?.email;
    let extractedPhone = aiResult?.phone;

    if (!docType) {
      docType = classifyWithHeuristics(extractedText, file.name);
      const heurIdentity = extractIdentityHeuristics(extractedText, file.name);
      extractedFullName = heurIdentity.fullName;
      extractedEmail = heurIdentity.email;
      extractedPhone = heurIdentity.phone;
    }

    // 3. Vérification de conformité de type
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

    const admin = getSupabaseAdmin();

    // 4. Récupérer le profil et les documents existants de l'utilisateur
    const [{ data: userProfile }, { data: existingDocs }] = await Promise.all([
      admin.from("profiles").select("id, full_name, first_name, last_name, email, phone").eq("id", user.id).maybeSingle(),
      admin.from("resumes").select("id, title, type, content").eq("user_id", user.id),
    ]);

    // Déterminer l'identité de référence de l'utilisateur
    const profileFullName = userProfile?.full_name || `${userProfile?.first_name || ""} ${userProfile?.last_name || ""}`.trim() || null;
    const profileEmail = userProfile?.email || user.email || null;

    // Récupérer le nom extrait ou contenu dans le document existant
    let existingDocName = null;
    if (existingDocs && existingDocs.length > 0) {
      const firstDoc = existingDocs[0];
      existingDocName = firstDoc.content?.etat_civil?.nom || firstDoc.content?.firstName ? `${firstDoc.content?.firstName} ${firstDoc.content?.lastName}` : null;
      if (!existingDocName && firstDoc.title) {
        existingDocName = firstDoc.title
          .replace(/\.(pdf|docx|doc)$/i, "")
          .replace(/\b(cv|curriculum|vitae|lettre|de|motivation|cover|letter)\b/gi, "")
          .replace(/[-_]/g, " ")
          .trim();
      }
    }

    const referenceName = profileFullName || existingDocName;

    // 5. VÉRIFICATION D'IDENTITÉ IDENTIQUE (CV et Lettre de motivation doivent appartenir à la même personne)
    if (extractedFullName && referenceName) {
      const isMatch = checkNameMatch(extractedFullName, referenceName);
      if (!isMatch) {
        return NextResponse.json(
          {
            success: false,
            error: `Incohérence d'identité détectée : ce document est au nom de « ${extractedFullName} », alors que votre profil et vos documents existants sont au nom de « ${referenceName} ». Vos documents (CV et Lettre de motivation) doivent appartenir à la même personne.`,
            detectedIdentity: extractedFullName,
            expectedIdentity: referenceName,
          },
          { status: 400 }
        );
      }
    }

    // 6. Vérification de la règle d'unicité (1 seul CV + 1 seule Lettre de motivation)
    if (existingDocs && existingDocs.length > 0) {
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
      detectedIdentity: extractedFullName,
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
