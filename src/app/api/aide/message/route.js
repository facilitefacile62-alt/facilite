import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { traiterMessage } from "@/lib/aide/orchestrateur";
import { aideOuverte, construireDeps, enregistrerUsage, lireReglages } from "@/lib/aide/serveur";

export const runtime = "nodejs";

/**
 * Un message du panneau « Aide » (réponse préparée -> mémoire -> IA -> équipe).
 * Réservé aux personnes connectées. Tant que l'interrupteur feat_aide_unifiee est coupé : 404.
 * Par défaut le fournisseur est « faux » : aucun appel réel à une IA (voir src/lib/aide/fournisseurs).
 */
export async function POST(req) {
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;

  const { allowed, error: rateError } = await checkRateLimit(user.id);
  if (!allowed) return rateError;

  const admin = getSupabaseAdmin();
  if (!(await aideOuverte(admin, user.id))) {
    return NextResponse.json({ error: "Aide indisponible." }, { status: 404 });
  }

  let corps;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const texte = typeof corps?.message === "string" ? corps.message : "";

  // Déjà avec l'équipe : l'assistant se tait, le message part au fil humain (côté panneau).
  const { data: fil } = await admin.from("support_threads").select("mode").eq("user_id", user.id).maybeSingle();
  if (fil?.mode === "attente_humain" || fil?.mode === "humain") {
    return NextResponse.json({ mode: fil.mode, source: "equipe", reponse: null });
  }

  const reglages = await lireReglages(admin);
  const { data: derniers } = await admin
    .from("assistant_messages")
    .select("role, content, conversation_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(2);
  // conversation_id est NOT NULL (défaut : un UUID aléatoire par ligne) : sans le fixer, chaque message
  // deviendrait une « conversation » à part dans la messagerie. On reprend celle de la dernière ligne.
  const conversationId = derniers?.[0]?.conversation_id || crypto.randomUUID();
  const dernierEchange = (derniers || []).reverse();

  const deps = await construireDeps(admin);
  const resultat = await traiterMessage({ userId: user.id, texte, dernierEchange, reglages, deps });

  // Les refus de forme (message vide ou trop long) ne sont ni enregistrés ni comptés.
  if (resultat.source !== "refus" || resultat.proposerEquipe) {
    await admin.from("assistant_messages").insert([
      { user_id: user.id, conversation_id: conversationId, role: "user", content: texte.trim().slice(0, 2000) },
      { user_id: user.id, conversation_id: conversationId, role: "assistant", content: resultat.reponse },
    ]);
    await enregistrerUsage(admin, resultat);
  }

  let mode = "ia";
  if (resultat.passerEquipe) {
    // SECURITY DEFINER, agit sur auth.uid() uniquement : on l'appelle avec le jeton de la personne.
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
    const { data, error } = await client.rpc("demander_un_humain", { p_motif: texte.trim().slice(0, 200) || null });
    if (!error && data?.mode) mode = data.mode;
  }

  return NextResponse.json({
    mode,
    source: resultat.source,
    reponse: resultat.reponse,
    lien: resultat.lien || null,
    proposerEquipe: resultat.proposerEquipe === true,
    passerEquipe: resultat.passerEquipe === true,
  });
}
