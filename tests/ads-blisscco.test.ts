import { describe, expect, it } from "vitest";
import { getAdsConfig, parseAdResponse, reportImpression, requestAd, safeHttpsUrl } from "@/lib/ads/blisscco";
import { BASE, ENV, FAKE_KEY, FOOD_AD_ID, GAMING_AD_ID, fakeBlisscco } from "./ads-test-helpers";

const cfg = { baseUrl: BASE, apiKey: FAKE_KEY };

describe("getAdsConfig (fails closed)", () => {
  it("is off unless explicitly enabled", () => {
    expect(getAdsConfig({ ...ENV, BLISSCCO_ADS_ENABLED: "" })).toBeNull();
    expect(getAdsConfig({ ...ENV, BLISSCCO_ADS_ENABLED: "false" })).toBeNull();
    expect(getAdsConfig({})).toBeNull();
  });
  it("needs base URL and key; base must be https (http only for localhost)", () => {
    expect(getAdsConfig({ ...ENV, BLISSCCO_PUBLISHER_API_KEY: "" })).toBeNull();
    expect(getAdsConfig({ ...ENV, BLISSCCO_API_BASE_URL: "http://example.com" })).toBeNull();
    expect(getAdsConfig({ ...ENV, BLISSCCO_API_BASE_URL: "https://user:pw@example.com" })).toBeNull();
    expect(getAdsConfig({ ...ENV, BLISSCCO_API_BASE_URL: "http://localhost:3001/" })?.baseUrl).toBe("http://localhost:3001");
    expect(getAdsConfig(ENV)?.baseUrl).toBe(BASE);
  });
});

