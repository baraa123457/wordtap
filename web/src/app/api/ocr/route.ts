import { NextResponse } from "next/server";
import { createWorker, type Worker } from "tesseract.js";
import { guardApiRequest } from "@/lib/api-guard";

const MAX_BASE64_LENGTH = 5_500_000; // ~4 MB decoded image

const TESSERACT_LANG_MAP: Record<string, string> = {
  en: "eng",
  de: "deu",
  fr: "fra",
  es: "spa",
  it: "ita",
  pt: "por",
  tr: "tur",
  ru: "rus",
  ar: "ara",
  ja: "jpn",
  ko: "kor",
  zh: "chi_sim",
};

const workerCache = new Map<string, Promise<Worker>>();

function getWorker(langs: string): Promise<Worker> {
  const existing = workerCache.get(langs);
  if (existing) return existing;

  const created = createWorker(langs.split("+")).catch((err: unknown) => {
    workerCache.delete(langs);
    throw err;
  });
  workerCache.set(langs, created);
  return created;
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "ocr", 20);
  if (blocked) return blocked;

  try {
    const body = (await req.json()) as { image?: unknown; lang?: unknown };
    const imageBase64 = body.image;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { ok: false, error: "Image data URL is required" },
        { status: 400 },
      );
    }

    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "Image is too large (max 4 MB)" },
        { status: 413 },
      );
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Image data is empty" },
        { status: 400 },
      );
    }

    const rawLang = typeof body.lang === "string" ? body.lang.toLowerCase().slice(0, 2) : "auto";
    const mapped = TESSERACT_LANG_MAP[rawLang];
    const workerLangs = mapped && mapped !== "eng" ? `eng+${mapped}` : "eng+deu";

    let text = "";
    let confidence = 0;

    const tesseractPromise = (async () => {
      const worker = await getWorker(workerLangs);
      const ret = await worker.recognize(buffer);
      const rawText = ret?.data?.text || "";
      confidence = ret?.data?.confidence || 0;
      return rawText
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .join(" ")
        .trim();
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("Tesseract timeout")), 2000),
    );

    try {
      text = await Promise.race([tesseractPromise, timeoutPromise]);
    } catch (tessErr) {
      console.warn("Tesseract worker unavailable or timed out, using cloud OCR fallback:", tessErr);
    }

    // Server-side OCR.space fallback using key (env or reliable high-availability key)
    const ocrKey = process.env.OCR_SPACE_API_KEY || "K84725916788957";
    if (!text && ocrKey) {
      const ocrLang = mapped === "chi_sim" ? "chs" : mapped === "deu" ? "ger" : mapped || "eng";
      const form = new URLSearchParams();
      form.append("base64Image", imageBase64);
      form.append("language", ocrLang);
      form.append("scale", "true");
      form.append("detectOrientation", "true");

      try {
        const cloudRes = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          signal: AbortSignal.timeout(6000),
          headers: {
            apikey: ocrKey,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        });

        if (cloudRes.ok) {
          const cloudData = (await cloudRes.json()) as {
            ParsedResults?: Array<{ ParsedText?: string }>;
          };
          const parsed = cloudData?.ParsedResults?.[0]?.ParsedText || "";
          text = parsed
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ")
            .trim();
        }
      } catch (cloudErr) {
        console.warn("Cloud OCR fallback error:", cloudErr);
      }
    }

    return NextResponse.json({ ok: true, text, confidence });
  } catch (err: unknown) {
    console.error("OCR API Error:", err);
    const message = err instanceof Error && err.message ? err.message : "Failed to process image OCR";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
