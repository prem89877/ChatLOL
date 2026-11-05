import { describe, expect, it } from "vitest";
import { newId, normalizeConversations } from "@/lib/historyStore";
import { rowsToConversations } from "@/lib/conversationsDb";

describe("newId", () => {
  it("returns a valid v4 UUID (the database uses uuid ids)", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(id);
  });
});

describe("normalizeConversations (legacy browser history)", () => {
  it("drops invalid data and duplicates, sorts newest first", () => {
    const out = normalizeConversations([
      { id: "c-1", title: "old", updatedAt: 1, messages: [{ id: "u-1", role: "user", text: "hi" }, { id: "u-1", role: "user", text: "dup" }, { id: "x", role: "system", text: "bad" }] },
      { id: "c-2", title: "new", updatedAt: 5, messages: [] },
      { id: "c-2", title: "duplicate id", updatedAt: 9, messages: [] },
      { nope: true },
    ]);
    expect(out.map((c) => c.id)).toEqual(["c-2", "c-1"]);
    expect(out[1].messages).toEqual([{ id: "u-1", role: "user", text: "hi" }]);
    expect(normalizeConversations("garbage")).toEqual([]);
  });
});

describe("rowsToConversations (database rows -> app model)", () => {
  it("maps content to text, keeps message order and sorts by updated_at", () => {
    const out = rowsToConversations([
      { id: "a", title: "A", updated_at: "2026-01-01T00:00:00Z", messages: [{ id: "m1", role: "user", content: "q", created_at: "" }, { id: "m2", role: "assistant", content: "a", created_at: "" }] },
      { id: "b", title: "B", updated_at: "2026-02-01T00:00:00Z", messages: null },
    ]);
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
    expect(out[1].messages).toEqual([
      { id: "m1", role: "user", text: "q" },
      { id: "m2", role: "assistant", text: "a" },
    ]);
    expect(out[0].messages).toEqual([]);
  });
  it("ignores rows with an unknown role", () => {
    const out = rowsToConversations([
      { id: "a", title: "A", updated_at: "2026-01-01T00:00:00Z", messages: [{ id: "m1", role: "system", content: "x", created_at: "" }] },
    ]);
    expect(out[0].messages).toEqual([]);
  });
});
