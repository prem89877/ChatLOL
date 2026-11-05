import type { Conversation, Message } from "./types";

/**
 * Local (browser) history is LEGACY now.
 *
 * Conversations of signed-in users are stored in Supabase (see conversationsDb.ts) and are
 * protected by Row Level Security. Nothing is written to localStorage anymore, so chats of
 * different accounts never mix on a shared device.
 *
 * This file only READS chats that were saved in this browser before accounts existed, so the user
 * can choose to import them into their account. The old data is never deleted or modified.
 */

const STORE_KEY = "chatlol:conversations";
const IMPORTED_KEY_PREFIX = "chatlol:legacy-imported:";

/** A random UUID (the database uses uuid ids). */
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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

/** Chats saved in this browser before accounts existed. Read-only; returns [] if unreadable. */
export function loadLegacyConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return normalizeConversations(JSON.parse(raw)).filter((c) => c.messages.length > 0);
  } catch {
    return [];
  }
}

/** Legacy conversation ids this user already imported or chose to skip (per user, per browser). */
export function getHandledLegacyIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY_PREFIX + userId);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markLegacyIdsHandled(userId: string, ids: string[]): void {
  try {
    const all = getHandledLegacyIds(userId);
    ids.forEach((id) => all.add(id));
    localStorage.setItem(IMPORTED_KEY_PREFIX + userId, JSON.stringify([...all]));
  } catch {}
}
