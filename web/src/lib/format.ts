const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "now", "in 3 hours", "in 2 days" for a future timestamp. */
export function formatDueIn(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return "now";
  if (diff < HOUR) return `in ${Math.max(1, Math.round(diff / MINUTE))} min`;
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return `in ${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.round(diff / DAY);
  return `in ${d} ${d === 1 ? "day" : "days"}`;
}

export type WordStatus = "due" | "learning" | "mastered";

export function wordStatus(box: number, nextReview: string, now: Date = new Date()): WordStatus {
  if (box >= 4) return "mastered";
  return new Date(nextReview).getTime() <= now.getTime() ? "due" : "learning";
}

export function isDue(nextReview: string, now: Date = new Date()): boolean {
  return new Date(nextReview).getTime() <= now.getTime();
}
