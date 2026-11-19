import { describe, expect, it } from "vitest";
import {
  analyzeAnswerFaults,
  buildExactDotPlaceholder,
  buildProgressiveHint,
  maskWordInSentence,
  parseYouGlishCaption,
  validateMissingWordAnswer,
} from "./placeholder";

describe("Stage 2 exact 1-dot-per-character placeholder rule", () => {
  it("generates exact character-count dots for single words", () => {
    expect(buildExactDotPlaceholder("CAT")).toBe("...");
    expect(buildExactDotPlaceholder("CAT").length).toBe(3);

    expect(buildExactDotPlaceholder("APPLE")).toBe(".....");
    expect(buildExactDotPlaceholder("APPLE").length).toBe(5);

    expect(buildExactDotPlaceholder("RELUCTANT")).toBe(".........");
    expect(buildExactDotPlaceholder("RELUCTANT").length).toBe(9);
  });

  it("masks the exact target word inside a real sentence", () => {
    const masked = maskWordInSentence("He was reluctant to accept the offer.", "reluctant");
    expect(masked).not.toBeNull();
    expect(masked?.before).toBe("He was ");
    expect(masked?.hiddenWord).toBe("reluctant");
    expect(masked?.placeholder).toBe(".........");
    expect(masked?.letterCount).toBe(9);
    expect(masked?.after).toBe(" to accept the offer.");
  });

  it("returns null if the target word is NOT present in the sentence (never fabricates)", () => {
    expect(maskWordInSentence("He was happy to accept the offer.", "reluctant")).toBeNull();
  });

  it("matches inflected forms while preserving exact hidden letter count", () => {
    const masked = maskWordInSentence("She reluctantly agreed to join the panel.", "reluctant");
    expect(masked).not.toBeNull();
    expect(masked?.hiddenWord).toBe("reluctantly");
    expect(masked?.placeholder).toBe("...........");
    expect(masked?.letterCount).toBe(11);
  });

  it("validates user answers case-insensitively and handles progressive hints", () => {
    expect(validateMissingWordAnswer("Reluctant", "reluctant", "reluctant")).toBe(true);
    expect(validateMissingWordAnswer("  reluctant. ", "reluctant", "reluctant")).toBe(true);
    expect(validateMissingWordAnswer("hesitant", "reluctant", "reluctant")).toBe(false);

    expect(buildProgressiveHint("reluctant", 0)).toBeNull();
    expect(buildProgressiveHint("reluctant", 1)).toBe("r........");
    expect(buildProgressiveHint("reluctant", 2)).toBe("r.......t");
    expect(buildProgressiveHint("reluctant", 3)).toBe("re......t");
    expect(buildProgressiveHint("reluctant", 4)).toBe("relu....t");
  });

  it("parses official YouGlish [[[target word]]] markers accurately", () => {
    const raw =
      "On%20now-%5B%5B%5Bcrowded%5D%5D%5D%20commuter%20trains%2C%20a%20frequent%20conversation%20topic%20is%20where%20to%20find%20the%20cheapest%20gas.";
    const parsed = parseYouGlishCaption(raw, "crowded");
    expect(parsed.hasExplicitMarker).toBe(true);
    expect(parsed.plainSentence).toBe(
      "On now-crowded commuter trains, a frequent conversation topic is where to find the cheapest gas.",
    );
    expect(parsed.masked?.before).toBe("On now-");
    expect(parsed.masked?.hiddenWord).toBe("crowded");
    expect(parsed.masked?.placeholder).toBe(".......");
    expect(parsed.masked?.letterCount).toBe(7);
    expect(parsed.masked?.after).toBe(
      " commuter trains, a frequent conversation topic is where to find the cheapest gas.",
    );
  });

  it("verifies exact dot counts for all mandatory Stage 2 test words", () => {
    const cases: Array<[string, number]> = [
      ["crowded", 7],
      ["reluctant", 9],
      ["embarrassed", 11],
      ["exhausted", 9],
      ["probably", 8],
    ];
    for (const [word, expectedLen] of cases) {
      const parsed = parseYouGlishCaption(`People often feel [[[${word}]]] during busy days.`, word);
      expect(parsed.hasExplicitMarker).toBe(true);
      expect(parsed.masked?.hiddenWord).toBe(word);
      expect(parsed.masked?.letterCount).toBe(expectedLen);
      expect(parsed.masked?.placeholder).toBe(".".repeat(expectedLen));
    }
  });

  it("returns masked: null when a YouGlish caption does not contain the target word", () => {
    const parsed = parseYouGlishCaption("Welcome back to today's episode everyone.", "crowded");
    expect(parsed.hasExplicitMarker).toBe(false);
    expect(parsed.masked).toBeNull();
    expect(parsed.plainSentence).toBe("Welcome back to today's episode everyone.");
  });

  describe("analyzeAnswerFaults letter-by-letter diagnosis", () => {
    it("detects wrong letters not in the word (e.g. 'retrife' vs 'retrieve')", () => {
      const res = analyzeAnswerFaults("retrife", "retrieve");
      expect(res.hasFault).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.correctPrefix).toBe("retri");
      expect(res.firstWrongIndex).toBe(5);
      expect(res.firstWrongChar).toBe("f");
      expect(res.expectedChar).toBe("e");
      expect(res.notInWord).toBe(true);
      expect(res.summary).toContain('Letter #6 ("f") is incorrect — "f" is not in this word.');
      expect(res.summary).toContain('You have "retri" right so far');
    });

    it("detects incorrect letters that exist elsewhere in the word", () => {
      const res = analyzeAnswerFaults("retreive", "retrieve");
      expect(res.hasFault).toBe(true);
      expect(res.correctPrefix).toBe("retr");
      expect(res.firstWrongIndex).toBe(4);
      expect(res.firstWrongChar).toBe("e");
      expect(res.expectedChar).toBe("i");
      expect(res.notInWord).toBe(false);
      expect(res.summary).toContain('Letter #5 ("e") is incorrect — try "i".');
    });

    it("reports correct partial prefix when input is incomplete", () => {
      const res = analyzeAnswerFaults("retri", "retrieve");
      expect(res.hasFault).toBe(true);
      expect(res.correctPrefix).toBe("retri");
      expect(res.firstWrongIndex).toBe(-1);
      expect(res.summary).toContain('"retri" is correct so far! You need 3 more letters');
    });

    it("handles exact match and empty inputs", () => {
      expect(analyzeAnswerFaults("retrieve", "retrieve").isCorrect).toBe(true);
      expect(analyzeAnswerFaults("", "retrieve").hasFault).toBe(false);
    });
  });
});
