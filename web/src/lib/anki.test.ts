import { describe, expect, it } from "vitest";
import { exportWordsToAnki } from "./anki";
import type { Word } from "./schemas";

describe("exportWordsToAnki", () => {
  it("generates tab-separated text with front, back, and sentence context", () => {
    const mockWords: Word[] = [
      {
        id: "1",
        text: "Integrity",
        translation: "نزاهة",
        src_lang: "en",
        target_lang: "ar",
        sentence: "A man of integrity.",
        source_title: "Suits S01",
        source_url: "",
        times_seen: 1,
        box: 1,
        next_review: "",
        correct_count: 1,
        wrong_count: 0,
        last_practiced: null,
        created_at: "",
      },
    ];

    const output = exportWordsToAnki(mockWords);
    const parts = output.split("\t");
    expect(parts[0]).toBe("Integrity");
    expect(parts[1]).toContain("نزاهة");
    expect(parts[1]).toContain("A man of integrity.");
    expect(parts[2]).toBe("Suits_S01");
  });
});
