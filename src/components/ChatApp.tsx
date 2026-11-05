"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Composer from "./Composer";
import MessageList from "./MessageList";
import SettingsDialog from "./SettingsDialog";
import { MenuIcon, MoonIcon, SunIcon } from "./icons";
import { useTheme } from "@/lib/useTheme";
import { useChat } from "@/lib/useChat";

export default function ChatApp() {
  const chat = useChat();
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
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
