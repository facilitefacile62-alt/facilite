import { NextResponse } from 'next/server';
import { requireUser, checkRateLimit } from '@/lib/apiAuth';

export const runtime = 'nodejs';

// Voix "Sulafat" (caractéristique officielle : "Warm") choisie parmi les 30
// voix documentées (ai.google.dev/gemini-api/docs/speech-generation) pour
// un ton chaleureux cohérent avec un assistant d'aide à l'emploi — Google
// ne documente aucune voix "recommandée pour le français" spécifiquement
// (voix multilingues, adaptent la prononciation à la langue du texte).
const TTS_VOICE = "Sulafat";

// gemini-3.1-flash-tts-preview est un modèle "preview" : liste de repli
// vérifiée en direct le 2026-08-21 (gemini-2.5-pro-preview-tts renvoie
// 429 quota=0 sur ce projet, gemini-2.5-flash-preview-tts fonctionne).
const TTS_CANDIDATE_MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

// L'API renvoie du PCM brut (jamais de conteneur audio autonome) — mimeType
// vérifié en direct : "audio/l16; rate=24000; channels=1" sur
// gemini-3.1-flash-tts-preview, "audio/L16;codec=pcm;rate=24000" (pas de
// "channels", mono implicite) sur gemini-2.5-flash-preview-tts. Sample rate
// extrait dynamiquement plutôt que fixé en dur, au cas où un modèle de
// repli varierait.
function parseSampleRateFromMimeType(mimeType) {
  const match = /rate=(\d+)/i.exec(mimeType || "");
  return match ? parseInt(match[1], 10) : 24000;
}

// Un <audio>/Audio() navigateur ne peut pas lire du PCM brut sans conteneur
// — enveloppe minimale WAV (44 octets), verifiée avec le module standard
// Python "wave" (parseur indépendant de ce code) avant intégration.
function pcmToWav(pcmBuffer, sampleRate, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Synthèse vocale côté serveur — remplace speechSynthesis (navigateur) par
 * l'API Gemini TTS. Best-effort : une erreur ici ne doit jamais faire
 * échouer la réponse texte, qui reste utilisable seule (le client retombe
 * sur speechSynthesis si audioBase64 est absent).
 */
async function synthesizeSpeech(text, apiKey) {
  for (const model of TTS_CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];
      if (!part?.inlineData?.data) continue;

      const sampleRate = parseSampleRateFromMimeType(part.inlineData.mimeType);
      const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
      const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
      return wavBuffer.toString("base64");
    } catch (err) {
      console.error(`[Voice Assistant TTS] Échec avec ${model}:`, err.message);
    }
  }
  return null;
}

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

    const finalReplyText = replyText || "Désolé, je n'ai pas compris votre demande.";
    const audioBase64 = await synthesizeSpeech(finalReplyText, apiKey);

    return NextResponse.json({ reply: finalReplyText, mapsUrl, audioBase64 });
  } catch (error) {
    console.error("voice-assistant error:", error);
    return NextResponse.json({ error: "Erreur de traitement vocal" }, { status: 500 });
  }
}
