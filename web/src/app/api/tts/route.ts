import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const text = (url.searchParams.get("text") || "").trim();
    const lang = (url.searchParams.get("lang") || "ar").trim();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // Google Translate TTS endpoint
    const prefix = lang.slice(0, 2).toLowerCase();
    const googleTtsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${encodeURIComponent(
      prefix,
    )}&q=${encodeURIComponent(text.slice(0, 500))}`;

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
  } catch (err: any) {
    console.error("TTS API error:", err);
    return NextResponse.json(
      { error: err.message || "TTS failed" },
      { status: 500 },
    );
  }
}
