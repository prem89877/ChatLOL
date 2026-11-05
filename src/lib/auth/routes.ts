/** Pure routing rules, kept separate from the middleware so they can be unit tested. */

export const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
const AUTH_FLOW_PREFIX = "/auth/"; // email-link callback, must work with or without a session

export type RouteDecision = "allow" | "redirect-login" | "redirect-home" | "unauthorized";

export function decideRoute(pathname: string, signedIn: boolean): RouteDecision {
  if (pathname.startsWith(AUTH_FLOW_PREFIX)) return "allow";

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return signedIn ? "allow" : "unauthorized"; // APIs answer 401 instead of redirecting
  }

  if (GUEST_ONLY_PATHS.includes(pathname)) {
    return signedIn ? "redirect-home" : "allow";
  }

  // Everything else (the chat, /reset-password) needs a session.
  return signedIn ? "allow" : "redirect-login";
}

/** Only allow same-site relative paths after login (blocks open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
