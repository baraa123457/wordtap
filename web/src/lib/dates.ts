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

/** Computes the difference in calendar days between two YYYY-MM-DD dates (toDay - fromDay). */
export function daysDifference(fromDay: string, toDay: string): number {
  if (!fromDay || !toDay || typeof fromDay !== "string" || typeof toDay !== "string") return 999;
  const parts1 = fromDay.split("-").map(Number);
  const parts2 = toDay.split("-").map(Number);
  if (parts1.length < 3 || parts2.length < 3) return 999;
  const [y1, m1, d1] = parts1;
  const [y2, m2, d2] = parts2;
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2 || isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) return 999;
  const dt1 = new Date(y1, m1 - 1, d1, 12, 0, 0);
  const dt2 = new Date(y2, m2 - 1, d2, 12, 0, 0);
  const diffMs = dt2.getTime() - dt1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type EffectiveStats = {
  streak: number;
  todayXp: number;
  practicedToday: boolean;
  isCold: boolean;
  coldDaysLeft: number;
};

/**
 * Calculates the consecutive daily practice streak from word review history and stats.
 * Inspects all unique calendar dates on which words were practiced.
 * If the streak was cold (no practice yet today or missed days), practicing today
 * continues and increments the existing streak rather than restarting it at 1.
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

  const baseStreak = Math.max(stats.streak || 0, stats.best_streak || 0, 0);

  if (practiceDates.size === 0) {
    return baseStreak;
  }

  const practicedToday = practiceDates.has(today);

  // If the user practiced today:
  if (practicedToday) {
    // 1. Calculate consecutive days ending today
    let consecutive = 1;
    let checkDate = previousDay(today);
    while (practiceDates.has(checkDate)) {
      consecutive++;
      checkDate = previousDay(checkDate);
    }

    // 2. If the user had an existing streak and reignited a cold streak today,
    // continue and advance the existing streak (+1) rather than dropping it to 1!
    const wasAlreadyRecordedToday = stats.last_practice_date === today;
    const continuedStreak = wasAlreadyRecordedToday ? baseStreak : baseStreak + 1;

    return Math.max(continuedStreak, consecutive, 1);
  }

  // Not practiced today yet: preserve existing streak intact while cold
  return baseStreak;
}

/** Streak and today's XP as the learner should see them right now. */
export function effectiveStats(
  stats: Stats,
  today: string = localDateString(),
  words?: { last_practiced?: string | null }[],
): EffectiveStats {
  const baseStreak = Math.max(stats.streak || 0, stats.best_streak || 0, 0);
  const last = stats.last_practice_date;
  const practicedToday =
    last === today ||
    (words?.some(
      (w) => w.last_practiced && localDateString(new Date(w.last_practiced)) === today,
    ) ?? false);

  if (practicedToday) {
    const computedStreak = words ? calculateStreakFromWords(words, stats, today) : Math.max(baseStreak, 1);
    return {
      streak: Math.max(computedStreak, 1),
      todayXp: stats.today_xp,
      practicedToday: true,
      isCold: false,
      coldDaysLeft: 0,
    };
  }

  // Find latest practice date across user_stats and word review timestamps
  let lastDate = last || "";
  if (words && words.length > 0) {
    for (const w of words) {
      if (w.last_practiced) {
        const dStr = localDateString(new Date(w.last_practiced));
        if (!lastDate || dStr > lastDate) {
          lastDate = dStr;
        }
      }
    }
  }

  // Not practiced today yet:
  if (baseStreak > 0) {
    // Streak is cold: user has not practiced today yet.
    // Preserves streak count so practicing today continues it!
    const daysSince = lastDate ? daysDifference(lastDate, today) : 1;
    return {
      streak: baseStreak,
      todayXp: 0,
      practicedToday: false,
      isCold: true,
      coldDaysLeft: Math.max(1, 3 - Math.min(daysSince, 2)),
    };
  }

  return { streak: 0, todayXp: 0, practicedToday: false, isCold: false, coldDaysLeft: 0 };
}
