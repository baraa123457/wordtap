import { describe, expect, it } from "vitest";
import {
  formatIntervalLabel,
  previewFsrsIntervals,
  scheduleFsrsReview,
  type FsrsCardState,
} from "./fsrs";

describe("FSRS adaptive spaced repetition", () => {
  const freshCard: FsrsCardState = {
    stability: 0,
    difficulty: 5.0,
    reps: 0,
    lapses: 0,
    intervalDays: 0,
    lastPracticed: null,
    status: "new",
  };

  it("produces strictly increasing intervals for Again < Hard < Good < Easy on a new word", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const preview = previewFsrsIntervals(freshCard, now);

    expect(preview[1].result.intervalDays).toBe(0);
    expect(preview[2].result.intervalDays).toBe(1);
    expect(preview[3].result.intervalDays).toBeGreaterThan(preview[2].result.intervalDays);
    expect(preview[4].result.intervalDays).toBeGreaterThan(preview[3].result.intervalDays);
  });

  it("grows stability adaptively over repeated Good reviews until mastered", () => {
    let now = new Date("2026-11-01T12:00:00Z");
    let card: FsrsCardState = { ...freshCard };

    for (let i = 0; i < 4; i++) {
      const res = scheduleFsrsReview(card, 3, now);
      card = {
        stability: res.stability,
        difficulty: res.difficulty,
        reps: res.reps,
        lapses: res.lapses,
        intervalDays: res.intervalDays,
        lastPracticed: now.toISOString(),
        status: res.learningStatus,
      };
      now = new Date(res.nextReviewIso);
    }

    expect(card.reps).toBe(4);
    expect(card.intervalDays).toBeGreaterThanOrEqual(14);
    expect(card.status).toBe("mastered");
  });

  it("reduces stability and increases lapses when rated Again", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const learnedCard: FsrsCardState = {
      stability: 14,
      difficulty: 5,
      reps: 3,
      lapses: 0,
      intervalDays: 14,
      lastPracticed: "2026-11-04T12:00:00Z",
      status: "review",
    };

    const res = scheduleFsrsReview(learnedCard, 1, now);
    expect(res.lapses).toBe(1);
    expect(res.stability).toBeLessThan(learnedCard.stability);
    expect(res.intervalDays).toBe(0);
    expect(res.learningStatus).toBe("learning");
    expect(res.box).toBe(0);
  });

  it("formats interval labels cleanly", () => {
    expect(formatIntervalLabel(0)).toBe("10 min");
    expect(formatIntervalLabel(1)).toBe("1 day");
    expect(formatIntervalLabel(3)).toBe("3 days");
    expect(formatIntervalLabel(30)).toBe("1 month");
  });
});
