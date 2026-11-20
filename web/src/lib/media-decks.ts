import type { Word } from "./schemas";

export interface MediaDeck {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  categoryLabel: string;
  badge: string;
  emoji: string;
  gradient: string;
  sourceType: "netflix" | "youtube" | "vlc" | "prime" | "disney" | "web" | "general";
  sourceUrl?: string;
  words: Word[];
  wordCount: number;
  lastAddedAt: string;
}

/**
 * Intelligently cleans and normalizes a movie, series, or video title
 * from raw filenames, browser page titles, or context strings.
 */
export function cleanMediaTitle(rawTitle: string, rawUrl: string = ""): {
  cleanTitle: string;
  sourceType: MediaDeck["sourceType"];
  categoryLabel: string;
  emoji: string;
} {
  const url = (rawUrl || "").toLowerCase();
  let text = (rawTitle || "").trim();

  // 1. Strip preceding context sentence if format is: "sentence" — Title
  if (text.includes("—")) {
    const parts = text.split("—");
    text = parts[parts.length - 1].trim();
  } else if (text.includes(" - ") && !url.includes("youtube")) {
    const parts = text.split(" - ");
    if (parts.length > 1 && parts[0].startsWith('"')) {
      text = parts.slice(1).join(" - ").trim();
    }
  }

  // 2. Detect platform from URL or title tags
  let sourceType: MediaDeck["sourceType"] = "general";
  let categoryLabel = "Word Collection";
  let emoji = "🎬";

  if (url.includes("netflix.com") || /\|\s*netflix/i.test(text)) {
    sourceType = "netflix";
    categoryLabel = "Netflix Series";
    emoji = "🎬";
    text = text.replace(/\|\s*netflix/gi, "").trim();
  } else if (url.includes("youtube.com") || url.includes("youtu.be") || /-\s*youtube/i.test(text)) {
    sourceType = "youtube";
    categoryLabel = "YouTube";
    emoji = "▶️";
    text = text.replace(/-\s*youtube/gi, "").trim();
  } else if (url.includes("primevideo.com") || url.includes("amazon.com") || /\|\s*prime\s*video/i.test(text)) {
    sourceType = "prime";
    categoryLabel = "Prime Video";
    emoji = "🍿";
    text = text.replace(/\|\s*prime\s*video/gi, "").trim();
  } else if (url.includes("disneyplus.com") || /\|\s*disney\+/i.test(text)) {
    sourceType = "disney";
    categoryLabel = "Disney+";
    emoji = "✨";
    text = text.replace(/\|\s*disney\+/gi, "").trim();
  } else if (url === "wordtap-vlc-player" || /\.(mkv|mp4|avi|mov|m4v|ts|flv)$/i.test(text)) {
    sourceType = "vlc";
    categoryLabel = "WordTap VLC Player";
    emoji = "🍿";
  } else if (url.startsWith("http://") || url.startsWith("https://")) {
    sourceType = "web";
    categoryLabel = "Web Article";
    emoji = "🌐";
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      if (!text || text.length < 3) {
        text = hostname.split(".")[0];
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }
    } catch {}
  }

  // 3. Clean video/scene filename artifacts (e.g. "Game of Thrones S02E01 The North Remembers (1080p x265 10bit Joy).mkv")
  text = text
    .replace(/\.(mkv|mp4|avi|mov|m4v|ts|flv|webm|wmv)$/i, "") // strip extension
    .replace(/\[[^\]]*\]/g, "") // strip brackets [1080p]
    .replace(/\([^\)]*\)/g, "") // strip parens (2014)
    .replace(/\b(1080p|720p|2160p|4k|bluray|bdrip|webrip|web-dl|hdrip|dvdrip|x264|x265|10bit|hevc|ddp|ddp5\.1|ac3|dts|aac|ivy|joy|yts|yify|rarbg|eztv)\b/gi, "")
    .replace(/[-_.]+/g, " ") // replace dots and underscores with spaces
    .trim();

  // 4. Extract Series Name if Season/Episode is present
  // e.g. "Game of Thrones S02E01 The North Remembers" -> "Game of Thrones"
  // e.g. "Stranger Things S04E01" -> "Stranger Things"
  // e.g. "Stranger Things: Season 1: Chapter One" -> "Stranger Things"
  const seasonMatch = text.match(/^(.*?)(?:\s+(?:s\d\d?|season\s*\d\d?|episode\s*\d\d?|ep\s*\d\d?|ch\s*\d\d?|chapter\s*\d\d?)\b|:\s*season)/i);
  if (seasonMatch && seasonMatch[1] && seasonMatch[1].trim().length >= 2) {
    text = seasonMatch[1].trim();
  }

  // 5. If YouTube video title is too long or messy, make it clean
  if (sourceType === "youtube") {
    if (text.length > 36) {
      const colonSplit = text.split(":");
      if (colonSplit.length > 1 && colonSplit[0].length < 30) {
        text = colonSplit[0].trim();
      } else {
        text = text.slice(0, 34).trim() + "…";
      }
    }
  }

  // Fallback if empty
  if (!text || text.length < 2) {
    if (sourceType === "netflix") text = "Netflix Series";
    else if (sourceType === "youtube") text = "YouTube";
    else if (sourceType === "vlc") text = "VLC Movie / Series";
    else if (sourceType === "prime") text = "Prime Video";
    else text = "My Collection";
  }

  return {
    cleanTitle: text,
    sourceType,
    categoryLabel,
    emoji,
  };
}

