/**
 * Création de compte, côté serveur, protégée par Vercel BotID.
 *
 * Pourquoi cette route existe. /register appelait supabase.auth.signUp()
 * directement depuis le navigateur, vers *.supabase.co. Aucune requête ne
 * traversait ffacilite.com — il n'existait donc aucun endroit où exécuter
 * une vérification anti-robot. BotID protège des chemins de l'application :
 * le navigateur attache les en-têtes de challenge aux requêtes vers ces
 * chemins (déclarés dans instrumentation-client.js), et checkBotId() les
 * valide ici. Sans cette route, BotID n'aurait jamais rien vérifié.
 *
 * Périmètre volontairement limité à l'inscription. La connexion reste
 * cliente : le navigateur y a besoin des jetons de session, ce qui
 * imposerait de les renvoyer puis de les réinjecter — un changement bien
 * plus risqué sur un flux qui a déjà cassé deux fois le 2026-08-28. Et
 * bloquer les faux comptes se joue à l'inscription, pas à la connexion.
 *
 * Aucune session n'est établie ici : l'application exige la confirmation
 * par e-mail, signUp() se contente donc de créer le compte et d'envoyer le
 * message. Le profil, lui, est créé par le déclencheur on_auth_user_created
 * (handle_new_user) à partir de raw_user_meta_data — c'est pourquoi
 * full_name est transmis dans options.data et non écrit à la main.
 */
import { checkBotId } from "botid/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// Node et non Edge : le SDK Supabase et botid/server sont utilisés ici dans
// leur forme serveur classique, et cette route n'a aucun besoin de latence
// au plus près du visiteur.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bornage volontaire : une inscription qui traîne doit échouer proprement
// plutôt que de consommer les 60 s par défaut de la fonction serverless —
// même raisonnement que le REDIS_TIMEOUT_MS d'apiAuth.js après le 504 du
// 2026-08-28.
export const maxDuration = 15;

export async function POST(request) {
  // 1. Anti-robot AVANT toute lecture du corps : un robot ne doit pas même
  // faire travailler le parseur JSON.
  let verification;
  try {
    verification = await checkBotId();
  } catch {
    // BotID indisponible (incident Vercel, configuration absente) : on
    // laisse passer plutôt que de fermer l'inscription du site. Le risque
    // d'un faux compte est très inférieur à celui d'un formulaire mort.
    verification = { isBot: false };
  }
  if (verification.isBot) {
    return NextResponse.json(
      { error: "Inscription refusée : activité automatisée détectée." },
      { status: 403 }
    );
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const email = String(corps?.email || "").trim();
  const password = String(corps?.password || "");
  const fullName = String(corps?.fullName || "").trim();
  const emailRedirectTo = String(corps?.emailRedirectTo || "").trim();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Nom, e-mail et mot de passe sont obligatoires." }, { status: 400 });
  }

  // emailRedirectTo vient du client : il ne doit jamais servir à rediriger
  // vers un domaine tiers. On n'accepte que notre propre origine, sinon on
  // retombe sur le domaine de production.
  let redirection = "https://ffacilite.com/auth/callback";
  try {
    const u = new URL(emailRedirectTo);
    if (u.origin === new URL(request.url).origin || u.hostname === "ffacilite.com") {
      redirection = u.toString();
    }
  } catch {
    // URL absente ou invalide : la valeur de repli s'applique.
  }

  // Client anon, jamais service_role : signUp n'a besoin d'aucun privilège,
  // et un service_role sur une route publique serait une porte ouverte.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirection,
      data: { full_name: fullName },
    },
  });

  if (error) {
    // Le message de Supabase est repris tel quel : il distingue déjà les cas
    // utiles (mot de passe trop court, e-mail déjà pris) sans révéler
    // davantage que ce que le formulaire client affichait auparavant.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: data?.user?.id ?? null });
}
