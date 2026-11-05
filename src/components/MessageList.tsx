import type { Message } from "@/lib/types";

const SUGGESTIONS = [
  "Explain something complicated in simple words",
  "Help me write a polite email",
  "Give me a joke to start my day",
  "Plan a 3-day trip on a small budget",
];

type Props = {
  messages: Message[];
  onPick: (text: string) => void;
};

export default function MessageList({ messages, onPick }: Props) {
  if (messages.length === 0) {
    return (
      <div className="m-auto w-full py-10">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Ask anything. Laugh a little.
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Type below, or start with one of these.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-xl border border-line bg-panel px-4 py-3 text-left hover:border-brand"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {messages.map((m) => (
        <li
          key={m.id}
          className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
        >
          <div
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed ${
              m.role === "user"
                ? "bg-brand text-white"
                : "border border-line bg-panel"
            }`}
          >
            {m.text}
          </div>
        </li>
      ))}
    </ul>
  );
}