const DECK_GRADIENTS = [
  "from-amber-500/20 via-orange-500/10 to-transparent",
  "from-purple-500/20 via-indigo-500/10 to-transparent",
  "from-cyan-500/20 via-blue-500/10 to-transparent",
  "from-rose-500/20 via-pink-500/10 to-transparent",
  "from-emerald-500/20 via-teal-500/10 to-transparent",
  "from-yellow-500/20 via-amber-500/10 to-transparent",
];

export function groupWordsIntoMediaDecks(words: Word[]): MediaDeck[] {
  if (!words || words.length === 0) return [];

  const groups = new Map<
    string,
    {
      cleanTitle: string;
      sourceType: MediaDeck["sourceType"];
      categoryLabel: string;
      emoji: string;
      words: Word[];
      lastAddedAt: string;
    }
  >();

  for (const word of words) {
    const rawTitle = word.source_title || "";
    const rawUrl = word.source_url || "";
    const { cleanTitle, sourceType, categoryLabel, emoji } = cleanMediaTitle(rawTitle, rawUrl);

    // Group key (case-insensitive title)
    const key = cleanTitle.toLowerCase();
    const existing = groups.get(key);

    if (existing) {
      existing.words.push(word);
      if (new Date(word.created_at) > new Date(existing.lastAddedAt)) {
        existing.lastAddedAt = word.created_at;
      }
    } else {
      groups.set(key, {
        cleanTitle,
        sourceType,
        categoryLabel,
        emoji,
        words: [word],
        lastAddedAt: word.created_at || new Date().toISOString(),
      });
    }
  }

  // Convert to array of MediaDeck
  const decks: MediaDeck[] = Array.from(groups.values()).map((g, idx) => {
    const id = `media-${g.cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const wordCount = g.words.length;
    const gradient = DECK_GRADIENTS[idx % DECK_GRADIENTS.length];

    return {
      id,
      title: g.cleanTitle,
      subtitle: `${wordCount} word${wordCount === 1 ? "" : "s"} collected while watching`,
      description: `Practice native vocabulary and expressions you saved while watching ${g.cleanTitle}.`,
      categoryLabel: g.categoryLabel,
      badge: `${wordCount} Word${wordCount === 1 ? "" : "s"}`,
      emoji: g.emoji,
      gradient,
      sourceType: g.sourceType,
      words: g.words,
      wordCount,
      lastAddedAt: g.lastAddedAt,
    };
  });

  // Sort decks: first by wordCount (descending), then by lastAddedAt
  decks.sort(
    (a, b) =>
      b.wordCount - a.wordCount ||
      new Date(b.lastAddedAt).getTime() - new Date(a.lastAddedAt).getTime(),
  );

  return decks;
}
