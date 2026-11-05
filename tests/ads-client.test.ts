import { describe, expect, it } from "vitest";
import { fetchSponsoredAd, isSponsoredAd, reportAdImpression } from "@/lib/adsApi";

const AD = { id: "11111111-1111-4111-8111-111111111111", headline: "H", body: "B", ctaText: null, destinationUrl: "https://a.example", impressionToken: "tok-1" };
const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("browser ad API never throws and never blocks chat", () => {
  it("returns the ad when the server sends a valid one", async () => {
    expect(await fetchSponsoredAd("q", [], reply({ ad: AD }))).toEqual(AD);
  });
  it("returns null for no ad, server errors, bad JSON, network errors and timeouts", async () => {
    expect(await fetchSponsoredAd("q", [], reply({ ad: null }))).toBeNull();
    expect(await fetchSponsoredAd("q", [], reply({ error: "x" }, 500))).toBeNull();
    expect(await fetchSponsoredAd("q", [], (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchSponsoredAd("q", [], (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch)).toBeNull();
    const hang = ((_u: string, init?: RequestInit) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await fetchSponsoredAd("q", [], hang, 30)).toBeNull();
  });
  it("refuses ads that are not https or have the wrong shape", () => {
    expect(isSponsoredAd({ ...AD, destinationUrl: "javascript:alert(1)" })).toBe(false);
    expect(isSponsoredAd({ ...AD, destinationUrl: "http://a.example" })).toBe(false);
    expect(isSponsoredAd({ ...AD, headline: 5 })).toBe(false);
    expect(isSponsoredAd(null)).toBe(false);
    expect(isSponsoredAd(AD)).toBe(true);
  });
  it("impression: recorded and duplicate are final; one retry after a failure; then 'failed'", async () => {
    expect(await reportAdImpression("t", reply({ status: "recorded" }))).toBe("recorded");
    expect(await reportAdImpression("t", reply({ status: "duplicate" }))).toBe("duplicate");
    let n = 0;
    const flaky = (async () => (++n === 1 ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ status: "recorded" })))) as unknown as typeof fetch;
    expect(await reportAdImpression("t", flaky)).toBe("recorded");
    expect(n).toBe(2);
    expect(await reportAdImpression("t", reply({ status: "failed" }, 200))).toBe("failed");
  });
});
