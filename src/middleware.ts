import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideRoute } from "@/lib/auth/routes";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Runs on every page and API request (not static files).
 * 1. Refreshes the Supabase session cookies.
 * 2. Checks the user with the Auth server (getUser, not just the cookie contents).
 * 3. Redirects or rejects according to decideRoute().
 * Fails closed: if Supabase is not configured, nothing is served.
 */
export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) {
    return new NextResponse("Supabase is not configured on the server.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const decision = decideRoute(pathname, !!user);
  if (decision === "allow") return response;

  if (decision === "unauthorized") {
    return new NextResponse(JSON.stringify({ error: { message: "You need to log in to use the chat." } }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (decision === "redirect-home") {
    target.pathname = "/";
  } else {
    target.pathname = "/login";
    // A leftover auth cookie without a valid user means the session expired.
    const hadSession = request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));
    if (hadSession) target.searchParams.set("reason", "expired");
  }

  const redirect = NextResponse.redirect(target);
  // Keep refreshed/cleared auth cookies on the redirect response.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
