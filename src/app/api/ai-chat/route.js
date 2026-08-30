import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { AiChatPayloadSchema } from "@/lib/validation";
import { extractTextFromFile } from "@/lib/documentParser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { getGeminiFunctionDeclarations, getDeclarationsHorsTunnel, getTool, runToolCall } from "@/lib/aiTools";

export const runtime = "nodejs";

/**
 * Assistant IA de la messagerie — une conversation directe couvrant CV,
 * entretien et orientation sans que l'utilisateur ait à choisir un mode.
 *
 * Appel direct à l'API Gemini en `fetch`, sans Vercel AI SDK : les versions
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

const GEMINI_VISION_MODEL = "gemini-3.6-flash";
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

// Machine à états du tunnel CV (point 3, 2026-08-22). Le CODE impose l'ordre
// et l'unicité de la question posée à chaque tour ; le TEXTE de chaque
// question reste entièrement piloté par prompt_text (section "TUNNEL DE
// CONVERSATION"), jamais réécrit ici — seule une consigne d'étape ("ne pose
// que la question de cette étape précise") est ajoutée par-dessus. C'est
// précisément ce qui manquait à l'agent WhatsApp (prompt détaillé, jamais
// suivi) : ici, le modèle ne peut pas dériver du plan sans que le code ne
// rejette la transition proposée.
const TUNNEL_TRANSITIONS = {
  accueil: ["intention", "cv_existant", "lettre_cv_upload"],
  intention: ["cv_existant", "lettre_cv_upload"],
  cv_existant: ["cv_ancien_upload", "infos_personnelles"],
  cv_ancien_upload: ["resume_cloture"],
  lettre_cv_upload: ["resume_cloture"],
  infos_personnelles: ["etudes"],
  etudes: ["formations_oui_non"],
  formations_oui_non: ["formations_details", "stages_oui_non"],
  formations_details: ["stages_oui_non"],
  stages_oui_non: ["stages_details", "experience_oui_non"],
  stages_details: ["experience_oui_non"],
  experience_oui_non: ["experience_details", "resume_cloture"],
  experience_details: ["resume_cloture"],
  // Permet de relancer un nouveau tunnel après clôture (candidat qui revient
  // plus tard) plutôt que de rester bloqué sur le message final.
  resume_cloture: ["intention", "cv_existant", "lettre_cv_upload", "resume_cloture"],
};
const TUNNEL_STEPS = Object.keys(TUNNEL_TRANSITIONS);

// Consigne par étape : ne fixe JAMAIS le texte de la question elle-même
// (toujours puisé dans prompt_text par le modèle), seulement le PÉRIMÈTRE
// autorisé pour ce tour — quelle section du TUNNEL DE CONVERSATION utiliser,
// et l'interdiction explicite d'anticiper la suite.
const STEP_INSTRUCTIONS = {
  accueil: `Étape actuelle : ACCUEIL. Envoie uniquement le message d'accueil défini dans la section "Accueil (Premier message)" du TUNNEL DE CONVERSATION ci-dessus. Si le message du client révèle déjà une intention précise (CV, lettre, les deux — voir règle "Prise en compte de l'intention directe"), tu peux enchaîner directement sur LA SEULE question d'orientation/tarifs correspondante dans ce même message, sans reposer une question d'intention séparée.`,
  intention: `Étape actuelle : INTENTION. Pose UNIQUEMENT la question permettant de savoir si le client veut un CV, une lettre de motivation, ou les deux (section "Orientation & Tarifs"). N'ajoute aucune autre question.`,
  cv_existant: `Étape actuelle : CV_EXISTANT. Pose UNIQUEMENT la question "Avez-vous déjà eu un CV auparavant ?" accompagnée de l'annonce du tarif correspondant (section "Orientation & Tarifs"). Ne demande pas encore les informations personnelles.`,
  cv_ancien_upload: `Étape actuelle : CV_ANCIEN_UPLOAD. Demande au client de t'envoyer son ancien CV. N'ajoute aucune autre question.`,
  lettre_cv_upload: `Étape actuelle : LETTRE_CV_UPLOAD. Demande au client de t'envoyer son CV actuel pour rédiger la lettre de motivation (section "Orientation & Tarifs", cas "lettre"). N'ajoute aucune autre question.`,
  infos_personnelles: `Étape actuelle : INFOS_PERSONNELLES. Pose UNIQUEMENT la question A ("Infos personnelles & Poste") de la section "Collecte de données". N'ajoute aucune question sur les études, formations, stages ou expérience à ce stade.`,
  etudes: `Étape actuelle : ÉTUDES. Pose UNIQUEMENT la question B ("Niveau d'études") de la section "Collecte de données". N'ajoute aucune autre question.`,
  formations_oui_non: `Étape actuelle : FORMATIONS_OUI_NON. Pose UNIQUEMENT la question C ("Formations complémentaires") en version oui/non — ne demande pas encore le nom, la durée, l'établissement ou l'année : ce sera une relance séparée si la réponse est oui.`,
  formations_details: `Étape actuelle : FORMATIONS_DETAILS. Le client a répondu OUI à la question sur les formations. Demande UNIQUEMENT les détails prévus (nom, durée, établissement, année).`,
  stages_oui_non: `Étape actuelle : STAGES_OUI_NON. Pose UNIQUEMENT la question D ("Stages") en version oui/non.`,
  stages_details: `Étape actuelle : STAGES_DETAILS. Le client a répondu OUI à la question sur les stages. Demande UNIQUEMENT les détails prévus (lieu, domaine, durée, année).`,
  experience_oui_non: `Étape actuelle : EXPERIENCE_OUI_NON. Pose UNIQUEMENT la question E ("Expérience professionnelle") en version oui/non.`,
  experience_details: `Étape actuelle : EXPERIENCE_DETAILS. Le client a répondu OUI à la question sur l'expérience. Demande UNIQUEMENT les détails prévus (nombre d'entreprises, noms des structures, postes occupés, durée pour chacune).`,
  resume_cloture: `Étape actuelle : RESUME_CLOTURE. Résume proprement toutes les informations recueillies durant cette conversation sous forme de fiche synthétique, puis termine impérativement par le message de clôture prévu dans la section "Résumé & Clôture finale".`,
};

const TUNNEL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    nextStep: { type: "STRING", enum: TUNNEL_STEPS },
  },
  required: ["reply", "nextStep"],
};

/**
 * Étape courante du candidat (assistant_conversation_state, verrouillée
 * service_role — voir 20260822180000_assistant_conversation_state.sql).
 * Repli sur "accueil" si la ligne n'existe pas encore ou en cas d'échec :
 * jamais un échec bloquant pour l'utilisateur final.
 */
