"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAbortError, requestChatReply } from "./chatApi";
import {
  SAVE_FAILED_MESSAGE,
  loadConversations,
  newId,
  saveConversations,
} from "./historyStore";
import type { Conversation, Message } from "./types";

type ChatError = { conversationId: string; message: string };

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const [draft, setDraft] = useState(""); // assistant text while it streams in
  const [storageError, setStorageError] = useState<string | null>(null);

  // Refs guard against double submits and hold the cancel handle.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef("");

  // Load / save conversations (this device only). A storage failure never breaks the chat.
  useEffect(() => {
    const result = loadConversations();
    setConversations(result.conversations);
    setStorageError(result.error);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const failed = saveConversations(conversations);
    if (failed) setStorageError(failed);
    else setStorageError((cur) => (cur === SAVE_FAILED_MESSAGE ? null : cur));
  }, [conversations, loaded]);

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
      const message: Message = { id: newId("a"), role: "assistant", text };
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
  }, []);

  // Returns true if the message was accepted (so the composer can clear itself).
  const sendMessage = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return false;

      const now = Date.now();
      const userMessage: Message = { id: newId("u"), role: "user", text: trimmed };
      const existing = conversations.find((c) => c.id === activeId);

      if (existing) {
        const history = [...existing.messages, userMessage];
        setConversations((prev) =>
          prev
            .map((c) => (c.id === existing.id ? { ...c, messages: history, updatedAt: now } : c))
            .sort((a, b) => b.updatedAt - a.updatedAt),
        );
        void requestReply(existing.id, history);
      } else {
        const id = newId("c");
        const title = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
        setConversations((prev) => [{ id, title, messages: [userMessage], updatedAt: now }, ...prev]);
        setActiveId(id);
        void requestReply(id, [userMessage]);
      }
      return true;
    },
    [conversations, activeId, requestReply],
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
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
    },
    [loadingId],
  );

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setConversations([]);
    setActiveId(null);
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  // Most recent conversation first
  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  return {
    conversations: sorted,
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
