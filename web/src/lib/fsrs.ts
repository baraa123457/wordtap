import type { LearningStatus, Word } from "./schemas";

/**
 * Adaptive FSRS-4.5 (Free Spaced Repetition Scheduler) implementation.
 *
 * Ratings:
 *  1 = Again (forgot / needs immediate relearning)
 *  2 = Hard  (remembered with difficulty -> shorter interval)
 *  3 = Good  (normal recall -> standard adaptive growth)
 *  4 = Easy  (effortless recall -> accelerated interval)
 *
 * Learning statuses:
 *  - "new": never completed a learning review
 *  - "learning": initial acquisition or lapsed (stability < 3 days)
 *  - "review": consolidated in spaced repetition (3 <= stability < 21 days)
 *  - "mastered": long-term retention (stability >= 21 days and reps >= 3)
 */

export type FsrsRating = 1 | 2 | 3 | 4;

export type FsrsCardState = {
  stability: number;   // S: days until retrievability drops to 90%
  difficulty: number;  // D: 1.0 (easiest) .. 10.0 (hardest)
  reps: number;        // total successful reviews
  lapses: number;      // number of times rated Again after learning
  intervalDays: number;
  lastPracticed: string | null;
  status: LearningStatus;
};

export type FsrsScheduleResult = {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  intervalDays: number;
  nextReviewIso: string;
  learningStatus: LearningStatus;
  box: number;
};

// Standard FSRS-4.5 default parameter weights (w0..w16)
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, // initial stability for Again, Hard, Good, Easy
  5.1618, 1.2298, 0.8975, 0.031,   // initial difficulty & difficulty delta
  1.6474, 0.1367, 1.0461,          // recall stability growth
  2.1072, 0.0793, 0.3246, 1.587,   // forget stability
  0.2272, 2.8755,                  // hard penalty & easy bonus
] as const;

const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL_DAYS = 365;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Derives canonical learning status from a Word row (compatible with legacy Leitner rows). */
export function deriveWordLearningStatus(word: Pick<Word, "learning_status" | "box" | "correct_count" | "wrong_count" | "fsrs_stability" | "fsrs_reps">): LearningStatus {
  if (word.learning_status) return word.learning_status;
  if (word.box >= 4 || ((word.fsrs_stability ?? 0) >= 21 && (word.fsrs_reps ?? 0) >= 3)) {
    return "mastered";
  }
  if (word.box >= 2 || (word.fsrs_stability ?? 0) >= 3) {
    return "review";
  }
  if (word.correct_count + word.wrong_count > 0 || word.box >= 1) {
    return "learning";
  }
  return "new";
}

/** Extracts an FsrsCardState from a Word row, migrating legacy box data gracefully. */
export function cardStateFromWord(word: Word): FsrsCardState {
  const legacyIntervals = [0, 1, 3, 7, 14, 30];
  const fallbackStability = legacyIntervals[clamp(Math.round(word.box), 0, 5)] ?? 0;
  const stability = word.fsrs_stability && word.fsrs_stability > 0 ? word.fsrs_stability : fallbackStability;
  const difficulty = word.fsrs_difficulty && word.fsrs_difficulty >= 1 ? word.fsrs_difficulty : 5.0;
  const reps = word.fsrs_reps && word.fsrs_reps > 0 ? word.fsrs_reps : word.correct_count;
  const lapses = word.fsrs_lapses && word.fsrs_lapses > 0 ? word.fsrs_lapses : word.wrong_count;

  return {
    stability,
    difficulty,
    reps,
    lapses,
    intervalDays: word.interval_days && word.interval_days > 0 ? word.interval_days : fallbackStability,
    lastPracticed: word.last_practiced,
    status: deriveWordLearningStatus(word),
  };
}

/** Maps adaptive FSRS stability back to WordTap's 0..5 Leitner box for backward compatibility. */
export function mapStabilityToBox(stability: number, rating: FsrsRating): number {
  if (rating === 1) return 0;
  if (stability >= 25) return 5;
  if (stability >= 14) return 4;
  if (stability >= 6) return 3;
  if (stability >= 2.5) return 2;
  return 1;
}

/** Computes next interval in days for desired retention R using FSRS forgetting curve. */
function stabilityToInterval(stability: number): number {
  // FSRS forgetting curve factor: R(t, S) = (1 + (19/81) * t / S)^(-0.5)
  const factor = 19 / 81;
  const raw = (stability / factor) * (Math.pow(REQUEST_RETENTION, -2) - 1);
  return clamp(Math.round(raw), 1, MAX_INTERVAL_DAYS);
}

/**
 * Schedules the next review for a word given its current FSRS card state and user rating (1..4).
 */
