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
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // --- FILTRES D'ÉLIGIBILITÉ STRICTS ---
    // jobId sert deux flux distincts, jamais mélangés :
    //  - un entier (candidatures.job_id, colonne héritée) pour le "postuler
    //    rapide" historique vers les offres statiques de la page d'accueil ;
    //  - un UUID (job_offers.id) pour une vraie offre publiée par un
    //    recruteur (page /offres), avec contrôle d'éligibilité.
    // Les confondre est ce qui cassait la vérification précédemment :
    // interroger job_offers avec un petit entier ne renvoie jamais de ligne,
    // et écrire un UUID dans candidatures.job_id (INT) est impossible.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const jobOfferId = UUID_RE.test(String(jobId)) ? String(jobId) : null;

    let cvMatchScore = null;
    let offerRecruiterId = null;

    if (jobOfferId) {
      // A. Récupérer l'offre pour connaître le diplôme requis et la description
      const { data: offerData, error: offerErr } = await supabase
        .from("job_offers")
        .select("min_education_level, description, recruiter_id")
        .eq("id", jobOfferId)
        .single();

      if (offerErr || !offerData) {
        return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
      }
      offerRecruiterId = offerData.recruiter_id;

      // B. Récupérer le profil du candidat pour vérifier son niveau d'études et ses compétences
      const { data: candidateProfile } = await supabase
        .from("profiles")
        .select("education_level, skills, bio")
        .eq("id", user.id)
        .single();

      const requiredEducation = offerData.min_education_level || "Aucun";
      const candidateEducation = candidateProfile?.education_level || "Aucun";

      const { isEducationEligible, calculateCvMatchScore: computeScore } = await import("@/lib/eligibility");

      // 1. Vérification du niveau d'études
      if (!isEducationEligible(candidateEducation, requiredEducation)) {
        return NextResponse.json(
          { error: "Votre niveau d'étude est inférieur au niveau requis." },
          { status: 403 }
        );
      }

      // 2. Vérification du Match Score CV (doit être >= 50%)
      cvMatchScore = computeScore(
        candidateProfile?.skills || [],
        candidateProfile?.bio || "",
        offerData.description || ""
      );

      if (cvMatchScore < 50) {
        return NextResponse.json(
          { error: "Votre CV n'est pas suffisamment adapté à cette offre." },
          { status: 403 }
        );
      }
    }

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
    // job_id (entier, flux historique) et job_offer_id (UUID, vraie offre
    // recruteur) sont mutuellement exclusifs — jamais les deux à la fois.
    const { data: candidature, error: candidatureError } = await supabase
      .from("candidatures")
      .insert({
        user_id: user.id,
        job_id: jobOfferId ? null : parseInt(jobId, 10),
        job_offer_id: jobOfferId,
        job_title: jobTitle,
        company: company,
        full_name: fullName,
        email: email,
        cv_url: cvUrl,
        cover_letter: coverLetter,
        cv_match_score: cvMatchScore,
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

    // Auto-création d'une conversation séparée de type 'OFFRE' dans Supabase,
    // uniquement pour une vraie offre recruteur (le flux historique n'a pas
    // de destinataire interne connu — il repose uniquement sur l'e-mail).
    if (offerRecruiterId) {
      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: offerRecruiterId,
        content: `Candidature envoyée pour le poste : ${jobTitle} (${company}) — Score de correspondance CV : ${cvMatchScore}%`,
        type_discussion: "OFFRE",
        job_offer_id: jobOfferId,
        created_at: new Date().toISOString(),
      });
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
    const isProd = process.env.NODE_ENV === "production";
    const recruiterSender = process.env.RESEND_FROM_RECRUITER || (isProd ? "Facilite Recrutement <recrutement@ffacilite.com>" : "Facilite Recrutement <onboarding@resend.dev>");
    const candidateSender = process.env.RESEND_FROM_CANDIDATE || (isProd ? "Facilite <noreply@ffacilite.com>" : "Facilite <onboarding@resend.dev>");
    
    // On est en mode onboarding si l'un des expéditeurs contient onboarding@resend.dev
    const isResendOnboarding = recruiterSender.includes("onboarding@resend.dev") || candidateSender.includes("onboarding@resend.dev");

    const testRecipient = isResendOnboarding ? (process.env.RESEND_TEST_RECIPIENT || process.env.RESEND_VERIFIED_EMAIL || null) : null;
    const finalRecruiterEmail = testRecipient || recruiterEmail;
    const finalCandidateEmail = testRecipient || email;

    const handleResendError = (err) => {
      if (err) {
        const msg = err.message || "";
        const isRestriction = 
          msg.includes("verify") || 
          msg.includes("domain") || 
          msg.includes("restriction") || 
          msg.includes("onboarding") || 
          (err.name && err.name.includes("validation_error"));
        
        if (isRestriction) {
          return {
            name: "resend_restriction",
            message: "En mode test (onboarding@resend.dev), Resend restreint l'envoi d'e-mails aux adresses de test vérifiées de votre compte. Veuillez configurer la variable d'environnement RESEND_TEST_RECIPIENT avec votre adresse vérifiée."
          };
        }
      }
      return err;
    };

    if (fileBuffer) {
      const { data, error } = await resend.emails.send({
        from: recruiterSender,
        to: finalRecruiterEmail,
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

      console.log("Resend response:", data, error);
      if (error) {
        return NextResponse.json({ error: handleResendError(error) }, { status: 500 });
      }
    }

    const { data, error } = await resend.emails.send({
      from: candidateSender,
      to: finalCandidateEmail,
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

    console.log("Resend response:", data, error);
    if (error) {
      return NextResponse.json({ error: handleResendError(error) }, { status: 500 });
    }

    // 7. Enregistrement automatique de l'e-mail dans la messagerie interne Supabase (messages)
    // sender_id référence auth.users(id) (NOT NULL) : "recruiter-support" n'est
    // pas un UUID valide et viole systématiquement la contrainte de clé
    // étrangère (l'insert échouait silencieusement, avalé par le catch
    // ci-dessous). On utilise le recruteur propriétaire de l'offre quand il
    // est connu (flux job_offers), sinon l'utilisateur connecté lui-même
    // (flux historique sans recruteur identifié) pour garantir un UUID valide.
    try {
      const emailContentText = `📧 [E-mail de confirmation] Candidature transmise avec succès pour le poste de ${jobTitle} chez ${company}.\n\nLe recruteur (${finalRecruiterEmail}) étudiera votre profil avec attention.`;
      const { error: confirmMsgError } = await supabase.from("messages").insert({
        sender_id: offerRecruiterId || user.id,
        receiver_id: user.id,
        content: emailContentText,
        type_discussion: "OFFRE",
        job_offer_id: jobOfferId || null,
        created_at: new Date().toISOString()
      });
      if (confirmMsgError) {
        console.error("Erreur d'enregistrement du message de confirmation:", confirmMsgError.message);
      }
    } catch (msgErr) {
      console.error("Erreur de synchronisation de l'e-mail dans la messagerie Supabase:", msgErr?.message);
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
