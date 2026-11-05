"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Composer from "./Composer";
import MessageList from "./MessageList";
import SettingsDialog from "./SettingsDialog";
import { MenuIcon, MoonIcon, SunIcon } from "./icons";
import { useTheme } from "@/lib/useTheme";
import { useChat } from "@/lib/useChat";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string; userEmail: string };

export default function ChatApp({ userId, userEmail }: Props) {
  const router = useRouter();
  const leavingRef = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Ends the local session and returns to the login page (once).
  const leave = useCallback(
    async (reason?: "expired") => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      try {
        await createClient().auth.signOut({ scope: "local" });
      } catch {
        // Even if the network call fails, the browser session is cleared below by the redirect.
      }
      router.replace(reason ? `/login?reason=${reason}` : "/login");
      router.refresh();
    },
    [router],
  );

  const onAuthExpired = useCallback(() => void leave("expired"), [leave]);

  // If the session ends in another tab (or cannot be refreshed), leave this page too.
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void leave();
    });
    return () => data.subscription.unsubscribe();
  }, [leave]);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await leave();
  }, [leave, loggingOut]);

  const chat = useChat({ userId, onAuthExpired });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme, toggle } = useTheme();
  const endRef = useRef<HTMLDivElement>(null);

  const { active } = chat;
  const hasMessages = !!active && active.messages.length > 0;

  // Keep the latest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length, chat.activeId, chat.activeLoading, chat.activeDraft, chat.activeError]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        conversations={chat.conversations}
        activeId={chat.activeId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          chat.newChat();
          setSidebarOpen(false);
        }}
        onSelect={(id) => {
          chat.select(id);
          setSidebarOpen(false);
        }}
        onDelete={(id) => {
          const title = chat.conversations.find((c) => c.id === id)?.title ?? "this conversation";
          if (window.confirm(`Delete "${title}"? This cannot be undone.`)) chat.remove(id);
        }}
        onOpenSettings={() => {
          setSidebarOpen(false);
          setSettingsOpen(true);
        }}
        historyLoading={chat.historyLoading}
        userEmail={userEmail}
        loggingOut={loggingOut}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-3 py-2.5 md:justify-end">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 hover:bg-panel md:hidden"
          >
            <MenuIcon />
          </button>
          <span className="text-lg font-bold tracking-tight md:hidden">
            chat<span className="rounded bg-lol px-1 text-[#16152B]">LOL</span>
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-lg p-2 hover:bg-panel"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        {chat.storageError && (
          <div
            role="alert"
            className="mx-3 mb-1 flex items-start justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2 text-sm"
          >
            <span>{chat.storageError}</span>
            <button type="button" onClick={chat.dismissStorageError} className="shrink-0 font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {chat.legacyCount > 0 && (
          <div
            role="status"
            className="mx-3 mb-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm"
          >
            <span>
              Found {chat.legacyCount} older chat{chat.legacyCount === 1 ? "" : "s"} saved in this browser. Import{" "}
              {chat.legacyCount === 1 ? "it" : "them"} to your account? The browser copy is kept.
            </span>
            <span className="flex shrink-0 gap-3 font-semibold">
              <button type="button" onClick={chat.importLegacy} disabled={chat.importing} className="text-brand disabled:opacity-60">
                {chat.importing ? "Importing…" : "Import"}
              </button>
              <button type="button" onClick={chat.skipLegacy} disabled={chat.importing} className="disabled:opacity-60">
                Not now
              </button>
            </span>
          </div>
        )}

        {hasMessages && active ? (
          <>
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <MessageList
                  messages={active.messages}
                  loading={chat.activeLoading}
                  streamingText={chat.activeDraft}
                  error={chat.activeError}
                  canRetry={!chat.busy}
                  onRetry={chat.retry}
                  ads={chat.ads}
                />
                <div ref={endRef} />
              </div>
            </main>
            <div className="px-4 pb-4 pt-2">
              <div className="mx-auto w-full max-w-3xl">
                <Composer onSend={chat.sendMessage} busy={chat.busy} onStop={chat.stop} />
              </div>
            </div>
          </>
        ) : (
          <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <div className="w-full max-w-2xl">
              <h1 className="mb-8 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
                How can I help you?
              </h1>
              <Composer onSend={chat.sendMessage} busy={chat.busy} onStop={chat.stop} />
            </div>
          </main>
        )}
      </div>

      {settingsOpen && (
        <SettingsDialog
          theme={theme}
          onTheme={setTheme}
          onClearChats={chat.clearAll}
          userEmail={userEmail}
          loggingOut={loggingOut}
          onLogout={logout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
