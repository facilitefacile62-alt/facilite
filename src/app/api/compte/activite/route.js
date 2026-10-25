import { requireUser } from "@/lib/apiAuth";
import { repondre } from "@/lib/compte/route";
import { lireActivite } from "@/lib/compte/service";

export const runtime = "nodejs";

export async function GET(req) {
  const { user, error } = await requireUser(req, { logDenials: true });
  if (error) return error;
  return repondre(req, user, (ctx, _d, deps) => lireActivite(ctx, deps), { corps: false });
}
