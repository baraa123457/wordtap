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

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Same-origin navigations or server-side fetches

  if (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
  ) {
    return true;
  }

  try {
    const reqUrl = new URL(req.url);
    const origUrl = new URL(origin);
    if (origUrl.host === reqUrl.host) return true;
  } catch {
    return false;
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin) {
    try {
      if (new URL(configuredOrigin).host === new URL(origin).host) return true;
    } catch {
      // ignore invalid env URL
    }
  }

  // Optional authenticated bearer token allows cross-origin clients
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ") && auth.length > 20) {
    return true;
  }

  return false;
}

export function guardApiRequest(
  req: Request,
  routeKey: string,
  maxPerMinute = 60,
): NextResponse | null {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const now = Date.now();
  const key = `${routeKey}:${getClientIp(req)}`;
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
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
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  return null;
}
