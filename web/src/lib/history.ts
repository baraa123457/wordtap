export type HistorySource = "translator" | "subtitle" | "selection";

export type HistoryItem = {
  id: string;
  text: string;
  translation: string;
  src_lang: string;
  target_lang: string;
  timestamp: string; // ISO date string
  source: HistorySource;
  source_title?: string;
  source_url?: string;
  saved?: boolean;
};

const STORAGE_KEY = "wordtap_history";
const MAX_HISTORY = 300;

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read history:", e);
    return [];
  }
}

export function addHistoryItem(
  item: Omit<HistoryItem, "id" | "timestamp"> & { id?: string; timestamp?: string }
): HistoryItem {
  if (typeof window === "undefined") {
    return {
      ...item,
      id: item.id || `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: item.timestamp || new Date().toISOString(),
    };
  }

  try {
    const current = getHistory();
    const cleanText = item.text.trim();
    const cleanTrans = item.translation.trim();

    // Check if the most recent item is identical to avoid duplicates while typing
    const first = current[0];
    if (
      first &&
      first.text.toLowerCase() === cleanText.toLowerCase() &&
      first.target_lang === item.target_lang &&
      first.src_lang === item.src_lang
    ) {
      // Just update translation & timestamp if changed
      first.translation = cleanTrans;
      first.timestamp = new Date().toISOString();
      if (typeof item.saved === "boolean") first.saved = item.saved;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
      return first;
    }

    const newItem: HistoryItem = {
      id: item.id || `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleanText,
      translation: cleanTrans,
      src_lang: item.src_lang || "auto",
      target_lang: item.target_lang || "ar",
      source: item.source || "translator",
      source_title: item.source_title || "",
      source_url: item.source_url || "",
      saved: Boolean(item.saved),
      timestamp: item.timestamp || new Date().toISOString(),
    };

    // Filter out previous exact match to keep list clean and bring to top
    const filtered = current.filter(
      (h) =>
        !(
          h.text.toLowerCase() === cleanText.toLowerCase() &&
          h.target_lang === newItem.target_lang &&
          h.src_lang === newItem.src_lang
        )
    );

    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
    return newItem;
  } catch (e) {
    console.error("Failed to save history:", e);
    return {
      ...item,
      id: item.id || `h-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }
}

export function markHistoryItemSaved(text: string, srcLang?: string, targetLang?: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getHistory();
    let modified = false;
    const lower = text.trim().toLowerCase();
    for (const h of current) {
      if (
        h.text.toLowerCase() === lower &&
        (!srcLang || h.src_lang === srcLang) &&
        (!targetLang || h.target_lang === targetLang)
      ) {
        h.saved = true;
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
    }
  } catch (e) {
    console.error("Failed to mark history saved:", e);
  }
}

export function removeHistoryItem(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getHistory();
    const updated = current.filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
  } catch (e) {
    console.error("Failed to remove history item:", e);
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("wordtap_history_updated"));
  } catch (e) {
    console.error("Failed to clear history:", e);
  }
}
