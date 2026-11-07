import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { aideOuverte, lireReglages, BUCKET_VOCAUX } from "@/lib/aide/serveur";

export const runtime = "nodejs";

const TAILLE_MAX_OCTETS = 1024 * 1024; // 1 Mo : ~4 minutes d'audio à 32 kbps, très au-dessus de 60 s
const EXTENSIONS = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/x-m4a": "m4a" };

/**
 * Message vocal à l'équipe : 60 s maximum (réglable), 5 par jour et par personne (réglable), stocké dans le
 * bucket PRIVÉ « aide-vocaux » (jamais d'URL publique : adresses signées côté administration).
 * Le fil de support passe en « attente_humain » et les administrateurs sont notifiés.
 */
export async function POST(req) {
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;
  const { allowed, error: rateError } = await checkRateLimit(user.id);
  if (!allowed) return rateError;

  const admin = getSupabaseAdmin();
  if (!(await aideOuverte(admin, user.id))) return NextResponse.json({ error: "Aide indisponible." }, { status: 404 });

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const fichier = form.get("audio");
  const duree = Math.round(Number(form.get("duree")));
  const reglages = await lireReglages(admin);

  if (!fichier || typeof fichier === "string" || typeof fichier.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Aucun enregistrement reçu." }, { status: 400 });
  }
  const type = String(fichier.type || "").split(";")[0].toLowerCase();
  const extension = EXTENSIONS[type];
  if (!extension) return NextResponse.json({ error: "Format audio non pris en charge." }, { status: 415 });
  if (fichier.size > TAILLE_MAX_OCTETS) return NextResponse.json({ error: "Enregistrement trop lourd." }, { status: 413 });
  if (!Number.isFinite(duree) || duree < 1 || duree > reglages.vocal_secondes_max) {
    return NextResponse.json({ error: `Un message vocal dure ${reglages.vocal_secondes_max} secondes au maximum.` }, { status: 400 });
  }

  const { data: reserve, error: errReserve } = await admin.rpc("aide_reserver_vocal", { p_user_id: user.id, p_limite: reglages.vocaux_par_jour });
  if (errReserve || reserve !== true) {
    return NextResponse.json({ error: `Vous avez atteint la limite de ${reglages.vocaux_par_jour} messages vocaux par jour.` }, { status: 429 });
  }

  const chemin = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: errEnvoi } = await admin.storage.from(BUCKET_VOCAUX).upload(chemin, Buffer.from(await fichier.arrayBuffer()), { contentType: type, upsert: false });
  if (errEnvoi) return NextResponse.json({ error: "L'enregistrement n'a pas pu être envoyé." }, { status: 500 });

  const { data: ligne, error: errLigne } = await admin
    .from("aide_messages_vocaux")
    .insert({ user_id: user.id, chemin, duree_secondes: duree, taille_octets: fichier.size })
    .select("id")
    .single();
  if (errLigne || !ligne) {
    await admin.storage.from(BUCKET_VOCAUX).remove([chemin]);
    return NextResponse.json({ error: "L'enregistrement n'a pas pu être enregistré." }, { status: 500 });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
  await client.rpc("demander_un_humain", { p_motif: `Message vocal de ${duree} s` });

  return NextResponse.json({ id: ligne.id, duree });
}
