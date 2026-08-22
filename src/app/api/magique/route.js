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
 * Route API /api/magique
 * Studio IA & Écriture Magique pour CV et lettres de motivation.
 * Texte pur (pas de vision/document) : DeepSeek en modèle principal
 * (réallocation Gemini, point 2 du 2026-08-22 — usage texte substituable),
 * Gemini gardé en repli si DeepSeek est indisponible.
 */
export async function POST(req) {
  try {
    // 0. Authentification + limite de débit — endpoint trouvé sans aucun
    // contrôle (invariant 5), ouvert à quiconque connaît l'URL et pouvant
    // épuiser la clé Gemini du projet sans coût pour l'appelant. Même
    // garde que les autres routes IA (ex. /api/cv/improve-text).
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    // 1. Parsing sécurisé du corps de la requête
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { 
          success: false, 
          error: "Format de requête invalide (JSON attendu).",
          message: "Format de requête invalide."
        },
        { status: 400 }
      );
    }

    // 2. Validation rigoureuse des données entrantes
    const texte = body?.texteInitial || body?.texte || body?.text || body?.prompt || body?.content;
    const typeAction = body?.type || 'reformulation'; // 'reformulation', 'ats', 'experience', 'profil', etc.
    const jobTitle = body?.jobTitle || '';

    if (!texte || typeof texte !== 'string' || !texte.trim()) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Le paramètre 'texteInitial' est requis et ne doit pas être vide.",
          message: "Le texte à améliorer est manquant ou vide." 
        },
        { status: 400 }
      );
    }

    const texteNettoye = texte.trim();

    // 3. Construction du prompt optimisé selon le contexte
    let promptContexte = "";
    if (typeAction === 'ats') {
      promptContexte = "Optimise ce texte pour maximiser sa compatibilité avec les logiciels de recrutement ATS (Applicant Tracking Systems) en intégrant des mots-clés stratégiques du secteur.";
    } else {
      promptContexte = "Reformule et valorise ce texte avec un ton percutant, professionnel et moderne, en utilisant des verbes d'action au présent/passé composé et une syntaxe irréprochable.";
    }

    const consignes = `Mission : Améliorer le texte suivant pour un CV professionnel${jobTitle ? ` dans le domaine "${jobTitle}"` : ""}.

Directives strictes :
- ${promptContexte}
- Corrige toutes les fautes d'orthographe, de grammaire et de typographie.
- Ne rajoute pas d'informations factuelles inventées ou mensongères.
- Renvoie UNIQUEMENT le texte final amélioré, prêt à être copié/collé directement dans le CV.
- Ne rajoute aucune formule de politesse, ni introduction (ex: "Voici une version améliorée"), ni balise markdown de bloc de code (\`\`\`), ni guillemets englobants.

Texte d'origine à transformer :
"""
${texteNettoye}
"""`;
    const systemPrompt = "Tu es un expert senior en recrutement et rédaction de CV de haut niveau pour la plateforme Facilité.";

    // 4. DeepSeek en modèle principal
    let texteAmeliore = null;
    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (dsKey && !dsKey.includes('[') && dsKey.trim() !== '') {
      try {
        const dsResponse = await deepseek.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: consignes },
          ],
          temperature: 0.7,
        });
        texteAmeliore = dsResponse.choices[0]?.message?.content?.trim() || null;
      } catch (dsError) {
        console.warn("[API Magique] Échec DeepSeek, repli sur Gemini:", dsError?.message);
      }
    }

    // 5. Repli Gemini si DeepSeek indisponible ou en échec
    if (!texteAmeliore) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey || apiKey.trim() === '' || apiKey.includes('[VOTRE_')) {
        console.error("[API Magique] Ni DeepSeek ni Gemini disponibles.");
        return NextResponse.json(
          {
            success: false,
            error: "Configuration des clés API IA manquante côté serveur.",
            message: "Le service d'assistance IA est momentanément indisponible."
          },
          { status: 500 }
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.6-flash",
        generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 1024 },
      });
      const result = await model.generateContent(`${systemPrompt}\n\n${consignes}`);
      const response = await result.response;
      texteAmeliore = response.text();
    }

    if (!texteAmeliore || !texteAmeliore.trim()) {
      throw new Error("La réponse générée par le modèle est vide.");
    }

    // Nettoyage supplémentaire des éventuels guillemets ou backticks superflus
    texteAmeliore = texteAmeliore.trim().replace(/^["']|["']$/g, '').trim();

    // 7. Retour de la réponse JSON au format attendu par le client
    return NextResponse.json({
      success: true,
      texteAmeliore: texteAmeliore,
      texte: texteAmeliore, // Rétrocompatibilité
    });

  } catch (error) {
    console.error("[API Magique] Erreur lors de l'exécution du Studio IA :", error);

    // Analyse du message d'erreur pour un statut et un message adaptés
    const errorMessage = error?.message || "Erreur interne du serveur.";
    const isRateLimit = errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota");

    return NextResponse.json(
      {
        success: false,
        error: isRateLimit ? "Limite de requêtes IA atteinte, veuillez patienter quelques instants." : errorMessage,
        message: isRateLimit ? "Trop de requêtes IA simultanées. Veuillez réessayer dans un instant." : "Impossible de joindre l'IA pour le moment. Veuillez réessayer.",
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
