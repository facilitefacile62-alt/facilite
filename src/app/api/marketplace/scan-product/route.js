import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 45;

const CATEGORIES_VALIDEES = [
  { id: "telephones", label: "Téléphones & Tech" },
  { id: "vehicules", label: "Véhicules & Motos" },
  { id: "immobilier", label: "Immobilier" },
  { id: "mode", label: "Mode & Vêtements" },
  { id: "maison", label: "Maison & Électro" },
  { id: "electronique", label: "Électronique & Son" },
  { id: "informatique", label: "Informatique & PC" },
  { id: "services", label: "Services" },
  { id: "alimentation", label: "Alimentation" },
  { id: "autre", label: "Autre" },
];

const VALID_CAT_IDS = CATEGORIES_VALIDEES.map((c) => c.id);

function cleanAndParseJSON(text) {
  if (!text) return null;
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Essayer d'extraire la première section {...}
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const SYSTEM_PROMPT = `Tu es un Expert Vision E-Commerce Multimodal et Spécialiste Marketplace sénégalaise et africaine (Dakar, Thiès, etc.).
Ton rôle : À partir de la photo d'un article téléversée par un commerçant, tu dois identifier avec une précision absolue le produit exact et générer une fiche commerciale prête pour une publication "Zéro Saisie" 100% automatisée.

Tu dois impérativement retourner un objet JSON avec les propriétés suivantes :
1. "titre" : Le nom exact, commercial et valorisant du produit (ex: "Crème Hydratante Visage Bio 200ml", "Sneakers Nike Air Max 90 Blanc", "iPhone 13 128 Go", "Blender Multifonction 1.5L", "Robe de Soirée Satinée"). Mentionne marque, modèle, volume ou caractéristique clé visible.
2. "categorie" : L'identifiant STRICT parmi cette liste de 10 catégories :
   - "telephones" : Smartphones, chargeurs, écouteurs, airpods, smartwatches, tablettes, coques et accessoires mobiles.
   - "mode" : Vêtements, chaussures, sacs, bijoux, montres, produits de beauté, cosmétiques, soins visage, crèmes, maquillage, parfums.
   - "maison" : Meubles, décoration, literie, ustensiles de cuisine, électroménager maison.
   - "electronique" : Téléviseurs, baffles Bluetooth, enceintes, casques audio, sono, caméras.
   - "informatique" : Ordinateurs portables, PC de bureau, écrans, imprimantes, claviers, périphériques.
   - "vehicules" : Voitures, motos, scooters, casques moto, pièces détachées, accessoires auto.
   - "immobilier" : Logements, studios, appartements, terrains.
   - "services" : Prestations de service, maintenance, réparations.
   - "alimentation" : Produits alimentaires, épicerie, boissons, jus locaux, paniers bio, confiserie.
   - "autre" : Tout autre article ne rentrant pas ci-dessus.
3. "categorie_label" : Le libellé lisible en français de la catégorie choisie.
4. "description" : Une description commerciale vendeuse, claire et bien structurée avec des puces pour les caractéristiques clés visibles, les bienfaits/usages, l'état du produit, et un appel à l'action courtois invitant à commander par message ou WhatsApp avec livraison rapide.
5. "prix_suggere" : Une estimation réaliste et indicative du prix moyen du marché sénégalais en FCFA (XOF). Nombre entier (ex: 12000, 25000, 180000...).
6. "mots_cles" : Un tableau de 5 à 8 mots-clés SEO populaires en minuscules pour la recherche sur la marketplace.

Format JSON strict attendu :
{
  "titre": "Nom exact et commercial du produit",
  "categorie": "mode",
  "categorie_label": "Mode & Vêtements",
  "description": "Description commerciale complète avec puces et incitation WhatsApp",
  "prix_suggere": 15000,
  "mots_cles": ["creme", "visage", "hydratation", "bio", "soin", "dakar"]
}`;

const GEMINI_VISION_MODELS = [
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
];

async function analyserAvecGeminiVision(base64Data, mimeType, indiceTexte = "") {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") {
    return null;
  }

  const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
  const promptFinal = indiceTexte
    ? `${SYSTEM_PROMPT}\n\nIndice complémentaire fourni par le commerçant : "${indiceTexte}"`
    : `${SYSTEM_PROMPT}\n\nAnalyse cette image de produit et renvoie la fiche JSON structurée.`;

  // 1. Appel direct REST API pour compatibilité maximale
  for (const model of GEMINI_VISION_MODELS) {
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
                parts: [
                  { text: promptFinal },
                  {
                    inlineData: {
                      mimeType: mimeType || "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.warn(`[Scan-Product] Rejet Gemini (${model}):`, response.status, errText.slice(0, 200));
        continue;
      }

      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = cleanAndParseJSON(rawText);
      if (parsed?.titre) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[Scan-Product] Échec Gemini ${model}:`, err.message);
    }
  }

  // 2. SDK @google/generative-ai
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const result = await model.generateContent([
      promptFinal,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ]);
    const parsed = cleanAndParseJSON(result.response.text());
    if (parsed?.titre) {
      return parsed;
    }
  } catch (sdkErr) {
    console.warn("[Scan-Product] Échec SDK GoogleGenerativeAI:", sdkErr?.message);
  }

  return null;
}

async function analyserAvecOpenAIVision(base64Data, mimeType, indiceTexte = "") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("[") || apiKey.trim() === "") return null;

  try {
    const openai = new OpenAI({ apiKey });
    const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/\-+.]+;base64,/, "");
    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${cleanBase64}`;

    const promptFinal = indiceTexte
      ? `${SYSTEM_PROMPT}\n\nIndice complémentaire : "${indiceTexte}"`
      : `${SYSTEM_PROMPT}\n\nAnalyse cette photo de produit et renvoie la fiche JSON structurée.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Tu réponds uniquement en JSON valide." },
        {
          role: "user",
          content: [
            { type: "text", text: promptFinal },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = cleanAndParseJSON(raw);
    if (parsed?.titre) return parsed;
  } catch (err) {
    console.warn("[Scan-Product] Échec OpenAI Vision:", err?.message);
  }

  return null;
}

export async function POST(req) {
  try {
    // Vérification d'authentification facultative ou souple
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const { user, error: authError } = await requireUser(req);
      if (!authError && user?.id) {
        const { allowed, error: rateError } = await checkRateLimit(user.id);
        if (!allowed && rateError) return rateError;
      }
    }

    let base64Image = null;
    let mimeType = "image/jpeg";
    let indiceTexte = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") || formData.get("image");
      indiceTexte = formData.get("hint") || formData.get("titre") || "";

      if (file && typeof file !== "string") {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        mimeType = file.type || "image/jpeg";
        base64Image = buffer.toString("base64");
      } else {
        const imageUrl = formData.get("imageUrl");
        if (imageUrl && typeof imageUrl === "string") {
          try {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              mimeType = imgRes.headers.get("content-type") || "image/jpeg";
              base64Image = buf.toString("base64");
            }
          } catch (fetchErr) {
            console.warn("[Scan-Product] Impossible de télécharger imageUrl depuis formData:", fetchErr?.message);
          }
        }
      }
    } else {
      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ success: false, error: "Format de requête invalide (JSON ou multipart attendu)." }, { status: 400 });
      }

      base64Image = body.image || body.imageBase64;
      mimeType = body.mimeType || "image/jpeg";
      indiceTexte = body.hint || body.titre || "";

      // Si c'est une URL publique d'image
      if (!base64Image && body.imageUrl) {
        try {
          const imgRes = await fetch(body.imageUrl);
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            mimeType = imgRes.headers.get("content-type") || "image/jpeg";
            base64Image = buf.toString("base64");
          }
        } catch (fetchErr) {
          console.warn("[Scan-Product] Impossible de télécharger imageUrl:", fetchErr?.message);
        }
      }
    }

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: "Veuillez fournir une image de produit à analyser." },
        { status: 400 }
      );
    }

    // 1. Essai avec Gemini Vision
    let analyse = await analyserAvecGeminiVision(base64Image, mimeType, indiceTexte);

    // 2. Repli OpenAI Vision
    if (!analyse?.titre) {
      analyse = await analyserAvecOpenAIVision(base64Image, mimeType, indiceTexte);
    }

    // 3. Repli intelligent sans crash si les APIs externes sont saturées
    if (!analyse?.titre) {
      const nomGen = indiceTexte?.trim() ? indiceTexte.trim() : "Article Boutique";
      analyse = {
        titre: nomGen.charAt(0).toUpperCase() + nomGen.slice(1),
        categorie: "autre",
        categorie_label: "Autre",
        description: `Superbe article disponible immédiatement en stock. Produit de très bonne qualité, vérifié et garanti. Contactez notre boutique directement via WhatsApp ou messagerie pour valider votre commande et profiter d'une livraison rapide à Dakar et partout au Sénégal.`,
        prix_suggere: 15000,
        mots_cles: ["boutique", "senegal", "dakar", "qualite", "disponible"],
      };
    }

    // Normalisation de la catégorie
    const catId = VALID_CAT_IDS.includes(analyse.categorie) ? analyse.categorie : "autre";
    const catObj = CATEGORIES_VALIDEES.find((c) => c.id === catId);

    const dataFinal = {
      titre: String(analyse.titre || "").trim(),
      categorie: catId,
      categorie_label: catObj ? catObj.label : "Autre",
      description: String(analyse.description || "").trim(),
      prix_suggere: Number(analyse.prix_suggere) || 10000,
      mots_cles: Array.isArray(analyse.mots_cles)
        ? analyse.mots_cles.map((m) => String(m).replace(/^#/, "").trim().toLowerCase())
        : ["article", "marketplace", "senegal"],
    };

    return NextResponse.json({
      success: true,
      data: dataFinal,
    });
  } catch (err) {
    console.error("[Scan-Product Fatal Catch]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erreur lors de l'analyse visuelle du produit." },
      { status: 500 }
    );
  }
}
