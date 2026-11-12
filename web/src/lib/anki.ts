import type { Word } from "./schemas";
import { downloadCsvFile } from "./export";

function cleanAnkiText(text: string): string {
  return (text || "").replace(/\t/g, " ").replace(/\r?\n/g, "<br>").trim();
}

/**
 * Generates tab-delimited Anki-ready text.
 * Anki standard card import format: Front (Word + Context audio hint) \t Back (Arabic Translation + Example Sentence) \t Tags
 */
export function exportWordsToAnki(words: Word[]): string {
  const lines = words.map((w) => {
    const front = cleanAnkiText(w.text);
    const backTranslation = cleanAnkiText(w.translation);
    const backSentence = w.sentence ? `<br><small style="color:#888;">"${cleanAnkiText(w.sentence)}"</small>` : "";
    const back = `${backTranslation}${backSentence}`;
    const tag = cleanAnkiText(w.source_title ? w.source_title.replace(/\s+/g, "_") : "wordtap");

    return `${front}\t${back}\t${tag}`;
  });

  return lines.join("\r\n");
}

export function downloadAnkiFile(content: string, filename = "wordtap-anki-deck.txt"): void {
  downloadCsvFile(content, filename);
}
