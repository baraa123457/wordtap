import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCorsHeaders, guardApiRequestShared, handleCorsPreflight } from "@/lib/api-guard";

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

const clipPayloadSchema = z.object({
  word: z.string().trim().min(1).max(120),
  video_id: z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video_id"),
  start_sec: z.number().finite().min(0),
  end_sec: z.number().finite().positive(),
  sentence: z.string().trim().min(3).max(300),
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: Request) {
  const blocked = await guardApiRequestShared(req, "learn-word-clips", 60);
  if (blocked) return blocked;

  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !/^Bearer\s+.+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: corsHeaders },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  let userId: string | null = null;
  if (supabaseUrl && anonKey) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authErr,
    } = await authClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json(
        { error: "Invalid or expired authorization token." },
        { status: 401, headers: corsHeaders },
      );
    }
    userId = user.id;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders });
  }

  const parsed = clipPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid clip payload.", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  const { word, video_id, sentence } = parsed.data;
  const startSec = Math.max(0, Math.floor(parsed.data.start_sec));
  const endSec = Math.ceil(parsed.data.end_sec);
  const duration = endSec - startSec;

  if (endSec <= startSec || duration < 1 || duration > 12) {
    return NextResponse.json(
      { error: "Clip duration must be between 1 and 12 seconds." },
      { status: 400, headers: corsHeaders },
    );
  }

  const normalizedWord = word.toLowerCase();
  const wordRe = new RegExp(`\\b${escapeRegExp(normalizedWord)}\\b`, "i");
  if (!wordRe.test(sentence)) {
    return NextResponse.json(
      { error: "Sentence must contain the target word." },
      { status: 400, headers: corsHeaders },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server storage is not configured." },
      { status: 503, headers: corsHeaders },
    );
  }

  const { error } = await supabase.from("word_clips").upsert(
    {
      word: normalizedWord,
      video_id,
      start_sec: startSec,
      end_sec: endSec,
      sentence,
      source: "user_saved",
      user_id: userId,
    },
    { onConflict: "word,video_id,start_sec", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers: corsHeaders });
}
