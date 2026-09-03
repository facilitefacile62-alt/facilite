// Détail complet d'un CV, avec accès au fichier d'origine.
//
// Le bucket banque-cv est privé, sans policy pour authenticated/anon (voir
// 20260903120000_banque_cv.sql) : createSignedUrl() depuis le navigateur
// échouerait, contrairement au patron déjà utilisé pour "resumes"
// (getSignedCvUrl, src/lib/supabase.js). Ici, l'URL signée est générée
// côté serveur avec le client service_role, après vérification du rôle
// admin — même contrôle que les trois autres routes de cette fonctionnalité.
import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

// Une heure, comme les autres URLs signées du projet (resumes, invoices) :
// assez pour consulter un CV pendant l'évaluation d'une candidature, sans
// laisser un lien valable indéfiniment si jamais il fuitait.
const DUREE_URL_SIGNEE = 3600;

export async function GET(req, { params }) {
  const { user, identifier, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return authError;

  const { allowed, error: rateLimitError } = await checkRateLimit(identifier);
  if (!allowed) return rateLimitError;

  const admin = getSupabaseAdmin();
  if (!(await isCallerAdmin(admin, user.id))) {
    return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
  }

  const { id } = await params;
  const { data: cv, error: lectureError } = await admin
    .from("banque_cv")
    .select(
      "id, nom_complet, categorie, niveau_etude_code, annees_experience, competences, resume_profil, points_forts, texte_extrait, fichier_cv, fichier_lettre, statut, erreur_analyse, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (lectureError || !cv) {
    return NextResponse.json({ error: "CV introuvable." }, { status: 404 });
  }

  // Les deux signatures en parallèle : la lettre est facultative, son
  // absence ne doit pas retarder ni bloquer l'accès au CV.
  const [urlCv, urlLettre] = await Promise.all([
    admin.storage.from("banque-cv").createSignedUrl(cv.fichier_cv, DUREE_URL_SIGNEE),
    cv.fichier_lettre
      ? admin.storage.from("banque-cv").createSignedUrl(cv.fichier_lettre, DUREE_URL_SIGNEE)
      : Promise.resolve({ data: null, error: null }),
  ]);

  return NextResponse.json({
    success: true,
    cv: {
      ...cv,
      fichier_cv: undefined,
      fichier_lettre: undefined,
      urlCv: urlCv.data?.signedUrl || null,
      urlLettre: urlLettre.data?.signedUrl || null,
    },
  });
}
