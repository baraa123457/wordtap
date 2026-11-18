import { getSupabase } from "./supabase";
import { reviewWord } from "./api";
import type { FsrsRating, FsrsScheduleResult } from "./fsrs";
import type { Word } from "./schemas";

export type UnderstandingOption = {
  id: "A" | "B" | "C" | "D";
  text: string;
};

export type UnderstandingQuestion = {
  word: string;
  question: string;
  options: UnderstandingOption[];
  correctOptionId: "A" | "B" | "C" | "D";
  explanation: string;
  definition: string;
  pronunciation: string;
  partOfSpeech: string;
  provider: "gemini" | "openai" | "dictionary";
};

export type VerifiedVideoClip = {
  id: string;
  youtubeVideoId: string;
  videoTitle: string;
  channelName: string;
  source:
    | "youtube_supadata"
    | "youtube_transcriptapi"
    | "youtube_filmot"
    | "user_subtitle"
    | "user_contributed";
  timestampSeconds: number;
  verifiedTranscript: string;
  contextSentence: string;
  targetWordPosition: number;
  captionAvailable: boolean;
  videoAvailable: boolean;
};

export type FallbackContextItem = {
  sentence: string;
  sourceLabel: string;
  pronunciation?: string;
};

export type VideoDiscoveryResponse = {
  word: string;
  videos: VerifiedVideoClip[];
  verifiedCount: number;
  fallbackContext: FallbackContextItem | null;
  fallbackContexts?: FallbackContextItem[];
  diagnostics?: {
    status:
      | "verified"
      | "missing_credentials"
      | "missing_transcript_provider"
      | "no_matches"
      | "provider_error";
    message: string;
    missingEnvVars: string[];
    providersAttempted: string[];
    cacheStatus: "memory_hit" | "db_hit" | "fresh_discovery" | "empty";
  };
  capabilities: {
    youtubeApiConfigured: boolean;
    supadataConfigured: boolean;
    transcriptApiConfigured?: boolean;
    filmotConfigured: boolean;
  };
};

export type SentenceEvaluation = {
  isCorrect: boolean;
  usageCorrect: boolean;
  grammarScore: number;
  grammarCorrections: string[];
  naturalAlternative: string | null;
  naturalnessFeedback: string;
  explanation: string;
  provider: "gemini" | "openai" | "languagetool" | "validator";
};

export type ReviewHistoryRow = {
  id: string;
  word_id: string;
  review_date: string;
  exercise_type: "understanding" | "contextual_video" | "create_sentence" | "spaced_repetition";
  result: boolean;
  difficulty_rating: number | null;
  interval_days: number;
};

export type ExerciseType =
  | "understanding"
  | "contextual_video"
  | "create_sentence"
  | "spaced_repetition";

export async function fetchUnderstandingQuestion(
  word: Word,
  level: "beginner" | "intermediate" | "advanced" = "intermediate",
): Promise<UnderstandingQuestion> {
  const res = await fetch("/api/learn/understanding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      word: word.text,
      translation: word.translation,
      existingDefinition: word.definition || "",
      partOfSpeech: word.part_of_speech || "",
      level,
    }),
  });
  const data = (await res.json()) as UnderstandingQuestion & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not load understanding question.");
  }
  return data;
}

export async function fetchVerifiedVideos(
  word: Word,
  options?: { refresh?: boolean },
): Promise<VideoDiscoveryResponse> {
  const params = new URLSearchParams({ word: word.text });
  if (word.source_url) params.set("sourceUrl", word.source_url);
  if (word.sentence) params.set("sentence", word.sentence);
  if (word.source_title) params.set("sourceTitle", word.source_title);
  if (options?.refresh) params.set("refresh", "1");

  // Forward authenticated session token so server-side Supabase cache reads work under RLS
  const headers: Record<string, string> = {};
  try {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Continue unauthenticated if Supabase isn't initialized (e.g. demo)
  }

  const res = await fetch(`/api/learn/videos?${params.toString()}`, { headers });
  const data = (await res.json()) as VideoDiscoveryResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not search verified videos.");
  }
  return data;
}

