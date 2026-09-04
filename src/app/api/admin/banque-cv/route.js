// Liste les CV de la banque. Route obligatoire, pas un confort : banque_cv
// n'accorde rien à authenticated (voir la migration), donc même un
// administrateur ne peut pas faire `supabase.from("banque_cv").select()`
// depuis le navigateur — il n'existe aucun autre chemin de lecture.
import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

const PAR_PAGE = 24;

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

  const url = new URL(req.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10) || 0);
  const categorie = url.searchParams.get("categorie") || null;
  const recherche = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const debut = page * PAR_PAGE;

  // Classé par catégorie puis nom : les CV d'une même catégorie se
  // retrouvent groupés (l'écran affiche un en-tête par catégorie), et à
  // l'intérieur d'un groupe, l'ordre alphabétique permet de retrouver un
  // candidat au coup d'œil plutôt qu'en parcourant tout par ordre d'import.
  let requete = admin
    .from("banque_cv")
    .select(
      "id, nom_complet, categorie, niveau_etude_code, annees_experience, competences, resume_profil, statut, erreur_analyse, created_at, apercu_cv",
      { count: "exact" }
    )
    .order("categorie", { ascending: true, nullsFirst: false })
    .order("nom_complet", { ascending: true, nullsFirst: false })
    .range(debut, debut + PAR_PAGE - 1);

  if (categorie) requete = requete.eq("categorie", categorie);
  if (recherche) requete = requete.ilike("nom_complet", `%${recherche}%`);

  const { data, count, error: lectureError } = await requete;
  if (lectureError) {
    return NextResponse.json({ error: `Lecture impossible : ${lectureError.message}` }, { status: 500 });
  }

  // Signature en un seul appel batch pour toute la page plutôt qu'un appel
  // par ligne : le bucket "banque-cv" est privé (voir la migration), aucune
  // vignette n'est affichable sans URL signée. Courte durée (10 min) : la
  // liste se recharge de toute façon à chaque changement de page/filtre.
  const cheminsApercu = (data || []).map((c) => c.apercu_cv).filter(Boolean);
  let urlsApercu = {};
  if (cheminsApercu.length > 0) {
    const { data: signes } = await admin.storage.from("banque-cv").createSignedUrls(cheminsApercu, 600);
    for (const s of signes || []) {
      if (s.signedUrl && !s.error) urlsApercu[s.path] = s.signedUrl;
    }
  }
  const cvs = (data || []).map(({ apercu_cv, ...c }) => ({
    ...c,
    apercuUrl: apercu_cv ? urlsApercu[apercu_cv] || null : null,
  }));

  return NextResponse.json({ success: true, cvs, total: count || 0, page });
}

export async function DELETE(req) {
  const { admin, error } = await authorizeAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  const { data: ligne, error: lectureError } = await admin
    .from("banque_cv")
    .select("fichier_cv, fichier_lettre")
    .eq("id", id)
    .maybeSingle();
  if (lectureError || !ligne) {
    return NextResponse.json({ error: "CV introuvable." }, { status: 404 });
  }

  const { error: suppressionError } = await admin.from("banque_cv").delete().eq("id", id);
  if (suppressionError) {
    return NextResponse.json({ error: `Suppression impossible : ${suppressionError.message}` }, { status: 500 });
  }

  // La ligne compte plus que le fichier : si le nettoyage Storage échoue,
  // on ne fait pas échouer la suppression pour autant — un fichier orphelin
  // coûte quelques kilo-octets, une ligne qu'on ne peut plus supprimer
  // coûterait bien plus cher.
  const chemins = [ligne.fichier_cv, ligne.fichier_lettre].filter(Boolean);
  if (chemins.length) {
    await admin.storage.from("banque-cv").remove(chemins).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
