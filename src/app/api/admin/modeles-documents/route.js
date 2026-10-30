import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { FACILITE_WHATSAPP_NUMBER } from "@/lib/whatsappHelp";

export const runtime = "nodejs";

// Modèles de documents (CV, lettres de motivation) — espace admin /admin/modeles-documents.
// La table modeles_documents n'accorde AUCUNE écriture à anon/authenticated (20261029100000_modeles_documents.sql) : cette route (service_role, après
// contrôle admin) est le seul chemin d'écriture. L'affiche part directement du navigateur vers Supabase Storage par URL signée.
// « Publier aussi en story » crée la story correspondante (même affiche, bouton « Commander via WhatsApp » vers Facilité).

const BUCKET = "modeles-documents";
const TAILLE_MAX = 5 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TYPES_DOCUMENT = ["cv", "lettre"];
const COLONNES = "id, type, nom, description, prix_xof, image_url, actif, ordre, story_id, created_at, updated_at";

async function autoriserAdmin(req) {
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

function cheminValide(chemin) {
  return /^modele-[\w.-]+\.(jpg|png|webp)$/.test(String(chemin || ""));
}

function cheminDepuisUrl(url) {
  if (typeof url !== "string") return null;
  const i = url.indexOf(`/${BUCKET}/`);
  return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]);
}

async function urlPubliqueDuFichier(admin, chemin) {
  if (!cheminValide(chemin)) return { erreur: "Affiche invalide." };
  const { data: existe } = await admin.storage.from(BUCKET).list("", { search: chemin, limit: 1 });
  if (!existe?.some((o) => o.name === chemin)) return { erreur: "L'affiche n'a pas été déposée : réessayez le téléversement." };
  return { url: admin.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl };
}

async function retirerDepot(admin, chemin) {
  if (cheminValide(chemin)) await admin.storage.from(BUCKET).remove([chemin]).catch(() => {});
}

/** Valide les champs texte et numériques ; renvoie seulement ceux qui sont présents (utile au PATCH). */
function lireChamps(body) {
  const champs = {};
  if (body?.type !== undefined) {
    if (!TYPES_DOCUMENT.includes(body.type)) return { erreur: "Type invalide : CV ou lettre de motivation." };
    champs.type = body.type;
  }
  if (body?.nom !== undefined) {
    const nom = String(body.nom).trim();
    if (nom.length < 2 || nom.length > 60) return { erreur: "Le nom doit faire entre 2 et 60 caractères." };
    champs.nom = nom;
  }
  if (body?.description !== undefined) {
    const description = String(body.description).trim();
    if (description.length > 200) return { erreur: "La description doit faire 200 caractères au maximum." };
    champs.description = description;
  }
  if (body?.prix_xof !== undefined) {
    const prix = Number(body.prix_xof);
    if (!Number.isInteger(prix) || prix < 0 || prix > 1000000) return { erreur: "Le prix doit être un nombre entier de FCFA (0 à 1 000 000)." };
    champs.prix_xof = prix;
  }
  if (body?.actif !== undefined) champs.actif = body.actif === true;
  if (body?.ordre !== undefined) {
    const ordre = Number(body.ordre);
    if (!Number.isInteger(ordre) || ordre < -100000 || ordre > 100000) return { erreur: "Rang invalide." };
    champs.ordre = ordre;
  }
  return { champs };
}

export async function GET(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const { data, error: dbError } = await admin
    .from("modeles_documents")
    .select(COLONNES)
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: false });
  if (dbError) {
    console.error("[admin/modeles-documents GET]", dbError);
    return NextResponse.json({ error: "Impossible de charger les modèles." }, { status: 500 });
  }
  return NextResponse.json({ modeles: data || [] });
}

