import type { Message } from "./types";

/**
 * API layer for chat. UI components never call fetch directly.
 *
 *   POST /api/chat
 *   body:     { messages: [{ role: "user" | "assistant", content: string }] }
 *   success:  plain text stream of the assistant's reply (or the full text at once)
 *   failure:  JSON { error: { message: string } } with a non-2xx status
 */

export class ChatApiError extends Error {
  /** HTTP status when the server answered (401 = not logged in / session expired). */
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: unknown } };
    if (typeof data?.error?.message === "string") return data.error.message;
  } catch {}
  return `The request failed (error ${res.status}). Please retry.`;
}

/**
 * Requests an assistant reply. `onText` receives the full text so far while it streams.
 * Resolves with the final text. Throws an AbortError if cancelled.
 */
export async function requestChatReply(
  messages: Pick<Message, "role" | "text">[],
  signal: AbortSignal,
  onText: (textSoFar: string) => void,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      }),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ChatApiError("Could not reach the server. Check your connection and retry.");
  }

  if (!res.ok) throw new ChatApiError(await readErrorMessage(res), res.status);

  let full = "";
  try {
    if (!res.body) {
      full = await res.text();
      onText(full);
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        onText(full);
      }
      full += decoder.decode();
    }
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ChatApiError("The response was interrupted. Please retry.");
  }

  if (!full.trim()) throw new ChatApiError("The AI returned an empty response. Please retry.");
  return full;
}
