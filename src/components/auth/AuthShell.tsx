import type { ReactNode } from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-3xl font-extrabold tracking-tight">
          chat<span className="rounded bg-lol px-1.5 text-[#16152B]">LOL</span>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  const style =
    kind === "error"
      ? "border-red-500/60 bg-red-500/10"
      : kind === "success"
        ? "border-emerald-500/60 bg-emerald-500/10"
        : "border-line bg-side";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`mb-4 rounded-xl border px-3 py-2 text-sm ${style}`}>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-base outline-none focus:border-brand disabled:opacity-60";

export function Field({
  label,
  id,
  hint,
  ...props
}: { label: string; id: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input id={id} name={id} className={inputClass} {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText }: { loading: boolean; children: ReactNode; loadingText: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-onbrand hover:opacity-90 disabled:opacity-60"
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {loading ? loadingText : children}
    </button>
  );
}
