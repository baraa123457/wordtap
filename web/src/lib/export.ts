import type { Word } from "./schemas";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Converts a list of Word records into clean, standards-compliant CSV text.
 */
export function exportWordsToCsv(words: Word[]): string {
  const headers = [
    "Word",
    "Translation",
    "Source Language",
    "Target Language",
    "Context Sentence",
    "Source Title",
    "Source URL",
    "Times Seen",
    "Leitner Box",
    "Next Review",
    "Correct Count",
    "Wrong Count",
    "Date Added",
  ];

  const rows = words.map((w) => [
    escapeCsvField(w.text),
    escapeCsvField(w.translation),
    escapeCsvField(w.src_lang),
    escapeCsvField(w.target_lang),
    escapeCsvField(w.sentence || ""),
    escapeCsvField(w.source_title || ""),
    escapeCsvField(w.source_url || ""),
    escapeCsvField(w.times_seen),
    escapeCsvField(w.box),
    escapeCsvField(w.next_review),
    escapeCsvField(w.correct_count),
    escapeCsvField(w.wrong_count),
    escapeCsvField(w.created_at),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

/**
 * Triggers a browser download of the CSV data.
 */
export function downloadCsvFile(csvContent: string, filename = "wordtap-vocabulary.csv"): void {
  // UTF-8 BOM so Excel on Windows handles Arabic/UTF-8 correctly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
