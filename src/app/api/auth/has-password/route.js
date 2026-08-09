import { NextResponse } from "next/server";
import { Client } from "pg";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * "A un mot de passe" a d'abord été déduit de auth.identities (une
 * identité 'email' = un compte a été créé avec mot de passe) — mais
 * vérifié faux en conditions réelles sur deux cas :
 * 1. Un compte sans mot de passe qui vient d'en créer un via ce même flux
 *    (updateUser({ password })) ne gagne PAS d'identité 'email' pour
 *    autant : il resterait détecté "sans mot de passe" indéfiniment.
 * 2. Un vrai compte de production, identités = ["phone"] uniquement,
 *    a en réalité déjà un mot de passe (encrypted_password non vide) —
 *    l'heuristique par identités l'aurait fait passer à tort pour "sans
 *    mot de passe", risquant d'écraser son mot de passe existant sans
 *    jamais lui redemander l'ancien.
 *
 * encrypted_password (auth.users) est le fait lui-même, pas un indice
 * indirect — vérifié fiable sur 5 vrais comptes Google (false) et sur ce
 * cas réel "phone uniquement" (true, correctement détecté). auth.users
 * n'est pas exposé via PostgREST ; connexion Postgres directe
 * (POSTGRES_URL_NON_POOLING, même pattern que
 * /api/admin/users/[id]/phone), jamais via le client.
 */
async function hasPasswordHash(userId) {
  const rawConnectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!rawConnectionString) {
    throw new Error("Aucune chaîne de connexion PostgreSQL configurée (POSTGRES_URL_NON_POOLING).");
  }
  const connectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT (encrypted_password IS NOT NULL AND encrypted_password <> '') AS has_password FROM auth.users WHERE id = $1",
      [userId]
    );
    return rows[0]?.has_password === true;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const hasPassword = await hasPasswordHash(user.id);

    return NextResponse.json({ hasPassword });
  } catch (err) {
    console.error("[Has Password API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