describe("Scenario 1: relevant contextual ad is returned", () => {
  it("sends only topic data + key and returns a sanitized ad with a tracking token", async () => {
    const fake = fakeBlisscco();
    const r = await requestAd(cfg, { topics: ["gaming", "technology"] }, { fetchImpl: fake.fetchImpl });
    expect(r.reason).toBe("ok");
    expect(r.ad?.id).toBe(GAMING_AD_ID);
    expect(r.ad?.impressionToken).toBe("tok-gaming.abc_123");
    const call = fake.calls[0];
    expect(call.url).toBe(`${BASE}/api/v1/ads/match`);
    expect(call.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(call.headers["X-Blisscco-Tracking"]).toBe("1");
    expect(call.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(call.body).toEqual({ topic: "gaming", fallback_topics: ["technology"] });
  });
});

describe("Scenario 2: unrelated ad is not selected when a suitable one exists", () => {
  it("a gaming question asks for gaming, so the gaming ad (not the food ad) is chosen", async () => {
    const fake = fakeBlisscco();
    const r = await requestAd(cfg, { topics: ["gaming"] }, { fetchImpl: fake.fetchImpl });
    expect(r.ad?.id).toBe(GAMING_AD_ID);
    expect(r.ad?.id === FOOD_AD_ID).toBe(false);
  });
});

describe("Scenario 3: no eligible ad", () => {
  it("fill:false gives no ad", async () => {
    const r = await requestAd(cfg, { topics: ["travel"] }, { fetchImpl: fakeBlisscco().fetchImpl });
    expect(r).toEqual({ ad: null, reason: "no_fill" });
  });
  it("no valid topics means no request at all", async () => {
    const fake = fakeBlisscco();
    const r = await requestAd(cfg, { topics: ["Bad Topic!"] }, { fetchImpl: fake.fetchImpl });
    expect(r.reason).toBe("no_fill");
    expect(fake.calls).toHaveLength(0);
  });
});

describe("Scenario 4: Blisscco unavailable", () => {
  it("network error, 503, and timeout all become 'no ad' without throwing", async () => {
    expect((await requestAd(cfg, { topics: ["gaming"] }, { fetchImpl: fakeBlisscco({ mode: "down" }).fetchImpl })).reason).toBe("unavailable");
    const fiveOhThree = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    expect((await requestAd(cfg, { topics: ["gaming"] }, { fetchImpl: fiveOhThree })).reason).toBe("unavailable");
    const slow = await requestAd(cfg, { topics: ["gaming"] }, { fetchImpl: fakeBlisscco({ mode: "timeout" }).fetchImpl, timeoutMs: 30 });
    expect(slow).toEqual({ ad: null, reason: "unavailable" });
  });
});

describe("Scenario 5: invalid publisher credentials", () => {
  it("401 gives no ad and reason 'unauthorized'", async () => {
    const r = await requestAd({ baseUrl: BASE, apiKey: "blc_test_wrong" }, { topics: ["gaming"] }, { fetchImpl: fakeBlisscco().fetchImpl });
    expect(r).toEqual({ ad: null, reason: "unauthorized" });
  });
});

describe("Scenario 6: duplicate impression", () => {
  it("first report is recorded, second is duplicate (idempotent)", async () => {
    const fake = fakeBlisscco();
    expect(await reportImpression(cfg, "tok-gaming.abc_123", { fetchImpl: fake.fetchImpl })).toBe("recorded");
    expect(await reportImpression(cfg, "tok-gaming.abc_123", { fetchImpl: fake.fetchImpl })).toBe("duplicate");
    expect(fake.calls[0].body).toEqual({ token: "tok-gaming.abc_123", event: "impression" });
    expect(fake.calls[0].headers.Authorization).toBe(undefined); // impression needs no API key
  });
  it("bad token shape is rejected locally with no request; Blisscco 401 is 'rejected'; outage is 'failed'", async () => {
    const fake = fakeBlisscco();
    expect(await reportImpression(cfg, "bad token!", { fetchImpl: fake.fetchImpl })).toBe("rejected");
    expect(fake.calls).toHaveLength(0);
    expect(await reportImpression(cfg, "forged", { fetchImpl: fake.fetchImpl })).toBe("rejected");
    expect(await reportImpression(cfg, "tok-x", { fetchImpl: fakeBlisscco({ mode: "down" }).fetchImpl })).toBe("failed");
  });
});

describe("Scenario 7: several questions in one session", () => {
  it("already shown ads are sent as exclude_ad_ids, so the next question gets a different/no ad", async () => {
    const fake = fakeBlisscco();
    const first = await requestAd(cfg, { topics: ["gaming", "food"] }, { fetchImpl: fake.fetchImpl });
    expect(first.ad?.id).toBe(GAMING_AD_ID);
    const second = await requestAd(cfg, { topics: ["gaming", "food"], excludeAdIds: [GAMING_AD_ID] }, { fetchImpl: fake.fetchImpl });
    expect(second.ad?.id).toBe(FOOD_AD_ID);
    expect((fake.calls[1].body as { exclude_ad_ids: string[] }).exclude_ad_ids).toEqual([GAMING_AD_ID]);
  });
});

describe("Ad content is handled safely", () => {
  it("rejects javascript:, http:, credentialed and malformed destination URLs", () => {
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("http://a.example")).toBeNull();
    expect(safeHttpsUrl("https://user:pw@a.example")).toBeNull();
    expect(safeHttpsUrl("not a url")).toBeNull();
    expect(safeHttpsUrl("https://a.example/x")).toBe("https://a.example/x");
  });
  it("a malformed ad response yields no ad", async () => {
    const r = await requestAd(cfg, { topics: ["gaming"] }, { fetchImpl: fakeBlisscco({ mode: "badshape" }).fetchImpl });
    expect(r).toEqual({ ad: null, reason: "invalid_response" });
  });
  it("only whitelisted fields survive; control characters are stripped; unsponsored responses are dropped", () => {
    const ad = parseAdResponse({
      fill: true,
      sponsored: true,
      ad: { id: GAMING_AD_ID, headline: "Hi\u0000 there", body: "Body", cta_text: null, destination_url: "https://a.example", advertiser_email: "x@y.z" },
    });
    expect(ad?.headline).toBe("Hi there");
    expect(Object.keys(ad ?? {}).sort()).toEqual(["body", "ctaText", "destinationUrl", "headline", "id", "impressionToken"]);
    expect(parseAdResponse({ fill: true, sponsored: false, ad: { id: GAMING_AD_ID } })).toBeNull();
    expect(parseAdResponse(null)).toBeNull();
  });
});
