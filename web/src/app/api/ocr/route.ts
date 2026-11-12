import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";

// Cached worker to avoid re-initializing Tesseract wasm on every request
let cachedWorker: any = null;
let initPromise: Promise<any> | null = null;

async function getWorker() {
  if (cachedWorker) return cachedWorker;
  if (!initPromise) {
    initPromise = (async () => {
      const worker = await createWorker(["eng", "deu"]);
      cachedWorker = worker;
      return worker;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64 = body.image;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { ok: false, error: "Image data URL is required" },
        { status: 400 },
      );
    }

    // Clean data URL prefix to get raw base64 buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Image data is empty" },
        { status: 400 },
      );
    }

    const worker = await getWorker();
    const ret = await worker.recognize(buffer);
    const rawText = ret?.data?.text || "";

    // Clean OCR artifacts, linebreaks, and extra spaces
    const text = rawText
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    return NextResponse.json({
      ok: true,
      text,
      confidence: ret?.data?.confidence || 0,
    });
  } catch (err: any) {
    console.error("OCR API Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process image OCR" },
      { status: 500 },
    );
  }
}
