// Server-only Blisscco client. Never import this file from a client component.
// Sends ONLY: topic slugs, optional ids of ads already shown, a random idempotency key, and the publisher key
// in the Authorization header. No question text, no user id, no email, no conversation.

import type { AdLookupReason, ImpressionStatus, SponsoredAd } from "./types";

export type AdsConfig = { baseUrl: string; apiKey: string };

export const AD_TIMEOUT_MS = 2500;
const MAX_RESPONSE_CHARS = 16_000;
const HEADLINE_MAX = 90; // same limits Blisscco enforces on creatives
const BODY_MAX = 300;
const CTA_MAX = 30;
const URL_MAX = 2048;
const TOKEN_MAX = 512;
const TOKEN_RE = /^[A-Za-z0-9._-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPIC_RE = /^[a-z0-9_]{1,50}$/;

type Env = Record<string, string | undefined>;
type FetchLike = typeof fetch;

/** Ads are OFF unless BLISSCCO_ADS_ENABLED=true AND the base URL and key are valid. Fails closed. */
export function getAdsConfig(env: Env = process.env): AdsConfig | null {
  if (env.BLISSCCO_ADS_ENABLED?.trim().toLowerCase() !== "true") return null;
  const base = env.BLISSCCO_API_BASE_URL?.trim();
  const apiKey = env.BLISSCCO_PUBLISHER_API_KEY?.trim();
  if (!base || !apiKey || /\s/.test(apiKey)) return null;
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password) return null;
    return { baseUrl: base.replace(/\/+$/, ""), apiKey };
  } catch {
    return null;
  }
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= max ? text : null;
}

/** https only, no credentials in the URL, no control characters. Returns the normalized href or null. */
export function safeHttpsUrl(raw: unknown): string | null {
  try {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > URL_MAX) return null;
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    if (/[\u0000-\u0020\u007f]/.test(parsed.href)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Accept only the exact Blisscco success shape; rebuild the ad from whitelisted fields. */
export function parseAdResponse(data: unknown): SponsoredAd | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.fill !== true || d.sponsored !== true) return null;
  const ad = d.ad as Record<string, unknown> | null | undefined;
  if (!ad || typeof ad !== "object") return null;
  const id = typeof ad.id === "string" && UUID_RE.test(ad.id) ? ad.id : null;
  const headline = clean(ad.headline, HEADLINE_MAX);
  const body = clean(ad.body, BODY_MAX);
  const destinationUrl = safeHttpsUrl(ad.destination_url);
  if (!id || !headline || !body || !destinationUrl) return null;
  const ctaText = ad.cta_text === null || ad.cta_text === undefined ? null : clean(ad.cta_text, CTA_MAX);
  const tracking = d.tracking as Record<string, unknown> | undefined;
  const rawToken = tracking && typeof tracking === "object" ? tracking.token : undefined;
  const impressionToken =
    typeof rawToken === "string" && rawToken.length <= TOKEN_MAX && TOKEN_RE.test(rawToken) ? rawToken : null;
  return { id, headline, body, ctaText, destinationUrl, impressionToken };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length > MAX_RESPONSE_CHARS) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function randomKey(): string {
  return globalThis.crypto.randomUUID();
}

/** Asks Blisscco for one ad. NEVER throws: every failure becomes { ad: null, reason }. */
export async function requestAd(
  config: AdsConfig,
  input: { topics: string[]; excludeAdIds?: string[] },
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<{ ad: SponsoredAd | null; reason: AdLookupReason }> {
  const topics = input.topics.filter((t) => TOPIC_RE.test(t));
  if (topics.length === 0) return { ad: null, reason: "no_fill" };
  const exclude = (input.excludeAdIds ?? []).filter((id) => UUID_RE.test(id)).slice(-20);
  const payload: { topic: string; fallback_topics?: string[]; exclude_ad_ids?: string[] } = { topic: topics[0] };
  if (topics.length > 1) payload.fallback_topics = topics.slice(1, 3);
  if (exclude.length > 0) payload.exclude_ad_ids = exclude;

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    return await withTimeout(opts.timeoutMs ?? AD_TIMEOUT_MS, async (signal) => {
      const res = await doFetch(`${config.baseUrl}/api/v1/ads/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "X-Blisscco-Tracking": "1",
          "Idempotency-Key": randomKey(),
        },
        body: JSON.stringify(payload),
        signal,
        cache: "no-store",
      });
      if (res.status === 401) return { ad: null, reason: "unauthorized" as const };
      if (res.status === 429) return { ad: null, reason: "rate_limited" as const };
      if (!res.ok) return { ad: null, reason: "unavailable" as const };
      const data = await readJson(res);
      if (data && typeof data === "object" && (data as { fill?: unknown }).fill === false) {
        return { ad: null, reason: "no_fill" as const };
      }
      const ad = parseAdResponse(data);
      return ad ? { ad, reason: "ok" as const } : { ad: null, reason: "invalid_response" as const };
    });
  } catch {
    return { ad: null, reason: "unavailable" };
  }
}

/** Forwards an impression token to Blisscco. Needs no API key (the signed token is the permission). Never throws. */
export async function reportImpression(
  config: Pick<AdsConfig, "baseUrl">,
  token: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<ImpressionStatus> {
  if (typeof token !== "string" || token.length === 0 || token.length > TOKEN_MAX || !TOKEN_RE.test(token)) {
    return "rejected";
  }
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    return await withTimeout(opts.timeoutMs ?? AD_TIMEOUT_MS, async (signal) => {
      const res = await doFetch(`${config.baseUrl}/api/v1/ads/impression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, event: "impression" }),
        signal,
        cache: "no-store",
      });
      if (res.status === 400 || res.status === 401) return "rejected" as const;
      if (!res.ok) return "failed" as const;
      const data = (await readJson(res)) as { ok?: unknown; status?: unknown } | null;
      if (data?.ok === true && data.status === "recorded") return "recorded" as const;
      if (data?.ok === true && data.status === "duplicate") return "duplicate" as const;
      return "failed" as const;
    });
  } catch {
    return "failed";
  }
}
