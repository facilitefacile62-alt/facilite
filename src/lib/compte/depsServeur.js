import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { limiter } from "@/lib/limiteur";
import * as codes from "./codes.js";
import { PHRASE_ALERTE, SUJETS_ALERTE } from "./messages.js";

// Dépendances RÉELLES du service « Informations du compte » (base, e-mail, SMS, limites). Les tests passent leurs propres doublures au même service.

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");
const expediteur = () => process.env.RESEND_FROM_CANDIDATE || (process.env.NODE_ENV === "production" ? "Facilite <noreply@ffacilite.com>" : "Facilite <onboarding@resend.dev>");

const FLAG_TELEPHONE = "feat_compte_telephone";

/** Drapeau « téléphone » : une ligne absente ou illisible = FERMÉ (jamais ouvert par défaut). */
async function telephoneActif(admin) {
  try {
    const { data } = await admin.from("feature_flags").select("enabled").eq("id", FLAG_TELEPHONE).maybeSingle();
    return data?.enabled === true;
  } catch {
    return false;
  }
}

async function envoyerEmail(destination, sujet, html) {
  try {
    const { error } = await resend.emails.send({ from: expediteur(), to: destination, subject: sujet, html });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

async function envoyerSms(destination, texte) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const jeton = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const de = process.env.TWILIO_SMS_FROM;
  if (!sid || !jeton || !(service || de)) return { ok: false };
  try {
    const { default: twilio } = await import("twilio");
    await twilio(sid, jeton).messages.create({ to: destination, body: texte, ...(service ? { messagingServiceSid: service } : { from: de }) });
    return { ok: true };
  } catch (erreur) {
    console.error("[Compte] SMS non envoyé :", erreur?.message);
    return { ok: false };
  }
}

const TITRES_CODE = { preuve: "Votre code de vérification Facilité", nouvelle_valeur: "Confirmez votre nouvelle information Facilité" };

export function creerDependances() {
  const admin = getSupabaseAdmin();
  return {
    admin,
    codes,
    maintenant: () => Date.now(),
    limiter,
    telephoneActif: () => telephoneActif(admin),
    valeurPrise: async (canal, valeur, userId) => {
      const { data, error } = await admin.rpc("compte_valeur_prise", { p_canal: canal, p_valeur: valeur, p_user_id: userId });
      // En cas de doute, on dit « pris » : jamais d'accord par défaut.
      return error ? true : data !== false;
    },
    dissocierServeur: async (userId, canal) => {
      const { error } = await admin.rpc("compte_dissocier_methode", { p_user_id: userId, p_canal: canal });
      return { error };
    },
    fermerAutresSessions: async (jetonAcces) => {
      if (!jetonAcces) return { ok: false };
      const { error } = await admin.auth.admin.signOut(jetonAcces, "others");
      return { ok: !error };
    },
    envoyerCode: async ({ canal, destination, code, but }) => {
      const titre = TITRES_CODE[but] ?? TITRES_CODE.preuve;
      if (canal === "telephone") return envoyerSms(destination, `Facilité : votre code est ${code}. Il est valable 10 minutes. Ne le donnez à personne.`);
      return envoyerEmail(destination, titre, `<p>Votre code : <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Il est valable 10 minutes. Ne le donnez à personne.</p><p>${PHRASE_ALERTE}</p>`);
    },
    envoyerAlerte: async ({ destination, action, canal }) => {
      const sujet = SUJETS_ALERTE[`${action}_${canal}`] ?? "Votre compte Facilité a changé";
      const support = process.env.SUPPORT_WHATSAPP_URL || "https://wa.me/221771400832";
      return envoyerEmail(destination, sujet, `<p>${sujet}.</p><p>${PHRASE_ALERTE}</p><p><a href="${support}">Contacter le support sur WhatsApp</a></p>`);
    },
  };
}
