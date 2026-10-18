import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

// Stories du fil d'actualité — espace admin /admin/stories.
// La table stories n'accorde AUCUNE écriture à anon/authenticated
// (20261013130000_stories.sql) : cette route (service_role, après contrôle
// admin) est le seul chemin d'écriture. Le visuel part directement du navigateur
// vers Supabase Storage par URL signée.

const BUCKET = "stories-media";
const TAILLE_MAX = 5 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COLONNES = "id, titre, image_url, libelle_bouton, lien, bouton_visible, type, date_debut, date_fin, message_whatsapp, ordre, actif, created_at, updated_at";

// Type de story : « cv » = modèle de CV (bouton « Commander via WhatsApp ») ; « offre » = offre d'emploi, qui doit toujours
// avoir un bouton « Postuler » avec le lien de l'offre (jamais d'offre sans bouton).
const TYPES_STORY = ["cv", "offre"];
const LIBELLE_PAR_TYPE = { cv: "Commander via WhatsApp", offre: "Postuler" };

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

/** Lien du bouton : une URL http(s), ou un numéro de téléphone (devient un lien WhatsApp). Vide = pas de lien. */
function normaliserLien(saisie) {
  const texte = String(saisie ?? "").trim();
  if (!texte) return { lien: null };
  if (/^\+?[\d\s().-]{8,20}$/.test(texte)) {
    const chiffres = texte.replace(/\D/g, "");
    if (chiffres.length < 8 || chiffres.length > 15) return { erreur: "Numéro de téléphone invalide." };
    return { lien: `https://wa.me/${chiffres}` };
  }
  if (/^https?:\/\/\S+$/i.test(texte) && texte.length <= 500) return { lien: texte };
  return { erreur: "Le lien doit commencer par http:// ou https:// (ou être un numéro de téléphone WhatsApp)." };
}

function cheminDepuisUrl(url) {
  if (typeof url !== "string") return null;
  const i = url.indexOf(`/${BUCKET}/`);
  return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]);
}

async function urlPubliqueDuFichier(admin, chemin) {
  if (!/^story-[\w.-]+\.(jpg|png|webp)$/.test(String(chemin || ""))) return { erreur: "Visuel invalide." };
  const { data: existe } = await admin.storage.from(BUCKET).list("", { search: chemin, limit: 1 });
  if (!existe?.some((o) => o.name === chemin)) return { erreur: "Le visuel n'a pas été déposé : réessayez le téléversement." };
  return { url: admin.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl };
}

/** Création refusée alors que le visuel est déjà déposé : on retire ce fichier pour ne pas laisser d'orphelin. */
async function retirerDepot(admin, chemin) {
  if (/^story-[\w.-]+\.(jpg|png|webp)$/.test(String(chemin || ""))) {
    await admin.storage.from(BUCKET).remove([chemin]).catch(() => {});
  }
}

function lireChamps(body) {
  const titre = typeof body?.titre === "string" ? body.titre.trim() : undefined;
  const libelle = typeof body?.libelle_bouton === "string" ? body.libelle_bouton.trim() : undefined;
  if (titre !== undefined && (titre.length < 1 || titre.length > 40)) return { erreur: "Le titre doit faire entre 1 et 40 caractères." };
  if (libelle !== undefined && (libelle.length < 1 || libelle.length > 40)) return { erreur: "Le texte du bouton doit faire entre 1 et 40 caractères." };
  const type = typeof body?.type === "string" ? body.type : undefined;
  if (type !== undefined && !TYPES_STORY.includes(type)) return { erreur: "Type de story invalide." };
  // Période d'affichage (vide = pas de borne) et message WhatsApp pré-rempli ({nom} = titre de la story).
  const dateOuNull = (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? false : d.toISOString();
  };
  const debut = dateOuNull(body?.date_debut);
  const fin = dateOuNull(body?.date_fin);
  if (debut === false || fin === false) return { erreur: "Date invalide." };
  if (debut && fin && fin < debut) return { erreur: "La date de fin doit être après la date de début." };
  const message = typeof body?.message_whatsapp === "string" ? body.message_whatsapp.trim() : undefined;
  if (message !== undefined && message.length > 300) return { erreur: "Le message WhatsApp doit faire 300 caractères au maximum." };
  return { titre, libelle, type, debut, fin, message };
}

export async function GET(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const { data, error: dbError } = await admin
    .from("stories")
    .select(COLONNES)
    .order("ordre", { ascending: true })
    .order("created_at", { ascending: false });
  if (dbError) {
    console.error("[admin/stories GET]", dbError);
    return NextResponse.json({ error: "Impossible de charger les stories." }, { status: 500 });
  }
  return NextResponse.json({ stories: data || [] });
}

