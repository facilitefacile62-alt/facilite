import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { lireReglages, BUCKET_VOCAUX } from "@/lib/aide/serveur";

export const runtime = "nodejs";

/**
 * Purge quotidienne (Vercel Cron, voir vercel.json) des messages vocaux de l'aide dont le fil de support est
 * résolu depuis plus de `conservation_vocaux_jours` jours (30 par défaut). Les fichiers sont retirés par
 * l'API Storage (jamais par SQL), puis les lignes. Mémoire des réponses expirée nettoyée au passage.
 */
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const reglages = await lireReglages(admin);
  const { data: lignes, error } = await admin.rpc("aide_vocaux_a_purger", { p_jours: reglages.conservation_vocaux_jours });
  if (error) {
    console.error("[Cron aide-purge-vocaux]", error.message);
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }

  let supprimes = 0;
  for (let i = 0; i < (lignes || []).length; i += 100) {
    const lot = lignes.slice(i, i + 100);
    const { error: errFichiers } = await admin.storage.from(BUCKET_VOCAUX).remove(lot.map((l) => l.chemin));
    if (errFichiers) continue; // on ne supprime pas la ligne si le fichier est resté : nouvel essai demain
    const { error: errLignes } = await admin.from("aide_messages_vocaux").delete().in("id", lot.map((l) => l.id));
    if (!errLignes) supprimes += lot.length;
  }

  await admin.from("aide_reponses_cache").delete().lt("expire_le", new Date().toISOString());
  return NextResponse.json({ vocauxSupprimes: supprimes });
}
