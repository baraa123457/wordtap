import { NextResponse } from "next/server";
import { getCorsHeaders, guardApiRequest, handleCorsPreflight } from "@/lib/api-guard";

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

// In-memory telemetry cache for the latest health status per platform
const latestPlatformHealth = new Map<string, SubtitleHealthPayload>();

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "telemetry-subtitle-health", 60);
  if (blocked) return blocked;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = (await req.json()) as SubtitleHealthPayload;
    if (!body || !body.platform || !body.status) {
      return NextResponse.json(
        { ok: false, error: "platform and status are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const payload: SubtitleHealthPayload = {
      platform: String(body.platform).toLowerCase().slice(0, 50),
      status: String(body.status).slice(0, 50),
      url: body.url ? String(body.url).slice(0, 300) : undefined,
      timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
      reason: body.reason ? String(body.reason).slice(0, 200) : undefined,
      hasCanvas: Boolean(body.hasCanvas),
      hasDomSubs: Boolean(body.hasDomSubs),
      hasTextTracks: Boolean(body.hasTextTracks),
    };

    latestPlatformHealth.set(payload.platform, payload);

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
