import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SendApplicationPayloadSchema } from "@/lib/validation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

export async function POST(req) {
  try {
    // Authentification + limite de débit : un envoi d'e-mail est une action
    // ayant un coût (Resend) et un potentiel d'abus (spam) — jamais anonyme.
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    const parsed = SendApplicationPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Adresse e-mail destinataire invalide." }, { status: 400 });
    }
    const { recipientEmail } = parsed.data;

    // Le candidat est TOUJOURS l'utilisateur authentifié (user.id), jamais un
    // id envoyé par le client : sans ça, n'importe qui pourrait déclencher
    // l'envoi d'un e-mail au nom d'un autre candidat vers l'adresse de son choix.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name, email, cv_url, cv_name")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
    }
    if (!profile.cv_url) {
      return NextResponse.json(
        { error: "Ajoutez d'abord un CV à votre profil pour pouvoir postuler en 1 clic." },
        { status: 400 }
      );
    }

    const candidateName = profile.full_name || "Un candidat Facilite";
    const candidateEmail = profile.email || user.email;

    // cv_url est un CHEMIN de stockage privé ({user_id}/cvs/...), pas une URL
    // accessible : on télécharge le fichier pour le joindre en pièce jointe
    // (même pattern que /api/postuler), plutôt qu'un lien qui serait cassé
    // pour le destinataire (le bucket est privé).
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(profile.cv_url);

    if (downloadError || !fileData) {
      console.error("Erreur téléchargement CV pour l'envoi:", downloadError?.message);
      return NextResponse.json({ error: "Impossible de récupérer votre CV depuis le stockage." }, { status: 500 });
    }
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const cvFileName = profile.cv_name || "CV.pdf";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #059669; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          🚀 Nouvelle Candidature via Facilite
        </h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">Bonjour,</p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          <strong>${candidateName}</strong> (${candidateEmail}) vous adresse sa candidature en réponse à votre annonce de recrutement.
        </p>
        <p style="font-size: 13px; color: #6b7280;">Vous trouverez son CV en pièce jointe à cet e-mail.</p>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">
          Candidature envoyée via la plateforme Facilite · Recrutement Simplifié.
        </p>
      </div>
    `;

    // Même logique de sandbox Resend que /api/postuler : en mode onboarding
    // (pas de domaine vérifié), l'envoi est redirigé vers l'adresse de test
    // configurée plutôt que d'échouer silencieusement.
    const isProd = process.env.NODE_ENV === "production";
    const sender = process.env.RESEND_FROM_CANDIDATE || (isProd ? "Facilite <noreply@ffacilite.com>" : "Facilite <onboarding@resend.dev>");
    const isResendOnboarding = sender.includes("onboarding@resend.dev");
    const testRecipient = isResendOnboarding ? (process.env.RESEND_TEST_RECIPIENT || process.env.RESEND_VERIFIED_EMAIL || null) : null;
    const finalRecipient = testRecipient || recipientEmail;

    const { error: resendError } = await resend.emails.send({
      from: sender,
      to: finalRecipient,
      replyTo: candidateEmail,
      subject: `Candidature de ${candidateName} via Facilite`,
      html: htmlContent,
      attachments: [{ filename: cvFileName, content: fileBuffer }],
    });

    if (resendError) {
      console.error("Erreur Resend send-application:", resendError);
      const msg = resendError.message || "";
      const isRestriction = msg.includes("verify") || msg.includes("domain") || msg.includes("onboarding");
      return NextResponse.json(
        {
          error: isRestriction
            ? "En mode test, Resend restreint l'envoi aux adresses vérifiées. Configurez RESEND_TEST_RECIPIENT."
            : "Échec de l'envoi de la candidature.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Candidature transmise avec succès !" });
  } catch (error) {
    console.error("[Send Application Route Error]", error);
    return NextResponse.json({ error: "Échec de l'envoi de la candidature." }, { status: 500 });
  }
}
