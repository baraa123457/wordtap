import { NextResponse } from "next/server";
import { getCorsHeaders, guardApiRequestShared, handleCorsPreflight } from "@/lib/api-guard";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

type SubtitleHealthPayload = {
  platform: string;
  status: "healthy_dom" | "canvas_or_broken_dom" | "no_active_video" | string;
  url?: string;
  timestamp?: number;
  reason?: string;
  hasCanvas?: boolean;
  hasDomSubs?: boolean;
  hasTextTracks?: boolean;
};

// In-memory telemetry cache for the latest health status per platform (bounded to prevent memory exhaustion)
const MAX_PLATFORMS = 50;
const latestPlatformHealth = new Map<string, SubtitleHealthPayload>();

function sanitizePlatform(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function sanitizeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.slice(0, 300);
  }
  return undefined;
}

export async function POST(req: Request) {
  const blocked = await guardApiRequestShared(req, "telemetry-subtitle-health", 60);
  if (blocked) return blocked;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = (await req.json()) as SubtitleHealthPayload;
    const cleanPlatform = sanitizePlatform(body?.platform);
    const cleanStatus = typeof body?.status === "string" ? body.status.slice(0, 50) : "";

    if (!cleanPlatform || !cleanStatus) {
      return NextResponse.json(
        { ok: false, error: "Valid platform identifier and status are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const payload: SubtitleHealthPayload = {
      platform: cleanPlatform,
      status: cleanStatus,
      url: sanitizeUrl(body.url),
      timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
      reason: body.reason ? String(body.reason).slice(0, 200) : undefined,
      hasCanvas: Boolean(body.hasCanvas),
      hasDomSubs: Boolean(body.hasDomSubs),
      hasTextTracks: Boolean(body.hasTextTracks),
    };

    // Ensure bounded memory: evict oldest entry if maximum cache size reached
    if (latestPlatformHealth.size >= MAX_PLATFORMS && !latestPlatformHealth.has(cleanPlatform)) {
      const oldestKey = latestPlatformHealth.keys().next().value;
      if (oldestKey) {
        latestPlatformHealth.delete(oldestKey);
      }
    }

    latestPlatformHealth.set(cleanPlatform, payload);

    if (payload.status === "canvas_or_broken_dom") {
      console.warn(
        `[WordTap Subtitle Alert] Degraded subtitles on platform "${payload.platform}". URL: ${payload.url || "N/A"}. Reason: ${payload.reason || "DOM selector mismatch/canvas"}. Users falling back to Alt+S Screen OCR.`,
      );
    }

    return NextResponse.json({ ok: true, received: true }, { headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse telemetry";
    return NextResponse.json({ ok: false, error: message }, { status: 400, headers: corsHeaders });
  }
}

export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  const summary: Record<string, SubtitleHealthPayload> = {};
  for (const [platform, data] of latestPlatformHealth.entries()) {
    summary[platform] = data;
  }
  return NextResponse.json({ ok: true, health: summary }, { headers: corsHeaders });
}
