import { requireUser } from "@/lib/apiAuth";
import { repondre } from "@/lib/compte/route";
import { lireEtat } from "@/lib/compte/service";

export const runtime = "nodejs";

export async function GET(req) {
  const { user, error } = await requireUser(req, { logDenials: true });
  if (error) return error;
  return repondre(req, user, (ctx, _d, deps) => lireEtat(ctx, deps), { corps: false });
}
