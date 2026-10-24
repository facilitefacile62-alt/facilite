import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cheminApercuCv, typeImageApercu } from "@/lib/cvAchatPaiement";

export const runtime = "nodejs";

/**
 * Image d'APERÇU d'une page d'un modèle de CV : image filigranée, en basse définition et sans texte lisible, préparée par l'administrateur.
 * Le PDF d'origine n'est jamais lu ici et n'existe pas dans cet espace. Réservé aux comptes connectés, modèle actif seulement ; la réponse
 * n'est mise en cache nulle part (ni navigateur, ni relais) et n'est pas faite pour être enregistrée.
 */
export async function GET(req, { params }) {
  try {
    const { id, page } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();
    const { data: modele, error } = await admin.from("cv_modeles").select("apercus").eq("id", id).eq("actif", true).maybeSingle();
    if (error) return NextResponse.json({ error: "Indisponible, réessayez." }, { status: 503 });
    const chemin = modele ? cheminApercuCv(modele.apercus, page) : null;
    const typeImage = chemin ? typeImageApercu(chemin) : null;
    if (!chemin || !typeImage) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

    const { data: fichier, error: erreurFichier } = await admin.storage.from("cv-modeles-apercus").download(chemin);
    if (erreurFichier || !fichier) return NextResponse.json({ error: "Indisponible, réessayez." }, { status: 503 });

    return new Response(await fichier.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": typeImage,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    });
  } catch (error) {
    console.error("[CV Aperçu API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
