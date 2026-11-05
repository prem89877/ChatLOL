"use client";

import { useState } from "react";

export default function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-line bg-panel p-2 focus-within:border-brand">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Message chatLOL"
        aria-label="Message"
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="rounded-xl bg-brand px-4 py-2 font-semibold text-white disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}
