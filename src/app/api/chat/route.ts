import { createClient } from "../../../lib/supabase/server";
import { getSupabaseEnv } from "../../../lib/supabase/env";
import {
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "../../../lib/limits";

// Server-only route. API credentials come from environment variables and never reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_BODY_CHARS = 400_000;
const UPSTREAM_CONNECT_TIMEOUT_MS = 30_000;
const SYSTEM_PROMPT =
  "You are chatLOL, a helpful and friendly AI assistant. Reply in the same language the user writes in. Keep answers clear and concise.";

/* ---------- small in-memory rate limit (per user; best-effort, resets on cold start) ---------- */
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

/* ---------- helpers ---------- */
function errorResponse(status: number, message: string, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function getConfig(): { key: string; endpoint: string; model: string } | null {
  const key = process.env.AI_API_KEY?.trim();
  const base = process.env.AI_BASE_URL?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!key || !base || !model) return null;
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return { key, endpoint: `${base.replace(/\/+$/, "")}/chat/completions`, model };
  } catch {
    return null;
  }
}

function parseMessages(body: unknown): { messages: ChatMessage[] } | { error: string } {
  const list = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > 500) {
    return { error: "Invalid request: messages must be a non-empty list." };
  }
  const clean: ChatMessage[] = [];
  for (const item of list) {
    const role = (item as { role?: unknown } | null)?.role;
    const content = (item as { content?: unknown } | null)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { error: "Invalid request: each message needs a valid role and text." };
    }
    const text = content.trim();
    if (!text) return { error: "Invalid request: messages cannot be empty." };
    if (text.length > MAX_MESSAGE_CHARS) {
      return { error: `A message is too long (max ${MAX_MESSAGE_CHARS.toLocaleString("en-US")} characters).` };
    }
    clean.push({ role, content: text });
  }
  if (clean[clean.length - 1].role !== "user") {
    return { error: "Invalid request: the last message must be from the user." };
  }

  // Keep the most recent messages that fit the context limits.
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    total += clean[i].content.length;
    if (kept.length >= MAX_CONTEXT_MESSAGES || (kept.length > 0 && total > MAX_CONTEXT_CHARS)) break;
    kept.unshift(clean[i]);
  }
  while (kept.length > 1 && kept[0].role === "assistant") kept.shift();
  return { messages: kept };
}

function mapProviderError(status: number): Response {
  console.error(`[chat] provider returned status ${status}`);
  if (status === 401 || status === 403) {
    return errorResponse(502, "The AI provider rejected the API key. Check AI_API_KEY on the server.");
  }
  if (status === 404) {
    return errorResponse(502, "The AI provider could not find the model or endpoint. Check AI_MODEL and AI_BASE_URL.");
  }
  if (status === 429) {
    return errorResponse(429, "The AI provider is rate limiting requests or the quota is used up. Wait a moment and retry.");
  }
  if (status >= 500) {
    return errorResponse(502, "The AI provider is having trouble right now. Please retry in a moment.");
  }
  return errorResponse(502, "The AI provider rejected the request.");
}

/** Turn an OpenAI-style SSE response into a plain text stream of the assistant's words. */
function textStreamFromSSE(upstream: Response): ReadableStream<Uint8Array> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const parseLine = (raw: string): string => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return "";
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return "";
    const json = JSON.parse(payload);
    if (json?.error) throw new Error("provider stream error");
    const delta = json?.choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : "";
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Keep reading until there is text to send (or the stream ends),
        // otherwise a chunk with no text would stall the stream.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            const rest = parseLine(buffer);
            if (rest) controller.enqueue(encoder.encode(rest));
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          let out = "";
          for (const line of lines) out += parseLine(line);
          if (out) {
            controller.enqueue(encoder.encode(out));
            return;
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
};

/* ---------- route ---------- */
export async function POST(req: Request): Promise<Response> {
  // Only signed-in users may use the AI. Checked on the server with the Supabase Auth server
  // (the middleware checks too; this is the second, route-level check).
  if (!getSupabaseEnv()) return errorResponse(503, "Supabase is not configured on the server.");
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return errorResponse(401, "Your session expired. Please log in again.");

  const config = getConfig();
  if (!config) {
    return errorResponse(
      500,
      "The AI is not configured on the server. Set AI_API_KEY, AI_BASE_URL and AI_MODEL in .env.local and restart.",
    );
  }

  // Rate limit per signed-in user (more accurate than per IP now that there are accounts).
  if (rateLimited(userId)) {
    return errorResponse(429, "Too many messages in a short time. Please wait a minute and retry.", {
      "Retry-After": "60",
    });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return errorResponse(400, "Invalid request.");
  }
  if (raw.length > MAX_BODY_CHARS) return errorResponse(413, "The request is too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, "Invalid request: body must be JSON.");
  }
  const parsed = parseMessages(body);
  if ("error" in parsed) return errorResponse(400, parsed.error);

  // One abort controller for the upstream call: client cancel + connect timeout.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPSTREAM_CONNECT_TIMEOUT_MS);
  req.signal.addEventListener("abort", () => controller.abort());

  const call = (stream: boolean) =>
    fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...parsed.messages],
        stream,
      }),
      signal: controller.signal,
    });

  try {
    let upstream = await call(true);
    // Some providers reject stream:true; retry once as a normal request.
    if (upstream.status === 400 || upstream.status === 422) upstream = await call(false);
    clearTimeout(timer);

    if (!upstream.ok) return mapProviderError(upstream.status);

    const type = upstream.headers.get("content-type") ?? "";
    if (type.includes("text/event-stream") && upstream.body) {
      return new Response(textStreamFromSSE(upstream), { headers: STREAM_HEADERS });
    }

    // Provider answered without streaming: return the full text in one go.
    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return errorResponse(502, "The AI provider returned an empty response. Please retry.");
    }
    return new Response(text, { headers: STREAM_HEADERS });
  } catch {
    clearTimeout(timer);
    if (timedOut) return errorResponse(504, "The AI provider took too long to respond. Please retry.");
    if (req.signal.aborted) return errorResponse(499, "Request cancelled.");
    console.error("[chat] could not reach the AI provider");
    return errorResponse(502, "Could not reach the AI provider. Please retry.");
  }
}

// Anything other than POST is not supported.
export function GET(): Response {
  return errorResponse(405, "Method not allowed.", { Allow: "POST" });
}