// action "upload-url" : URL signée pour l'affiche ; sinon création d'un modèle (et, si demandé, de sa story).
export async function POST(req) {
  const { admin, user, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);

  if (body?.action === "upload-url") {
    const extension = TYPES[String(body?.contentType || "")];
    const taille = Number(body?.taille) || 0;
    if (!extension) return NextResponse.json({ error: "Format non accepté : JPEG, PNG ou WebP." }, { status: 400 });
    if (taille <= 0 || taille > TAILLE_MAX) return NextResponse.json({ error: "L'affiche doit faire 5 Mo au maximum." }, { status: 400 });
    const chemin = `modele-${Date.now()}-${user.id.slice(0, 8)}.${extension}`;
    const { data, error: dbError } = await admin.storage.from(BUCKET).createSignedUploadUrl(chemin);
    if (dbError || !data) {
      console.error("[admin/modeles-documents upload-url]", dbError);
      return NextResponse.json({ error: "Impossible de préparer le dépôt de l'affiche." }, { status: 500 });
    }
    return NextResponse.json({ path: data.path ?? chemin, token: data.token });
  }

  const lu = lireChamps(body);
  if (lu.erreur) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: lu.erreur }, { status: 400 });
  }
  const { champs } = lu;
  if (!champs.nom) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
  }
  const affiche = await urlPubliqueDuFichier(admin, body?.path);
  if (affiche.erreur) return NextResponse.json({ error: affiche.erreur }, { status: 400 });

  const { data: dernier } = await admin.from("modeles_documents").select("ordre").order("ordre", { ascending: false }).limit(1);
  const ordre = (dernier?.[0]?.ordre ?? 0) + 1;

  // Story d'abord (si cochée) : si elle échoue, rien n'est créé et l'affiche déposée est retirée.
  let storyId = null;
  if (body?.publier_story === true) {
    const { data: derniereStory } = await admin.from("stories").select("ordre").order("ordre", { ascending: false }).limit(1);
    const { data: story, error: storyError } = await admin
      .from("stories")
      .insert({
        titre: champs.nom.slice(0, 40),
        image_url: affiche.url,
        libelle_bouton: "Commander via WhatsApp",
        lien: `https://wa.me/${FACILITE_WHATSAPP_NUMBER}`,
        type: "cv",
        // Le lien de l'affiche suit le message : WhatsApp en affiche l'aperçu (un lien wa.me ne peut pas joindre une image).
        message_whatsapp: `Bonjour, je souhaite le modèle de document : ${champs.nom}.\nVoici l'affiche : ${affiche.url}`,
        bouton_visible: true,
        ordre: (derniereStory?.[0]?.ordre ?? 0) + 1,
        actif: true,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (storyError) {
      console.error("[admin/modeles-documents story]", storyError);
      await retirerDepot(admin, body?.path);
      return NextResponse.json({ error: "Impossible de publier la story : le modèle n'a pas été créé." }, { status: 500 });
    }
    storyId = story.id;
  }

  const { data, error: dbError } = await admin
    .from("modeles_documents")
    .insert({
      type: champs.type || "cv",
      nom: champs.nom,
      description: champs.description ?? "",
      prix_xof: champs.prix_xof ?? 0,
      image_url: affiche.url,
      actif: champs.actif !== false,
      ordre,
      story_id: storyId,
      created_by: user.id,
    })
    .select(COLONNES)
    .single();
  if (dbError) {
    console.error("[admin/modeles-documents POST]", dbError);
    if (storyId) await admin.from("stories").delete().eq("id", storyId);
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: "Impossible de créer ce modèle." }, { status: 500 });
  }
  return NextResponse.json({ modele: data }, { status: 201 });
}

export async function PATCH(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  const lu = lireChamps(body);
  if (lu.erreur) return NextResponse.json({ error: lu.erreur }, { status: 400 });
  if (Object.keys(lu.champs).length === 0) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });

  const { data, error: dbError } = await admin
    .from("modeles_documents")
    .update({ ...lu.champs, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLONNES)
    .maybeSingle();
  if (dbError) {
    console.error("[admin/modeles-documents PATCH]", dbError);
    return NextResponse.json({ error: "Impossible de modifier ce modèle." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
  return NextResponse.json({ modele: data });
}

export async function DELETE(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  const { data: ligne } = await admin.from("modeles_documents").select("id, image_url, story_id").eq("id", id).maybeSingle();
  if (!ligne) return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });

  const { error: dbError } = await admin.from("modeles_documents").delete().eq("id", id);
  if (dbError) {
    console.error("[admin/modeles-documents DELETE]", dbError);
    return NextResponse.json({ error: "Impossible de supprimer ce modèle." }, { status: 500 });
  }
  // La story liée (même affiche) est retirée avec le modèle ; le fichier n'est supprimé qu'après, pour ne jamais laisser une story sans visuel.
  if (ligne.story_id) await admin.from("stories").delete().eq("id", ligne.story_id);
  await retirerDepot(admin, cheminDepuisUrl(ligne.image_url));
  return NextResponse.json({ ok: true });
}
