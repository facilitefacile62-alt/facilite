import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/apiAuth";
import { creerDependances } from "./depsServeur.js";

// Enveloppe commune des routes /api/compte/* : session obligatoire, limite de débit, lecture du corps, puis UN appel au service partagé.
// Le site, Facilité et Locaux appellent exactement ces routes : les règles et les messages sont donc identiques partout.

const jeton = (req) => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || null;
const adresse = (req) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

// La session est contrôlée par CHAQUE route (requireUser) avant d'arriver ici : `user` est donc toujours une personne connectée.
export async function repondre(req, user, action, { corps = true } = {}) {
  const { allowed, error: rateError } = await checkRateLimit(user.id);
  if (!allowed) return rateError;

  let donnees = {};
  if (corps) {
    donnees = await req.json().catch(() => null);
    if (!donnees || typeof donnees !== "object") return NextResponse.json({ ok: false, message: "Cette demande n'est pas valable." }, { status: 400 });
  }
  const ctx = { userId: user.id, accessToken: jeton(req), ip: adresse(req), appareil: (req.headers.get("user-agent") || "").slice(0, 200) };
  const resultat = await action(ctx, donnees, creerDependances());
  const { statut, ...reponse } = resultat;
  return NextResponse.json(reponse, { status: resultat.ok ? 200 : statut ?? 400 });
}
