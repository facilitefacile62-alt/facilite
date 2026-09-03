// Import d'un CV (et, en option, d'une lettre de motivation) dans la banque
// admin. banque_cv n'accorde RIEN à authenticated/anon (RLS activée, zéro
// policy, voir 20260903120000_banque_cv.sql) : cette route est le SEUL
// chemin d'écriture, même pour un administrateur.
//
// « Il va prendre son temps » n'est pas une figure de style : l'extraction
// du texte (OCR compris sur un CV scanné) puis la catégorisation par Gemini
// se font ici, dans le même appel, avant que la réponse ne parte. Un import
// dure donc plusieurs secondes — c'est le prix d'un classement fondé sur le
// texte réel du CV plutôt que sur son seul nom de fichier.
import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { extractTextFromFile } from "@/lib/documentParser";
import { validateUploadedFile } from "@/lib/validation";
import { categoriserCv, embarquerTexte, checkBanqueCvQuota, BANQUE_CV_DAILY_QUOTA } from "@/lib/banqueCvIA";

export const runtime = "nodejs";
// OCR éventuel + catégorisation + embedding dans le même appel : plus long
// qu'un simple upload, dans le même ordre de grandeur que parse-document
// (maxDuration 55) et rag-matching (maxDuration 60).
export const maxDuration = 60;

const EXTENSIONS_PAR_MIME = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

export async function POST(req) {
  const { admin, user, error } = await authorizeAdmin(req);
  if (error) return error;

  if (!(await checkBanqueCvQuota(user.id))) {
    return NextResponse.json(
      { error: `Quota d'import quotidien atteint (${BANQUE_CV_DAILY_QUOTA} CV/jour). Réessayez demain.` },
      { status: 429 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const fichierCv = form.get("cv");
  const fichierLettre = form.get("lettre");
  const nomSaisi = String(form.get("nom") || "").trim().slice(0, 200);

  if (!(fichierCv instanceof File) || fichierCv.size === 0) {
    return NextResponse.json({ error: "Le CV est obligatoire." }, { status: 400 });
  }

  const bufCv = Buffer.from(await fichierCv.arrayBuffer());
  const validationCv = validateUploadedFile(bufCv, fichierCv.type, bufCv.length);
  if (!validationCv.valid) {
    return NextResponse.json({ error: validationCv.error }, { status: validationCv.status });
  }

  let bufLettre = null;
  if (fichierLettre instanceof File && fichierLettre.size > 0) {
    bufLettre = Buffer.from(await fichierLettre.arrayBuffer());
    const validationLettre = validateUploadedFile(bufLettre, fichierLettre.type, bufLettre.length);
    if (!validationLettre.valid) {
      return NextResponse.json({ error: `Lettre de motivation : ${validationLettre.error}` }, { status: validationLettre.status });
    }
  }

  // 1. Texte réel du CV — jamais le nom de fichier, jamais une supposition.
  let texteExtrait;
  try {
    texteExtrait = (await extractTextFromFile(bufCv, fichierCv.name, fichierCv.type) || "").trim();
  } catch (e) {
    return NextResponse.json({ error: `Lecture du CV impossible : ${e.message}` }, { status: 422 });
  }
  if (texteExtrait.length < 50) {
    return NextResponse.json(
      { error: "Aucun texte exploitable n'a été trouvé dans ce fichier. Vérifiez qu'il s'agit bien d'un CV lisible." },
      { status: 422 }
    );
  }
  // Un CV dépasse rarement 4 pages : 12000 caractères en couvrent la quasi-
  // totalité tout en bornant le coût de l'appel Gemini et le poids de la
  // ligne en base.
  texteExtrait = texteExtrait.slice(0, 12000);

  // 2. Fichiers stockés AVANT l'analyse : si Gemini échoue plus bas, le CV
  // reste consultable et l'admin peut relancer l'analyse au lieu de tout
  // réimporter.
  const dossier = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cheminCv = `${dossier}-cv.${EXTENSIONS_PAR_MIME[fichierCv.type] || "bin"}`;
  const { error: erreurUploadCv } = await admin.storage
    .from("banque-cv")
    .upload(cheminCv, bufCv, { contentType: fichierCv.type, upsert: false });
  if (erreurUploadCv) {
    return NextResponse.json({ error: `Enregistrement du CV impossible : ${erreurUploadCv.message}` }, { status: 500 });
  }

  let cheminLettre = null;
  if (bufLettre) {
    const chemin = `${dossier}-lettre.${EXTENSIONS_PAR_MIME[fichierLettre.type] || "bin"}`;
    const { error: erreurUploadLettre } = await admin.storage
      .from("banque-cv")
      .upload(chemin, bufLettre, { contentType: fichierLettre.type, upsert: false });
    // La lettre est facultative : un échec de son envoi n'annule pas
    // l'import du CV, qui est la pièce qui compte pour la recherche.
    if (!erreurUploadLettre) cheminLettre = chemin;
  }

  // 3. Référentiel réel des niveaux d'étude — jamais une liste devinée, qui
  // pourrait diverger du CHECK/FK réellement posé en base.
  const { data: niveaux } = await admin.from("niveaux_etudes").select("code").order("rang", { ascending: true });
  const codesNiveaux = (niveaux || []).map((n) => n.code);

  // 4. Catégorisation, ancrée sur le texte réel du CV.
  let analyse = null;
  let erreurAnalyse = null;
  try {
    analyse = await categoriserCv(texteExtrait, codesNiveaux, nomSaisi);
  } catch (e) {
    erreurAnalyse = e.message;
  }

  // 5. Embedding — indépendant de l'étape précédente : un CV catégorisé
  // mais sans embedding reste consultable, seule la recherche par
  // proximité ne le trouvera pas avant un nouvel essai.
  let embedding = null;
  if (analyse) {
    try {
      embedding = await embarquerTexte(`${analyse.resume_profil || ""}\n\n${texteExtrait.slice(0, 4000)}`);
    } catch {
      // Silencieux par conception : voir le commentaire ci-dessus.
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("banque_cv")
    .insert({
      uploaded_by: user.id,
      nom_complet: analyse?.nom_complet || nomSaisi || null,
      categorie: analyse?.categorie || null,
      niveau_etude_code: codesNiveaux.includes(analyse?.niveau_etude_code) ? analyse.niveau_etude_code : null,
      annees_experience: Number.isFinite(analyse?.annees_experience) ? Math.max(0, Math.round(analyse.annees_experience)) : null,
      competences: Array.isArray(analyse?.competences) ? analyse.competences.slice(0, 15) : [],
      resume_profil: analyse?.resume_profil || null,
      points_forts: Array.isArray(analyse?.points_forts) ? analyse.points_forts.slice(0, 6) : [],
      texte_extrait: texteExtrait,
      embedding: embedding ? `[${embedding.join(",")}]` : null,
      fichier_cv: cheminCv,
      fichier_lettre: cheminLettre,
      statut: analyse ? "analyse" : "erreur",
      erreur_analyse: erreurAnalyse,
    })
    .select("id, nom_complet, categorie, niveau_etude_code, annees_experience, competences, resume_profil, points_forts, statut, erreur_analyse, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Enregistrement impossible : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, cv: inserted });
}