// action "upload-url" : URL signée pour le visuel ; sinon création d'une story.
export async function POST(req) {
  const { admin, user, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);

  if (body?.action === "upload-url") {
    const extension = TYPES[String(body?.contentType || "")];
    const taille = Number(body?.taille) || 0;
    if (!extension) return NextResponse.json({ error: "Format non accepté : JPEG, PNG ou WebP." }, { status: 400 });
    if (taille <= 0 || taille > TAILLE_MAX) return NextResponse.json({ error: "Le visuel doit faire 5 Mo au maximum." }, { status: 400 });
    const chemin = `story-${Date.now()}-${user.id.slice(0, 8)}.${extension}`;
    const { data, error: dbError } = await admin.storage.from(BUCKET).createSignedUploadUrl(chemin);
    if (dbError || !data) {
      console.error("[admin/stories upload-url]", dbError);
      return NextResponse.json({ error: "Impossible de préparer le dépôt du visuel." }, { status: 500 });
    }
    return NextResponse.json({ path: data.path ?? chemin, token: data.token });
  }

  // Les stories que montre le fil tant que la table est vide (modèles de CV du
  // code) ne sont pas modifiables. Cette action les copie en vraies stories —
  // visuel compris, une copie par story pour que supprimer l'une ne casse pas
  // les autres — afin que l'administrateur puisse en changer le texte, le numéro
  // ou le lien, les masquer ou les supprimer. Refusée dès qu'une story existe.
  if (body?.action === "importer-modeles") {
    const { count } = await admin.from("stories").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return NextResponse.json({ error: "Des stories existent déjà : rien à importer." }, { status: 409 });
    const reponse = await fetch(new URL("/affiche_cv_pro.jpg", req.url)).catch(() => null);
    if (!reponse?.ok) return NextResponse.json({ error: "Visuel des modèles introuvable." }, { status: 502 });
    const octets = Buffer.from(await reponse.arrayBuffer());
    const modeles = [
      { id: "modern", titre: "Moderne" },
      { id: "minimalist", titre: "Minimaliste" },
      { id: "classic", titre: "Classique" },
    ];
    const crees = [];
    for (const [i, m] of modeles.entries()) {
      const chemin = `story-${Date.now()}-${i}-${user.id.slice(0, 8)}.jpg`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(chemin, octets, { contentType: "image/jpeg" });
      if (upErr) {
        console.error("[admin/stories importer]", upErr);
        for (const c of crees) await retirerDepot(admin, cheminDepuisUrl(c.image_url));
        if (crees.length) await admin.from("stories").delete().in("id", crees.map((c) => c.id));
        return NextResponse.json({ error: "Import impossible : dépôt du visuel refusé." }, { status: 500 });
      }
      const { data, error: dbError } = await admin
        .from("stories")
        .insert({
          titre: m.titre,
          image_url: admin.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl,
          libelle_bouton: "Créer mon CV",
          lien: `https://ffacilite.com/creer-cv?template=${m.id}`,
          bouton_visible: true,
          ordre: i + 1,
          actif: true,
          created_by: user.id,
        })
        .select(COLONNES)
        .single();
      if (dbError) {
        console.error("[admin/stories importer]", dbError);
        await retirerDepot(admin, chemin);
        for (const c of crees) await retirerDepot(admin, cheminDepuisUrl(c.image_url));
        if (crees.length) await admin.from("stories").delete().in("id", crees.map((c) => c.id));
        return NextResponse.json({ error: "Import impossible." }, { status: 500 });
      }
      crees.push(data);
    }
    return NextResponse.json({ stories: crees }, { status: 201 });
  }

  const champs = lireChamps(body);
  if (champs.erreur) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: champs.erreur }, { status: 400 });
  }
  if (!champs.titre) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 400 });
  }
  const type = champs.type || "cv";
  const lien = normaliserLien(body?.lien);
  if (lien.erreur) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: lien.erreur }, { status: 400 });
  }
  // Une offre d'emploi n'a de sens qu'avec son bouton « Postuler » : le lien de l'offre est obligatoire.
  if (type === "offre" && (!lien.lien || !/^https?:\/\//i.test(lien.lien) || /wa\.me/i.test(lien.lien))) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: "Une offre d'emploi doit avoir un bouton « Postuler » : indiquez le lien de l'offre (http:// ou https://)." }, { status: 400 });
  }
  if (type === "offre" && body?.bouton_visible === false) {
    await retirerDepot(admin, body?.path);
    return NextResponse.json({ error: "Le bouton « Postuler » d'une offre d'emploi ne peut pas être caché." }, { status: 400 });
  }
  const visuel = await urlPubliqueDuFichier(admin, body?.path);
  if (visuel.erreur) return NextResponse.json({ error: visuel.erreur }, { status: 400 });

  // Nouvelle story en fin de liste.
  const { data: dernier } = await admin.from("stories").select("ordre").order("ordre", { ascending: false }).limit(1);
  const ordre = (dernier?.[0]?.ordre ?? 0) + 1;

  const { data, error: dbError } = await admin
    .from("stories")
    .insert({
      titre: champs.titre,
      image_url: visuel.url,
      libelle_bouton: champs.libelle || LIBELLE_PAR_TYPE[type],
      lien: lien.lien,
      type,
      date_debut: champs.debut ?? null,
      date_fin: champs.fin ?? null,
      message_whatsapp: champs.message || null,
      bouton_visible: type === "offre" ? true : body?.bouton_visible !== false,
      ordre,
      actif: body?.actif !== false,
      created_by: user.id,
    })
    .select(COLONNES)
    .single();
  if (dbError) {
    console.error("[admin/stories POST]", dbError);
    return NextResponse.json({ error: "Impossible de créer cette story." }, { status: 500 });
  }
  return NextResponse.json({ story: data }, { status: 201 });
}

