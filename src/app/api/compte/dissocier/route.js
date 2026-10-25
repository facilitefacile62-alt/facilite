import { requireUser } from "@/lib/apiAuth";
import { repondre } from "@/lib/compte/route";
import { dissocier } from "@/lib/compte/service";

export const runtime = "nodejs";

export async function POST(req) {
  const { user, error } = await requireUser(req, { logDenials: true });
  if (error) return error;
  return repondre(req, user, (ctx, d, deps) => dissocier(ctx, d, deps), { corps: true });
}
