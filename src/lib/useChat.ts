"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatApiError, isAbortError, requestChatReply } from "./chatApi";
import {
  AuthExpiredError,
  createConversationRow,
  deleteAllConversationRows,
  deleteConversationRow,
  fetchConversations,
  importLegacyConversation,
  insertMessageRow,
} from "./conversationsDb";
import { getHandledLegacyIds, loadLegacyConversations, markLegacyIdsHandled, newId } from "./historyStore";
import type { Conversation, Message } from "./types";

const SYNC_FAILED_MESSAGE =
  "Could not sync your latest changes to your account. Check your connection; recent changes may not be saved.";
const LOAD_FAILED_MESSAGE = "Could not load your saved conversations. Check your connection and reload the page.";
const IMPORT_FAILED_MESSAGE = "Could not import some older chats. Nothing was deleted; you can try again.";

type Options = { userId: string; onAuthExpired: () => void };

type ChatError = { conversationId: string; message: string };

export function useChat({ userId, onAuthExpired }: Options) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const [draft, setDraft] = useState(""); // assistant text while it streams in
  const [storageError, setStorageError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<Conversation[]>([]); // pre-account chats found in this browser
  const [importing, setImporting] = useState(false);

  // Refs guard against double submits and hold the cancel handle.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef("");
  const deletedRef = useRef<Set<string>>(new Set()); // never save into conversations the user deleted
  const queueRef = useRef<Promise<void>>(Promise.resolve()); // database writes run one after another
  const expiredRef = useRef(onAuthExpired);
  expiredRef.current = onAuthExpired;

  const handleDbError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof AuthExpiredError) expiredRef.current();
    else setStorageError(fallback);
  }, []);

  // Runs a database write after the previous one finished. Never rejects, never blocks the UI.
  const persist = useCallback(
    (task: () => Promise<void>) => {
      queueRef.current = queueRef.current.then(task).catch((err) => handleDbError(err, SYNC_FAILED_MESSAGE));
    },
    [handleDbError],
  );

  // Load this user's conversations from Supabase (Row Level Security returns only their own).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchConversations();
        if (cancelled) return;
        // Keep anything the user already started while this was loading.
        setConversations((prev) => {
          const ids = new Set(list.map((c) => c.id));
          return [...prev.filter((c) => !ids.has(c.id)), ...list].sort((a, b) => b.updatedAt - a.updatedAt);
        });
        const handled = getHandledLegacyIds(userId);
        setLegacy(loadLegacyConversations().filter((c) => !handled.has(c.id)));
      } catch (err) {
        if (!cancelled) handleDbError(err, LOAD_FAILED_MESSAGE);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, handleDbError]);

  // Cancel any request when the page unmounts
  useEffect(() => () => abortRef.current?.abort(), []);

  // Reusable: ask for an assistant reply to `history` and append it to a conversation.
  const requestReply = useCallback(async (conversationId: string, history: Message[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setDraft("");
    draftRef.current = "";
    setLoadingId(conversationId);

    const addAssistantMessage = (text: string) => {
      const message: Message = { id: newId(), role: "assistant", text };
      persist(async () => {
        if (!deletedRef.current.has(conversationId)) await insertMessageRow(conversationId, message);
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
            : c,
        ),
      );
    };

    try {
      const reply = await requestChatReply(history, controller.signal, (text) => {
        draftRef.current = text;
        setDraft(text);
      });
      addAssistantMessage(reply);
    } catch (err) {
      if (isAbortError(err)) {
        // Stopped by the user: keep whatever text already arrived.
        const partial = draftRef.current.trim();
        if (partial) addAssistantMessage(partial);
        else setError({ conversationId, message: "Response stopped." });
      } else if (err instanceof ChatApiError && err.status === 401) {
        expiredRef.current(); // session ended: go back to the login page
      } else {
        setError({
          conversationId,
          message: err instanceof Error ? err.message : "Something went wrong. Please retry.",
        });
      }
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      draftRef.current = "";
      setDraft("");
      setLoadingId(null);
    }
  }, [persist]);

  // Returns true if the message was accepted (so the composer can clear itself).
  const sendMessage = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return false;

      const now = Date.now();
      const userMessage: Message = { id: newId(), role: "user", text: trimmed };
      const existing = conversations.find((c) => c.id === activeId);

      if (existing) {
        const history = [...existing.messages, userMessage];
        setConversations((prev) =>
          prev
            .map((c) => (c.id === existing.id ? { ...c, messages: history, updatedAt: now } : c))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        );
        persist(async () => {
          if (!deletedRef.current.has(existing.id)) await insertMessageRow(existing.id, userMessage);
        });
        void requestReply(existing.id, history);
      } else {
        const id = newId();
        const title = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
        setConversations((prev) => [{ id, title, messages: [userMessage], updatedAt: now }, ...prev]);
        setActiveId(id);
        persist(async () => {
          if (deletedRef.current.has(id)) return;
          await createConversationRow(id, title);
          await insertMessageRow(id, userMessage);
        });
        void requestReply(id, [userMessage]);
      }
      return true;
    },
    [conversations, activeId, requestReply, persist],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Re-request a reply when the last message is a user message with no answer.
  const retry = useCallback(() => {
    if (busyRef.current) return;
    const conv = conversations.find((c) => c.id === activeId);
    const last = conv?.messages[conv.messages.length - 1];
    if (!conv || last?.role !== "user") return;
    void requestReply(conv.id, conv.messages);
  }, [conversations, activeId, requestReply]);

  // New chat only clears the view; saved conversations are untouched.
  const newChat = useCallback(() => setActiveId(null), []);
  const select = useCallback((id: string) => setActiveId(id), []);

  const remove = useCallback(
    (id: string) => {
      if (id === loadingId) abortRef.current?.abort();
      deletedRef.current.add(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
      persist(() => deleteConversationRow(id));
    },
    [loadingId, persist],
  );

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setConversations((prev) => {
      prev.forEach((c) => deletedRef.current.add(c.id));
      return [];
    });
    setActiveId(null);
    persist(() => deleteAllConversationRows(userId));
  }, [persist, userId]);

  // Older chats saved in this browser before accounts: copied only when the user agrees.
  const importLegacy = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    const done: string[] = [];
    try {
      for (const conv of [...legacy].sort((a, b) => a.updatedAt - b.updatedAt)) {
        await importLegacyConversation(conv);
        done.push(conv.id);
      }
      markLegacyIdsHandled(userId, done);
      setLegacy([]);
      setConversations(await fetchConversations());
    } catch (err) {
      markLegacyIdsHandled(userId, done); // do not import the finished ones twice on retry
      setLegacy((cur) => cur.filter((c) => !done.includes(c.id)));
      handleDbError(err, IMPORT_FAILED_MESSAGE);
    } finally {
      setImporting(false);
    }
  }, [importing, legacy, userId, handleDbError]);

  const skipLegacy = useCallback(() => {
    markLegacyIdsHandled(userId, legacy.map((c) => c.id));
    setLegacy([]);
  }, [legacy, userId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  // Most recent conversation first
  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  return {
    conversations: sorted,
    historyLoading: !loaded,
    legacyCount: legacy.length,
    importing,
    importLegacy,
    skipLegacy,
    storageError,
    dismissStorageError: () => setStorageError(null),
    active,
    activeId,
    busy: loadingId !== null,
    activeLoading: loadingId !== null && loadingId === activeId,
    activeDraft: loadingId !== null && loadingId === activeId ? draft : "",
    activeError: error && error.conversationId === activeId ? error.message : null,
    sendMessage,
    stop,
    retry,
    newChat,
    select,
    remove,
    clearAll,
  };
}
