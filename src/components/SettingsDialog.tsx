"use client";

import { useEffect } from "react";
import type { Theme } from "@/lib/useTheme";
import { CloseIcon, MoonIcon, SunIcon } from "./icons";

type Props = {
  theme: Theme;
  onTheme: (t: Theme) => void;
  onClearChats: () => void;
  userEmail: string;
  loggingOut: boolean;
  onLogout: () => void;
  onClose: () => void;
};

export default function SettingsDialog({ theme, onTheme, onClearChats, userEmail, loggingOut, onLogout, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const opt = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-semibold ${
      active ? "border-brand bg-brand/15" : "border-line hover:border-brand"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-bold">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-lg p-1.5 hover:bg-side">
            <CloseIcon />
          </button>
        </div>

        <p className="mb-2 text-sm font-semibold text-muted">Account</p>
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <span className="min-w-0 truncate text-sm" title={userEmail}>{userEmail}</span>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="shrink-0 text-sm font-semibold text-brand disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>

        <p className="mb-2 text-sm font-semibold text-muted">Theme</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => onTheme("dark")} aria-pressed={theme === "dark"} className={opt(theme === "dark")}>
            <MoonIcon width={18} height={18} /> Dark
          </button>
          <button type="button" onClick={() => onTheme("light")} aria-pressed={theme === "light"} className={opt(theme === "light")}>
            <SunIcon width={18} height={18} /> Light
          </button>
        </div>

        <p className="mb-2 mt-6 text-sm font-semibold text-muted">Data</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete all conversations in your account? This cannot be undone.")) {
              onClearChats();
              onClose();
            }
          }}
          className="w-full rounded-xl border border-line px-3 py-2.5 text-left font-semibold hover:border-brand"
        >
          Clear all conversations
        </button>
      </div>
    </div>
  );
}
