/** Turns Supabase Auth errors into short, friendly messages. Never exposes raw server text. */

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function friendlyAuthError(err: AuthErrorLike): string {
  const code = err?.code ?? "";
  const message = (err?.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  }
  if (code === "user_already_exists" || code === "email_exists" || message.includes("already registered")) {
    return "An account with this email already exists. Log in or reset your password.";
  }
  if (code === "weak_password" || message.includes("password should")) {
    return "That password is too weak. Use a longer password with a mix of letters and numbers.";
  }
  if (code === "same_password") return "Choose a new password that is different from your current one.";
  if (code === "signup_disabled") return "Sign-ups are currently disabled.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    err?.status === 429 ||
    message.includes("rate limit")
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (code === "session_not_found" || code === "refresh_token_not_found" || message.includes("session missing")) {
    return "Your session has expired. Please request a new link or log in again.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

/** Messages shown on the auth pages for ?error= and ?reason= query values. */
export function noticeFromQuery(error?: string | null, reason?: string | null): string | null {
  if (reason === "expired") return "Your session expired. Please log in again.";
  if (error === "link_invalid") {
    return "That link is invalid, expired, or was opened in a different browser. If you just confirmed your email, try logging in. For a password reset, request a new link.";
  }
  if (error === "not_configured") return "The app is not configured yet (Supabase settings are missing).";
  return null;
}
