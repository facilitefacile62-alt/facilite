import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser, checkRateLimit } from '@/lib/apiAuth';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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

// Détection déterministe (jamais confiée au LLM, même principe que
// KNOWN_DESTINATIONS plus bas) — "lis mes messages" déclenche un résumé
// des notifications réelles de l'utilisateur, pas une réponse générée qui
// pourrait halluciner ou mélanger des données personnelles.
const READ_MESSAGES_TRIGGERS = [
  "lis mes messages", "lis-moi mes messages", "lis moi mes messages",
  "mes messages", "mes notifications", "lis mes notifications",
];

function isReadMessagesRequest(message) {
  const lower = message.toLowerCase();
  return READ_MESSAGES_TRIGGERS.some((trigger) => lower.includes(trigger));
}

const NOTIFICATION_TYPE_LABELS = {
  candidature: "Nouvelle candidature",
  reponse: "Réponse recruteur",
  jobs: "Offre d'emploi",
  message: "Nouveau message",
  badge: "Statut de votre badge",
  document_access: "Accès à vos documents",
};

/**
 * Résumé vocal des notifications non lues — construit à partir de
 * `content`, déjà un texte complet et lisible écrit à l'insertion
 * (vérifié sur des lignes réelles le 2026-08-21 : "Candidat Test E2E a
 * postulé pour...", "Votre badge \"Recruteur vérifié\" a été approuvé !").
 * Jamais de résolution séparée actor_id -> nom : la RLS de `profiles`
 * n'autorise de toute façon la lecture que de son propre profil pour un
 * utilisateur standard, c'est précisément pourquoi `content` est déjà
 * pré-rédigé côté serveur au moment de la création de la notification.
 *
 * Client Supabase authentifié avec le jeton de LA REQUÊTE (jamais
 * service_role) : mark_notification_read() et la RLS de `notifications`
 * dépendent toutes deux de auth.uid(), qui ne résout correctement que
 * pour une connexion authentifiée comme l'utilisateur — même patron déjà
 * en service dans src/app/api/interviews/[id]/join/route.js.
 */
async function buildUnreadMessagesSummary(token, userId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: unread, error } = await supabase
    .from("notifications")
    .select("id, type, content, created_at")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[Voice Assistant] Échec lecture notifications:", error.message);
    return "Désolé, je n'ai pas pu récupérer vos messages pour le moment.";
  }

  if (!unread || unread.length === 0) {
    return "Vous n'avez aucun nouveau message.";
  }

  const summary = unread
    .map((n) => `${NOTIFICATION_TYPE_LABELS[n.type] || "Notification"} : ${n.content}`)
    .join(". ");

  // Marqués lus dès l'inclusion dans ce résumé (au moment où ils sont
  // "énoncés" côté serveur) — aucun signal fiable de fin de lecture audio
  // réelle côté navigateur sans un second aller-retour ; en cas d'échec de
  // lecture audio côté client, l'utilisateur voit quand même le texte à
  // l'écran, donc le message n'est pas perdu même marqué lu par erreur.
  await Promise.all(
    unread.map((n) => supabase.rpc("mark_notification_read", { notification_id: n.id }))
  );

  const intro = unread.length === 1 ? "Vous avez 1 nouveau message. " : `Vous avez ${unread.length} nouveaux messages. `;
  return intro + summary;
}

// Base de connaissances FAQ gérée depuis l'admin (assistant_faq) plutôt que
// codée en dur — table verrouillée service_role uniquement (aucune policy
// RLS authenticated, voir 20260821100000_assistant_faq.sql), donc lue ici
// via getSupabaseAdmin() comme le panneau admin (/api/admin/faq). Échec de
// lecture non bloquant : l'assistant continue avec la seule base transport
// plutôt que de renvoyer une erreur pour une simple indisponibilité FAQ.
async function loadActiveFaqBlock() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("assistant_faq")
      .select("question, reponse")
      .eq("actif", true)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) return "";

    const lines = data.map((row) => `- ${row.question} : "${row.reponse}"`).join("\n");
    return `\n\nBASE DE CONNAISSANCES FAQ (VALIDÉE PAR L'ÉQUIPE FACILITÉ) :\n${lines}`;
  } catch (err) {
    console.warn("[voice-assistant] Échec chargement FAQ (non bloquant) :", err?.message);
    return "";
  }
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API Gemini non configurée" }, { status: 500 });
    }

    // "Lis mes messages" court-circuite tout le reste (itinéraires, base de
    // connaissances) : réponse déterministe construite depuis les vraies
    // notifications de l'utilisateur, jamais depuis le LLM.
    if (isReadMessagesRequest(message)) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const summaryText = await buildUnreadMessagesSummary(token, user.id);
      const audioBase64 = await synthesizeSpeech(summaryText, apiKey);
      return NextResponse.json({ reply: summaryText, mapsUrl: null, audioBase64 });
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

    const faqBlock = await loadActiveFaqBlock();

    const SYSTEM_PROMPT = `
Tu es l'assistant vocal officiel de Facilité (ffacilite.com), basé à Dakar, Sénégal.
Réponds de façon concise, naturelle et directe (1 phrase courte adaptée à la voix).

CONTEXTE UTILISATEUR :
${locationContext}

SALUTATIONS ET POLITESSE (« bonjour », « merci », « comment ça va », « au revoir », etc.) : ce n'est pas une demande d'information — réponds naturellement et brièvement, comme le ferait un assistant courtois. La règle de repli ci-dessous ne s'applique pas à ces échanges.

BASE DE CONNAISSANCES STRICTE POUR LES TRANSPORTS ET ITINÉRAIRES :
- Aller à Pikine : "Pour aller à Pikine, prenez le bus 26 ou un taxi direct."
- Aller à Guédiawaye : "Pour Guédiawaye, empruntez le bus 28 ou un taxi."
- Aller au Plateau / Centre-ville : "Prenez le bus Tata ligne 1 ou le TER selon votre arrêt."
- Déposer un CV : "Déposez votre CV directement dans l'onglet Candidat sur le site ffacilite.com."
- Créer une offre : "Connectez-vous sur votre espace recruteur pour publier votre annonce."${faqBlock}

RÈGLE ABSOLUE (pour toute VRAIE QUESTION D'INFORMATION uniquement — pas la politesse ci-dessus) : utilise UNIQUEMENT les réponses listées ci-dessus (transports/itinéraires et FAQ). Si la question posée (destination, sujet Facilité, ou autre) ne correspond à aucune entrée listée, réponds exactement : "Je n'ai pas cette information pour le moment, veuillez contacter le support." N'invente jamais de réponse hors de cette base.
`;

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
