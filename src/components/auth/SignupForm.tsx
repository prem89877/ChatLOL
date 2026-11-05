"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/messages";
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
} from "@/lib/auth/validation";
import AuthShell, { Field, Notice, SubmitButton } from "./AuthShell";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const problem =
      validateEmail(email) ?? validatePassword(password) ?? validatePasswordMatch(password, confirm);
    if (problem) return setError(problem);

    setLoading(true);
    try {
      const { data, error: authError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (authError) {
        setError(friendlyAuthError(authError));
        return;
      }
      // With email confirmation on, Supabase hides duplicates: it returns a user with no identities.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setError(friendlyAuthError({ code: "user_already_exists" }));
        return;
      }
      if (data.session) {
        // Email confirmation is off in Supabase: the user is already signed in.
        router.replace("/");
        router.refresh();
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        footer={
          <Link href="/login" className="font-semibold text-brand">
            Back to log in
          </Link>
        }
      >
        <Notice kind="success">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account, then log in.
        </Notice>
        <p className="text-sm text-muted">Nothing arrived? Check your spam folder, or wait a minute and try again.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your chats are saved privately to your account."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Log in
          </Link>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
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
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        <Field
          label="Confirm password"
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
          required
        />
        <SubmitButton loading={loading} loadingText="Creating account…">
          Sign up
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
