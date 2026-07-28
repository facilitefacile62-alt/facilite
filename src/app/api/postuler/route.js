import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

export async function POST(req) {
  try {
    // 1. Authentification & Rate Limiting
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    // 2. Parse FormData
    const formData = await req.formData();
    const jobId = formData.get("jobId");
    const jobTitle = formData.get("jobTitle");
    const company = formData.get("company");
    const fullName = formData.get("fullName");
    const email = formData.get("email");
    const coverLetter = formData.get("coverLetter") || "";
    const existingCvId = formData.get("existingCvId");
    const cvFile = formData.get("cvFile");
    const recruiterEmail = formData.get("recruiterEmail") || "contact@facilite.sn";

    // Validation des données requises
    if (!jobId || !jobTitle || !company || !fullName || !email) {
      return NextResponse.json(
        { error: "Veuillez remplir tous les champs obligatoires." },
        { status: 400 }
      );
    }

    if (!existingCvId && !cvFile) {
      return NextResponse.json(
        { error: "Veuillez fournir un CV (sélectionné ou importé)." },
        { status: 400 }
      );
    }

    // 3. Instancier le client Supabase avec le token de l'utilisateur connecté
    // afin que toutes les opérations (storage et db) respectent les politiques RLS.
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    let cvUrl = "";
    let cvName = "";

    if (cvFile) {
      // Cas A : L'utilisateur a uploadé un nouveau fichier CV
      const buffer = Buffer.from(await cvFile.arrayBuffer());

      // Validation de la taille, type MIME déclaré, et sniffing binaire des magic bytes
      const check = validateUploadedFile(buffer, cvFile.type, cvFile.size);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: check.status });
      }

      // Upload dans le stockage privé (bucket 'resumes') sous {user_id}/cvs/{timestamp}_{name}
      const timestamp = Date.now();
      const storagePath = `${user.id}/cvs/${timestamp}_${cvFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(storagePath, buffer, {
          contentType: cvFile.type,
          duplex: "half",
        });

      if (uploadError) {
        console.error("Erreur upload CV:", uploadError.message);
        return NextResponse.json(
          { error: "Échec de l'importation du CV dans le stockage." },
          { status: 500 }
        );
      }

      // Enregistrement dans la table public.resumes pour que le CV soit disponible dans son profil
      const { data: resumeRecord, error: resumeError } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          title: cvFile.name,
          type: "imported",
          file_url: storagePath,
          ats_score: 95,
        })
        .select()
        .single();

      if (resumeError) {
        console.error("Erreur création entrée resume:", resumeError.message);
        // On ne bloque pas si la ligne de la table échoue mais le stockage a réussi
      }

      cvUrl = storagePath;
      cvName = cvFile.name;
    } else {
      // Cas B : L'utilisateur a sélectionné un CV existant
      const { data: resumeRecord, error: resumeFetchError } = await supabase
        .from("resumes")
        .select("*")
        .eq("id", existingCvId)
        .eq("user_id", user.id)
        .single();

      if (resumeFetchError || !resumeRecord) {
        return NextResponse.json(
          { error: "Le CV sélectionné est introuvable ou vous n'avez pas l'autorisation d'y accéder." },
          { status: 404 }
        );
      }

      cvUrl = resumeRecord.file_url;
      cvName = resumeRecord.title;
    }

    // 4. Enregistrer la candidature en base dans la table public.candidatures
    const { data: candidature, error: candidatureError } = await supabase
      .from("candidatures")
      .insert({
        user_id: user.id,
        job_id: parseInt(jobId, 10),
        job_title: jobTitle,
        company: company,
        full_name: fullName,
        email: email,
        cv_url: cvUrl,
        cover_letter: coverLetter,
        status: "pending",
      })
      .select()
      .single();

    if (candidatureError) {
      console.error("Erreur enregistrement candidature:", candidatureError.message);
      return NextResponse.json(
        { error: "Impossible d'enregistrer la candidature." },
        { status: 500 }
      );
    }

    // 5. Récupérer le fichier CV depuis le stockage privé pour le joindre à l'e-mail
    const { data: fileData, error: fileDownloadError } = await supabase.storage
      .from("resumes")
      .download(cvUrl);

    let fileBuffer = null;
    if (!fileDownloadError && fileData) {
      fileBuffer = Buffer.from(await fileData.arrayBuffer());
    } else {
      console.error("Erreur de récupération du CV pour l'email:", fileDownloadError?.message);
    }

    // 6. Envoi des 2 e-mails via Resend
    let recruiterRes = { data: null, error: null };
    if (fileBuffer) {
      recruiterRes = await resend.emails.send({
        from: "Facilite Recrutement <onboarding@resend.dev>",
        to: recruiterEmail,
        subject: `[Facilite] Nouvelle candidature : ${fullName} - ${jobTitle} chez ${company}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <h2 style="color: #10E688; border-bottom: 2px solid #eee; padding-bottom: 10px;">Nouvelle candidature reçue</h2>
            <p>Un candidat vient de postuler à une offre depuis la plateforme Facilite.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; width: 150px;">Poste :</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${jobTitle} (${company})</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Candidat :</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">E-mail de contact :</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><a href="mailto:${email}">${email}</a></td>
              </tr>
            </table>
            <p><strong>Message d'accompagnement :</strong></p>
            <div style="background-color: #f9f9f9; border-left: 4px solid #10E688; padding: 15px; margin: 15px 0; font-style: italic;">
              ${coverLetter ? coverLetter.replace(/\n/g, "<br/>") : "Aucun message d'accompagnement fourni."}
            </div>
            <p>Le CV du candidat est attaché en pièce jointe à cet e-mail.</p>
          </div>
        `,
        attachments: [
          {
            filename: cvName,
            content: fileBuffer,
          },
        ],
      });

      console.log("Resend response (recruiter):", recruiterRes.data, recruiterRes.error);
      if (recruiterRes.error) {
        return NextResponse.json({ error: recruiterRes.error }, { status: 500 });
      }
    }

    const candidateRes = await resend.emails.send({
      from: "Facilite <onboarding@resend.dev>",
      to: email,
      subject: `Confirmation de votre candidature : ${jobTitle} chez ${company}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #10E688;">Bonjour ${fullName},</h2>
          <p>Nous vous confirmons que votre candidature pour le poste de <strong>${jobTitle}</strong> chez <strong>${company}</strong> a bien été transmise avec succès.</p>
          <p>Le recruteur étudiera votre profil avec la plus grande attention. Vous serez recontacté(e) directement par e-mail si votre candidature est retenue.</p>
          <br/>
          <p style="border-top: 1px solid #eee; padding-top: 15px; font-size: 12px; color: #777;">
            Cordialement,<br/>
            L'équipe de recrutement Facilite
          </p>
        </div>
      `,
    });

    console.log("Resend response (candidate):", candidateRes.data, candidateRes.error);
    if (candidateRes.error) {
      return NextResponse.json({ error: candidateRes.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, candidature });
  } catch (error) {
    console.error("[Quick Apply API Error]", error);
    return NextResponse.json(
      { error: "Une erreur interne est survenue lors du traitement de la candidature." },
      { status: 500 }
    );
  }
}
