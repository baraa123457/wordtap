/**
 * Video Playback Quality Types & Utilities for WordTap Stage 2
 */

export type WordTabVideoQuality = "auto" | "360p" | "480p" | "720p" | "original";

export const QUALITY_OPTIONS: Array<{
  id: WordTabVideoQuality;
  label: string;
  badge: string;
  description: string;
}> = [
  { id: "auto", label: "Auto", badge: "Auto", description: "Smart bandwidth saving (480p)" },
  { id: "360p", label: "360p", badge: "360p", description: "Low data / Fastest loading" },
  { id: "480p", label: "480p", badge: "480p", description: "Standard clarity (smooth)" },
  { id: "720p", label: "720p", badge: "720p HD", description: "High definition" },
  { id: "original", label: "Original", badge: "Original", description: "Original uncompressed stream" },
];

const STORAGE_KEY = "wordtap_video_quality";

export function getSavedVideoQuality(): WordTabVideoQuality {
  if (typeof window === "undefined") return "auto";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "auto" || saved === "360p" || saved === "480p" || saved === "720p" || saved === "original")) {
      return saved;
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return "auto";
}

export function saveVideoQualityPreference(quality: WordTabVideoQuality): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Resolves an optimized stream URL for direct HTML5 video hosts (such as Wikimedia Commons).
 * Wikimedia automatically transcodes raw media into vp9 derivatives (360p, 480p, 720p)
 * which are 75% to 92% smaller than raw camera/satellite files.
 */
export function resolveDirectVideoQualityUrl(
  originalUrl: string,
  quality: WordTabVideoQuality,
): string {
  if (!originalUrl || quality === "original") return originalUrl;

  // Wikimedia Commons transcoding pattern
  const commonsMatch = originalUrl.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2}\/([^/?#]+))(?:\?.*)?$/i,
  );
  if (commonsMatch) {
    const [, relPath, fileName] = commonsMatch;
    // For auto, default to 480p to prevent heavy 90MB downloads while keeping text/subtitles clear
    const targetRes = quality === "360p" ? "360p" : quality === "720p" ? "720p" : "480p";
    return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${relPath}/${fileName}.${targetRes}.vp9.webm`;
  }

  return originalUrl;
}
