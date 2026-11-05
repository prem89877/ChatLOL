import { createClient } from "../../../../lib/supabase/server";
import { getSupabaseEnv } from "../../../../lib/supabase/env";
import { handleImpression } from "../../../../lib/ads/handlers";

// Server-only. Forwards the signed impression token to Blisscco (Blisscco allows no browser CORS).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleImpression(req, {
    getUserId: async () => {
      if (!getSupabaseEnv()) return null;
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}
