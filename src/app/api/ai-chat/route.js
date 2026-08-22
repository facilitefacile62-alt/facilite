import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { AiChatPayloadSchema } from "@/lib/validation";
import { extractTextFromFile } from "@/lib/documentParser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Assistant IA de la messagerie — une conversation directe couvrant CV,
 * entretien et orientation sans que l'utilisateur ait à choisir un mode.
 *
 * Appel direct à l'API DeepSeek en `fetch`, sans Vercel AI SDK : les versions
 * installées sont incompatibles entre elles (`ai@7` côté serveur n'expose plus
 * `toDataStreamResponse`, alors que `@ai-sdk/react@4` côté client attend encore
 * l'ancien protocole). Un appel HTTP brut est ici le chemin le plus fiable, au
 * prix d'une réponse non streamée.
 */

// Prompt unifié (fusion des 3 modes CV / Coach entretien / Orientation —
// voir git history pour les 3 versions séparées) : couvre les trois volets
// naturellement selon ce que la question demande, sans jamais faire choisir
// un mode à l'utilisateur. Les 3 descriptions de spécialisation sont
// reprises mot pour mot, seule leur présentation change (toujours actives
// au lieu de conditionnées à un `activeAiRole`).
const BASE_PROMPT = `Tu es l'assistant IA officiel de la plateforme Facilité (https://ffacilite.com/), fondée par Macoumba Samake.
Ton rôle est d'accompagner les utilisateurs, candidats et recruteurs au Sénégal et à l'international, sur trois volets que tu couvres naturellement selon ce que la question demande, sans jamais faire choisir un mode à l'utilisateur :
- Rédaction, correction et mise en valeur de CV et lettres de motivation.
- Coaching pour entretiens d'embauche et conseils pour convaincre les recruteurs.
- Orientation académique, démarches administratives et conseils de carrière.
Tu es trilingue : réponds avec aisance en Français, en Wolof ou en Anglais selon la langue choisie par l'utilisateur.
Sois clair, dynamique, courtois, hautement professionnel et structuré dans tes réponses.`;

const GEMINI_VISION_MODEL = "gemini-flash-latest";
const BASE64_PREFIXE = /^data:[a-zA-Z0-9/\-+.]+;base64,/;

// Copie exacte de COMMUNICATION_STYLES (src/components/AdminAIStudio.jsx) —
// même id/modifier, pour composer côté serveur EXACTEMENT le même
// fullSystemPrompt que celui déjà construit côté client dans le Playground
// admin. Toute dérive entre les deux redonnerait deux comportements
// différents pour un même réglage enregistré.
const COMMUNICATION_STYLE_MODIFIERS = {
  normal: "Adopte un ton naturel, chaleureux, bienveillant et professionnel.",
  concis: "Sois direct et ultra-synthétique. Limite tes réponses à 2-4 phrases ou points clés sans bavardage.",
  explicatif: "Donne des explications complètes et pédagogiques, étape par étape, avec des exemples concrets.",
  commercial: "Mets en valeur la qualité des maquettes Canva de Facilité et invite poliment le client à valider sa commande de CV ou lettre.",
};

/**
 * Construit le system prompt depuis assistant_ai_config (verrouillée
 * service_role, voir 20260821130000_assistant_ai_studio.sql) — c'est ce qui
 * manquait pour que l'onglet admin "Entraînement IA" ait un effet réel sur
 * la messagerie candidat : df3fe34 avait migré la PERSISTANCE de la config
 * vers Supabase, mais cette route continuait à ignorer la table et à
 * utiliser BASE_PROMPT (constante figée ci-dessus) pour tout appelant qui
 * n'envoie pas explicitement customSystemPrompt — c'est-à-dire la vraie
 * messagerie (MessagerieClient.js n'envoie que { messages }), contrairement
 * au Playground admin qui construit et envoie son propre prompt complet.
 *
 * Aucun cache : lu à chaque requête, une modification enregistrée est donc
 * immédiatement active à la prochaine réponse, sans redéploiement.
 * Repli sur BASE_PROMPT si la config est absente ou vide, jamais un échec
 * bloquant pour l'utilisateur final.
 */
async function buildSystemPromptFromConfig() {
  try {
    const admin = getSupabaseAdmin();
    const [{ data: config }, { data: products }] = await Promise.all([
      admin.from("assistant_ai_config").select("*").eq("id", 1).maybeSingle(),
      admin.from("assistant_ai_products").select("*").order("display_order", { ascending: true }),
    ]);

    if (!config?.prompt_text?.trim()) return BASE_PROMPT;

    const styleModifier = COMMUNICATION_STYLE_MODIFIERS[config.comm_style] || COMMUNICATION_STYLE_MODIFIERS.normal;
    const currency = config.currency === "EUR" ? "EUR" : "FCFA";
    const productsContext = (products || [])
      .map((p) => `• ${p.name} : ${currency === "FCFA" ? `${p.price_fcfa} FCFA` : `${p.price_eur} €`} (${p.description || ""})`)
      .join("\n");

    return `
${config.prompt_text.trim()}

[STYLE DE COMMUNICATION OBLIGATOIRE]
${styleModifier}

[BASE DE CONNAISSANCES OFFICIELLE & TARIFS EN VIGUEUR]
${(config.knowledge_text || "").trim()}

[RÈGLES ET CRITÈRES OFFICIELS DU DIAGNOSTIC CV & SCORING ATS]
${(config.diagnostic_rules_text || "").trim()}

[CATALOGUE DES PRODUITS ET TARIFS (${currency})]
${productsContext}
`.trim();
  } catch (err) {
    console.error("ai-chat: échec lecture assistant_ai_config, repli sur BASE_PROMPT:", err.message);
    return BASE_PROMPT;
  }
}

/**
 * Extrait le texte des documents joints (PDF, Word...) pour l'injecter dans le
 * prompt. DeepSeek ne lit que du texte : sans cette étape, un CV joint était
 * transmis puis purement ignoré.
 */
async function extraireContexteDocuments(documents) {
  let contexte = "";

  for (const doc of documents) {
    try {
      const buffer = Buffer.from(doc.data.replace(BASE64_PREFIXE, ""), "base64");
      const texte = await extractTextFromFile(
        buffer,
        doc.name || "document",
        doc.mimeType || "application/octet-stream"
      );
      if (texte) {
        contexte += `Contenu du fichier joint [${doc.name || "document"}] :\n---\n${texte}\n---\n\n`;
      }
    } catch (err) {
      console.error(`ai-chat: extraction impossible pour ${doc.name}:`, err.message);
    }
  }

  return contexte;
}

/**
 * Analyse d'images via Gemini : DeepSeek n'a pas de capacité vision, une image
 * jointe ne peut donc pas être traitée par le chemin nominal.
 * Renvoie null si la clé manque ou si l'appel échoue — l'appelant retombe alors
 * sur DeepSeek en mode texte seul.
 */
async function appelerGeminiVision(systemPrompt, historique, images) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.includes("[") || geminiKey.trim() === "") return null;

  // Gemini nomme "model" le rôle assistant.
  const contents = historique.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const dernier = contents[contents.length - 1];
  for (const img of images) {
    dernier.parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/png",
        data: img.data.replace(BASE64_PREFIXE, ""),
      },
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // En-tête plutôt que query string : une clé en URL fuite dans les journaux.
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ai-chat: Gemini Vision rejeté:", response.status, err.slice(0, 300));
      return null;
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error("ai-chat: échec Gemini Vision:", err.message);
    return null;
  }
}

