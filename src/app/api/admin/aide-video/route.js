import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

// Vidéo d'aide « comment postuler » — espace admin /admin/aide-video.
// La table aide_video n'accorde AUCUNE écriture à anon/authenticated
// (20261013120000_aide_video.sql) : cette route (service_role, après contrôle
// admin) est le seul chemin d'écriture. Le dépôt du fichier se fait par URL
// signée : la vidéo part directement du navigateur vers Supabase Storage, sans
// transiter par la fonction serveur (limite de taille des Route Handlers).

const BUCKET = "aide-videos";
const TAILLE_MAX = 100 * 1024 * 1024;
const TYPES = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

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

/** « https://youtu.be/XXXXXXXXXXX », « …watch?v=XXXXXXXXXXX », « …/embed/XXXXXXXXXXX » ou l'identifiant seul. */
function extraireIdYoutube(saisie) {
  const texte = String(saisie || "").trim();
  if (/^[\w-]{11}$/.test(texte)) return texte;
  const m = texte.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function cheminDepuisUrl(url) {
  if (typeof url !== "string") return null;
  const i = url.indexOf(`/${BUCKET}/`);
  return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]);
}

export async function GET(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const { data, error: dbError } = await admin.from("aide_video").select("type, url, youtube_id, duree, whatsapp_visible, updated_at").eq("id", 1).single();
  if (dbError) {
    console.error("[admin/aide-video GET]", dbError);
    return NextResponse.json({ error: "Impossible de charger la vidéo d'aide." }, { status: 500 });
  }
  return NextResponse.json({ video: data });
}

// Étape 1 du téléversement : URL signée pour un fichier vidéo.
export async function POST(req) {
  const { admin, user, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const contentType = String(body?.contentType || "");
  const taille = Number(body?.taille) || 0;

  const extension = TYPES[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Format non accepté : choisissez un fichier MP4, MOV ou WebM." }, { status: 400 });
  }
  if (taille <= 0 || taille > TAILLE_MAX) {
    return NextResponse.json({ error: "La vidéo doit faire 100 Mo au maximum." }, { status: 400 });
  }

  const chemin = `aide-${Date.now()}-${user.id.slice(0, 8)}.${extension}`;
  const { data, error: dbError } = await admin.storage.from(BUCKET).createSignedUploadUrl(chemin);
  if (dbError || !data) {
    console.error("[admin/aide-video POST]", dbError);
    return NextResponse.json({ error: "Impossible de préparer le dépôt de la vidéo." }, { status: 500 });
  }
  return NextResponse.json({ path: data.path ?? chemin, token: data.token });
}

// Étape 2 : enregistre la source de la vidéo (fichier déposé, lien YouTube, ou aucune).
export async function PUT(req) {
  const { admin, user, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const type = body?.type;
  const duree = typeof body?.duree === "string" && body.duree.trim() ? body.duree.trim().slice(0, 20) : null;

  const { data: avant } = await admin.from("aide_video").select("type, url").eq("id", 1).single();

  let ligne;
  if (type === "fichier") {
    const chemin = String(body?.path || "");
    if (!/^aide-[\w.-]+\.(mp4|mov|webm)$/.test(chemin)) {
      return NextResponse.json({ error: "Fichier vidéo invalide." }, { status: 400 });
    }
    const { data: existe } = await admin.storage.from(BUCKET).list("", { search: chemin, limit: 1 });
    if (!existe?.some((o) => o.name === chemin)) {
      return NextResponse.json({ error: "La vidéo n'a pas été déposée : réessayez le téléversement." }, { status: 400 });
    }
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(chemin);
    ligne = { type: "fichier", url: pub.publicUrl, youtube_id: null, duree };
  } else if (type === "youtube") {
    const id = extraireIdYoutube(body?.youtube);
    if (!id) {
      return NextResponse.json({ error: "Lien YouTube non reconnu. Collez l'adresse de la vidéo (youtube.com ou youtu.be)." }, { status: 400 });
    }
    ligne = { type: "youtube", url: null, youtube_id: id, duree };
  } else if (type === "aucune") {
    ligne = { type: "aucune", url: null, youtube_id: null, duree: null };
  } else {
    return NextResponse.json({ error: "Type de vidéo inconnu." }, { status: 400 });
  }

  const { data, error: dbError } = await admin
    .from("aide_video")
    .update({ ...ligne, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", 1)
    .select("type, url, youtube_id, duree, whatsapp_visible, updated_at")
    .single();

  if (dbError) {
    console.error("[admin/aide-video PUT]", dbError);
    return NextResponse.json({ error: "Impossible d'enregistrer la vidéo d'aide." }, { status: 500 });
  }

  // Ménage : l'ancien fichier n'est plus référencé, on le retire du stockage.
  const ancien = avant?.type === "fichier" ? cheminDepuisUrl(avant.url) : null;
  if (ancien && ancien !== cheminDepuisUrl(data.url)) {
    await admin.storage.from(BUCKET).remove([ancien]).catch(() => {});
  }

  return NextResponse.json({ video: data });
}

// Interrupteur « numéro WhatsApp visible » de la page d'aide (site et application).
export async function PATCH(req) {
  const { admin, user, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (typeof body?.whatsapp_visible !== "boolean") {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }
  const { data, error: dbError } = await admin
    .from("aide_video")
    .update({ whatsapp_visible: body.whatsapp_visible, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", 1)
    .select("type, url, youtube_id, duree, whatsapp_visible, updated_at")
    .single();
  if (dbError) {
    console.error("[admin/aide-video PATCH]", dbError);
    return NextResponse.json({ error: "Impossible d'enregistrer le réglage." }, { status: 500 });
  }
  return NextResponse.json({ video: data });
}
