import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCorsHeaders, guardApiRequestShared, handleCorsPreflight } from "@/lib/api-guard";
import {
  fetchAuthenticFallbackContexts,
  VideoDiscoveryService,
} from "@/lib/video/video-discovery-service";
import { isNonEnglishVideoTitle } from "@/lib/video/video-language-filter";
import { VideoRepository } from "@/lib/video/video-repository";
import type { VideoDiscoveryDiagnostics, VideoDiscoveryResponse } from "@/lib/video/types";

const querySchema = z.object({
  word: z.string().trim().min(1).max(120),
  wordId: z.string().trim().max(80).optional(),
  lang: z.string().trim().max(20).optional().default("en"),
  sourceUrl: z.string().trim().max(500).optional(),
  sentence: z.string().trim().max(600).optional(),
  sourceTitle: z.string().trim().max(300).optional(),
  refresh: z.enum(["0", "1"]).optional().default("0"),
});

const patchSchema = z.object({
  youtubeVideoId: z.string().trim().regex(/^([A-Za-z0-9_-]{11}|wm_[a-f0-9]{16})$/),
});

const videoRepository = new VideoRepository();
const discoveryService = new VideoDiscoveryService();

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET(req: Request) {
  const blocked = await guardApiRequestShared(req, "learn-videos", 45);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    word: url.searchParams.get("word") || "",
    wordId: url.searchParams.get("wordId") || undefined,
    lang: url.searchParams.get("lang") || "en",
    sourceUrl: url.searchParams.get("sourceUrl") || undefined,
    sentence: url.searchParams.get("sentence") || undefined,
    sourceTitle: url.searchParams.get("sourceTitle") || undefined,
    refresh: url.searchParams.get("refresh") === "1" ? "1" : "0",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid target vocabulary word is required." },
      { status: 400, headers: corsHeaders },
    );
  }

  const { word, wordId, lang, sourceUrl, sentence, sourceTitle, refresh } = parsed.data;
  const maxResultsRaw = Number(url.searchParams.get("maxResults") || "8");
  const maxResults = Number.isFinite(maxResultsRaw)
    ? Math.min(Math.max(1, Math.floor(maxResultsRaw)), 10)
    : 8;
  const wordNormalized = word.toLowerCase();
  const providersConfigured = discoveryService.getProviderCapabilities();
  const missingEnvVars = discoveryService.getMissingEnvVars();

  // 1. Check persistent video library (in-memory cache -> PostgreSQL vocabulary_video_examples)
  if (refresh !== "1") {
    const cached = await videoRepository.findByWord(wordNormalized, req);
    if (cached.clips.length > 0 && (maxResults === 1 || cached.clips.length >= 4)) {
      const payload: VideoDiscoveryResponse = {
        word,
        videos: cached.clips,
        verifiedCount: cached.clips.length,
        fallbackContext: null,
        fallbackContexts: [],
        diagnostics: {
          status: "verified",
          message: `Loaded ${cached.clips.length} cached verified video examples.`,
          providersAttempted: [cached.source],
          missingEnvVars,
          cacheStatus: cached.source,
        },
        providersConfigured,
      };
      return NextResponse.json(payload, { headers: corsHeaders });
    }
  }

  // 2. Run pluggable video discovery providers (YouGlish REST API -> Filmot -> YouTube+Transcript -> User Subtitle)
  const discoveryResult = await discoveryService.discover({
    word,
    wordId: wordId || null,
    lang,
    maxResults,
    sourceUrl,
    savedSentence: sentence,
    sourceTitle,
  });

  const videos = (discoveryResult.videos || []).filter(
    (v) => !isNonEnglishVideoTitle(v.videoTitle, v.channelName),
  );
  const providersAttempted = discoveryResult.providersAttempted;

  // 3. Persist verified video metadata & cues so returning visits reuse them immediately
  if (videos.length > 0) {
    await videoRepository.saveMany(wordNormalized, wordId || null, videos, req);

    const payload: VideoDiscoveryResponse = {
      word,
      videos,
      verifiedCount: videos.length,
      fallbackContext: null,
      fallbackContexts: [],
      diagnostics: {
        status: "verified",
        message: `Discovered and verified ${videos.length} video examples.`,
        providersAttempted,
        missingEnvVars,
        cacheStatus: "fresh_discovery",
      },
      providersConfigured,
    };
    return NextResponse.json(payload, { headers: corsHeaders });
  }

  // 4. Clean fallback ONLY when no verified video is available (never presented as a video transcript)
  const fallbackContexts = await fetchAuthenticFallbackContexts(word, sentence);

  let status: VideoDiscoveryDiagnostics["status"] = "no_matches";
  let message = "We couldn't find a verified video example for this word yet.";
  if (missingEnvVars.length > 0) {
    status = providersConfigured.youtubeData ? "missing_transcript_provider" : "missing_credentials";
    message = `Configure ${missingEnvVars.join(", ")} on the server to enable automatic YouTube video discovery.`;
  }

  const payload: VideoDiscoveryResponse = {
    word,
    videos: [],
    verifiedCount: 0,
    fallbackContext: fallbackContexts[0] || null,
    fallbackContexts,
    diagnostics: {
      status,
      message,
      providersAttempted,
      missingEnvVars,
      cacheStatus: "empty",
    },
    providersConfigured,
  };

  return NextResponse.json(payload, { headers: corsHeaders });
}

export async function PATCH(req: Request) {
  const blocked = await guardApiRequestShared(req, "learn-videos-flag", 30);
  if (blocked) return blocked;
  const corsHeaders = getCorsHeaders(req);

  // Require valid authenticated user session to prevent unauthenticated video suppression
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !/^Bearer\s+.+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "Authentication required to report unavailable videos." },
      { status: 401, headers: corsHeaders },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (supabaseUrl && anonKey) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json(
        { error: "Invalid or expired authorization token." },
        { status: 401, headers: corsHeaders },
      );
    }
  }

  try {
    const raw = await req.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid 11-character YouTube video ID is required." },
        { status: 400, headers: corsHeaders },
      );
    }
    await videoRepository.markUnavailable(parsed.data.youtubeVideoId, req);
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400, headers: corsHeaders });
  }
}
