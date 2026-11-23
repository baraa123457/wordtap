import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "local";
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Same-origin navigations or server-side fetches

  let origUrl: URL;
  let reqUrl: URL;
  try {
    reqUrl = new URL(req.url);
    origUrl = new URL(origin);
  } catch {
    return false;
  }

  // 1. Browser extension protocols
  if (
    origUrl.protocol === "chrome-extension:" ||
    origUrl.protocol === "moz-extension:"
  ) {
    return true;
  }

  // 2. Strict local development hostnames (strictly "localhost" or "127.0.0.1", eliminating prefix bypasses like localhost.attacker.com)
  if (origUrl.hostname === "localhost" || origUrl.hostname === "127.0.0.1") {
    return true;
  }

  if (origUrl.host === reqUrl.host) return true;

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) {
    try {
      if (new URL(configuredOrigin).host === origUrl.host) return true;
    } catch {
      // ignore invalid env URL
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    try {
      if (new URL(`https://${vercelUrl}`).host === origUrl.host) return true;
    } catch {
      // ignore invalid vercel URL
    }
  }

  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) {
    return {};
  }

  if (isAllowedOrigin(req)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    };
  }

  return {};
}

export function handleCorsPreflight(req: Request): NextResponse {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export function guardApiRequest(
  req: Request,
  routeKey: string,
  maxPerMinute = 60,
): NextResponse | null {
  const cors = getCorsHeaders(req);

  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers: cors });
  }

  const now = Date.now();
  const key = `${routeKey}:${getClientIp(req)}`;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      // Prune expired buckets first
      for (const [k, b] of buckets.entries()) {
        if (now >= b.resetAt) {
          buckets.delete(k);
        }
      }
      // If still overflowing, evict oldest
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) buckets.delete(oldestKey);
      }
    }
    bucket = { count: 0, resetAt: now + 60_000 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > maxPerMinute) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...cors,
        },
      },
    );
  }

  return null;
}

/**
 * Shared (cross-instance) rate limiter.
 *
 * `guardApiRequest` keeps its counters in the memory of ONE serverless instance. On Vercel many
 * instances run in parallel (and cold starts reset them), so the real limit is far higher than
 * `maxPerMinute`. This version also counts in Upstash Redis (REST API, no extra dependency), so
 * every instance shares one counter per client IP.
 *
 * - Works with Upstash (UPSTASH_REDIS_REST_URL / _TOKEN) or Vercel KV (KV_REST_API_URL / _TOKEN).
 * - Without those env vars it behaves exactly like `guardApiRequest` (per-instance only).
 * - Fails OPEN: if Redis is slow or down, requests are allowed instead of taking the site down.
 */
function sharedStoreConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export async function guardApiRequestShared(
  req: Request,
  routeKey: string,
  maxPerMinute = 60,
): Promise<NextResponse | null> {
  // 1. Origin check + cheap per-instance counter (also protects when Redis is not configured).
  const local = guardApiRequest(req, routeKey, maxPerMinute);
  if (local) return local;

  const store = sharedStoreConfig();
  if (!store) return null;

  const now = Date.now();
  const windowId = Math.floor(now / 60_000);
  const ip = getClientIp(req).replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 64);
  const key = `rl:${routeKey}:${ip}:${windowId}`;

  try {
    const res = await fetch(`${store.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, 90],
      ]),
      signal: AbortSignal.timeout(800),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result);
    if (Number.isFinite(count) && count > maxPerMinute) {
      const retryAfter = Math.max(1, 60 - Math.floor((now % 60_000) / 1000));
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(retryAfter), ...getCorsHeaders(req) } },
      );
    }
  } catch {
    // Fail open: a Redis outage must not take the API down.
  }
  return null;
}