export async function POST(req) {
  try {
    // 1. Authentification & limitation de débit — alignées sur /api/assistant.
    // Sans elles, l'endpoint serait ouvert et n'importe qui pourrait consommer
    // le crédit DeepSeek du projet.
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

    // 2. Validation du payload
    const parsed = AiChatPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Historique des messages invalide ou manquant." },
        { status: 400 }
      );
    }
    const { messages, message, model: requestedModel, customSystemPrompt, temperature, attachments } = parsed.data;

    // Normalisation des deux formes acceptées vers un historique unique.
    const historique =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: message }];

    // customSystemPrompt reste un override explicite (utilisé par le
    // Playground admin pour prévisualiser un brouillon non enregistré) ;
    // tout appelant qui ne le fournit pas — c'est-à-dire la vraie
    // messagerie candidat — reçoit désormais le prompt réellement
    // enregistré en base, lu à chaque requête (aucun cache).
    const systemPrompt = customSystemPrompt?.trim()
      ? customSystemPrompt.trim()
      : await buildSystemPromptFromConfig();

    // 3. Pièces jointes
    const images = (attachments || []).filter((a) => a.type === "image");
    const documents = (attachments || []).filter((a) => a.type === "document");

    // Les documents sont convertis en texte et préfixés au dernier tour
    // utilisateur, qui est celui auquel ils étaient joints.
    if (documents.length > 0) {
      const contexte = await extraireContexteDocuments(documents);
      if (contexte) {
        const dernierUser = historique.map((m) => m.role).lastIndexOf("user");
        if (dernierUser !== -1) {
          historique[dernierUser] = {
            ...historique[dernierUser],
            content: `${contexte}${historique[dernierUser].content}`,
          };
        }
      }
    }

    // Les images exigent un modèle vision : DeepSeek n'en a pas.
    if (images.length > 0) {
      const reponseVision = await appelerGeminiVision(systemPrompt, historique, images);
      if (reponseVision) {
        return NextResponse.json({ reply: reponseVision });
      }
      console.warn("ai-chat: vision indisponible, repli sur DeepSeek en texte seul.");
      historique.push({
        role: "user",
        content:
          "[Note système : des images ont été jointes mais n'ont pas pu être analysées. " +
          "Indique-le à l'utilisateur et propose de coller le texte du document.]",
      });
    }

    const temp = typeof temperature === "number" ? temperature : 0.7;

    // 1. Tentative avec DeepSeek (si demandé ou par défaut)
    if (!requestedModel || requestedModel === "deepseek-chat") {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (apiKey && !apiKey.includes("[") && apiKey.trim() !== "") {
        try {
          const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ role: "system", content: systemPrompt }, ...historique],
              temperature: temp,
              stream: false,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content;
            if (reply) return NextResponse.json({ reply });
          }
        } catch (deepseekErr) {
          console.warn("ai-chat: échec DeepSeek, bascule sur Gemini Flash:", deepseekErr.message);
        }
      }
    }

    // 2. Tentative avec Google Gemini Flash
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !geminiKey.includes("[") && geminiKey.trim() !== "") {
      try {
        const contents = historique.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { temperature: temp },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (geminiErr) {
        console.warn("ai-chat: échec Gemini, bascule sur Groq:", geminiErr.message);
      }
    }

    // 3. Repli de secours : Groq (Llama 3.3 70B)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && !groqKey.includes("[") && groqKey.trim() !== "") {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, ...historique],
            temperature: temp,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const reply = groqData.choices?.[0]?.message?.content;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (groqErr) {
        console.error("ai-chat: échec Groq:", groqErr.message);
      }
    }

    return NextResponse.json(
      { error: "Aucun fournisseur d'intelligence artificielle n'a pu répondre à la requête." },
      { status: 503 }
    );
  } catch (error) {
    console.error("ai-chat: Erreur serveur:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors du traitement de la requête IA." },
      { status: 500 }
    );
  }
}
