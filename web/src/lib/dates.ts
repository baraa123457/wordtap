import type { Stats } from "./schemas";

/** YYYY-MM-DD in the learner's own time zone. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function previousDay(date: string): string {
  if (!date || typeof date !== "string" || !date.includes("-")) return "";
  const parts = date.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return "";
  // Using noon (12:00) prevents daylight saving shifts from rolling back an extra day
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0);
  return localDateString(prev);
}

export type EffectiveStats = {
  streak: number;
  todayXp: number;
  practicedToday: boolean;
};

/**
 * Calculates the consecutive daily practice streak from word review history and stats.
 * Inspects all unique calendar dates on which words were practiced.
 */
export function calculateStreakFromWords(
  words: { last_practiced?: string | null }[],
  stats: Stats,
  today: string = localDateString(),
): number {
  const practiceDates = new Set<string>();

  // Add recorded date from user_stats
  if (stats.last_practice_date) {
    practiceDates.add(stats.last_practice_date);
  }

  // Add all dates when any word was actually practiced
  for (const w of words) {
    if (w.last_practiced) {
      practiceDates.add(localDateString(new Date(w.last_practiced)));
    }
  }

  if (practiceDates.size === 0) {
    return stats.streak || 0;
  }

  // Walk backwards from today or yesterday to determine consecutive streak
  let streak = 0;
  let checkDate = today;

  if (practiceDates.has(checkDate)) {
    // Practiced today: count today and walk backward
    streak = 1;
    checkDate = previousDay(checkDate);
  } else if (practiceDates.has(previousDay(today))) {
    // Not practiced today yet, but practiced yesterday: streak intact
    streak = 1;
    checkDate = previousDay(previousDay(today));
  } else {
    // Neither today nor yesterday: streak is broken
    return 0;
  }

  while (practiceDates.has(checkDate)) {
    streak++;
    checkDate = previousDay(checkDate);
  }

  return Math.max(stats.streak, streak);
}

/** Streak and today's XP as the learner should see them right now. */
export function effectiveStats(
  stats: Stats,
  today: string = localDateString(),
  words?: { last_practiced?: string | null }[],
): EffectiveStats {
  const computedStreak = words ? calculateStreakFromWords(words, stats, today) : stats.streak;
  const last = stats.last_practice_date;
  const practicedToday =
    last === today ||
    (words?.some(
      (w) => w.last_practiced && localDateString(new Date(w.last_practiced)) === today,
    ) ?? false);

  if (practicedToday) {
    return {
      streak: Math.max(1, computedStreak),
      todayXp: stats.today_xp,
      practicedToday: true,
    };
  }

  const practicedYesterday =
    last === previousDay(today) ||
    (words?.some(
      (w) => w.last_practiced && localDateString(new Date(w.last_practiced)) === previousDay(today),
    ) ?? false);

  if (practicedYesterday) {
    return {
      streak: computedStreak,
      todayXp: 0,
      practicedToday: false,
    };
  }

  return { streak: 0, todayXp: 0, practicedToday: false };
}
