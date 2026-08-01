import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { z } from "zod";

export const runtime = "nodejs";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

const improveSchema = z.object({
  text: z.string().trim().min(1, "Le texte à améliorer est requis.").max(2000),
});

const SYSTEM_PROMPT = `Tu es un rédacteur professionnel spécialisé en CV pour le marché de l'emploi sénégalais/ouest-africain.
On te fournit la description d'une expérience professionnelle rédigée par un candidat. Réécris-la pour la rendre plus percutante :
verbes d'action, résultats concrets/chiffrés si plausibles, phrases courtes, sans emojis ni markdown.
Réponds UNIQUEMENT avec le texte réécrit, sans préambule ni guillemets, dans la même langue que le texte fourni.`;

async function improveWithGroq(text) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey.includes("[") || groqKey.trim() === "") return null;
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("[CV improve-text] Échec Groq, essai avec DeepSeek...", err.message);
    return null;
  }
}

async function improveWithDeepSeek(text) {
  const dsKey = process.env.DEEPSEEK_API_KEY;
  if (!dsKey || dsKey.includes("[") || dsKey.trim() === "") return null;
  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.4,
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("[CV improve-text] Échec DeepSeek:", err.message);
    return null;
  }
}

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const parsed = improveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Texte invalide." }, { status: 400 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (configError) {
      console.error("[CV improve-text] Configuration manquante :", configError.message);
      return NextResponse.json({ error: configError.message }, { status: 502 });
    }

    // Déduction AVANT l'appel IA (pas après) : évite qu'un utilisateur sans
    // crédit déclenche quand même un appel IA payant côté fournisseur alors
    // que la requête sera de toute façon rejetée.
    const { data: hadCredit, error: deductError } = await admin.rpc("deduct_credit", {
      p_user_id: user.id,
    });

    if (deductError) {
      console.error("[CV improve-text] Échec déduction crédit :", deductError.message);
      return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
    }

    if (!hadCredit) {
      return NextResponse.json(
        { error: "Crédits insuffisants. Rechargez votre compte pour utiliser l'IA." },
        { status: 402 }
      );
    }

    const improved = (await improveWithGroq(parsed.data.text)) || (await improveWithDeepSeek(parsed.data.text));

    if (!improved) {
      // Rembourse le crédit consommé : l'utilisateur ne doit pas payer un
      // appel IA qui a échoué côté fournisseur (clés manquantes, panne...).
      await admin.rpc("refund_credit", { p_user_id: user.id }).catch(() => {});
      return NextResponse.json(
        { error: "Le service de reformulation IA est momentanément indisponible." },
        { status: 502 }
      );
    }

    return NextResponse.json({ improvedText: improved });
  } catch (err) {
    console.error("[CV improve-text] Erreur interne :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
