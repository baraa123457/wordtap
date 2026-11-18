import { describe, expect, it } from "vitest";
import {
  buildExactDotPlaceholder,
  buildProgressiveHint,
  maskWordInSentence,
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

    expect(buildProgressiveHint("reluctant", 1)).toBeNull();
    expect(buildProgressiveHint("reluctant", 2)).toBe("r........");
    expect(buildProgressiveHint("reluctant", 3)).toBe("r.......t");
  });
});
