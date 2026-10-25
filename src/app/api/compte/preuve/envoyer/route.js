import { requireUser } from "@/lib/apiAuth";
import { repondre } from "@/lib/compte/route";
import { envoyerPreuve } from "@/lib/compte/service";

export const runtime = "nodejs";

export async function POST(req) {
  const { user, error } = await requireUser(req, { logDenials: true });
  if (error) return error;
  return repondre(req, user, (ctx, d, deps) => envoyerPreuve(ctx, d, deps), { corps: true });
}
