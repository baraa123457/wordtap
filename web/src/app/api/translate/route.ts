import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") || "").trim();
  const src = url.searchParams.get("src") || "auto";
  const target = url.searchParams.get("target") || "ar";
  return handleTranslate(text, src, target);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body.text || "").trim();
    const src = body.src || "auto";
    const target = body.target || "ar";
    return handleTranslate(text, src, target);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid JSON" }, { status: 400 });
  }
}

async function handleTranslate(text: string, src: string, target: string) {
  try {
    if (!text) {
      return NextResponse.json({
        text: "",
        translation: "",
        detectedSrcLang: src === "auto" ? "en" : src,
        sourcePronunciation: "",
        targetPronunciation: "",
        definitions: [],
      });
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
      src,
    )}&tl=${encodeURIComponent(target)}&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(text)}`;

    let data: any = null;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.warn("Google translate fetch error:", e);
    }

    // If Google returned data successfully:
    if (data && Array.isArray(data[0])) {
      let translation = "";
      let sourcePronunciation = "";
      let targetPronunciation = "";

      for (const item of data[0]) {
        if (!item) continue;
        if (typeof item[0] === "string") {
          translation += item[0];
        }
        if (item[0] === null) {
          if (typeof item[2] === "string") targetPronunciation = item[2];
          if (typeof item[3] === "string") sourcePronunciation = item[3];
        }
      }

      const definitions: Array<{ partOfSpeech: string; meanings: string[] }> = [];
      if (Array.isArray(data[1])) {
        for (const entry of data[1]) {
          if (Array.isArray(entry) && typeof entry[0] === "string" && Array.isArray(entry[1])) {
            definitions.push({
              partOfSpeech: entry[0],
              meanings: entry[1].filter((m: any) => typeof m === "string").slice(0, 5),
            });
          }
        }
      }

      const detectedSrcLang = typeof data[2] === "string" ? data[2] : src === "auto" ? "en" : src;

      return NextResponse.json({
        text,
        translation: translation || text,
        detectedSrcLang,
        sourcePronunciation,
        targetPronunciation,
        definitions,
      });
    }

    // Fallback: MyMemory Translation API
    const pair = `${src === "auto" ? "autodetect" : src}|${target}`;
    const memRes = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`,
    );
    if (memRes.ok) {
      const memData = await memRes.json();
      return NextResponse.json({
        text,
        translation: memData?.responseData?.translatedText || text,
        detectedSrcLang: src === "auto" ? "en" : src,
        sourcePronunciation: "",
        targetPronunciation: "",
        definitions: [],
      });
    }

    throw new Error("All translation providers failed");
  } catch (err: any) {
    console.error("Translation API error:", err);
    return NextResponse.json(
      { error: err.message || "Translation failed" },
      { status: 500 },
    );
  }
}
