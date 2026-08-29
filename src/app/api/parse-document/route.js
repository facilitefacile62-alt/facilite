import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractTextFromFile, mapTextToProfileFields, extractCvWithGeminiVision } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { ParseDocumentJsonSchema, validateUploadedFile } from "@/lib/validation";

export const runtime = "nodejs"; // Évite les restrictions de durée Edge en production
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

// Modèle Groq du filet de secours.
//
// llama-3.3-70b-versatile a été retiré du catalogue : l'API répondait 404 à
// chaque appel (vérifié le 2026-08-29 en interrogeant GET /openai/v1/models —
// plus aucun modèle Llama de conversation n'y figure). Le repli était donc
// mort sans que rien ne le signale, puisque l'échec était avalé par le
// catch et que la route renvoyait quand même success:true.
//
// Choisi parmi les modèles réellement servis, sur deux critères testés en
// conditions réelles : mode JSON strict fonctionnel — openai/gpt-oss-120b et
// gpt-oss-20b échouent sur `response_format: json_object` avec « Failed to
// validate JSON » — et respect du schéma imposé par SYSTEM_PROMPT, vérifié
// sur un CV complet (10 clés attendues, 3 formations, dates au format
// « Septembre 2018 - Juin 2021 »). groq/compound-mini passait aussi, mais
// c'est un système agentique à outils, imprévisible pour de l'extraction
// pure.
const MODELE_GROQ = "qwen/qwen3.8-27b";

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
  "formations": [
    {
      "diplome": "string (intitulé exact du diplôme ou de la certification)",
      "etablissement": "string (école, université, centre de formation)",
      "dates": "string (ex: Septembre 2018 - Juin 2021, ou 2021 si une seule année)",
      "domaine": "string (spécialité ou filière, sinon null)",
      "lieu": "string (ville ou pays, sinon null)"
    }
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
- Extrais le texte verbatim.
- "formations" est OBLIGATOIRE dès qu'un diplôme, une école, une université ou une
  certification apparaît dans le document — y compris si la section s'intitule
  « Formation », « Études », « Parcours académique » ou « Education ».
- Pour tout champ "dates", conserve le format « Mois Année - Mois Année » tel qu'il
  figure dans le document. Si le poste est en cours, écris « Mois Année - Présent ».`;

/**
 * Un résultat d'extraction contient-il quoi que ce soit d'utilisable ?
 *
 * Doit reconnaître DEUX formes, qui ne se ressemblent pas :
 *  - la réponse des modèles, imbriquée (etat_civil.nom, contacts.email…),
 *    telle que SYSTEM_PROMPT l'impose ;
 *  - celle du repli regex mapTextToProfileFields(), entièrement plate
 *    (firstName, lastName, email…).
 *
 * Le seuil est volontairement bas : un seul signal suffit. Il ne s'agit pas
 * de juger la qualité de l'extraction — la personne relit tout dans la modale
 * de vérification — mais de distinguer « quelque chose est remonté » de
 * « absolument rien », seul cas où renvoyer une erreur est justifié.
 */
function extractionExploitable(champs) {
  if (!champs || typeof champs !== "object") return false;

  const texteUtile = (v) => typeof v === "string" && v.trim() !== "";
  const listeUtile = (v) => (Array.isArray(v) ? v.length > 0 : Array.isArray(v?.detail) && v.detail.length > 0);

  return (
    // Forme imbriquée (modèles)
    texteUtile(champs?.etat_civil?.nom) ||
    texteUtile(champs?.etat_civil?.titre_professionnel) ||
    texteUtile(champs?.contacts?.email) ||
    texteUtile(champs?.contacts?.telephone) ||
    texteUtile(champs?.profil_professionnel) ||
    listeUtile(champs?.formations) ||
    listeUtile(champs?.experiences_professionnelles) ||
    listeUtile(champs?.competences_cles_hard_skills) ||
    listeUtile(champs?.langues) ||
    // Forme plate (repli regex)
    texteUtile(champs?.firstName) ||
    texteUtile(champs?.lastName) ||
    texteUtile(champs?.email) ||
    texteUtile(champs?.phone) ||
    texteUtile(champs?.title) ||
    listeUtile(champs?.skills) ||
    listeUtile(champs?.experiences) ||
    listeUtile(champs?.educations)
  );
}

export async function POST(req) {
  let documentText = "";
  let filename = "document.txt";
  let mimeType = "text/plain";

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

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const parsedBody = ParseDocumentJsonSchema.safeParse(await req.json());
      if (!parsedBody.success) {
        return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
      }
      documentText = parsedBody.data.documentText;
    } else {
      // Extraction depuis FormData
      const formData = await req.formData();
      const file = formData.get("file");
      if (file && typeof file !== "string") {
        filename = file.name;
        mimeType = file.type;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Taille + type déclaré + magic bytes : l'OCR Tesseract qui suit est
        // très coûteux en CPU, on refuse tout ce qui n'est pas légitime AVANT.
        const check = validateUploadedFile(buffer, mimeType, file.size);
        if (!check.valid) {
          return NextResponse.json({ error: check.error }, { status: check.status });
        }

        if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
          try {
            const visionResult = await extractCvWithGeminiVision(buffer, mimeType, SYSTEM_PROMPT);
            // `!visionResult.error` ne suffisait pas : un objet sans champ
            // `error` mais vide passait pour un succès et court-circuitait
            // DeepSeek et Groq. C'est le chemin PRINCIPAL pour un PDF ou une
            // photo — donc le cas le plus fréquent. On exige désormais un
            // contenu réellement exploitable avant de s'arrêter là ; sinon on
            // laisse la chaîne de repli faire son travail.
            if (visionResult && !visionResult.error && extractionExploitable(visionResult)) {
              return NextResponse.json({ success: true, data: visionResult, fields: visionResult, rawTextLength: 0 });
            }
          } catch (err) {
            console.error("[Vision API Fallback]", err);
          }
        }

        documentText = await extractTextFromFile(buffer, filename, mimeType);
      }
    }

    if (!documentText) {
      // Auparavant : success:true avec des champs vides. Le client ouvrait
      // alors sa modale de vérification sur un formulaire entièrement blanc,
      // sans qu'aucun message n'explique pourquoi. C'est le cas typique d'un
      // PDF scanné sans couche texte dont l'OCR n'a rien tiré.
      console.warn("Texte de document vide — aucune extraction possible.");
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucun texte n'a pu être lu dans ce document. S'il s'agit d'une photo ou d'un scan, réessayez avec une image plus nette ou un PDF contenant du texte.",
          stage: "extraction_texte",
        },
        { status: 422 }
      );
    }

    let parsedData = null;

    // Tentative 1 : DeepSeek en modèle principal (réallocation Gemini, point 2
    // du 2026-08-22 — texte pur, l'appel Gemini précédent ciblait un modèle
    // mort (gemini-2.5-flash, 404) et dégradait déjà silencieusement vers
    // DeepSeek à chaque appel ; autant y aller directement).
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

        const rawContent = dsResponse.choices[0]?.message?.content;
        parsedData = extractAndParseJSON(rawContent);
        console.log("Extraction DeepSeek réussie.");
      } catch (dsError) {
        console.error("[DeepSeek Failure]", dsError?.message);
      }
    }

    // Tentative 2 : Groq en repli
    if (!parsedData) {
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
        try {
          console.log(`Appel Groq OpenAI Client (${MODELE_GROQ})...`);
          const groqResponse = await groq.chat.completions.create({
            model: MODELE_GROQ,
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

    // Tentative 3 : repli regex local si toutes les APIs IA échouent
    let replisRegex = false;
    if (!parsedData) {
      console.log("Appel regex local fallback.");
      parsedData = mapTextToProfileFields(documentText);
      replisRegex = true;
    }

    // Dernier verrou : un repli qui n'a rien trouvé ne doit PAS ressortir en
    // succès. C'est ce qui rendait la panne invisible — trois étages pouvaient
    // échouer d'affilée et la route répondait quand même success:true avec un
    // objet vide, que le client affichait sous forme de formulaire blanc.
    if (!extractionExploitable(parsedData)) {
      console.error("[Parsing] Aucun étage n'a produit de données exploitables.");
      return NextResponse.json(
        {
          success: false,
          error:
            "L'analyse automatique n'a rien pu extraire de ce document. Réessayez dans quelques minutes, ou saisissez vos informations manuellement.",
          stage: replisRegex ? "modeles_indisponibles" : "extraction_vide",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      fields: parsedData,
      rawTextLength: documentText.length,
      // Permet au client de dire que le résultat est partiel plutôt que de
      // le présenter comme une extraction complète.
      degraded: replisRegex,
    });
  } catch (error) {
    console.error("[Parsing Route Error]", error);
    // Auparavant : success:true avec les champs du repli regex. Une exception
    // — quota IA, fichier corrompu, panne réseau — passait donc pour une
    // extraction réussie mais vide.
    return NextResponse.json(
      {
        success: false,
        error: "L'analyse du document a échoué. Réessayez, ou saisissez vos informations manuellement.",
        stage: "exception",
      },
      { status: 500 }
    );
  }
}
