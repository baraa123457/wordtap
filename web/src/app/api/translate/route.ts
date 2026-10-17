import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") || "").trim();
  const src = url.searchParams.get("src") || "auto";
  const target = url.searchParams.get("target") || "ar";
  const forceExact = url.searchParams.get("forceExact") === "true";
  return handleTranslate(text, src, target, forceExact);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body.text || "").trim();
    const src = body.src || "auto";
    const target = body.target || "ar";
    const forceExact = Boolean(body.forceExact);
    return handleTranslate(text, src, target, forceExact);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid JSON" }, { status: 400 });
  }
}

async function handleTranslate(
  text: string,
  src: string,
  target: string,
  forceExact = false,
) {
  try {
    if (!text) {
      return NextResponse.json({
        text: "",
        translation: "",
        detectedSrcLang: src === "auto" ? "en" : src,
        sourcePronunciation: "",
        targetPronunciation: "",
        definitions: [],
        correction: null,
      });
    }

    const dtParams = forceExact
      ? "&dt=t&dt=bd&dt=rm"
      : "&dt=t&dt=bd&dt=rm&dt=qca&dt=sp";

    const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(
      src,
    )}&tl=${encodeURIComponent(target)}${dtParams}&q=${encodeURIComponent(text)}`;

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

    // Check for spelling correction in data[7]
    let correction: {
      correctedText: string;
      originalText: string;
      autoCorrected: boolean;
    } | null = null;

    if (
      !forceExact &&
      data &&
      Array.isArray(data[7]) &&
      data[7].length >= 2 &&
      typeof data[7][1] === "string" &&
      data[7][1].trim()
    ) {
      const clean = data[7][1].replace(/<[^>]+>/g, "").trim();
      if (clean.toLowerCase() !== text.toLowerCase()) {
        correction = {
          correctedText: clean,
          originalText: text,
          autoCorrected: Boolean(data[7][5]),
        };
      }
    }

    // If auto-detect misclassified an English typo (e.g. 'reciept' -> 'lus'), retry with sl=en to check for spell correction
    if (
      !forceExact &&
      !correction &&
      (src === "auto" || src === "en") &&
      /^[a-zA-Z\s'-]+$/.test(text)
    ) {
      try {
        const enUrl = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(
          target,
        )}&dt=t&dt=bd&dt=rm&dt=qca&dt=sp&q=${encodeURIComponent(text)}`;
        const enRes = await fetch(enUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (enRes.ok) {
          const enData = await enRes.json();
          if (
            Array.isArray(enData[7]) &&
            enData[7].length >= 2 &&
            typeof enData[7][1] === "string" &&
            enData[7][1].trim()
          ) {
            const clean = enData[7][1].replace(/<[^>]+>/g, "").trim();
            if (clean.toLowerCase() !== text.toLowerCase()) {
              data = enData;
              correction = {
                correctedText: clean,
                originalText: text,
                autoCorrected: Boolean(enData[7][5]),
              };
            }
          }
        }
      } catch (e) {
        // ignore retry error
      }
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

      const detectedSrcLang =
        correction && correction.autoCorrected
          ? "en"
          : typeof data[2] === "string"
          ? data[2]
          : src === "auto"
          ? "en"
          : src;

      return NextResponse.json({
        text,
        translation: translation || text,
        detectedSrcLang,
        sourcePronunciation,
        targetPronunciation,
        definitions,
        correction,
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
        correction: null,
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