async function getConversationStep(userId) {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("assistant_conversation_state")
      .select("current_step")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.current_step && TUNNEL_TRANSITIONS[data.current_step] ? data.current_step : "accueil";
  } catch (err) {
    console.error("ai-chat: échec lecture assistant_conversation_state, repli sur 'accueil':", err.message);
    return "accueil";
  }
}

async function saveConversationStep(userId, nextStep) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("assistant_conversation_state").upsert({ user_id: userId, current_step: nextStep });
  } catch (err) {
    console.error("ai-chat: échec écriture assistant_conversation_state:", err.message);
  }
}

/**
 * Le modèle PROPOSE une prochaine étape (nextStep) ; le code en a le dernier
 * mot. Une proposition hors du graphe de transitions légales depuis l'étape
 * courante est rejetée — repli sur la première option légale, jamais sur
 * l'idée du modèle. C'est ici, et seulement ici, que "l'ordre" est imposé.
 */
function resolveNextStep(currentStep, proposedNextStep) {
  const legal = TUNNEL_TRANSITIONS[currentStep] || TUNNEL_TRANSITIONS.accueil;
  if (proposedNextStep && legal.includes(proposedNextStep)) return proposedNextStep;
  return legal[0];
}

/**
 * Extrait le texte des documents joints (PDF, Word...) pour l'injecter dans le
 * prompt. Le modèle ne lit que du texte : sans cette étape, un CV joint était
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
 * Analyse d'images via Gemini : le chemin nominal plus bas n'envoie que du
 * texte (`parts: [{ text }]`), une image jointe a donc besoin de ce chemin
 * séparé qui construit des `inlineData`.
 * Renvoie null si la clé manque ou si l'appel échoue — l'appelant retombe
 * alors sur le chemin nominal en texte seul (note système expliquant
 * l'image non traitée).
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
    // 1. Authentification & limitation de débit — même garde que les autres routes IA du dépôt.
    // Sans elles, l'endpoint serait ouvert et n'importe qui pourrait consommer
    // le crédit Gemini du projet.
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
    const { messages, message, customSystemPrompt, temperature, attachments, confirmToolCall, position } = parsed.data;

    // Client scopé par le token de l'appelant — jamais service_role — pour
    // que tout outil exécuté (src/lib/aiTools/) passe par la même RLS que
    // l'utilisateur lui-même. Construit systématiquement (coût négligible),
    // utilisé uniquement quand des outils entrent en jeu.
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });

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

    // La machine à états ne s'applique qu'au vrai fil candidat (aucun
    // customSystemPrompt fourni) : le Playground admin garde un accès libre
    // au prompt brut pour tester un brouillon non enregistré, sans jamais
    // toucher à l'état persisté d'un vrai candidat.
    const useTunnelStateMachine = !customSystemPrompt?.trim();
    const currentStep = useTunnelStateMachine ? await getConversationStep(user.id) : null;

    const systemPromptAvecEtape = useTunnelStateMachine
      ? `${systemPrompt}\n\n[MACHINE À ÉTATS DU TUNNEL — CONTRÔLE IMPÉRATIF]\n${STEP_INSTRUCTIONS[currentStep]}\n\nRègle absolue, au-dessus de toute autre instruction ci-dessus : ne pose JAMAIS plus d'une question par message.`
      : systemPrompt;

    // Outils (registre src/lib/aiTools/) : jamais en mode machine à états —
    // l'API Gemini n'accepte pas simultanément responseSchema (imposé par
    // le tunnel) et des déclarations de function calling dans le même
    // appel. Disponibles uniquement hors tunnel (aujourd'hui : le
    // Playground admin, customSystemPrompt fourni).
    const toolsActifs = !useTunnelStateMachine;
    const geminiTools = toolsActifs ? [{ functionDeclarations: getGeminiFunctionDeclarations() }] : undefined;
    const tempEffectif = typeof temperature === "number" ? temperature : 0.7;
    const geminiKeyPourOutils = process.env.GEMINI_API_KEY;

    // 2bis. Confirmation explicite d'un outil proposé au tour précédent
    // (registre src/lib/aiTools/, tools requiresConfirmation). Court-
    // circuite le reste du traitement : exécute l'outil sous la RLS de
    // l'utilisateur, puis un second appel Gemini synthétise la réponse
    // finale à partir du résultat réel.
    // 2ter. ROUTAGE VERS UN OUTIL, MÊME PENDANT LE TUNNEL.
    //
    // Le fil candidat active toujours la machine à états, laquelle impose un
    // responseSchema à Gemini. Or l'API refuse responseSchema et function
    // calling dans le même appel : les outils étaient donc désactivés dans la
    // vraie messagerie. Conséquence constatée en production le 2026-08-30,
    // « Je veux aller à Pikine » ne déclenchait jamais chercher_itineraire et
    // recevait l'argumentaire CV du tunnel.
    //
    // On fait donc un appel SÉPARÉ, sans responseSchema, dont le seul rôle
    // est de décider si un outil s'applique. S'il n'en propose aucun — le cas
    // de très loin le plus fréquent — le tunnel reprend la main exactement
    // comme avant, à la même étape. Le parcours CV n'est jamais altéré :
    // répondre à une question de transport ne fait pas avancer d'une étape.
    //
    // Coût : un appel de plus par message. Assumé — la seule alternative
    // était un aiguillage par mots-clés, qui aurait raté « comment rejoindre
    // Pikine » aussi sûrement que le tunnel ratait la question d'origine.
    if (useTunnelStateMachine && geminiKeyPourOutils && !confirmToolCall?.toolName) {
      const declarationsRoutage = getDeclarationsHorsTunnel();
      try {
        const routageRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKeyPourOutils },
            body: JSON.stringify({
              // Instruction dédiée, volontairement séparée du prompt CV
              // enregistré en base : celui-ci appartient à l'équipe produit et
              // n'a pas à être réécrit ici pour faire fonctionner un outil.
              systemInstruction: {
                parts: [
                  {
                    text:
                      "Tu es un aiguilleur. Ton unique tâche est de décider si le dernier message de l'utilisateur " +
                      "appelle l'un des outils disponibles — par exemple une question de déplacement, de trajet ou " +
                      "de transport à Dakar, ou une recherche d'offres d'emploi.\n\n" +
                      "Si c'est le cas, appelle l'outil approprié. Sinon, réponds exactement le mot RIEN et rien " +
                      "d'autre. N'engage jamais la conversation, ne salue pas, ne propose aucun service : un autre " +
                      "assistant s'en charge.",
                  },
                ],
              },
              contents: historique.slice(-4).map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              tools: [{ functionDeclarations: declarationsRoutage }],
              generationConfig: { temperature: 0 },
            }),
          }
        );

        if (routageRes.ok) {
          const routageData = await routageRes.json();
          const partie = routageData.candidates?.[0]?.content?.parts?.find((p) => p.functionCall);

          if (partie?.functionCall) {
            const { name: nomOutil, args: argsOutil } = partie.functionCall;
            const outil = getTool(nomOutil);

            if (outil && outil.requiresConfirmation !== true) {
              // Le modèle INVENTE des coordonnées quand on ne lui en donne
              // pas : interrogé sur « Je veux aller à Pikine », il a proposé
              // 14.6937 / -17.4441, le centre de Dakar, sans rien en savoir.
              // Un itinéraire calculé depuis un point faux est pire que pas
              // d'itinéraire. On impose donc la position réelle transmise par
              // le navigateur, et à défaut on efface la sienne : l'outil
              // demande alors son quartier de départ à la personne.
              const argsSurs = { ...(argsOutil || {}) };
              if (nomOutil === "chercher_itineraire") {
                if (Number.isFinite(position?.latitude) && Number.isFinite(position?.longitude)) {
                  argsSurs.latitude = position.latitude;
                  argsSurs.longitude = position.longitude;
                } else {
                  delete argsSurs.latitude;
                  delete argsSurs.longitude;
                }
              }

              const resultat = await runToolCall(nomOutil, argsSurs, {
                user,
                supabase: userScopedSupabase,
              });

              // Synthèse à partir du résultat RÉEL de l'outil. La consigne
              // d'interdiction d'invention voyage dans la charge utile de
              // l'outil lui-même (voir findTransportRoute) : elle arrive donc
              // au modèle avec les données, pas seulement dans un prompt
              // qu'il pourrait perdre de vue.
              const synthese = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKeyPourOutils },
                  body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [
                      ...historique.slice(-4).map((m) => ({
                        role: m.role === "assistant" ? "model" : "user",
                        parts: [{ text: m.content }],
                      })),
                      { role: "model", parts: [{ functionCall: partie.functionCall }] },
                      { role: "user", parts: [{ functionResponse: { name: nomOutil, response: resultat } }] },
                    ],
                    generationConfig: { temperature: tempEffectif },
                  }),
                }
              );

              if (synthese.ok) {
                const donnees = await synthese.json();
                const reply = donnees.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
                if (reply) {
                  // L'étape du tunnel n'est délibérément PAS avancée : la
                  // personne a posé une question de côté, elle reprendra son
                  // parcours CV là où elle l'avait laissé.
                  return NextResponse.json({ reply, toolResult: resultat, toolName: nomOutil });
                }
              }
            }
          }
        }
      } catch (err) {
        // Un aiguillage en panne ne doit jamais empêcher de répondre : on
        // retombe silencieusement sur le tunnel, comportement d'avant.
        console.error("ai-chat: routage outil indisponible:", err.message);
      }
    }

    if (confirmToolCall?.toolName && toolsActifs) {
      const toolResult = await runToolCall(confirmToolCall.toolName, confirmToolCall.args || {}, {
        user,
        supabase: userScopedSupabase,
      });

      if (!geminiKeyPourOutils) {
        return NextResponse.json(
          { error: "L'assistant IA est temporairement indisponible." },
          { status: 503 }
        );
      }

      const contentsConfirmation = historique.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      contentsConfirmation.push({
        role: "model",
        parts: [{ functionCall: { name: confirmToolCall.toolName, args: confirmToolCall.args || {} } }],
      });
      contentsConfirmation.push({
        role: "user",
        parts: [{ functionResponse: { name: confirmToolCall.toolName, response: toolResult } }],
      });

      try {
        const synthRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKeyPourOutils },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contentsConfirmation,
              tools: geminiTools,
              generationConfig: { temperature: tempEffectif },
            }),
          }
        );
        if (synthRes.ok) {
          const synthData = await synthRes.json();
          const reply = synthData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
          if (reply) return NextResponse.json({ reply, toolResult });
        }
      } catch (err) {
        console.error("ai-chat: échec synthèse post-confirmation outil:", err.message);
      }

      // La synthèse a échoué mais l'action a bien été tentée : message
      // honnête reflétant toolResult, jamais un faux succès générique.
      return NextResponse.json({
        reply: toolResult.success
          ? "C'est fait."
          : `Je n'ai pas pu terminer cette action : ${toolResult.error || "erreur inconnue"}.`,
        toolResult,
      });
    }

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

    // Les images ont besoin du chemin inlineData dédié (voir appelerGeminiVision).
    // Reçoit la consigne d'étape (systemPromptAvecEtape) mais PAS le format
    // JSON — ce chemin ne demande jamais de nouvelle question, seulement un
    // message de transition en texte libre après réception d'un fichier.
    if (images.length > 0) {
      const reponseVision = await appelerGeminiVision(systemPromptAvecEtape, historique, images);
      if (reponseVision) {
        // Recevoir le fichier attendu satisfait l'étape upload en cours —
        // avance directement vers le résumé, sans repasser par le modèle
        // pour le choix de nextStep (ce chemin n'est pas au format JSON).
        if (useTunnelStateMachine && (currentStep === "cv_ancien_upload" || currentStep === "lettre_cv_upload")) {
          await saveConversationStep(user.id, "resume_cloture");
        }
        return NextResponse.json({ reply: reponseVision });
      }
      console.warn("ai-chat: vision indisponible, repli sur le chemin texte seul.");
      historique.push({
        role: "user",
        content:
          "[Note système : des images ont été jointes mais n'ont pas pu être analysées. " +
          "Indique-le à l'utilisateur et propose de coller le texte du document.]",
      });
    }

    // Gemini seul (point 1, 2026-08-22) : DeepSeek et Groq retirés de cette
    // route. Seuls appelants de /api/ai-chat dans le dépôt : le Playground
    // admin (AdminAIStudio.jsx) et le fil "Support RH Facilité" réel
    // (MessagerieClient.js) — aucun autre consommateur n'est cassé par ce
    // retrait. requestedModel n'est plus lu : le modèle n'est plus un choix
    // exposé à l'appelant, Gemini est la seule option (verrouillée aussi
    // côté panneau admin, voir AdminAIStudio.jsx AI_MODELS).
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !geminiKey.includes("[") && geminiKey.trim() !== "") {
      try {
        const contents = historique.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        // En mode machine à états, le modèle doit renvoyer {reply, nextStep}
        // (responseSchema) plutôt qu'un texte libre — c'est ce format
        // structuré qui permet au code de valider (ou de rejeter) la
        // transition proposée avant de l'écrire dans
        // assistant_conversation_state. Hors tunnel, les outils (registre
        // aiTools) sont proposés à la place.
        const generationConfig = useTunnelStateMachine
          ? { temperature: tempEffectif, responseMimeType: "application/json", responseSchema: TUNNEL_RESPONSE_SCHEMA }
          : { temperature: tempEffectif };

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPromptAvecEtape }] },
              contents,
              tools: geminiTools,
              generationConfig,
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const responsePart = geminiData.candidates?.[0]?.content?.parts?.[0];
          const rawText = responsePart?.text;

          // Le modèle propose un appel d'outil plutôt qu'une réponse texte
          // (jamais en mode tunnel, cf. generationConfig ci-dessus).
          if (responsePart?.functionCall && toolsActifs) {
            const { name: toolName, args: toolArgs } = responsePart.functionCall;
            const tool = getTool(toolName);

            if (!tool) {
              return NextResponse.json({ reply: "Une action a été proposée mais n'a pas pu être reconnue." });
            }

            if (tool.requiresConfirmation) {
              // N'exécute rien : le guard est quand même vérifié pour ne
              // jamais proposer une action que le candidat ne pourrait de
              // toute façon pas effectuer (CV d'un autre utilisateur, etc.).
              try {
                await tool.guard({ user, supabase: userScopedSupabase, args: toolArgs });
              } catch (err) {
                return NextResponse.json({ reply: `Je ne peux pas proposer cette action : ${err.message}` });
              }
              return NextResponse.json({
                reply: toolArgs?.resume || "Confirmez-vous cette action ?",
                pendingConfirmation: { toolName, args: toolArgs },
              });
            }

            // Pas de confirmation requise (outil a) : exécution immédiate,
            // puis un second appel synthétise la réponse finale à partir du
            // résultat réel.
            const toolResult = await runToolCall(toolName, toolArgs, { user, supabase: userScopedSupabase });
            const contentsAvecResultat = [
              ...contents,
              { role: "model", parts: [{ functionCall: responsePart.functionCall }] },
              { role: "user", parts: [{ functionResponse: { name: toolName, response: toolResult } }] },
            ];

            const synthRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemPromptAvecEtape }] },
                  contents: contentsAvecResultat,
                  tools: geminiTools,
                  generationConfig,
                }),
              }
            );
            if (synthRes.ok) {
              const synthData = await synthRes.json();
              const synthReply = synthData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
              if (synthReply) return NextResponse.json({ reply: synthReply, toolResult });
            }
            return NextResponse.json({
              reply: toolResult.success ? "C'est fait." : `Je n'ai pas pu terminer cette action : ${toolResult.error || "erreur inconnue"}.`,
              toolResult,
            });
          }

          if (!useTunnelStateMachine) {
            if (rawText) return NextResponse.json({ reply: rawText });
          } else if (rawText) {
            try {
              const { reply, nextStep: proposedNextStep } = JSON.parse(rawText);
              if (reply) {
                const resolvedNextStep = resolveNextStep(currentStep, proposedNextStep);
                await saveConversationStep(user.id, resolvedNextStep);
                return NextResponse.json({ reply });
              }
            } catch (parseErr) {
              // Le modèle n'a pas respecté le format JSON malgré
              // responseSchema : repli sur le texte brut tel quel plutôt que
              // de bloquer la conversation, sans faire avancer l'étape (on
              // reste sur currentStep, la prochaine requête re-tentera).
              console.error("ai-chat: réponse hors format JSON attendu:", parseErr.message);
              return NextResponse.json({ reply: rawText });
            }
          }
        } else {
          const err = await geminiRes.text();
          console.error("ai-chat: Gemini a répondu en erreur:", geminiRes.status, err.slice(0, 300));
        }
      } catch (geminiErr) {
        console.error("ai-chat: échec Gemini:", geminiErr.message);
      }
    }

    return NextResponse.json(
      { error: "L'assistant IA est temporairement indisponible." },
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
