import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const corpsSchema = z.object({ storeId: z.string().uuid() });
const DUREE_CODE_MINUTES = 10;
const MAX_PAR_JOUR = 5;
const ATTENTE_SECONDES = 60;

// Même règle que public.normaliser_numero() en base : les 9 derniers chiffres (771400832 = +221 77 140 08 32).
const normaliser = (n) => {
  const chiffres = String(n ?? "").replace(/\D/g, "");
  return chiffres.length >= 9 ? chiffres.slice(-9) : chiffres;
};

/**
 * Envoie, SUR WHATSAPP, un code à 6 chiffres au numéro WhatsApp de la boutique de l'appelant ; la saisie du code
 * (confirmer_whatsapp_boutique, côté base) confirme ensuite ce numéro. Le code n'est jamais renvoyé au client ni écrit en clair :
 * seule son empreinte SHA-256 est conservée (10 minutes, 5 essais). Au plus 1 envoi par minute et 5 par jour et par boutique.
 *
 * Nécessite un compte Twilio WhatsApp : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (numéro expéditeur, chiffres) et, pour
 * écrire à quelqu'un hors d'une conversation ouverte, TWILIO_WHATSAPP_CONTENT_SID (modèle approuvé avec un paramètre {{1}} = le code).
 * Sans cette configuration, la route répond 503 et rien n'est enregistré.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const jeton = process.env.TWILIO_AUTH_TOKEN;
    const expediteur = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !jeton || !expediteur) {
      return NextResponse.json({ error: "La confirmation par WhatsApp n'est pas encore disponible." }, { status: 503 });
    }

    const corps = corpsSchema.safeParse(await req.json().catch(() => ({})));
    if (!corps.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { storeId } = corps.data;

    const admin = getSupabaseAdmin();
    // Propriétaire contrôlé à la main : le rôle serveur ignore les policies.
    const { data: boutique, error: erreurBoutique } = await admin
      .from("marketplace_stores")
      .select("id, telephone_whatsapp")
      .eq("id", storeId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (erreurBoutique) return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
    if (!boutique) return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });

    const numero = normaliser(boutique.telephone_whatsapp);
    if (numero.length < 9) return NextResponse.json({ error: "Enregistrez d'abord un numéro WhatsApp valide pour la boutique." }, { status: 400 });

    const depuis = (ms) => new Date(Date.now() - ms).toISOString();
    const [{ count: recents }, { count: duJour }] = await Promise.all([
      admin.from("whatsapp_confirmations").select("id", { count: "exact", head: true }).eq("store_id", storeId).gt("created_at", depuis(ATTENTE_SECONDES * 1000)),
      admin.from("whatsapp_confirmations").select("id", { count: "exact", head: true }).eq("store_id", storeId).gt("created_at", depuis(24 * 3_600_000)),
    ]);
    if ((recents ?? 0) > 0) return NextResponse.json({ error: "Un code vient d'être envoyé. Patientez une minute avant d'en demander un autre." }, { status: 429 });
    if ((duJour ?? 0) >= MAX_PAR_JOUR) return NextResponse.json({ error: "Trop de codes demandés aujourd'hui. Réessayez demain." }, { status: 429 });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const empreinte = crypto.createHash("sha256").update(`${code}:${storeId}`).digest("hex");
    const { data: ligne, error: erreurInsertion } = await admin
      .from("whatsapp_confirmations")
      .insert({ store_id: storeId, numero, code_hash: empreinte, expire_le: new Date(Date.now() + DUREE_CODE_MINUTES * 60_000).toISOString() })
      .select("id")
      .single();
    if (erreurInsertion) return NextResponse.json({ error: "Envoi impossible pour le moment." }, { status: 500 });

    const chiffres = String(boutique.telephone_whatsapp).replace(/\D/g, "");
    const complet = chiffres.length === 9 ? `221${chiffres}` : chiffres;
    const donnees = new URLSearchParams({ To: `whatsapp:+${complet}`, From: `whatsapp:+${expediteur.replace(/\D/g, "")}` });
    if (process.env.TWILIO_WHATSAPP_CONTENT_SID) {
      donnees.set("ContentSid", process.env.TWILIO_WHATSAPP_CONTENT_SID);
      donnees.set("ContentVariables", JSON.stringify({ 1: code }));
    } else {
      donnees.set("Body", `Facilité : votre code de confirmation est ${code}. Il expire dans ${DUREE_CODE_MINUTES} minutes. Ne le partagez avec personne.`);
    }

    const reponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${jeton}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: donnees,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!reponse || !reponse.ok) {
      // Échec d'envoi : le code n'a servi à rien, on le retire pour ne pas bloquer une nouvelle demande.
      await admin.from("whatsapp_confirmations").delete().eq("id", ligne.id);
      console.error("[WhatsApp Code] Envoi Twilio refusé :", reponse?.status ?? "réseau");
      return NextResponse.json({ error: "Le message WhatsApp n'a pas pu être envoyé. Vérifiez le numéro et réessayez." }, { status: 502 });
    }

    return NextResponse.json({ envoye: true, expireDansMinutes: DUREE_CODE_MINUTES });
  } catch (err) {
    console.error("[WhatsApp Code Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
