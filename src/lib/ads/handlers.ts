// Request handlers for ChatLOL's two ad routes. The route files only supply real dependencies;
// tests supply fakes. Ad problems NEVER become 5xx: the chat must keep working with no ad.

import { MAX_MESSAGE_CHARS } from "../limits";
import { getAdsConfig, reportImpression, requestAd, type AdsConfig } from "./blisscco";
import { deriveTopics } from "./topic";

type Env = Record<string, string | undefined>;
export type RateLimiter = (userId: string) => boolean; // true = blocked

export type AdsDeps = {
  getUserId: () => Promise<string | null>;
  env?: Env;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  timeoutMs?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Small per-user limiter (best-effort, resets on cold start), same idea as /api/chat. */
export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  return (userId) => {
    const t = now();
    const recent = (hits.get(userId) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) {
      hits.set(userId, recent);
      return true;
    }
    recent.push(t);
    hits.set(userId, recent);
    if (hits.size > 5000) hits.clear();
    return false;
  };
}

async function authorize(deps: AdsDeps): Promise<string | null> {
  try {
    return await deps.getUserId();
  } catch {
    return null;
  }
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > 200_000) return null;
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** POST /api/ads  body: { question: string, exclude_ad_ids?: string[] } -> { ad: SponsoredAd | null } */
export async function handleAdRequest(req: Request, deps: AdsDeps): Promise<Response> {
  const userId = await authorize(deps);
  if (!userId) return json({ error: { message: "Your session expired. Please log in again." } }, 401);

  const body = await readBody(req);
  const question = body?.question;
  if (typeof question !== "string" || !question.trim() || question.length > MAX_MESSAGE_CHARS) {
    return json({ error: { message: "Invalid request." } }, 400);
  }
  const excludeRaw = body?.exclude_ad_ids;
  const exclude = Array.isArray(excludeRaw)
    ? excludeRaw.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)).slice(-20)
    : [];

  if (deps.limiter?.(userId)) return json({ ad: null, reason: "rate_limited" });

  const config: AdsConfig | null = getAdsConfig(deps.env ?? process.env);
  if (!config) return json({ ad: null, reason: "disabled" });

  const topics = deriveTopics(question);
  if (topics.length === 0) return json({ ad: null, reason: "no_topic" });

  const result = await requestAd(config, { topics, excludeAdIds: exclude }, { fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs });
  if (result.reason === "unauthorized") console.error("[ads] Blisscco rejected the publisher key (401). Check BLISSCCO_PUBLISHER_API_KEY.");
  return json({ ad: result.ad, reason: result.reason });
}

/** POST /api/ads/impression  body: { token: string } -> { status } */
export async function handleImpression(req: Request, deps: AdsDeps): Promise<Response> {
  const userId = await authorize(deps);
  if (!userId) return json({ error: { message: "Your session expired. Please log in again." } }, 401);

  const body = await readBody(req);
  const token = body?.token;
  if (typeof token !== "string" || !token) return json({ error: { message: "Invalid request." } }, 400);

  const config = getAdsConfig(deps.env ?? process.env);
  if (!config) return json({ status: "failed" });

  const status = await reportImpression(config, token, { fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs });
  return json({ status });
}
