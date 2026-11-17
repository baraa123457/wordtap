import { describe, expect, it } from "vitest";
import { calculateStreakFromWords, effectiveStats, previousDay } from "./dates";
import { EMPTY_STATS } from "./schemas";

describe("dates and streak calculations", () => {
  it("computes previousDay correctly without DST issues", () => {
    expect(previousDay("2026-11-16")).toBe("2026-11-15");
    expect(previousDay("2026-11-01")).toBe("2026-10-31");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });

  it("calculates 3-day streak when words were practiced on 3 consecutive days", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-14T10:00:00Z" },
      { last_practiced: "2026-11-15T15:30:00Z" },
      { last_practiced: "2026-11-16T08:00:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 1, last_practice_date: today, today_xp: 300 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(3);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(3);
    expect(eff.practicedToday).toBe(true);
    expect(eff.todayXp).toBe(300);
  });

  it("preserves streak if user has not yet practiced today, but practiced yesterday", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-14T10:00:00Z" },
      { last_practiced: "2026-11-15T15:30:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 2, last_practice_date: "2026-11-15", today_xp: 0 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(2);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(2);
    expect(eff.practicedToday).toBe(false);
  });

  it("resets streak to 0 if more than 1 day was missed", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-13T10:00:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 5, last_practice_date: "2026-11-13", today_xp: 0 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(0);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(0);
    expect(eff.practicedToday).toBe(false);
  });
});
