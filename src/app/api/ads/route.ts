import { createClient } from "../../../lib/supabase/server";
import { getSupabaseEnv } from "../../../lib/supabase/env";
import { createLimiter, handleAdRequest } from "../../../lib/ads/handlers";

// Server-only. The Blisscco key comes from env vars and never reaches the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createLimiter(15, 60_000);

export async function POST(req: Request): Promise<Response> {
  return handleAdRequest(req, {
    limiter,
    getUserId: async () => {
      if (!getSupabaseEnv()) return null;
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}
