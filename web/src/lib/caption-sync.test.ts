import { describe, expect, it } from "vitest";
import { maskWordInSentence } from "./placeholder";
import { buildTimedCaptionLayout, getTokenSpeechState } from "./caption-sync";

describe("Live word-by-word caption synchronization", () => {
  it("computes monotonic word timings across a cue and transitions upcoming -> speaking -> spoken", () => {
    const sentence = "Ukraine's sovereignty and territorial integrity must be respected.";
    const masked = maskWordInSentence(sentence, "integrity")!;
    const cues = [
      { start: 10.0, end: 14.0, text: sentence },
    ];

    const layout = buildTimedCaptionLayout(masked, cues)!;
    expect(layout).not.toBeNull();
    expect(layout.sentenceStart).toBe(10.0);
    expect(layout.sentenceEnd).toBe(14.0);

    const words = layout.tokens.filter((t) => !t.isSpace);
    expect(words.length).toBe(8);

    // Timings must be strictly monotonic and span [10, 14]
    expect(words[0]!.start).toBeCloseTo(10.0, 2);
    expect(words[words.length - 1]!.end).toBeCloseTo(14.0, 2);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i]!.start).toBeGreaterThanOrEqual(words[i - 1]!.end - 0.001);
    }

    const targetTok = words.find((w) => w.isTarget)!;
    expect(targetTok).toBeDefined();

    // Before sentence starts -> idle
    expect(getTokenSpeechState(targetTok, 9.0, layout.sentenceStart)).toBe("idle");
    // Inside sentence before target word -> upcoming
    expect(getTokenSpeechState(targetTok, 10.2, layout.sentenceStart)).toBe("upcoming");
    // Exact instant speaker says target word -> speaking
    expect(
      getTokenSpeechState(targetTok, (targetTok.start + targetTok.end) / 2, layout.sentenceStart),
    ).toBe("speaking");
    // After target word is spoken -> spoken
    expect(getTokenSpeechState(targetTok, targetTok.end + 0.2, layout.sentenceStart)).toBe("spoken");
  });

  it("anchors multi-cue sentences to real cue boundaries", () => {
    const sentence = "Many new editors feel reluctant to contribute to open projects.";
    const masked = maskWordInSentence(sentence, "reluctant")!;
    const cues = [
      { start: 59.0, end: 61.5, text: "Many new editors feel" },
      { start: 61.5, end: 65.0, text: "reluctant to contribute to open projects." },
    ];

    const layout = buildTimedCaptionLayout(masked, cues)!;
    expect(layout.sentenceStart).toBe(59.0);
    expect(layout.sentenceEnd).toBe(65.0);

    const targetTok = layout.tokens.find((t) => t.isTarget)!;
    expect(targetTok.start).toBeGreaterThanOrEqual(61.0);
    expect(targetTok.end).toBeLessThanOrEqual(65.0);
  });
});
