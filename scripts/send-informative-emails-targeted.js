const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");
require("dotenv").config({ path: ".env.local" });

const SENDER_EMAIL = "contact@ffacilite.com";
const SENDER_NAME = "Facilité - Support & Securité";

// Les 7 comptes réels identifiés (Partie 6 A1, chantier du 2026-08-06) :
// email_confirmed_at est renseigné pour chacun mais par auto_confirm_user()
// au moment de la création (delta < 1s avec created_at), jamais par un vrai
// clic — send-informative-emails.js (filtre email_confirmed_at IS NULL) les
// ignore tous à tort. Ciblage explicite par id plutôt que par ce filtre.
const TARGET_USER_IDS = [
  "eda26422-98b2-436f-b3b6-8beaaebf1188",
  "58b1e288-ed59-4cf5-9cc0-471431ecdddb",
  "98f2b9a0-8ecb-4db0-bc94-f414f7c331a6",
  "2a4bc6d4-b81b-4fce-9ecf-4a1450df4758",
  "2ace28f9-9d02-4a49-a0f3-5cca8acb7f32",
  "70cd5571-de00-49b0-b94b-069472228fc0",
  "4584044b-4254-45ff-90dd-5ae7764260cd",
];

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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    console.error("❌ Les variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et RESEND_API_KEY sont requises.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const resend = new Resend(resendApiKey);

  console.log(`🔍 Envoi ciblé à ${TARGET_USER_IDS.length} comptes identifiés (Partie 6 A1)...`);

  for (const userId of TARGET_USER_IDS) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      console.error(`❌ Compte introuvable ou sans email (${userId}) :`, userError?.message);
      continue;
    }
    const user = userData.user;
    console.log(`📧 Préparation de l'email pour ${user.email}...`);

    // type: "signup" échoue pour un compte déjà enregistré ("A user with
    // this email address has already been registered") — attendu, ce type
    // sert une inscription EN COURS, pas une reconfirmation après coup.
    // "magiclink" atteint le même objectif réel (prouver l'accès à la boîte
    // mail) sans ce blocage — cliquer connecte directement, ce qui démontre
    // la possession du compte au moins aussi bien qu'une confirmation.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

    if (linkError) {
      console.error(`❌ Erreur de génération du lien pour ${user.email} :`, linkError.message);
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
        console.error(`❌ Erreur Resend pour ${user.email} :`, error);
      } else {
        console.log(`✅ Email envoyé avec succès à ${user.email} (ID: ${data?.id})`);
      }
    } catch (err) {
      console.error(`❌ Exception lors de l'envoi à ${user.email} :`, err);
    }
  }

  console.log("🎉 Terminé !");
}

main();
