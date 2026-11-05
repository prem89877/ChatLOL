"use client";

import { useRef, useState } from "react";
import { SendIcon, StopIcon } from "./icons";
import { MAX_MESSAGE_CHARS } from "@/lib/limits";

type Props = {
  /** Return true when the message was accepted (the input is then cleared). */
  onSend: (text: string) => boolean;
  /** True while a request is active: sending is disabled. */
  busy: boolean;
  onStop: () => void;
};

export default function Composer({ onSend, busy, onStop }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function submit() {
    if (busy || !value.trim()) return;
    if (onSend(value)) {
      setValue("");
      requestAnimationFrame(resize);
    }
  }

  return (
    <div>
      {busy && (
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-1.5 text-sm font-semibold hover:border-brand"
          >
            <StopIcon width={14} height={14} /> Stop generating
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-3xl border border-line bg-panel p-2 pl-4 focus-within:border-brand">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            // On touch devices (phones) Enter adds a new line; use the Send button.
            if (window.matchMedia("(pointer: coarse)").matches) return;
            e.preventDefault();
            submit();
          }}
          rows={1}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="Message chatLOL"
          aria-label="Message"
          className="max-h-[200px] min-h-[2.5rem] flex-1 resize-none bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !value.trim()}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-onbrand disabled:opacity-30"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
