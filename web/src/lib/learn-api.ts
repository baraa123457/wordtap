import { getSupabase } from "./supabase";
import { reviewWord } from "./api";
import type { FsrsRating, FsrsScheduleResult } from "./fsrs";
import type { Word } from "./schemas";
import type { VideoDiscoveryResponse } from "./video/types";

export type {
  CaptionCue,
  FallbackContextExample,
  VerifiedVideoExample,
  VideoDiscoveryDiagnostics,
  VideoDiscoveryResponse,
  VideoDiscoverySource,
} from "./video/types";

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
  meanings?: string[];
  provider: "gemini" | "openai" | "dictionary";
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
      targetLang: word.target_lang || "ar",
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

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await getSupabase().auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch {
    // Continue unauthenticated if Supabase isn't initialized
  }
  return {};
}

export async function fetchContextualVideos(
  word: Word,
  options?: { refresh?: boolean; maxResults?: number },
): Promise<VideoDiscoveryResponse> {
  const params = new URLSearchParams({
    word: word.text,
    lang: word.src_lang || "en",
  });
  if (word.id && !word.id.startsWith("sample-")) params.set("wordId", word.id);
  if (word.source_url) params.set("sourceUrl", word.source_url);
  if (word.sentence) params.set("sentence", word.sentence);
  if (word.source_title) params.set("sourceTitle", word.source_title);
  if (options?.refresh) params.set("refresh", "1");
  if (typeof options?.maxResults === "number") {
    params.set("maxResults", String(options.maxResults));
  }

  const headers = await getAuthHeaders();
  const res = await fetch(`/api/learn/videos?${params.toString()}`, { headers });
  const data = (await res.json()) as VideoDiscoveryResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Could not search verified videos.");
  }
  return data;
}

export async function markVideoUnavailable(youtubeVideoId: string): Promise<void> {
  if (!/^([A-Za-z0-9_-]{11}|wm_[a-f0-9]{16})$/.test(youtubeVideoId)) return;
  try {
    const headers = await getAuthHeaders();
    await fetch("/api/learn/videos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ youtubeVideoId }),
    });
  } catch {
    // Best-effort flag
  }
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

export async function fetchSentenceExamples(
  word: string,
  definition?: string,
  partOfSpeech?: string,
): Promise<string[]> {
  try {
    const res = await fetch("/api/learn/sentence-examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, definition, partOfSpeech }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { examples?: string[] };
    return Array.isArray(data.examples) ? data.examples : [];
  } catch {
    return [];
  }
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
