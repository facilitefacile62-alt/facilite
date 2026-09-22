import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { checkRateLimit } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Pont de session pour l'app mobile native (Expo) : établit sur cette page
 * web, dans la WebView de l'app, la même session que l'utilisateur a déjà
 * dans l'app (jetons transmis par le client mobile) — sans ça, une page
 * comme /creer-cv, servie dans une WebView, redemanderait une connexion
 * alors que la personne est déjà connectée côté app.
 *
 * Même patron que src/app/auth/callback/route.js (construire la réponse de
 * redirection AVANT le client Supabase, pour que setAll pose les cookies
 * dessus), avec deux différences : les jetons arrivent en POST (jamais dans
 * une URL, donc jamais dans un log d'accès ni un historique de navigateur),
 * et la cible est une CLÉ dans une liste blanche tenue ICI côté serveur —
 * jamais un chemin arbitraire fourni par le client. Cette liste est
 * volontairement séparée de mobile/src/lib/webEcrans.ts : même si ce
 * fichier mobile était un jour trafiqué, ce serveur n'accepte toujours que
 * les clés qu'il connaît lui-même.
 *
 * Sécurité : l'access_token est vérifié par Supabase (signature + expiration
 * réelles, auth.getUser) avant tout — un jeton invalide ou expiré n'établit
 * aucune session. Jamais de journalisation des jetons.
 */
const ALLOWED_MOBILE_BRIDGE_TARGETS = {
  "creer-cv": "/creer-cv",
};

// Client dédié à la seule vérification du jeton, distinct de celui (plus
// bas) qui posera les cookies de session — même séparation que apiAuth.js.
const supabaseVerifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const accessToken = form.get("access_token");
  const refreshToken = form.get("refresh_token");
  const cible = form.get("cible");
  const template = form.get("template");

  const chemin = typeof cible === "string" ? ALLOWED_MOBILE_BRIDGE_TARGETS[cible] : null;
  if (!chemin) {
    return NextResponse.json({ error: "Cible inconnue." }, { status: 400 });
  }
  if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) {
    return NextResponse.json({ error: "Jetons manquants." }, { status: 400 });
  }

  const { data, error: userError } = await supabaseVerifier.auth.getUser(accessToken);
  if (userError || !data?.user) {
    return NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  const { allowed, error: rateError } = await checkRateLimit(data.user.id);
  if (!allowed) return rateError;

  const cheminFinal =
    typeof template === "string" && template ? `${chemin}?template=${encodeURIComponent(template)}` : chemin;
  const res = NextResponse.redirect(new URL(cheminFinal, req.url));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    return NextResponse.json({ error: "Impossible d'établir la session." }, { status: 401 });
  }

  return res;
}
