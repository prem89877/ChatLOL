import { Fragment } from "react";
import type { Message } from "@/lib/types";
import type { SponsoredAd as Ad } from "@/lib/ads/types";
import SponsoredAd from "./SponsoredAd";

type Props = {
  messages: Message[];
  /** Assistant is responding to this conversation right now. */
  loading: boolean;
  /** Assistant text received so far while streaming. */
  streamingText: string;
  /** Error from the last request for this conversation, if any. */
  error: string | null;
  /** Retry is allowed (no other request is active). */
  canRetry: boolean;
  onRetry: () => void;
  /** Sponsored ads keyed by the id of the user question they answer. Shown after the AI reply, never inside it. */
  ads?: Record<string, Ad>;
};

export default function MessageList({ messages, loading, streamingText, error, canRetry, onRetry, ads }: Props) {
  const last = messages[messages.length - 1];
  const unanswered = !loading && last?.role === "user";

  return (
    <ul className="flex flex-col gap-6">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const ad = m.role === "assistant" && prev?.role === "user" ? ads?.[prev.id] : undefined;
        return (
          <Fragment key={m.id}>
            <li className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`whitespace-pre-wrap break-words leading-7 ${
                  m.role === "user" ? "max-w-[85%] rounded-3xl bg-panel px-4 py-2.5" : "max-w-full"
                }`}
              >
                {m.text}
              </div>
            </li>
            {ad && (
              <li className="flex justify-start">
                <SponsoredAd ad={ad} />
              </li>
            )}
          </Fragment>
        );
      })}

      {loading && streamingText && (
        <li className="flex justify-start">
          <div className="max-w-full whitespace-pre-wrap break-words leading-7">{streamingText}</div>
        </li>
      )}

      {loading && !streamingText && (
        <li role="status" aria-label="Assistant is responding" className="flex gap-1.5 py-2">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </li>
      )}

      {unanswered && (
        <li role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{error ?? "This message has no reply yet."}</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry}
            className="rounded-full border border-line bg-panel px-3 py-1 font-semibold text-ink hover:border-brand disabled:opacity-40"
          >
            Retry
          </button>
        </li>
      )}
    </ul>
  );
}
