import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SENDER_EMAIL = "contact@ffacilite.com";
const SENDER_NAME = "Facilité - Support & Securité";

function buildInformativeVerificationEmail({ fullName, email, confirmationLink }) {
  return {
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: email,
    subject: "Bienvenue sur Facilité — Vérification de votre adresse e-mail",
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAF6F1; color: #1F2937; margin: 0; padding: 20px; }
          .container { max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 32px; border: 1px solid #E5E7EB; }
          .header { text-align: center; margin-bottom: 24px; }
          .btn { display: inline-block; background-color: #10E688; color: #111827; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 9999px; margin-top: 16px; }
          .footer { font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #111827; margin: 0;">Bienvenue sur Facilité !</h2>
          </div>
          <p>Bonjour ${fullName || "cher membre"},</p>
          <p>Votre compte a été créé avec succès. Vous pouvez dès à présent utiliser toutes les fonctionnalités de la plateforme sans aucune restriction.</p>
          <p>Pour des raisons de sécurité et afin de pouvoir récupérer votre compte si besoin, nous vous invitons à confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
          <div style="text-align: center;">
            <a href="${confirmationLink || '#'}" class="btn">Confirmer mon e-mail</a>
          </div>
          <p style="margin-top: 24px; font-size: 13px; color: #6B7280;">Si vous n'êtes pas à l'origine de cette création de compte, vous pouvez ignorer cet e-mail.</p>
          <div class="footer">
            <p>© 2026 Facilité (ffacilite.com). Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token !== "execute-emails-33-now") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return NextResponse.json({ error: "Missing environment variables" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resend = new Resend(resendApiKey);

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (usersError) {
    return NextResponse.json({ error: "Error fetching users", details: usersError }, { status: 500 });
  }

  const users = usersData.users;
  const unconfirmedUsers = users.filter((u) => !u.email_confirmed_at && u.email);
  
  const results = [];

  for (const user of unconfirmedUsers) {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: user.email,
    });

    if (linkError) {
      results.push({ email: user.email, status: "error_link", error: linkError.message });
      continue;
    }

    const emailPayload = buildInformativeVerificationEmail({
      fullName: user.user_metadata?.full_name || user.user_metadata?.first_name || "",
      email: user.email,
      confirmationLink: linkData.properties.action_link,
    });

    try {
      const { data, error } = await resend.emails.send(emailPayload);
      if (error) {
         results.push({ email: user.email, status: "error_resend", error });
      } else {
         results.push({ email: user.email, status: "success", id: data?.id });
      }
    } catch (err) {
      results.push({ email: user.email, status: "error_exception", error: String(err) });
    }
  }

  return NextResponse.json({
    total_found: users.length,
    total_unconfirmed: unconfirmedUsers.length,
    results
  });
}
