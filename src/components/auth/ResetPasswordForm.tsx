"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/messages";
import { MIN_PASSWORD_LENGTH, validatePassword, validatePasswordMatch } from "@/lib/auth/validation";
import AuthShell, { Field, Notice, SubmitButton } from "./AuthShell";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const problem = validatePassword(password) ?? validatePasswordMatch(password, confirm);
    if (problem) return setError(problem);

    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.updateUser({ password });
      if (authError) {
        setError(friendlyAuthError(authError));
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 1500);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link href="/forgot-password" className="font-semibold text-brand">
          Request a new reset link
        </Link>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      {done ? (
        <Notice kind="success">Password updated. Taking you to your chats…</Notice>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Field
            label="New password"
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
            label="Confirm new password"
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            required
          />
          <SubmitButton loading={loading} loadingText="Saving…">
            Update password
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
