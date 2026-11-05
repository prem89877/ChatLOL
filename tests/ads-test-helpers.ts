// Mocked Blisscco for tests. No network. No real keys: every key below is a fake placeholder.
export const FAKE_KEY = "blc_test_placeholder_not_a_real_key";
export const BASE = "https://blisscco.test";
export const GAMING_AD_ID = "11111111-1111-4111-8111-111111111111";
export const FOOD_AD_ID = "22222222-2222-4222-8222-222222222222";
export const ENV = { BLISSCCO_ADS_ENABLED: "true", BLISSCCO_API_BASE_URL: BASE, BLISSCCO_PUBLISHER_API_KEY: FAKE_KEY };

export type Call = { url: string; headers: Record<string, string>; body: unknown };

const CATALOG: Record<string, { id: string; headline: string; token: string }> = {
  gaming: { id: GAMING_AD_ID, headline: "Pro Gaming Laptops", token: "tok-gaming.abc_123" },
  food: { id: FOOD_AD_ID, headline: "Meal Kits", token: "tok-food.abc_123" },
};

const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

/** Behaves like Blisscco: picks an ad by topic (then fallbacks), skips excluded ids, dedupes impressions by token. */
export function fakeBlisscco(opts: { mode?: "normal" | "down" | "unauthorized" | "badshape" | "timeout" } = {}) {
  const calls: Call[] = [];
  const seenImpressions = new Set<string>();
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, headers, body });
    if (opts.mode === "timeout") {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }
    if (opts.mode === "down") throw new TypeError("fetch failed");
    if (url.endsWith("/api/v1/ads/match")) {
      if (opts.mode === "unauthorized" || headers.Authorization !== `Bearer ${FAKE_KEY}`) return ok({ error: "unauthorized" }, 401);
      if (opts.mode === "badshape") return ok({ fill: true, sponsored: true, ad: { id: "x", headline: "<script>", destination_url: "javascript:alert(1)" } });
      const topics = [body.topic, ...(body.fallback_topics ?? [])] as string[];
      for (const t of topics) {
        const ad = CATALOG[t];
        if (ad && !(body.exclude_ad_ids ?? []).includes(ad.id)) {
          return ok({
            fill: true,
            sponsored: true,
            ad: { id: ad.id, headline: ad.headline, body: "Great deals.", cta_text: "Shop now", destination_url: "https://advertiser.example/landing?x=1" },
            tracking: { token: ad.token, expires_at: "2099-01-01T00:00:00.000Z", events: ["impression"] },
          });
        }
      }
      return ok({ fill: false });
    }
    if (url.endsWith("/api/v1/ads/impression")) {
      if (!/^tok-/.test(body.token)) return ok({ error: "unauthorized" }, 401);
      const dup = seenImpressions.has(body.token);
      seenImpressions.add(body.token);
      return ok({ ok: true, status: dup ? "duplicate" : "recorded" });
    }
    return ok({ error: "not_found" }, 404);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls, seenImpressions };
}
