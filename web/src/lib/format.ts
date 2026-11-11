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

/**
 * Parses raw source context into an optional subtitle sentence and a clean source title.
 * Handles formats:
 * - '"What are you doing here?" — Stranger Things'
 * - 'Sentence ::: Source Title'
 * - 'Just a title or URL'
 */
export function parseSourceContext(raw?: string | null): { sentence?: string; sourceTitle: string } {
  if (!raw) return { sourceTitle: "" };
  const str = raw.trim();
  const quoteMatch = str.match(/^["“](.+?)["”]\s*[-—–:]\s*(.+)$/);
  if (quoteMatch) {
    return {
      sentence: quoteMatch[1].trim(),
      sourceTitle: quoteMatch[2].trim(),
    };
  }
  if (str.includes(" ::: ")) {
    const [sentence, ...rest] = str.split(" ::: ");
    return {
      sentence: sentence.trim(),
      sourceTitle: rest.join(" ::: ").trim(),
    };
  }
  return { sourceTitle: str };
}

