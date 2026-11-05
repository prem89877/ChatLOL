import { describe, expect, it } from "vitest";
import { createLimiter, handleAdRequest, handleImpression } from "@/lib/ads/handlers";
import { ENV, FAKE_KEY, GAMING_AD_ID, fakeBlisscco } from "./ads-test-helpers";

const post = (path: string, body: unknown, raw = false) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ? String(body) : JSON.stringify(body) });
const signedIn = async () => "user-1";
const signedOut = async () => null;

describe("POST /api/ads handler", () => {
  it("rejects signed-out users with 401 and calls nothing", async () => {
    const fake = fakeBlisscco();
    const res = await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), { getUserId: signedOut, env: ENV, fetchImpl: fake.fetchImpl });
    expect(res.status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });
  it("treats an auth check that throws as signed out", async () => {
    const res = await handleAdRequest(post("/api/ads", { question: "x" }), { getUserId: async () => { throw new Error("boom"); }, env: ENV });
    expect(res.status).toBe(401);
  });
  it("rejects malformed bodies with 400", async () => {
    for (const body of ["not json", JSON.stringify({}), JSON.stringify({ question: 5 }), JSON.stringify({ question: "   " })]) {
      const res = await handleAdRequest(post("/api/ads", body, true), { getUserId: signedIn, env: ENV });
      expect(res.status).toBe(400);
    }
  });
  it("Scenario 1 end to end: gaming question -> only topics reach Blisscco, ad comes back", async () => {
    const fake = fakeBlisscco();
    const q = "Suggest some good gaming laptops. My email is secret.person@example.com";
    const res = await handleAdRequest(post("/api/ads", { question: q }), { getUserId: signedIn, env: ENV, fetchImpl: fake.fetchImpl });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ad.id).toBe(GAMING_AD_ID);
    expect(data.ad.impressionToken).toBe("tok-gaming.abc_123");
    const sent = JSON.stringify(fake.calls[0]);
    expect(sent).not.toContain("secret.person");
    expect(sent).not.toContain("Suggest");
    expect(sent).not.toContain("user-1");
    expect(JSON.stringify(data)).not.toContain(FAKE_KEY);
  });
  it("Scenario 3: no matching ad -> 200 with ad:null", async () => {
    const res = await handleAdRequest(post("/api/ads", { question: "best hotels and flights for a trip" }), { getUserId: signedIn, env: ENV, fetchImpl: fakeBlisscco().fetchImpl });
    expect(res.status).toBe(200);
    expect((await res.json()).ad).toBeNull();
  });
  it("no topic / sensitive question -> no request to Blisscco at all", async () => {
    const fake = fakeBlisscco();
    for (const question of ["hello there", "gym workout for my depression"]) {
      const res = await handleAdRequest(post("/api/ads", { question }), { getUserId: signedIn, env: ENV, fetchImpl: fake.fetchImpl });
      expect((await res.json()).ad).toBeNull();
    }
    expect(fake.calls).toHaveLength(0);
  });
  it("Scenario 4: Blisscco down or slow -> still 200 ad:null (chat is never affected)", async () => {
    for (const mode of ["down", "timeout"] as const) {
      const res = await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), { getUserId: signedIn, env: ENV, fetchImpl: fakeBlisscco({ mode }).fetchImpl, timeoutMs: 30 });
      expect(res.status).toBe(200);
      expect((await res.json()).ad).toBeNull();
    }
  });
  it("Scenario 5: invalid publisher key -> 200 ad:null, key never echoed", async () => {
    const res = await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), { getUserId: signedIn, env: { ...ENV, BLISSCCO_PUBLISHER_API_KEY: "blc_test_wrong_key" }, fetchImpl: fakeBlisscco().fetchImpl });
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text).ad).toBeNull();
    expect(text).not.toContain("blc_test_wrong_key");
  });
  it("ads disabled or unconfigured -> ad:null and no request", async () => {
    const fake = fakeBlisscco();
    const res = await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), { getUserId: signedIn, env: {}, fetchImpl: fake.fetchImpl });
    expect((await res.json()).ad).toBeNull();
    expect(fake.calls).toHaveLength(0);
  });
  it("Scenario 7: only valid UUIDs are forwarded as exclude ids, so repeat questions get a new ad", async () => {
    const fake = fakeBlisscco();
    const res = await handleAdRequest(post("/api/ads", { question: "gaming and dinner recipes", exclude_ad_ids: [GAMING_AD_ID, "not-a-uuid", 7] }), { getUserId: signedIn, env: ENV, fetchImpl: fake.fetchImpl });
    expect((await res.json()).ad.headline).toBe("Meal Kits");
    expect((fake.calls[0].body as { exclude_ad_ids: string[] }).exclude_ad_ids).toEqual([GAMING_AD_ID]);
  });
  it("rate limit: extra requests get ad:null without calling Blisscco", async () => {
    const fake = fakeBlisscco();
    const limiter = createLimiter(1, 60_000);
    const deps = { getUserId: signedIn, env: ENV, fetchImpl: fake.fetchImpl, limiter };
    await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), deps);
    const second = await (await handleAdRequest(post("/api/ads", { question: "gaming laptops" }), deps)).json();
    expect(second.ad).toBeNull();
    expect(fake.calls).toHaveLength(1);
  });
});

describe("POST /api/ads/impression handler", () => {
  it("rejects signed-out users and bad bodies", async () => {
    expect((await handleImpression(post("/api/ads/impression", { token: "tok-a" }), { getUserId: signedOut, env: ENV })).status).toBe(401);
    expect((await handleImpression(post("/api/ads/impression", {}), { getUserId: signedIn, env: ENV })).status).toBe(400);
  });
  it("Scenario 6: duplicate impression request -> recorded, then duplicate", async () => {
    const fake = fakeBlisscco();
    const deps = { getUserId: signedIn, env: ENV, fetchImpl: fake.fetchImpl };
    expect((await (await handleImpression(post("/api/ads/impression", { token: "tok-gaming.abc_123" }), deps)).json()).status).toBe("recorded");
    expect((await (await handleImpression(post("/api/ads/impression", { token: "tok-gaming.abc_123" }), deps)).json()).status).toBe("duplicate");
    expect(fake.seenImpressions.size).toBe(1);
  });
  it("forged token -> rejected; Blisscco down -> failed (both 200, never a 5xx)", async () => {
    const res = await handleImpression(post("/api/ads/impression", { token: "forged" }), { getUserId: signedIn, env: ENV, fetchImpl: fakeBlisscco().fetchImpl });
    expect((await res.json()).status).toBe("rejected");
    const down = await handleImpression(post("/api/ads/impression", { token: "tok-x" }), { getUserId: signedIn, env: ENV, fetchImpl: fakeBlisscco({ mode: "down" }).fetchImpl });
    expect(down.status).toBe(200);
    expect((await down.json()).status).toBe("failed");
  });
});
