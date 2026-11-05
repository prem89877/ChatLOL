"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import Composer from "./Composer";
import MessageList from "./MessageList";
import type { Message } from "@/lib/types";

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send(text: string) {
    const id = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u-${id}`, role: "user", text },
      {
        id: `a-${id}`,
        role: "assistant",
        text: "The AI is not connected yet. This is a placeholder reply so you can test the layout.",
      },
    ]);
  }

  function reset() {
    setMessages([]);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={reset} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 hover:bg-brand-soft"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-lg font-bold tracking-tight">
            chat<span className="rounded bg-lol px-1">LOL</span>
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6">
            <MessageList messages={messages} onPick={send} />
            <div ref={endRef} />
          </div>
        </main>

        <div className="border-t border-line bg-paper px-4 pb-4 pt-3">
          <div className="mx-auto w-full max-w-3xl">
            <Composer onSend={send} />
          </div>
        </div>
      </div>
    </div>
  );
}
