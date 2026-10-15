import type { Stats } from "./schemas";

/** YYYY-MM-DD in the learner's own time zone. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const prev = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1);
  return localDateString(prev);
}

export type EffectiveStats = {
  streak: number;
  todayXp: number;
  practicedToday: boolean;
};

/** Streak and today's XP as the learner should see them right now. */
export function effectiveStats(stats: Stats, today: string): EffectiveStats {
  const last = stats.last_practice_date;
  if (last === today) {
    return { streak: stats.streak, todayXp: stats.today_xp, practicedToday: true };
  }
  if (last === previousDay(today)) {
    return { streak: stats.streak, todayXp: 0, practicedToday: false };
  }
  return { streak: 0, todayXp: 0, practicedToday: false };
}