export async function PATCH(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  const champs = lireChamps(body);
  if (champs.erreur) return NextResponse.json({ error: champs.erreur }, { status: 400 });

  const patch = { updated_at: new Date().toISOString() };
  if (champs.type !== undefined) patch.type = champs.type;
  if (champs.debut !== undefined) patch.date_debut = champs.debut;
  if (champs.fin !== undefined) patch.date_fin = champs.fin;
  if (champs.message !== undefined) patch.message_whatsapp = champs.message || null;
  if (champs.titre !== undefined) patch.titre = champs.titre;
  if (champs.libelle !== undefined) patch.libelle_bouton = champs.libelle;
  if (body.lien !== undefined) {
    const lien = normaliserLien(body.lien);
    if (lien.erreur) return NextResponse.json({ error: lien.erreur }, { status: 400 });
    patch.lien = lien.lien;
  }
  if (typeof body.actif === "boolean") patch.actif = body.actif;
  if (typeof body.bouton_visible === "boolean") patch.bouton_visible = body.bouton_visible;

  // Règle « offre = bouton Postuler » vérifiée sur l'état FINAL de la story (type, lien et bouton après modification).
  {
    const { data: avant } = await admin.from("stories").select("type, lien, bouton_visible").eq("id", id).single();
    const typeFinal = patch.type ?? avant?.type ?? "cv";
    const lienFinal = patch.lien !== undefined ? patch.lien : avant?.lien;
    const boutonFinal = patch.bouton_visible !== undefined ? patch.bouton_visible : avant?.bouton_visible !== false;
    if (typeFinal === "offre") {
      if (!lienFinal || !/^https?:\/\//i.test(lienFinal) || /wa\.me/i.test(lienFinal)) {
        return NextResponse.json({ error: "Une offre d'emploi doit avoir un bouton « Postuler » : indiquez le lien de l'offre (http:// ou https://)." }, { status: 400 });
      }
      if (!boutonFinal) return NextResponse.json({ error: "Le bouton « Postuler » d'une offre d'emploi ne peut pas être caché." }, { status: 400 });
    }
  }
  if (Number.isInteger(body.ordre)) patch.ordre = body.ordre;

  let ancienChemin = null;
  if (body.path) {
    const visuel = await urlPubliqueDuFichier(admin, body.path);
    if (visuel.erreur) return NextResponse.json({ error: visuel.erreur }, { status: 400 });
    const { data: avant } = await admin.from("stories").select("image_url").eq("id", id).single();
    ancienChemin = cheminDepuisUrl(avant?.image_url);
    patch.image_url = visuel.url;
  }

  const { data, error: dbError } = await admin.from("stories").update(patch).eq("id", id).select(COLONNES).single();
  if (dbError) {
    console.error("[admin/stories PATCH]", dbError);
    return NextResponse.json({ error: "Impossible de modifier cette story." }, { status: 500 });
  }
  if (ancienChemin && ancienChemin !== cheminDepuisUrl(data.image_url)) {
    await admin.storage.from(BUCKET).remove([ancienChemin]).catch(() => {});
  }
  return NextResponse.json({ story: data });
}

export async function DELETE(req) {
  const { admin, error } = await autoriserAdmin(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  const { data, error: dbError } = await admin.from("stories").delete().eq("id", id).select("image_url").single();
  if (dbError) {
    console.error("[admin/stories DELETE]", dbError);
    return NextResponse.json({ error: "Impossible de supprimer cette story." }, { status: 500 });
  }
  const chemin = cheminDepuisUrl(data?.image_url);
  if (chemin) await admin.storage.from(BUCKET).remove([chemin]).catch(() => {});
  return NextResponse.json({ ok: true });
}
