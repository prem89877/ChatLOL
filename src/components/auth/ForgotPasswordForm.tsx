"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/messages";
import { validateEmail } from "@/lib/auth/validation";
import AuthShell, { Field, Notice, SubmitButton } from "./AuthShell";

export default function ForgotPasswordForm({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (authError) {
        setError(friendlyAuthError(authError));
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-semibold text-brand">
          Back to log in
        </Link>
      }
    >
      {notice && <Notice kind="info">{notice}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {sent ? (
        <Notice kind="success">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Check your inbox and spam
          folder.
        </Notice>
      ) : (
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
          <SubmitButton loading={loading} loadingText="Sending…">
            Send reset link
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
