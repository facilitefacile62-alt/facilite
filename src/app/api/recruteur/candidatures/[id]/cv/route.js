import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

// Ouverture d'un CV reçu : la base vérifie que la candidature est dans la boîte de l'appelant, journalise la consultation et renvoie le
// chemin du fichier (ouvrir_cv_candidature) ; le serveur ne délivre qu'un lien signé de 60 secondes. Aucun accès direct au bucket.
const DUREE_LIEN_S = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SANS_CACHE = { "Cache-Control": "no-store" };

const repondre = (corps, status = 200) => NextResponse.json(corps, { status, headers: SANS_CACHE });

export async function POST(req, { params }) {
  try {
    const { user, error: authError } = await requireUser(req, { logDenials: true });
    if (authError) return authError;

    // Limitation de débit (Upstash) : empêche d'aspirer les CV.
    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const { id } = await params;
    if (!UUID_RE.test(String(id))) return repondre({ error: "Candidature introuvable." }, 404);

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const commeAppelant = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const { data, error } = await commeAppelant.rpc("ouvrir_cv_candidature", { p_candidature: id });
    if (error) {
      if (error.code === "54000") return repondre({ error: "Limite quotidienne d'ouverture de CV atteinte. Réessayez demain." }, 429);
      if (error.code === "P0002") return repondre({ error: "Ce CV n'est pas disponible." }, 404);
      console.error("[CV recruteur] ouvrir_cv_candidature :", error.message);
      return repondre({ error: "Impossible d'ouvrir le CV." }, 500);
    }
    const ligne = Array.isArray(data) ? data[0] : data;
    if (!ligne?.chemin) return repondre({ error: "Ce CV n'est pas disponible." }, 404);

    const stockage = getSupabaseAdmin().storage.from("resumes");
    const extension = ligne.chemin.split(".").pop().toLowerCase();

    if (["pdf", "jpg", "jpeg", "png", "webp"].includes(extension)) {
      const { data: signe, error: erreurLien } = await stockage.createSignedUrl(ligne.chemin, DUREE_LIEN_S);
      if (erreurLien || !signe?.signedUrl) return repondre({ error: "Ce CV n'est pas disponible." }, 404);
      return repondre({ type: extension === "pdf" ? "pdf" : "image", url: signe.signedUrl, expireDans: DUREE_LIEN_S });
    }

    if (extension === "docx") {
      const { data: fichier, error: erreurFichier } = await stockage.download(ligne.chemin);
      if (erreurFichier || !fichier) return repondre({ error: "Ce CV n'est pas disponible." }, 404);
      const mammoth = await import("mammoth");
      const { value } = await (mammoth.default || mammoth).extractRawText({ buffer: Buffer.from(await fichier.arrayBuffer()) });
      return repondre({ type: "texte", texte: value.slice(0, 60000) });
    }

    return repondre({ type: "indisponible" });
  } catch (err) {
    console.error("[CV recruteur] Erreur :", err);
    return repondre({ error: "Impossible d'ouvrir le CV." }, 500);
  }
}