export function scheduleFsrsReview(
  card: FsrsCardState,
  rating: FsrsRating,
  now: Date = new Date(),
): FsrsScheduleResult {
  const isFirstReview = card.reps === 0 || card.stability <= 0;

  let nextD: number;
  let nextS: number;
  let nextReps = card.reps;
  let nextLapses = card.lapses;
  let intervalDays: number;
  let nextReviewMs: number;

  if (isFirstReview) {
    // Initial difficulty D0(G) = w4 - (G - 3) * w5
    nextD = clamp(W[4] - (rating - 3) * W[5], 1.0, 10.0);
    // Initial stability S0(G) = w[G - 1]
    nextS = W[rating - 1]!;

    if (rating === 1) {
      // Again: immediate relearning in 10 minutes
      nextLapses += 1;
      intervalDays = 0;
      nextReviewMs = now.getTime() + 10 * MINUTE_MS;
    } else if (rating === 2) {
      // Hard: 1 day
      nextReps += 1;
      intervalDays = 1;
      nextReviewMs = now.getTime() + 1 * DAY_MS;
    } else if (rating === 3) {
      // Good: 3 days (or 1 day if conservative; adaptive initial Good -> 3d aligns with 1/3/7/14/30)
      nextReps += 1;
      intervalDays = Math.max(1, Math.min(3, Math.round(nextS)));
      nextReviewMs = now.getTime() + intervalDays * DAY_MS;
    } else {
      // Easy: 7 days initial jump
      nextReps += 1;
      intervalDays = 7;
      nextS = Math.max(nextS, 7);
      nextReviewMs = now.getTime() + intervalDays * DAY_MS;
    }
  } else {
    const elapsedDays = card.lastPracticed
      ? Math.max(0.05, (now.getTime() - new Date(card.lastPracticed).getTime()) / DAY_MS)
      : Math.max(1, card.intervalDays);

    // Current retrievability R(t, S)
    const retrievability = Math.pow(1 + (19 / 81) * (elapsedDays / Math.max(0.1, card.stability)), -0.5);

    // Mean-reverting difficulty update
    const d0Good = W[4];
    const nextDRaw = card.difficulty - W[6] * (rating - 3);
    nextD = clamp(W[7] * d0Good + (1 - W[7]) * nextDRaw, 1.0, 10.0);

    if (rating === 1) {
      // Again (lapse): shrink stability and return quickly
      nextLapses += 1;
      const forgetS =
        W[11] *
        Math.pow(nextD, -W[12]) *
        (Math.pow(card.stability + 1, W[13]) - 1) *
        Math.exp(W[14] * (1 - retrievability));
      nextS = clamp(Math.min(forgetS, card.stability * 0.5), 0.3, MAX_INTERVAL_DAYS);
      intervalDays = 0;
      nextReviewMs = now.getTime() + 10 * MINUTE_MS;
    } else {
      nextReps += 1;
      const hardPenalty = rating === 2 ? W[15] : 1;
      const easyBonus = rating === 4 ? W[16] : 1;

      const recallS =
        card.stability *
        (1 +
          Math.exp(W[8]) *
            (11 - nextD) *
            Math.pow(Math.max(0.1, card.stability), -W[9]) *
            (Math.exp(W[10] * (1 - retrievability)) - 1) *
            hardPenalty *
            easyBonus);

      nextS = clamp(recallS, Math.max(0.5, card.stability * (rating === 2 ? 1.05 : 1.2)), MAX_INTERVAL_DAYS);
      intervalDays = stabilityToInterval(nextS);

      // Guarantee strict monotonic separation: Again < Hard < Good < Easy
      if (rating === 2) {
        intervalDays = Math.max(1, Math.min(intervalDays, Math.max(1, Math.round(card.intervalDays * 1.2))));
      } else if (rating === 3) {
        intervalDays = Math.max(Math.round(card.intervalDays) + 1, intervalDays);
      } else if (rating === 4) {
        intervalDays = Math.max(Math.round(card.intervalDays * 1.5) + 2, intervalDays);
      }

      intervalDays = clamp(intervalDays, 1, MAX_INTERVAL_DAYS);
      nextReviewMs = now.getTime() + intervalDays * DAY_MS;
    }
  }

  let learningStatus: LearningStatus;
  if (rating === 1) {
    learningStatus = "learning";
  } else if (nextS >= 21 && nextReps >= 3) {
    learningStatus = "mastered";
  } else if (intervalDays >= 3 && nextReps >= 2) {
    learningStatus = "review";
  } else {
    learningStatus = "learning";
  }

  return {
    stability: round2(nextS),
    difficulty: round2(nextD),
    reps: nextReps,
    lapses: nextLapses,
    intervalDays: round2(intervalDays),
    nextReviewIso: new Date(nextReviewMs).toISOString(),
    learningStatus,
    box: mapStabilityToBox(nextS, rating),
  };
}

/** Human-friendly interval label for rating buttons ("10m", "1d", "3d", "7d", "1mo"). */
export function formatIntervalLabel(intervalDays: number): string {
  if (intervalDays <= 0) return "10 min";
  if (intervalDays < 1) return `${Math.max(1, Math.round(intervalDays * 24))}h`;
  if (intervalDays === 1) return "1 day";
  if (intervalDays < 30) return `${Math.round(intervalDays)} days`;
  const months = Math.round((intervalDays / 30) * 10) / 10;
  return months === 1 ? "1 month" : `${months} months`;
}

/** Previews all 4 ratings (Again, Hard, Good, Easy) for the UI before the user picks one. */
export function previewFsrsIntervals(
  card: FsrsCardState,
  now: Date = new Date(),
): Record<FsrsRating, { label: string; result: FsrsScheduleResult }> {
  const r1 = scheduleFsrsReview(card, 1, now);
  const r2 = scheduleFsrsReview(card, 2, now);
  const r3 = scheduleFsrsReview(card, 3, now);
  const r4 = scheduleFsrsReview(card, 4, now);
  return {
    1: { label: formatIntervalLabel(r1.intervalDays), result: r1 },
    2: { label: formatIntervalLabel(r2.intervalDays), result: r2 },
    3: { label: formatIntervalLabel(r3.intervalDays), result: r3 },
    4: { label: formatIntervalLabel(r4.intervalDays), result: r4 },
  };
}
