import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Supabase server client is replaced ONLY to control who is "signed in" for each case.
// No AI call is faked: none of these cases reaches the AI provider.
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { POST } from "@/app/api/chat/route";

const request = () =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  });

describe("POST /api/chat authorization", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_MODEL", "");
    getUser.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a signed-out request with 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toMatch(/log in/i);
  });

  it("rejects when the auth check throws", async () => {
    getUser.mockRejectedValue(new Error("boom"));
    expect((await POST(request())).status).toBe(401);
  });

  it("lets a signed-in user through the gate (then stops at missing AI config)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toMatch(/AI is not configured/i);
  });

  it("fails closed when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await POST(request())).status).toBe(503);
  });
});
