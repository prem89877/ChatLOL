import type { ImpressionStatus, SponsoredAd } from "./ads/types";

/**
 * Browser API layer for sponsored ads. Both functions NEVER throw and never block the chat:
 * any failure, timeout or odd response simply means "no ad".
 *
 *   POST /api/ads             { question, exclude_ad_ids } -> { ad: SponsoredAd | null }
 *   POST /api/ads/impression  { token }                    -> { status }
 */
export const AD_CLIENT_TIMEOUT_MS = 5000;

async function postJson(url: string, body: unknown, timeoutMs: number, fetchImpl: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Re-checks the shape so a bad server reply can never put odd values into the page. */
export function isSponsoredAd(value: unknown): value is SponsoredAd {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  const https = typeof a.destinationUrl === "string" && a.destinationUrl.startsWith("https://");
  return (
    typeof a.id === "string" &&
    typeof a.headline === "string" &&
    typeof a.body === "string" &&
    (a.ctaText === null || typeof a.ctaText === "string") &&
    https &&
    (a.impressionToken === null || typeof a.impressionToken === "string")
  );
}

export async function fetchSponsoredAd(
  question: string,
  excludeAdIds: string[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = AD_CLIENT_TIMEOUT_MS,
): Promise<SponsoredAd | null> {
  const data = (await postJson("/api/ads", { question, exclude_ad_ids: excludeAdIds }, timeoutMs, fetchImpl)) as
    | { ad?: unknown }
    | null;
  return data && isSponsoredAd(data.ad) ? data.ad : null;
}

/** Reports one impression. Blisscco de-duplicates, so a single retry after a failure is safe. */
export async function reportAdImpression(
  token: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = AD_CLIENT_TIMEOUT_MS,
): Promise<ImpressionStatus> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = (await postJson("/api/ads/impression", { token }, timeoutMs, fetchImpl)) as { status?: unknown } | null;
    const status = data?.status;
    if (status === "recorded" || status === "duplicate" || status === "rejected") return status;
  }
  return "failed";
}
