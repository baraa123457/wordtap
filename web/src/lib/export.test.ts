import { describe, expect, it } from "vitest";
import { exportWordsToCsv } from "./export";
import type { Word } from "./schemas";

describe("exportWordsToCsv", () => {
  it("formats words correctly with Arabic text and proper CSV escaping", () => {
    const mockWords: Word[] = [
      {
        id: "1",
        text: "Integrity",
        translation: "نزاهة",
        src_lang: "en",
        target_lang: "ar",
        sentence: 'He spoke about "Integrity" in leadership.',
        source_title: "Ted Talk",
        source_url: "https://youtube.com/watch?v=123",
        times_seen: 3,
        box: 2,
        next_review: "2026-11-15T00:00:00Z",
        correct_count: 2,
        wrong_count: 1,
        last_practiced: "2026-11-12T00:00:00Z",
        created_at: "2026-11-10T00:00:00Z",
      },
    ];

    const csv = exportWordsToCsv(mockWords);
    expect(csv).toContain("Word,Translation,Source Language,Target Language");
    expect(csv).toContain('"Integrity"');
    expect(csv).toContain('"نزاهة"');
    // Quotes inside sentence escaped as double quotes
    expect(csv).toContain('"He spoke about ""Integrity"" in leadership."');
  });
});
