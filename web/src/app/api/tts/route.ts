import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";

export async function GET(req: Request) {
  const blocked = guardApiRequest(req, "tts", 60);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    const text = (url.searchParams.get("text") || "").trim().slice(0, 500);
    const lang = (url.searchParams.get("lang") || "ar").trim();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const prefix = lang.replace(/[^a-zA-Z-]/g, "").slice(0, 5).toLowerCase() || "en";
    const googleTtsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${encodeURIComponent(
      prefix.slice(0, 2),
    )}&q=${encodeURIComponent(text)}`;

    const res = await fetch(googleTtsUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch speech audio" },
        { status: res.status },
      );
    }

    const audioBuffer = await res.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err: unknown) {
    console.error("TTS API error:", err);
    const message = err instanceof Error && err.message ? err.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
