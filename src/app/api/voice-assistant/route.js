import { NextResponse } from 'next/server';
import { requireUser, checkRateLimit } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const { message, location } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const hasRealPosition = !!(location && typeof location.lat === "number" && typeof location.lng === "number");

    let locationContext = "Position actuelle : Non fournie (considérer Dakar centre).";
    if (hasRealPosition) {
      locationContext = `Position GPS exacte : Latitude ${location.lat}, Longitude ${location.lng} (Région de Dakar).`;
    }

    // Destinations reconnues (même liste que la base de connaissances
    // ci-dessous) — recherche déterministe côté code, jamais confiée au
    // LLM : un lien Maps mal formé ou halluciné serait pire qu'aucun lien.
    // "label" est un nom de lieu géocodable par Google Maps directement
    // (pas besoin de coordonnées fixes par destination).
    const KNOWN_DESTINATIONS = [
      { keywords: ["pikine"], label: "Pikine, Dakar, Sénégal" },
      { keywords: ["guédiawaye", "guediawaye"], label: "Guédiawaye, Dakar, Sénégal" },
      { keywords: ["plateau", "centre-ville", "centre ville"], label: "Plateau, Dakar, Sénégal" },
    ];
    const lowerMessage = message.toLowerCase();
    const matchedDestination = KNOWN_DESTINATIONS.find((dest) =>
      dest.keywords.some((kw) => lowerMessage.includes(kw))
    );

    let mapsUrl = null;
    if (hasRealPosition && matchedDestination) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${location.lat},${location.lng}&destination=${encodeURIComponent(matchedDestination.label)}&travelmode=transit`;
    }

    const SYSTEM_PROMPT = `
Tu es l'assistant vocal officiel de Facilité (ffacilite.com), basé à Dakar, Sénégal.
Réponds de façon concise, naturelle et directe (1 phrase courte adaptée à la voix).

CONTEXTE UTILISATEUR :
${locationContext}

BASE DE CONNAISSANCES STRICTE POUR LES TRANSPORTS ET ITINÉRAIRES :
- Aller à Pikine : "Pour aller à Pikine, prenez le bus 26 ou un taxi direct."
- Aller à Guédiawaye : "Pour Guédiawaye, empruntez le bus 28 ou un taxi."
- Aller au Plateau / Centre-ville : "Prenez le bus Tata ligne 1 ou le TER selon votre arrêt."
- Déposer un CV : "Déposez votre CV directement dans l'onglet Candidat sur le site ffacilite.com."
- Créer une offre : "Connectez-vous sur votre espace recruteur pour publier votre annonce."

RÈGLE ABSOLUE : Si la destination demandée n'est pas répertoriée ou est hors-sujet, réponds exactement : "Je n'ai pas cet itinéraire pour le moment, veuillez contacter le support."
`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API Gemini non configurée" }, { status: 500 });
    }

    // gemini-1.5-flash n'existe plus (retiré du catalogue Google, 404
    // systématique) — même liste de repli déjà vérifiée et en service dans
    // src/lib/documentParser.js (CANDIDATE_MODELS) pour cette même clé API.
    const CANDIDATE_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.0-flash"];

    let replyText = null;
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
                  parts: [{ text: `${SYSTEM_PROMPT}\n\nQuestion posée : "${message}"` }]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 60
              }
            })
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (candidateText) {
          replyText = candidateText;
          break;
        }
      } catch {
        // Modèle indisponible ou erreur réseau ponctuelle — tente le suivant.
      }
    }

    return NextResponse.json({ reply: replyText || "Désolé, je n'ai pas compris votre demande.", mapsUrl });
  } catch (error) {
    console.error("voice-assistant error:", error);
    return NextResponse.json({ error: "Erreur de traitement vocal" }, { status: 500 });
  }
}
