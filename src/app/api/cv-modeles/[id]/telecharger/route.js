import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { autoriserTelechargementCv, DUREE_LIEN_TELECHARGEMENT_SECONDES, nomFichierLivre } from "@/lib/cvAchatPaiement";

export const runtime = "nodejs";

/**
 * Lien de téléchargement du fichier LIVRÉ d'un modèle de CV. Seul l'acheteur d'un achat confirmé par le serveur (status = success) l'obtient ;
 * le fichier vit dans un espace privé (aucune lecture publique) et le lien signé ne dure que quelques secondes. L'adresse du lien n'est
 * jamais écrite dans les journaux. Les PDF d'aperçu, eux, n'existent pas côté application : voir ../apercu/[page].
 */
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();
    const autorisation = await autoriserTelechargementCv(admin, user.id, id);
    if (autorisation.erreur) return NextResponse.json({ error: autorisation.erreur }, { status: autorisation.statut });

    const { data, error } = await admin.storage
      .from("cv-modeles-livres")
      .createSignedUrl(autorisation.chemin, DUREE_LIEN_TELECHARGEMENT_SECONDES, { download: nomFichierLivre(autorisation.nom, autorisation.chemin) });
    if (error || !data?.signedUrl) {
      console.error("[CV Téléchargement] Lien signé impossible :", error?.message);
      return NextResponse.json({ error: "Téléchargement indisponible pour le moment." }, { status: 503 });
    }
    return NextResponse.json({ url: data.signedUrl, expireDansSecondes: DUREE_LIEN_TELECHARGEMENT_SECONDES }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[CV Téléchargement API Error]", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
