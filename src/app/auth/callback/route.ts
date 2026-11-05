import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Landing point for links in Supabase emails (confirm signup, reset password).
 *   ?code=...                      PKCE link (default Supabase email templates)
 *   ?token_hash=...&type=...       works even if the link is opened in another browser
 * On success the session cookie is set and the user is sent to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const fail = (error: string) => NextResponse.redirect(`${origin}/login?error=${error}`);

  if (!getSupabaseEnv()) return fail("not_configured");

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(
      `${origin}${next === "/reset-password" ? "/forgot-password" : "/login"}?error=link_invalid`,
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
