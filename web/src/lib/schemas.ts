import { z } from "zod";

export const wordSchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string(),
  src_lang: z.string(),
  target_lang: z.string(),
  source_title: z.string(),
  source_url: z.string(),
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
});

export type Stats = z.infer<typeof statsSchema>;

export const EMPTY_STATS: Stats = {
  xp: 0,
  streak: 0,
  best_streak: 0,
  last_practice_date: null,
  today_xp: 0,
  daily_goal: 20,
};

export const WORD_COLUMNS =
  "id,text,translation,src_lang,target_lang,source_title,source_url,times_seen,box,next_review,correct_count,wrong_count,last_practiced,created_at";

export const STATS_COLUMNS =
  "xp,streak,best_streak,last_practice_date,today_xp,daily_goal";
