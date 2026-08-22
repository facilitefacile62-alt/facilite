import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

// assistant_ai_config/assistant_ai_products n'accordent RIEN à
// authenticated (0 policy RLS, aucun GRANT — voir
// 20260821130000_assistant_ai_studio.sql) : cette route est le SEUL
// chemin, lecture ET écriture, pour l'onglet admin "Entraînement IA".
async function authorizeAdmin(req) {
  const { user, identifier, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return { error: authError };

  const { allowed, error: rateLimitError } = await checkRateLimit(identifier);
  if (!allowed) return { error: rateLimitError };

  const admin = getSupabaseAdmin();
  if (!(await isCallerAdmin(admin, user.id))) {
    return { error: NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 }) };
  }

  return { admin, user };
}

export async function GET(req) {
  const { admin, error } = await authorizeAdmin(req);
  if (error) return error;

  const [{ data: config, error: configError }, { data: products, error: productsError }] = await Promise.all([
    admin.from("assistant_ai_config").select("*").eq("id", 1).maybeSingle(),
    admin.from("assistant_ai_products").select("*").order("display_order", { ascending: true }),
  ]);

  if (configError || productsError) {
    console.error("[admin/ai-studio GET]", configError?.message, productsError?.message);
    return NextResponse.json({ error: "Impossible de charger la configuration." }, { status: 500 });
  }

  return NextResponse.json({
    config: config
      ? {
          promptText: config.prompt_text,
          knowledgeText: config.knowledge_text,
          diagnosticRulesText: config.diagnostic_rules_text,
          commStyle: config.comm_style,
          selectedModel: config.selected_model,
          currency: config.currency,
          updatedAt: config.updated_at,
        }
      : null,
    productsList: (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      priceFCFA: Number(p.price_fcfa),
      priceEUR: Number(p.price_eur),
      desc: p.description,
    })),
  });
}

// Sauvegarde intégrale (réglage + liste des produits) — miroir du
// comportement actuel de handleSaveConfig() côté client, qui enregistre
// tout l'objet en une fois. Aucune UI d'édition ligne à ligne des produits
// aujourd'hui ; remplacer la liste entière à chaque sauvegarde reste donc
// fidèle au comportement existant.
export async function PUT(req) {
  const { admin, user, error } = await authorizeAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const {
    promptText = "",
    knowledgeText = "",
    diagnosticRulesText = "",
    commStyle = "normal",
    currency = "FCFA",
    productsList = [],
  } = body;

  const { error: configError } = await admin.from("assistant_ai_config").upsert({
    id: 1,
    prompt_text: promptText,
    knowledge_text: knowledgeText,
    diagnostic_rules_text: diagnosticRulesText,
    comm_style: commStyle,
    // Verrouillé côté serveur (point 1, 2026-08-22) : Gemini est l'unique
    // modèle de l'assistant plateforme, un éventuel selectedModel envoyé
    // par le client est ignoré — le panneau admin ne propose de toute
    // façon plus qu'un seul choix, mais un appel API direct ne doit pas
    // pouvoir contourner cette décision.
    selected_model: "gemini-3.6-flash",
    currency,
    updated_by: user.id,
  });

  if (configError) {
    console.error("[admin/ai-studio PUT] config:", configError.message);
    return NextResponse.json({ error: "Impossible d'enregistrer la configuration." }, { status: 500 });
  }

  // Remplacement intégral de la liste des produits (delete + insert), pas
  // de diff ligne à ligne : voir commentaire ci-dessus, cohérent avec
  // l'absence de contrôle d'édition unitaire dans l'UI actuelle.
  const { error: deleteError } = await admin.from("assistant_ai_products").delete().gte("display_order", 0);
  if (deleteError) {
    console.error("[admin/ai-studio PUT] delete products:", deleteError.message);
    return NextResponse.json({ error: "Impossible de mettre à jour les produits." }, { status: 500 });
  }

  if (Array.isArray(productsList) && productsList.length > 0) {
    const rows = productsList.map((p, index) => ({
      name: p.name || "",
      price_fcfa: Number(p.priceFCFA) || 0,
      price_eur: Number(p.priceEUR) || 0,
      description: p.desc || "",
      display_order: index,
    }));
    const { error: insertError } = await admin.from("assistant_ai_products").insert(rows);
    if (insertError) {
      console.error("[admin/ai-studio PUT] insert products:", insertError.message);
      return NextResponse.json({ error: "Impossible d'enregistrer les produits." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

// Réinitialisation complète (miroir de handleClearAllTraining côté
// client) — vide la config serveur pour que "page blanche" reste vrai
// après un rechargement, pas seulement le temps de la session locale.
export async function DELETE(req) {
  const { admin, error } = await authorizeAdmin(req);
  if (error) return error;

  await admin.from("assistant_ai_config").delete().eq("id", 1);
  await admin.from("assistant_ai_products").delete().gte("display_order", 0);

  return NextResponse.json({ success: true });
}
