"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/messages";
import { validateEmail } from "@/lib/auth/validation";
import AuthShell, { Field, Notice, SubmitButton } from "./AuthShell";

export default function LoginForm({ notice }: { notice: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);
    setNeedsConfirm(false);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    if (!password) return setError("Enter your password.");

    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setNeedsConfirm(authError.code === "email_not_confirmed");
        setError(friendlyAuthError(authError));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (resendError) setError(friendlyAuthError(resendError));
      else setInfo("Confirmation email sent. Check your inbox (and spam folder).");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back. Log in to see your chats."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand">
            Create an account
          </Link>
        </>
      }
    >
      {notice && <Notice kind="info">{notice}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="success">{info}</Notice>}
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <Field
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        <div className="-mt-2 mb-4 text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand">
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={loading} loadingText="Logging in…">
          Log in
        </SubmitButton>
      </form>
      {needsConfirm && (
        <button
          type="button"
          onClick={resend}
          disabled={loading}
          className="mt-3 w-full text-center text-sm font-semibold text-brand disabled:opacity-60"
        >
          Resend confirmation email
        </button>
      )}
    </AuthShell>
  );
}
