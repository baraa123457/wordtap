import { z } from "zod";

export const learningStatusSchema = z.enum(["new", "learning", "review", "mastered"]);
export type LearningStatus = z.infer<typeof learningStatusSchema>;

export const wordSchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string(),
  src_lang: z.string(),
  target_lang: z.string(),
  source_title: z.string().nullable().optional().transform((v) => v ?? ""),
  source_url: z.string().nullable().optional().transform((v) => v ?? ""),
  sentence: z.string().nullable().optional().transform((v) => v ?? ""),
  definition: z.string().nullable().optional(),
  pronunciation: z.string().nullable().optional(),
  part_of_speech: z.string().nullable().optional(),
  learning_status: learningStatusSchema.nullable().optional(),
  current_stage: z.number().nullable().optional(),
  completed_stages: z.array(z.number()).nullable().optional(),
  attempts_count: z.number().nullable().optional(),
  fsrs_stability: z.number().nullable().optional(),
  fsrs_difficulty: z.number().nullable().optional(),
  fsrs_reps: z.number().nullable().optional(),
  fsrs_lapses: z.number().nullable().optional(),
  interval_days: z.number().nullable().optional(),
  last_rating: z.number().nullable().optional(),
  initial_learning_completed: z.boolean().nullable().optional(),
  stage_answers: z.record(z.string(), z.unknown()).nullable().optional(),
  review_box: z.number().nullable().optional(),
  next_review_at: z.string().nullable().optional(),
  correct_streak: z.number().nullable().optional(),
  last_reviewed_at: z.string().nullable().optional(),
  lapses: z.number().nullable().optional(),
  is_easy: z.boolean().nullable().optional(),
  times_seen: z.number(),
  box: z.number(),
  next_review: z.string(),
  correct_count: z.number(),
  wrong_count: z.number(),
  last_practiced: z.string().nullable(),
  created_at: z.string(),
});

export type Word = z.infer<typeof wordSchema>;

export const wordsSchema = z.array(wordSchema);

export const statsSchema = z.object({
  xp: z.number(),
  streak: z.number(),
  best_streak: z.number(),
  last_practice_date: z.string().nullable(),
  today_xp: z.number(),
  daily_goal: z.number(),
  daily_new_words_goal: z.number().nullable().optional().transform((v) => v ?? 5),
  daily_reviews_goal: z.number().nullable().optional().transform((v) => v ?? 20),
});

export type Stats = z.infer<typeof statsSchema>;

export const EMPTY_STATS: Stats = {
  xp: 0,
  streak: 0,
  best_streak: 0,
  last_practice_date: null,
  today_xp: 0,
  daily_goal: 20,
  daily_new_words_goal: 5,
  daily_reviews_goal: 20,
};

export const WORD_COLUMNS_LEGACY =
  "id,text,translation,src_lang,target_lang,source_title,source_url,times_seen,box,next_review,correct_count,wrong_count,last_practiced,created_at";

export const WORD_COLUMNS = `${WORD_COLUMNS_LEGACY},sentence`;

export const WORD_COLUMNS_V2 = `${WORD_COLUMNS},definition,pronunciation,part_of_speech,learning_status,current_stage,completed_stages,attempts_count,fsrs_stability,fsrs_difficulty,fsrs_reps,fsrs_lapses,interval_days,last_rating`;

export const WORD_COLUMNS_V3 = `${WORD_COLUMNS_V2},initial_learning_completed,stage_answers`;

export const WORD_COLUMNS_V4 = `${WORD_COLUMNS_V3},review_box,next_review_at,correct_streak,last_reviewed_at,lapses,is_easy`;

export const STATS_COLUMNS =
  "xp,streak,best_streak,last_practice_date,today_xp,daily_goal";

export const STATS_COLUMNS_V2 = `${STATS_COLUMNS},daily_new_words_goal,daily_reviews_goal`;
