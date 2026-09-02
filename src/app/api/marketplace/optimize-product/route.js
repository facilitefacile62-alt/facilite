import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";

export const runtime = "nodejs";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

const CATEGORIES_VALIDEES = [
  "telephones",
  "electronique",
  "vehicules",
  "mode",
  "maison",
  "immobilier",
  "alimentation",
  "autre",
];

function cleanAndParseJSON(text) {
  if (!text) return null;
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
    }

    const { titre = "", description = "", categorie = "", ville = "Dakar", quartier = "" } = body;
    const saisie = `${titre} ${description}`.trim();

    if (!saisie) {
      return NextResponse.json(
        { success: false, error: "Veuillez renseigner au moins un mot-clé ou titre d'article." },
        { status: 400 }
      );
    }

    const systemPrompt = `Tu es un Expert E-Commerce & SEO Marketplace Senior spécialisé dans le marché sénégalais (Dakar, Thiès, Touba...).
Ton rôle : À partir d'un nom de produit brut ou approximatif saisi par un vendeur, tu dois :
1. Identifier le nom exact commercial officiel (marque, modèle, version standard).
2. Créer un Titre de Vente percutant et ultra-optimisé pour le référencement (SEO) et la recherche sur la marketplace.
3. Attribuer la catégorie exacte parmi : ["telephones", "electronique", "vehicules", "mode", "maison", "immobilier", "alimentation", "autre"].
4. Rédiger une description commerciale professionnelle, claire et engageante (caractéristiques clés, état, disponibilité, appel à l'action WhatsApp poli).
5. Fournir 4 à 6 mots-clés de recherche populaire au Sénégal.

Format JSON strict :
{
  "titreOptimise": "Nom commercial complet avec marque/modèle et spécification",
  "descriptionOptimisee": "Description commerciale structurée avec puces, caractéristiques et incitation WhatsApp",
  "categorieSuggeree": "une_valeur_de_la_liste",
  "motsCles": ["mot1", "mot2", "mot3"]
}`;

    const userPrompt = `Produit saisi par le vendeur : "${titre}"
Détails actuels : "${description}"
Catégorie actuelle : "${categorie || "non définie"}"
Localisation boutique : ${quartier ? `${quartier}, ` : ""}${ville || "Sénégal"}

Génère la fiche produit optimisée en JSON.`;

    // 1. Essai DeepSeek
    if (process.env.DEEPSEEK_API_KEY && !process.env.DEEPSEEK_API_KEY.includes("dummy")) {
      try {
        const dsResponse = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const parsed = cleanAndParseJSON(dsResponse.choices[0]?.message?.content);
        if (parsed?.titreOptimise) {
          const cat = CATEGORIES_VALIDEES.includes(parsed.categorieSuggeree) ? parsed.categorieSuggeree : "autre";
          return NextResponse.json({ success: true, data: { ...parsed, categorieSuggeree: cat } });
        }
      } catch (dsErr) {
        console.warn("[Optimize-Product] Repli DeepSeek -> Gemini:", dsErr?.message);
      }
    }

    // 2. Repli Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey && apiKey.trim() !== "" && !apiKey.includes("[")) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-3.6-flash",
          generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
        });
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const text = result.response.text();
        const parsed = cleanAndParseJSON(text);
        if (parsed?.titreOptimise) {
          const cat = CATEGORIES_VALIDEES.includes(parsed.categorieSuggeree) ? parsed.categorieSuggeree : "autre";
          return NextResponse.json({ success: true, data: { ...parsed, categorieSuggeree: cat } });
        }
      } catch (geminiErr) {
        console.warn("[Optimize-Product] Échec Gemini:", geminiErr?.message);
      }
    }

    // 3. Repli local sans crash
    const titreNettoye = titre.charAt(0).toUpperCase() + titre.slice(1);
    return NextResponse.json({
      success: true,
      data: {
        titreOptimise: titreNettoye,
        descriptionOptimisee: `${titreNettoye} disponible en stock à ${ville}. Produit de qualité, contactez-nous directement via WhatsApp pour commander et convenir de la livraison rapide.`,
        categorieSuggeree: CATEGORIES_VALIDEES.includes(categorie) ? categorie : "autre",
        motsCles: [titreNettoye, ville, "vente", "disponible"],
      },
    });
  } catch (err) {
    console.error("[Optimize-Product Fatal Catch]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erreur lors de l'optimisation." },
      { status: 500 }
    );
  }
}