export async function contributeVerifiedVideo(params: {
  word: string;
  youtubeUrl: string;
  timestampSeconds: number;
  transcript: string;
}): Promise<VerifiedVideoClip> {
  const res = await fetch("/api/learn/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { clip?: VerifiedVideoClip; error?: string };
  if (!res.ok || !data.clip) {
    throw new Error(data.error || "Could not verify YouTube clip.");
  }

  // Persist verified clip into Supabase cache for future learners (best-effort)
  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("vocabulary_video_examples").upsert(
        {
          word_normalized: params.word.trim().toLowerCase(),
          youtube_video_id: data.clip.youtubeVideoId,
          video_title: data.clip.videoTitle,
          channel_name: data.clip.channelName,
          source: "user_contributed",
          timestamp_seconds: data.clip.timestampSeconds,
          verified_transcript: data.clip.verifiedTranscript,
          context_sentence: data.clip.contextSentence,
          target_word_position: data.clip.targetWordPosition,
          caption_available: true,
          video_available: true,
          contributed_by: user.id,
        },
        { onConflict: "word_normalized,youtube_video_id,timestamp_seconds", ignoreDuplicates: true },
      );
    }
  } catch {
    // Ignore if migration 010 isn't applied yet
  }

  return data.clip;
}

export async function evaluateUserSentence(params: {
  word: string;
  sentence: string;
  definition?: string;
  partOfSpeech?: string;
  level?: "beginner" | "intermediate" | "advanced";
}): Promise<SentenceEvaluation> {
  const res = await fetch("/api/learn/evaluate-sentence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as SentenceEvaluation & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not evaluate sentence.");
  }
  return data;
}

export async function saveUserSentence(params: {
  wordId: string;
  wordText: string;
  originalSentence: string;
  evaluation: SentenceEvaluation;
}): Promise<void> {
  if (params.wordId.startsWith("sample-")) return;
  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_sentences").insert({
      user_id: user.id,
      word_id: params.wordId,
      word_text: params.wordText,
      original_sentence: params.originalSentence,
      is_correct: params.evaluation.isCorrect,
      grammar_score: params.evaluation.grammarScore,
      naturalness_feedback: params.evaluation.naturalnessFeedback,
      ai_feedback: params.evaluation,
    });
  } catch {
    // Graceful fallback if migration 010 hasn't been applied yet
  }
}

export async function persistLearningReview(params: {
  wordId: string;
  exerciseType: ExerciseType;
  answer: string;
  result: boolean;
  rating: FsrsRating;
  completedStages: number[];
  schedule: FsrsScheduleResult;
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
}): Promise<void> {
  if (params.wordId.startsWith("sample-")) return;

  const supabase = getSupabase();
  const { error } = await supabase.rpc("record_learning_review", {
    p_word_id: params.wordId,
    p_exercise_type: params.exerciseType,
    p_answer: params.answer,
    p_result: params.result,
    p_rating: params.rating,
    p_learning_status: params.schedule.learningStatus,
    p_current_stage: 4,
    p_completed_stages: params.completedStages,
    p_fsrs_stability: params.schedule.stability,
    p_fsrs_difficulty: params.schedule.difficulty,
    p_fsrs_reps: params.schedule.reps,
    p_fsrs_lapses: params.schedule.lapses,
    p_interval_days: params.schedule.intervalDays,
    p_next_review: params.schedule.nextReviewIso,
    p_box: params.schedule.box,
    p_definition: params.definition || null,
    p_pronunciation: params.pronunciation || null,
    p_part_of_speech: params.partOfSpeech || null,
  });

  if (!error) return;

  // Backward-compatible fallback to existing review_word RPC if migration 010 isn't applied yet
  const legacyGrade = (params.rating - 1) as 0 | 1 | 2 | 3;
  await reviewWord(params.wordId, params.rating > 1, legacyGrade);
}

/** Fetches the last 14 days of review history for weekly activity & retention analytics. */
export async function fetchRecentReviewHistory(days = 14): Promise<ReviewHistoryRow[]> {
  try {
    const supabase = getSupabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("review_history")
      .select("id,word_id,review_date,exercise_type,result,difficulty_rating,interval_days")
      .gte("review_date", since)
      .order("review_date", { ascending: false })
      .limit(500);
    if (error || !Array.isArray(data)) return [];
    return data as ReviewHistoryRow[];
  } catch {
    return [];
  }
}
