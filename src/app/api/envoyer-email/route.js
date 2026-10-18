import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateUploadedFile, MAX_FILE_SIZE_BYTES } from "@/lib/validation";

export const runtime = "nodejs";

// « Écrire un e-mail » (bouton flottant de l'application) : l'utilisateur
// connecté écrit à n'importe quelle adresse, comme dans Gmail. Garde-fous
// contre l'abus (Facilité ne doit pas devenir un relais de spam) :
//  - session obligatoire + limite de débit par utilisateur ;
//  - 10 envois par utilisateur et par 24 h (table emails_envoyes, service_role) ;
//  - UN destinataire par message, adresse validée ;
//  - 3 pièces jointes maximum, 10 Mo au total, formats contrôlés par signature ;
//  - « Joindre : Mon CV · Lettre » : l'application envoie les identifiants (resume_ids) des documents DE
//    L'UTILISATEUR ; le serveur les relit lui-même dans le stockage privé après avoir vérifié qu'ils lui
//    appartiennent (jamais de chemin de fichier pris dans la requête) ;
//  - l'e-mail part du domaine de Facilité, avec « Répondre à » = l'adresse de
//    l'expéditeur, et un pied de message qui dit d'où il vient.
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

const MAX_PAR_JOUR = 10;
const MAX_PIECES = 3;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES_PAR_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};
const REGEX_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function echapper(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req) {
  const { user, error: authError } = await requireUser(req, { logDenials: true });
  if (authError) return authError;

  const { allowed, error: rateError } = await checkRateLimit(user.id);
  if (!allowed) return rateError;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const to = String(formData.get("to") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const fichiers = formData.getAll("pieces").filter((f) => f && typeof f === "object" && "arrayBuffer" in f);
  const idsDocuments = [...new Set(formData.getAll("resume_ids").map((v) => String(v)).filter((v) => REGEX_UUID.test(v)))];

  if (!to || to.length > 254 || !REGEX_EMAIL.test(to)) {
    return NextResponse.json({ error: "Adresse du destinataire invalide." }, { status: 400 });
  }
  if (!subject || subject.length > 150) {
    return NextResponse.json({ error: "L'objet est obligatoire (150 caractères maximum)." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Le message est trop long (5 000 caractères maximum)." }, { status: 400 });
  }
  if (!message && fichiers.length === 0 && idsDocuments.length === 0) {
    return NextResponse.json({ error: "Écrivez un message ou ajoutez une pièce jointe." }, { status: 400 });
  }
  if (fichiers.length + idsDocuments.length > MAX_PIECES) {
    return NextResponse.json({ error: `${MAX_PIECES} pièces jointes au maximum.` }, { status: 400 });
  }

  // Pièces jointes : taille totale et signature de chaque fichier.
  const attachments = [];
  let total = 0;
  for (const f of fichiers) {
    const buffer = Buffer.from(await f.arrayBuffer());
    total += buffer.length;
    if (total > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Les pièces jointes dépassent 10 Mo au total." }, { status: 413 });
    }
    const verdict = validateUploadedFile(buffer, f.type, buffer.length);
    if (!verdict.valid) return NextResponse.json({ error: verdict.error }, { status: verdict.status || 400 });
    attachments.push({ filename: String(f.name || "piece-jointe").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120), content: buffer });
  }

  const admin = getSupabaseAdmin();

  // Documents du profil (Mon CV, Lettre) : relus côté serveur, uniquement s'ils appartiennent à l'utilisateur.
  if (idsDocuments.length > 0) {
    const { data: docs } = await admin.from("resumes").select("id, title, file_url").eq("user_id", user.id).in("id", idsDocuments);
    if (!docs || docs.length !== idsDocuments.length) {
      return NextResponse.json({ error: "Un des documents à joindre est introuvable." }, { status: 400 });
    }
    for (const d of docs) {
      const chemin = d.file_url;
      if (!chemin || /^(https?:|data:)/.test(chemin)) {
        return NextResponse.json({ error: `Le document « ${d.title || "document"} » ne peut pas être joint.` }, { status: 400 });
      }
      const { data: blob, error: erreurTelechargement } = await admin.storage.from("resumes").download(chemin);
      if (erreurTelechargement || !blob) {
        return NextResponse.json({ error: `Le document « ${d.title || "document"} » est illisible.` }, { status: 400 });
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      total += buffer.length;
      if (total > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "Les pièces jointes dépassent 10 Mo au total." }, { status: 413 });
      }
      const extension = String(chemin).split(".").pop().toLowerCase();
      const verdict = validateUploadedFile(buffer, TYPES_PAR_EXTENSION[extension] || blob.type || "application/pdf", buffer.length);
      if (!verdict.valid) return NextResponse.json({ error: verdict.error }, { status: verdict.status || 400 });
      const nom = String(d.title || "document").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 110);
      attachments.push({ filename: /\.[a-z0-9]{2,5}$/i.test(nom) ? nom : `${nom}.${extension}`, content: buffer });
    }
  }

  // Plafond quotidien.
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("emails_envoyes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", depuis);
  if ((count ?? 0) >= MAX_PAR_JOUR) {
    return NextResponse.json({ error: `Limite atteinte : ${MAX_PAR_JOUR} e-mails par 24 heures.` }, { status: 429 });
  }

  // Identité de l'expéditeur (jamais prise dans la requête).
  const { data: profil } = await admin.from("profiles").select("full_name, contact_email").eq("id", user.id).maybeSingle();
  const emailExpediteur = user.email || profil?.contact_email || null;
  const nomExpediteur = (profil?.full_name || "Un utilisateur Facilité").replace(/[<>"\r\n]/g, "").trim().slice(0, 60) || "Un utilisateur Facilité";
  if (!emailExpediteur) {
    return NextResponse.json({ error: "Votre compte n'a pas d'adresse e-mail : ajoutez-en une dans Sécurité & Connexion." }, { status: 400 });
  }

  const isProd = process.env.NODE_ENV === "production";
  const sender = process.env.RESEND_FROM_CANDIDATE || (isProd ? "Facilite <noreply@ffacilite.com>" : "Facilite <onboarding@resend.dev>");
  const adresseEnvoi = sender.match(/<([^>]+)>/)?.[1] || sender;

  const html = `
    <div style="font-family: sans-serif; line-height: 1.55; color: #222;">
      <div style="white-space: normal;">${message ? echapper(message).replace(/\n/g, "<br/>") : "<em>(pas de message — voir les pièces jointes)</em>"}</div>
      <p style="border-top: 1px solid #eee; margin-top: 24px; padding-top: 12px; font-size: 12px; color: #777;">
        Message envoyé depuis Facilité par ${echapper(nomExpediteur)} (${echapper(emailExpediteur)}).
        Répondez directement à cet e-mail : votre réponse lui sera adressée.
      </p>
    </div>`;

  const { error: envoiError } = await resend.emails.send({
    from: `${nomExpediteur} via Facilité <${adresseEnvoi}>`,
    to,
    replyTo: emailExpediteur,
    subject,
    html,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (envoiError) {
    console.error("[envoyer-email] Échec Resend :", envoiError?.message || envoiError);
    return NextResponse.json({ error: "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant." }, { status: 502 });
  }

  await admin.from("emails_envoyes").insert({ user_id: user.id, destinataire: to, objet: subject.slice(0, 150) });
  return NextResponse.json({ success: true });
}
