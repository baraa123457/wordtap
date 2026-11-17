import { NextResponse } from "next/server";
import { createWorker, type Worker } from "tesseract.js";
import { getCorsHeaders, guardApiRequest, handleCorsPreflight } from "@/lib/api-guard";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

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

const OCR_SPACE_LANG_MAP: Record<string, string> = {
  en: "eng",
  ar: "ara",
  es: "spa",
  fr: "fre",
  de: "ger",
  it: "ita",
  pt: "por",
  ru: "rus",
  tr: "tur",
  ja: "jpn",
  ko: "kor",
  zh: "chs",
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

/**
 * Fast cloud OCR engine using OCR.space Engine 2.
 * Engine 2 is multi-threaded, handles rotation and layout automatically in ~400-800ms,
 * and does not require heavy multi-pass scaling or rotation tests.
 */
async function runCloudOcr(imageBase64: string, lang: string): Promise<string> {
  const keys = [
    process.env.OCR_SPACE_API_KEY,
    "helloworld",
  ].filter(Boolean) as string[];

  const ocrLang = OCR_SPACE_LANG_MAP[lang] || "eng";

  for (const apiKey of keys) {
    try {
      const form = new URLSearchParams();
      form.append("base64Image", imageBase64);
      form.append("language", ocrLang);
      form.append("OCREngine", "2"); // Engine 2 is 3-4x faster than Engine 1
      form.append("scale", "false"); // Disable heavy 300DPI upscaling for already resized images
      form.append("detectOrientation", "false"); // Avoid 4-pass rotational delay

      const cloudRes = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        signal: AbortSignal.timeout(4500),
        headers: {
          apikey: apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });

      if (!cloudRes.ok) continue;

      const cloudData = (await cloudRes.json()) as {
        ParsedResults?: Array<{ ParsedText?: string }>;
        OCRExitCode?: number;
        IsErroredOnProcessing?: boolean;
      };

      if (cloudData?.IsErroredOnProcessing) continue;

      const parsed = cloudData?.ParsedResults?.[0]?.ParsedText || "";
      const cleaned = parsed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .trim();

      if (cleaned) {
        return cleaned;
      }
    } catch (err) {
      console.warn("Cloud OCR attempt failed for key:", err);
    }
  }

  return "";
}

/**
 * Local Tesseract WASM recognition (fallback or local dev).
 */
async function runTesseractOcr(buffer: Buffer, lang: string): Promise<{ text: string; confidence: number }> {
  const mapped = TESSERACT_LANG_MAP[lang];
  const workerLangs = mapped && mapped !== "eng" ? `eng+${mapped}` : "eng+deu";
  const worker = await getWorker(workerLangs);
  const ret = await worker.recognize(buffer);
  const rawText = ret?.data?.text || "";
  const confidence = ret?.data?.confidence || 0;
  const cleaned = rawText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return { text: cleaned, confidence };
}

export async function POST(req: Request) {
  const blocked = guardApiRequest(req, "ocr", 20);
  if (blocked) return blocked;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = (await req.json()) as { image?: unknown; lang?: unknown };
    const imageBase64 = body.image;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { ok: false, error: "Image data URL is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "Image is too large (max 4 MB)" },
        { status: 413, headers: corsHeaders },
      );
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Image data is empty" },
        { status: 400, headers: corsHeaders },
      );
    }

    const rawLang = typeof body.lang === "string" ? body.lang.toLowerCase().slice(0, 2) : "auto";
    const isVercelServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    let text = "";
    let confidence = 0;

    // Strategy 1: On Vercel serverless, run ultra-fast Cloud OCR Engine 2 first
    // This avoids cold-starting 30MB Tesseract WASM on a serverless container.
    if (isVercelServerless) {
      text = await runCloudOcr(imageBase64, rawLang);
      if (text) {
        return NextResponse.json(
          { ok: true, text, confidence: 95, provider: "cloud-engine-2" },
          { headers: corsHeaders },
        );
      }
      // If Cloud OCR returned empty or errored, try Tesseract with a safe timeout
      try {
        const timeoutPromise = new Promise<{ text: string; confidence: number }>((_, reject) =>
          setTimeout(() => reject(new Error("Tesseract timeout")), 4000),
        );
        const res = await Promise.race([runTesseractOcr(buffer, rawLang), timeoutPromise]);
        text = res.text;
        confidence = res.confidence;
      } catch (tessErr) {
        console.warn("Tesseract fallback on Vercel timed out or failed:", tessErr);
      }
    } else {
      // Local dev environment: Run Cloud OCR and Tesseract competitively for minimum latency
      const cloudPromise = runCloudOcr(imageBase64, rawLang);
      const tesseractPromise = runTesseractOcr(buffer, rawLang).then((r) => r.text).catch(() => "");

      // Whichever completes first with non-empty text wins
      try {
        const first = await Promise.race([
          cloudPromise.then((t) => (t ? { text: t, prov: "cloud" } : Promise.reject("empty"))),
          tesseractPromise.then((t) => (t ? { text: t, prov: "tesseract" } : Promise.reject("empty"))),
        ]);
        text = first.text;
      } catch {
        // If neither resolved first, wait for cloud then tesseract
        text = (await cloudPromise) || (await tesseractPromise);
      }
    }

    return NextResponse.json({ ok: true, text, confidence }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("OCR API Error:", err);
    const message = err instanceof Error && err.message ? err.message : "Failed to process image OCR";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: corsHeaders });
  }
}
