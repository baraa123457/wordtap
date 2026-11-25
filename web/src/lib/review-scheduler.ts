import type { Word } from "./schemas";

/** Leitner box intervals in days (boxes 1..5). Box 0 means new/reset. */
export const LEITNER_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

/** Delay after a failed review before the word is due again (10 minutes). */
const LAPSE_RETRY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RoundResults = {
  round1Correct: boolean;
  round2Correct: boolean;
  round3Correct: boolean;
};

export type NextReviewSchedule = {
  passedAllRounds: boolean;
  review_box: number;
  next_review_at: string;
  correct_streak: number;
  last_reviewed_at: string;
  lapses: number;
  intervalDays: number;
};

/**
 * Pure Leitner spaced-repetition scheduler.
 * - All 3 rounds correct -> move up one box (max 5), increment streak, schedule 1/3/7/14/30d.
 * - Any mistake -> move down to box 1 (or 0 if already <= 1), reset streak, increment lapses, schedule soon.
 */
export function getNextReview(
  word: Pick<Word, "review_box" | "correct_streak" | "lapses">,
  results: RoundResults,
  now: Date = new Date(),
): NextReviewSchedule {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const currentBox = Math.max(0, Math.min(5, word.review_box ?? 0));
  const currentStreak = Math.max(0, word.correct_streak ?? 0);
  const currentLapses = Math.max(0, word.lapses ?? 0);

  const passedAllRounds =
    results.round1Correct && results.round2Correct && results.round3Correct;

  if (passedAllRounds) {
    const nextBox = Math.min(5, currentBox + 1);
    const intervalDays = LEITNER_INTERVAL_DAYS[nextBox - 1] ?? 30;
    return {
      passedAllRounds: true,
      review_box: nextBox,
      next_review_at: new Date(nowMs + intervalDays * DAY_MS).toISOString(),
      correct_streak: currentStreak + 1,
      last_reviewed_at: nowIso,
      lapses: currentLapses,
      intervalDays,
    };
  }

  const nextBox = currentBox <= 1 ? 0 : 1;
  return {
    passedAllRounds: false,
    review_box: nextBox,
    next_review_at: new Date(nowMs + LAPSE_RETRY_MS).toISOString(),
    correct_streak: 0,
    last_reviewed_at: nowIso,
    lapses: currentLapses + 1,
    intervalDays: 0,
  };
}

/** Whether a word is eligible for the dedicated Review mode (practiced or marked easy). */
export function isReviewEligible(word: Word): boolean {
  if (!word.text.trim() || !word.translation.trim()) return false;
  return Boolean(
    word.is_easy ||
      word.initial_learning_completed ||
      word.times_seen > 0 ||
      word.correct_count > 0,
  );
}

/** Whether a word is due for review as of `now`. */
export function isReviewDue(word: Word, now: Date = new Date()): boolean {
  if (!isReviewEligible(word)) return false;
  const dueStr = word.next_review_at || word.next_review;
  if (!dueStr) return true;
  const dueMs = Date.parse(dueStr);
  if (!Number.isFinite(dueMs)) return true;
  return dueMs <= now.getTime();
}

/** Counts eligible words due for review by `now`. */
export function countDueForReview(words: Word[], now: Date = new Date()): number {
  return words.filter((w) => isReviewDue(w, now)).length;
}

/**
 * Picks up to `limit` words (default 10) for a Review session:
 * 1. Eligible words where `next_review_at <= now` (oldest due first)
 * 2. Fallback to remaining eligible words ordered by lowest `review_box`
 */
export function pickReviewSessionWords(
  words: Word[],
  limit = 10,
  now: Date = new Date(),
): Word[] {
  const eligible = words.filter(isReviewEligible);
  const nowMs = now.getTime();

  const due: Word[] = [];
  const notDue: Word[] = [];

  for (const w of eligible) {
    const dueStr = w.next_review_at || w.next_review;
    const dueMs = dueStr ? Date.parse(dueStr) : 0;
    if (!Number.isFinite(dueMs) || dueMs <= nowMs) {
      due.push(w);
    } else {
      notDue.push(w);
    }
  }

  due.sort((a, b) => {
    const aMs = Date.parse(a.next_review_at || a.next_review || "") || 0;
    const bMs = Date.parse(b.next_review_at || b.next_review || "") || 0;
    return aMs - bMs;
  });

  notDue.sort((a, b) => {
    const boxDiff = (a.review_box ?? 0) - (b.review_box ?? 0);
    if (boxDiff !== 0) return boxDiff;
    if (Boolean(a.is_easy) !== Boolean(b.is_easy)) return a.is_easy ? -1 : 1;
    const aMs = Date.parse(a.next_review_at || a.next_review || "") || 0;
    const bMs = Date.parse(b.next_review_at || b.next_review || "") || 0;
    return aMs - bMs;
  });

  return [...due, ...notDue].slice(0, Math.max(1, limit));
}
