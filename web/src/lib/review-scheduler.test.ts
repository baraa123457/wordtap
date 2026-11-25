import { describe, expect, it } from "vitest";
import {
  countDueForReview,
  getNextReview,
  pickReviewSessionWords,
} from "./review-scheduler";
import type { Word } from "./schemas";

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w-1",
    text: "resilient",
    translation: "مرن",
    src_lang: "en",
    target_lang: "ar",
    source_title: "",
    source_url: "",
    sentence: "",
    times_seen: 1,
    box: 1,
    next_review: "2026-01-01T00:00:00.000Z",
    correct_count: 1,
    wrong_count: 0,
    last_practiced: null,
    created_at: "2026-01-01T00:00:00.000Z",
    review_box: 0,
    next_review_at: "2026-01-01T00:00:00.000Z",
    correct_streak: 0,
    last_reviewed_at: null,
    lapses: 0,
    is_easy: false,
    ...overrides,
  };
}

describe("getNextReview", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");

  it("advances box 0 -> 1 (1 day) when all 3 rounds pass", () => {
    const res = getNextReview(
      makeWord({ review_box: 0, correct_streak: 0, lapses: 0 }),
      { round1Correct: true, round2Correct: true, round3Correct: true },
      now,
    );
    expect(res.passedAllRounds).toBe(true);
    expect(res.review_box).toBe(1);
    expect(res.intervalDays).toBe(1);
    expect(res.correct_streak).toBe(1);
    expect(res.next_review_at).toBe("2026-11-26T12:00:00.000Z");
  });

  it("advances through Leitner intervals 3, 7, 14, 30 and caps at box 5", () => {
    const b2 = getNextReview(
      makeWord({ review_box: 1, correct_streak: 1 }),
      { round1Correct: true, round2Correct: true, round3Correct: true },
      now,
    );
    expect(b2.review_box).toBe(2);
    expect(b2.intervalDays).toBe(3);

    const b5 = getNextReview(
      makeWord({ review_box: 5, correct_streak: 5 }),
      { round1Correct: true, round2Correct: true, round3Correct: true },
      now,
    );
    expect(b5.review_box).toBe(5);
    expect(b5.intervalDays).toBe(30);
    expect(b5.correct_streak).toBe(6);
  });

  it("moves back down to box 1 (or 0) and schedules soon on any round mistake", () => {
    const fromBox3 = getNextReview(
      makeWord({ review_box: 3, correct_streak: 3, lapses: 1 }),
      { round1Correct: true, round2Correct: false, round3Correct: true },
      now,
    );
    expect(fromBox3.passedAllRounds).toBe(false);
    expect(fromBox3.review_box).toBe(1);
    expect(fromBox3.correct_streak).toBe(0);
    expect(fromBox3.lapses).toBe(2);
    expect(Date.parse(fromBox3.next_review_at)).toBeGreaterThan(now.getTime());
    expect(Date.parse(fromBox3.next_review_at) - now.getTime()).toBeLessThan(60 * 60 * 1000);
  });
});

describe("pickReviewSessionWords & countDueForReview", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");

  it("prioritizes due words, includes is_easy words, and falls back to lowest review_box", () => {
    const dueOld = makeWord({
      id: "due-old",
      next_review_at: "2026-11-20T00:00:00.000Z",
      review_box: 2,
    });
    const easyFutureLowBox = makeWord({
      id: "easy-low",
      times_seen: 0,
      correct_count: 0,
      is_easy: true,
      review_box: 0,
      next_review_at: "2026-11-28T00:00:00.000Z",
    });
    const futureHighBox = makeWord({
      id: "future-high",
      review_box: 4,
      next_review_at: "2026-12-05T00:00:00.000Z",
    });
    const unpracticedNotEasy = makeWord({
      id: "new-word",
      times_seen: 0,
      correct_count: 0,
      is_easy: false,
      initial_learning_completed: false,
    });

    const all = [futureHighBox, unpracticedNotEasy, easyFutureLowBox, dueOld];
    expect(countDueForReview(all, now)).toBe(1);

    const picked = pickReviewSessionWords(all, 10, now);
    expect(picked.map((w) => w.id)).toEqual(["due-old", "easy-low", "future-high"]);
  });
});
