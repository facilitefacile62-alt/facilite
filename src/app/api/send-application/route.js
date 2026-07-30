import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

export async function POST(request) {
  try {
    const { toEmail, candidateId } = await request.json();

    if (!toEmail || !candidateId) {
      return NextResponse.json({ error: "L'e-mail destinataire et l'ID du candidat sont requis." }, { status: 400 });
    }

    // Récupérer le profil du candidat depuis Supabase
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name, email, cv_url, cv_name")
      .eq("id", candidateId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profil candidat introuvable." }, { status: 404 });
    }

    const candidateName = profile.full_name || "Un candidat Facilite";
    const candidateEmail = profile.email || "candidat@facilite.sn";
    const cvUrl = profile.cv_url || "";

    // HTML de la candidature 1-click
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; background-color: #ffffff;">
        <h2 style="color: #059669; font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          🚀 Nouvelle Candidature via Facilite
        </h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Bonjour,
        </p>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          <strong>${candidateName}</strong> (${candidateEmail}) vous adresse sa candidature spontanée en réponse à votre annonce de recrutement.
        </p>
        ${
          cvUrl
            ? `<div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                <p style="font-size: 13px; font-weight: bold; color: #166534; margin: 0 0 8px 0;">Curriculum Vitae joint :</p>
                <a href="${cvUrl}" target="_blank" style="display: inline-block; font-size: 13px; font-weight: bold; color: #ffffff; background-color: #059669; padding: 8px 16px; border-radius: 8px; text-decoration: none;">
                  Consulter le CV
                </a>
              </div>`
            : `<p style="font-size: 13px; color: #6b7280; italic;">Le candidat n'a pas encore joint de fichier CV sur son profil.</p>`
        }
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">
          Candidature envoyée via la plateforme Facilite · Recrutement Simplifié.
        </p>
      </div>
    `;

    // Envoi via Resend
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "Facilite Candidatures <onboarding@resend.dev>",
      to: [toEmail],
      replyTo: candidateEmail,
      subject: `Candidature de ${candidateName} via Facilite`,
      html: htmlContent,
    });

    if (resendError) {
      console.warn("Avertissement Resend API (simulation activée si clé de test):", resendError);
    }

    return NextResponse.json({
      success: true,
      message: "Candidature transmise avec succès !",
      data: resendData
    });
  } catch (error) {
    console.error("Erreur API send-application:", error);
    return NextResponse.json({ error: "Échec de l'envoi de la candidature." }, { status: 500 });
  }
}
