/**
 * Parsed word row from CSV, TSV, or text file
 */
export type ImportedWordRow = {
  text: string;
  translation: string;
  src_lang?: string;
  target_lang?: string;
  sentence?: string;
  source_title?: string;
};

/**
 * Parses raw text into imported word items.
 * Supports:
 * - WordTap CSV export format (with headers)
 * - Anki tab-separated values (Word \t Translation \t Context)
 * - Comma-separated pairs (Word, Translation)
 * - Dash / colon separated lines (Word - Translation or Word: Translation)
 */
export function parseImportFile(rawContent: string): ImportedWordRow[] {
  if (!rawContent || !rawContent.trim()) return [];

  // Remove BOM if present
  const content = rawContent.replace(/^\uFEFF/, "").trim();
  const rawLines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const firstLine = rawLines[0] || "";
  const isCsvHeader = /^(word|text|term)[,\t]/i.test(firstLine);
  const dataLines = isCsvHeader ? rawLines.slice(1) : rawLines;

  const results: ImportedWordRow[] = [];

  for (const line of dataLines) {
    if (!line) continue;

    // 1. Tab separated (Anki or WordTap TSV)
    if (line.includes("\t")) {
      const parts = line.split("\t").map((p) => p.trim());
      if (parts[0] && parts[1]) {
        results.push({
          text: parts[0],
          translation: parts[1],
          sentence: parts[2] || "",
          source_title: parts[3] || "Imported deck",
        });
        continue;
      }
    }

    // 2. CSV parsing with basic quote handling
    if (line.includes(",")) {
      const cells = parseCsvLine(line);
      if (cells.length >= 2 && cells[0] && cells[1]) {
        // If WordTap format: Word,Translation,SourceLang,TargetLang,Box,Sentence,SourceTitle,SourceURL
        results.push({
          text: cells[0],
          translation: cells[1],
          src_lang: cells[2] || undefined,
          target_lang: cells[3] || undefined,
          sentence: cells[5] || "",
          source_title: cells[6] || "Imported CSV",
        });
        continue;
      }
    }

    // 3. Fallback: "Word - Translation" or "Word : Translation"
    const dashMatch = line.match(/^([^:-]+)\s*[:—–-]\s*(.+)$/);
    if (dashMatch && dashMatch[1] && dashMatch[2]) {
      results.push({
        text: dashMatch[1].trim(),
        translation: dashMatch[2].trim(),
        source_title: "Quick list",
      });
    }
  }

  return results;
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}
