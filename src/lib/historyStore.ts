import type { Conversation, Message } from "./types";

/**
 * Conversation history storage (MVP): the browser's localStorage, this device only.
 *
 * Why not Supabase yet: the app has no login, so there is no way to tell one visitor from
 * another. Saving chats in Supabase without a user identity would mean either public tables
 * or a server key that can read everyone's chats. Both are unsafe, so Supabase persistence
 * waits for authentication (see README, "Conversation history").
 */

const STORE_KEY = "chatlol:conversations";
const CORRUPT_KEY = "chatlol:conversations:corrupt";

export const SAVE_FAILED_MESSAGE =
  "Could not save your history on this device (storage is full or blocked). Your chat still works, but it may be lost when you close or reload the page.";
const LOAD_BLOCKED_MESSAGE =
  "Saved history can't be read in this browser (storage is blocked). Your chat works, but it will not be kept after you close the page.";
const LOAD_CORRUPT_MESSAGE =
  "Saved history was damaged and could not be loaded. A backup copy was kept in this browser.";

/** Unique id (UUID when the browser supports it). */
export function newId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function isMessage(x: unknown): x is Message {
  const m = x as Partial<Message> | null;
  return (
    !!m &&
    typeof m.id === "string" &&
    m.id.length > 0 &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.text === "string"
  );
}

/** Drops invalid entries and duplicate ids, keeps message order, sorts newest conversation first. */
export function normalizeConversations(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Conversation[] = [];

  for (const item of raw) {
    const c = item as Partial<Conversation> | null;
    if (!c || typeof c.id !== "string" || !c.id || seen.has(c.id)) continue;
    if (typeof c.title !== "string" || !Array.isArray(c.messages)) continue;
    seen.add(c.id);

    const messageIds = new Set<string>();
    const messages: Message[] = [];
    for (const m of c.messages) {
      if (!isMessage(m) || messageIds.has(m.id)) continue;
      messageIds.add(m.id);
      messages.push({ id: m.id, role: m.role, text: m.text });
    }
    out.push({
      id: c.id,
      title: c.title || "New chat",
      messages,
      updatedAt: typeof c.updatedAt === "number" && Number.isFinite(c.updatedAt) ? c.updatedAt : 0,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export type LoadResult = { conversations: Conversation[]; error: string | null };

export function loadConversations(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return { conversations: [], error: LOAD_BLOCKED_MESSAGE };
  }
  if (!raw) return { conversations: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      localStorage.setItem(CORRUPT_KEY, raw); // keep the unreadable data instead of overwriting it
    } catch {}
    return { conversations: [], error: LOAD_CORRUPT_MESSAGE };
  }
  return { conversations: normalizeConversations(parsed), error: null };
}

/** Returns null on success, or an error message. Never throws. */
export function saveConversations(conversations: Conversation[]): string | null {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(conversations));
    return null;
  } catch {
    return SAVE_FAILED_MESSAGE;
  }
}
