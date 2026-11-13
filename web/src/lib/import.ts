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

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

/**
 * Normalizes word and translation order:
 * If column 1 is Arabic (e.g. "متوافق") and column 2 is English (e.g. "Compatible"),
 * automatically swap them so the target vocabulary is the foreign word ("Compatible")
 * and the translation is Arabic ("متوافق"), with src_lang="en" and target_lang="ar".
 */
export function normalizeImportPair(
  col1: string,
  col2: string,
  explicitSrc?: string,
  explicitTarget?: string
): { text: string; translation: string; src_lang: string; target_lang: string } {
  const c1 = (col1 || "").trim();
  const c2 = (col2 || "").trim();
  const c1IsArabic = ARABIC_CHAR_REGEX.test(c1);
  const c2IsArabic = ARABIC_CHAR_REGEX.test(c2);

  if (c1IsArabic && !c2IsArabic) {
    // Inverted pair: Column 1 is Arabic translation, Column 2 is English/Foreign word!
    return {
      text: c2,
      translation: c1,
      src_lang: explicitSrc && explicitSrc !== "ar" ? explicitSrc : "en",
      target_lang: "ar",
    };
  }

  return {
    text: c1,
    translation: c2,
    src_lang: explicitSrc || (c2IsArabic ? "en" : "auto"),
    target_lang: explicitTarget || (c2IsArabic ? "ar" : "ar"),
  };
}

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
        const pair = normalizeImportPair(parts[0], parts[1]);
        results.push({
          text: pair.text,
          translation: pair.translation,
          src_lang: pair.src_lang,
          target_lang: pair.target_lang,
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
        const pair = normalizeImportPair(cells[0], cells[1], cells[2], cells[3]);
        // If WordTap format: Word,Translation,SourceLang,TargetLang,Box,Sentence,SourceTitle,SourceURL
        results.push({
          text: pair.text,
          translation: pair.translation,
          src_lang: pair.src_lang,
          target_lang: pair.target_lang,
          sentence: cells[5] || "",
          source_title: cells[6] || "Imported CSV",
        });
        continue;
      }
    }

    // 3. Fallback: "Word - Translation" or "Word : Translation"
    const dashMatch = line.match(/^([^:-]+)\s*[:—–-]\s*(.+)$/);
    if (dashMatch && dashMatch[1] && dashMatch[2]) {
      const pair = normalizeImportPair(dashMatch[1].trim(), dashMatch[2].trim());
      results.push({
        text: pair.text,
        translation: pair.translation,
        src_lang: pair.src_lang,
        target_lang: pair.target_lang,
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
