import { describe, expect, it } from "vitest";
import { calculateStreakFromWords, daysDifference, effectiveStats, previousDay } from "./dates";
import { EMPTY_STATS } from "./schemas";

describe("dates and streak calculations", () => {
  it("computes previousDay correctly without DST issues", () => {
    expect(previousDay("2026-11-16")).toBe("2026-11-15");
    expect(previousDay("2026-11-01")).toBe("2026-10-31");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
    expect(previousDay("")).toBe("");
    expect(previousDay("invalid-date")).toBe("");
  });

  it("computes daysDifference correctly", () => {
    expect(daysDifference("2026-11-22", "2026-11-22")).toBe(0);
    expect(daysDifference("2026-11-21", "2026-11-22")).toBe(1);
    expect(daysDifference("2026-11-20", "2026-11-22")).toBe(2);
    expect(daysDifference("2026-11-19", "2026-11-22")).toBe(3);
    expect(daysDifference("2026-11-18", "2026-11-22")).toBe(4);
  });

  it("calculates active hot 3-day streak when words were practiced today", () => {
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
    expect(eff.isCold).toBe(false);
    expect(eff.coldDaysLeft).toBe(0);
    expect(eff.todayXp).toBe(300);
  });

  it("marks streak as cold with 2 days left if not practiced today yet, but practiced yesterday", () => {
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
    expect(eff.isCold).toBe(true);
    expect(eff.coldDaysLeft).toBe(2);
  });

  it("preserves streak as cold (1 day left) when 1 day was missed (last practice 2 days ago)", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-13T10:00:00Z" },
      { last_practiced: "2026-11-14T15:30:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 2, last_practice_date: "2026-11-14", today_xp: 0 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(2);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(2);
    expect(eff.practicedToday).toBe(false);
    expect(eff.isCold).toBe(true);
    expect(eff.coldDaysLeft).toBe(1);
  });

  it("preserves streak as cold (1 day left) when 2 days were missed (last practice 3 days ago)", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-12T10:00:00Z" },
      { last_practiced: "2026-11-13T15:30:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 2, last_practice_date: "2026-11-13", today_xp: 0 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(2);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(2);
    expect(eff.practicedToday).toBe(false);
    expect(eff.isCold).toBe(true);
    expect(eff.coldDaysLeft).toBe(1);
  });

  it("resets streak to 0 if more than 2 cold days were missed (last practice 4+ days ago)", () => {
    const today = "2026-11-16";
    const words = [
      { last_practiced: "2026-11-12T10:00:00Z" },
    ];
    const stats = { ...EMPTY_STATS, streak: 5, last_practice_date: "2026-11-12", today_xp: 0 };

    const streak = calculateStreakFromWords(words, stats, today);
    expect(streak).toBe(0);

    const eff = effectiveStats(stats, today, words);
    expect(eff.streak).toBe(0);
    expect(eff.practicedToday).toBe(false);
    expect(eff.isCold).toBe(false);
    expect(eff.coldDaysLeft).toBe(0);
  });
});
