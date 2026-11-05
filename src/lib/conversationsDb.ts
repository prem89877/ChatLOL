import type { PostgrestError } from "@supabase/supabase-js";
import { newId } from "./historyStore";
import { createClient } from "./supabase/client";
import type { Conversation, Message } from "./types";

/**
 * All conversation reads/writes. They run in the browser AS the signed-in user, so Postgres Row
 * Level Security (supabase/migrations) decides what is allowed: a user can only ever see, create,
 * change or delete their own conversations, and messages only inside their own conversations.
 * Changing an id in a request cannot reach another user's data.
 */

export class AuthExpiredError extends Error {
  constructor() {
    super("Your session expired. Please log in again.");
  }
}
export class DbError extends Error {}

export const MAX_LOADED_CONVERSATIONS = 100;
const TIMEOUT_MS = 20_000;

type Row = {
  id: string;
  title: string;
  updated_at: string;
  messages: { id: string; role: string; content: string; created_at: string }[] | null;
};

export function rowsToConversations(rows: Row[]): Conversation[] {
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: Date.parse(r.updated_at) || 0,
      messages: (r.messages ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role as Message["role"], text: m.content })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function isAuthProblem(error: PostgrestError, status: number): boolean {
  return status === 401 || error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(error.message);
}

/** Rejects after `ms` so a stalled request can never block the UI or the save queue. */
function withTimeout<T>(work: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DbError("The request timed out.")), ms);
    Promise.resolve(work).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function run<T>(work: PromiseLike<{ data: T | null; error: PostgrestError | null; status: number }>): Promise<T | null> {
  let res;
  try {
    res = await withTimeout(work);
  } catch (err) {
    throw err instanceof DbError ? err : new DbError("Could not reach the database.");
  }
  if (res.error) {
    if (isAuthProblem(res.error, res.status)) throw new AuthExpiredError();
    throw new DbError("The database rejected the request.");
  }
  return res.data;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const rows = await run<Row[]>(
    createClient()
      .from("conversations")
      .select("id,title,updated_at,messages(id,role,content,created_at)")
      .order("updated_at", { ascending: false })
      .limit(MAX_LOADED_CONVERSATIONS)
      .order("created_at", { ascending: true, referencedTable: "messages" })
      .order("id", { ascending: true, referencedTable: "messages" }),
  );
  return rowsToConversations(rows ?? []);
}

// user_id is filled by the database from the signed-in user (default auth.uid()); RLS rejects anything else.
export async function createConversationRow(id: string, title: string): Promise<void> {
  await run(createClient().from("conversations").insert({ id, title: title.slice(0, 200) || "New chat" }));
}

export async function insertMessageRow(conversationId: string, message: Message): Promise<void> {
  await run(
    createClient()
      .from("messages")
      .insert({ id: message.id, conversation_id: conversationId, role: message.role, content: message.text }),
  );
}

export async function deleteConversationRow(id: string): Promise<void> {
  await run(createClient().from("conversations").delete().eq("id", id));
}

/** Deletes every conversation of the signed-in user (messages go with them). */
export async function deleteAllConversationRows(userId: string): Promise<void> {
  await run(createClient().from("conversations").delete().eq("user_id", userId));
}

/**
 * Copies one legacy local conversation into the account with fresh ids.
 * Messages get increasing timestamps so their order is kept. If the messages fail to save,
 * the half-created conversation is removed again. Returns false if there was nothing to import.
 */
export async function importLegacyConversation(conv: Conversation): Promise<boolean> {
  const messages = conv.messages.filter((m) => m.text.trim().length > 0);
  if (messages.length === 0) return false;

  const conversationId = newId();
  await createConversationRow(conversationId, conv.title);
  try {
    const base = Date.now() - messages.length * 1000;
    const rows = messages.map((m, i) => ({
      id: newId(),
      conversation_id: conversationId,
      role: m.role,
      content: m.text,
      created_at: new Date(base + i * 1000).toISOString(),
    }));
    await run(createClient().from("messages").insert(rows));
  } catch (err) {
    await deleteConversationRow(conversationId).catch(() => {});
    throw err;
  }
  return true;
}
