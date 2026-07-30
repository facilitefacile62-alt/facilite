import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SendApplicationPayloadSchema, validateUploadedFile } from "@/lib/validation";
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

    const formData = await req.formData();
    const recipientEmail = String(formData.get("recipientEmail") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const existingCvId = formData.get("existingCvId");
    const cvFile = formData.get("cvFile");

    const emailCheck = SendApplicationPayloadSchema.shape.recipientEmail.safeParse(recipientEmail);
    if (!emailCheck.success) {
      return NextResponse.json({ error: "Adresse e-mail destinataire invalide." }, { status: 400 });
    }

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

    const candidateName = profile.full_name || "Un candidat Facilite";
    const candidateEmail = profile.email || user.email;

    // --- Résolution du CV à joindre : nouveau fichier > CV existant choisi
    // > CV principal du profil (comportement historique, conservé en repli). ---
    let fileBuffer = null;
    let cvFileName = "CV.pdf";

    if (cvFile && typeof cvFile !== "string") {
      const buffer = Buffer.from(await cvFile.arrayBuffer());
      const check = validateUploadedFile(buffer, cvFile.type, cvFile.size);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: check.status });
      }

      const storagePath = `${user.id}/cvs/${Date.now()}_${cvFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(storagePath, buffer, { contentType: cvFile.type, duplex: "half" });

      if (uploadError) {
        console.error("Erreur upload CV send-application:", uploadError.message);
        return NextResponse.json({ error: "Échec de l'importation du CV." }, { status: 500 });
      }

      // Le nouveau CV rejoint la bibliothèque du candidat, comme sur
      // /api/postuler : disponible pour ses prochaines candidatures 1-clic.
      const { error: resumeInsertErr } = await supabase.from("resumes").insert({
        user_id: user.id,
        title: cvFile.name,
        type: "imported",
        file_url: storagePath,
        ats_score: 95,
      });
      if (resumeInsertErr) {
        console.error("Erreur enregistrement resume send-application:", resumeInsertErr.message);
      }

      fileBuffer = buffer;
      cvFileName = cvFile.name;
    } else if (existingCvId) {
      const { data: resumeRecord, error: resumeErr } = await supabase
        .from("resumes")
        .select("file_url, title")
        .eq("id", existingCvId)
        .eq("user_id", user.id)
        .single();

      if (resumeErr || !resumeRecord) {
        return NextResponse.json({ error: "Le CV sélectionné est introuvable." }, { status: 404 });
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("resumes")
        .download(resumeRecord.file_url);

      if (downloadError || !fileData) {
        console.error("Erreur téléchargement CV sélectionné:", downloadError?.message);
        return NextResponse.json({ error: "Impossible de récupérer le CV sélectionné." }, { status: 500 });
      }

      fileBuffer = Buffer.from(await fileData.arrayBuffer());
      cvFileName = resumeRecord.title || "CV.pdf";
    } else if (profile.cv_url) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("resumes")
        .download(profile.cv_url);

      if (downloadError || !fileData) {
        console.error("Erreur téléchargement CV pour l'envoi:", downloadError?.message);
        return NextResponse.json({ error: "Impossible de récupérer votre CV depuis le stockage." }, { status: 500 });
      }

      fileBuffer = Buffer.from(await fileData.arrayBuffer());
      cvFileName = profile.cv_name || "CV.pdf";
    } else {
      return NextResponse.json(
        { error: "Sélectionnez un CV existant ou importez-en un pour postuler en 1 clic." },
        { status: 400 }
      );
    }

    const finalSubject = subject || `Candidature de ${candidateName} via Facilite`;
    const escapedMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const messageHtml = message
      ? `<p style="font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapedMessage}</p>`
      : `<p style="font-size: 14px; color: #374151; line-height: 1.6;"><strong>${candidateName}</strong> (${candidateEmail}) vous adresse sa candidature en réponse à votre annonce de recrutement.</p>`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #059669; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          🚀 Nouvelle Candidature via Facilite
        </h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">Bonjour,</p>
        ${messageHtml}
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
      subject: finalSubject,
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
