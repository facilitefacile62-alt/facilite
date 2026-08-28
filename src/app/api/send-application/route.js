import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { SendApplicationPayloadSchema, validateUploadedFile } from "@/lib/validation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { extractAndEmbedResume } from "@/lib/resumeEmbedding";

export const runtime = "nodejs";
// Même contrainte que /api/process-resume : l'extraction du CV importé ici
// peut basculer sur l'OCR, potentiellement lent.
export const maxDuration = 55;

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

export async function POST(req) {
  try {
    // Authentification + limite de débit : un envoi d'e-mail est une action
    // ayant un coût (Resend) et un potentiel d'abus (spam) — jamais anonyme.
    const { user, error: authError } = await requireUser(req, { logDenials: true });
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
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

    // --- Résolution des documents à joindre (CV, Lettre de motivation, Diplômes) ---
    const attachmentsList = [];

    // 1. Documents existants sélectionnés dans le compte du candidat
    const existingCvIds = [
      ...formData.getAll("existingCvIds"),
      ...(formData.get("existingCvId") ? [formData.get("existingCvId")] : []),
    ].filter(Boolean);

    if (existingCvIds.length > 0) {
      // Dédupliquer les IDs
      const uniqueIds = [...new Set(existingCvIds)];
      for (const docId of uniqueIds) {
        const { data: resumeRecord, error: resumeErr } = await supabase
          .from("resumes")
          .select("file_url, title")
          .eq("id", docId)
          .eq("user_id", user.id)
          .single();

        if (resumeRecord && !resumeErr) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("resumes")
            .download(resumeRecord.file_url);

          if (fileData && !downloadError) {
            const buf = Buffer.from(await fileData.arrayBuffer());
            attachmentsList.push({
              filename: resumeRecord.title || "Document.pdf",
              content: buf,
            });
          }
        }
      }
    }

    // 2. Nouveaux fichiers téléversés
    const uploadedFiles = [
      ...(cvFile && typeof cvFile !== "string" ? [cvFile] : []),
      ...formData.getAll("newFiles"),
      ...formData.getAll("additionalFiles"),
    ].filter((f) => f && typeof f !== "string");

    for (const file of uploadedFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const check = validateUploadedFile(buffer, file.type, file.size);
      if (check.valid) {
        attachmentsList.push({
          filename: file.name || "Document.pdf",
          content: buffer,
        });

        // Enregistrer automatiquement dans les resumes du candidat pour réutilisation future
        try {
          const storagePath = `${user.id}/cvs/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("resumes")
            .upload(storagePath, buffer, { contentType: file.type, duplex: "half" });

          if (!uploadError) {
            await supabase.from("resumes").insert({
              user_id: user.id,
              title: file.name,
              type: "imported",
              file_url: storagePath,
              ats_score: 95,
            });
          }
        } catch (saveErr) {
          console.warn("Avertissement enregistrement document secondaire:", saveErr?.message);
        }
      }
    }

    // Repli : si aucun document n'a pu être joint et que le profil a un cv_url
    if (attachmentsList.length === 0 && profile.cv_url) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("resumes")
        .download(profile.cv_url);

      if (fileData && !downloadError) {
        attachmentsList.push({
          filename: profile.cv_name || "CV.pdf",
          content: Buffer.from(await fileData.arrayBuffer()),
        });
      }
    }

    if (attachmentsList.length === 0) {
      return NextResponse.json(
        { error: "Veuillez joindre au moins un document (CV ou lettre) pour postuler." },
        { status: 400 }
      );
    }

    const { error: resendError } = await resend.emails.send({
      from: sender,
      to: finalRecipient,
      replyTo: candidateEmail,
      subject: finalSubject,
      html: htmlContent,
      attachments: attachmentsList,
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
