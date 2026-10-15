import { describe, expect, it } from "vitest";
import { checkTyped, levenshtein, normalizeAnswer } from "./text";

describe("normalizeAnswer", () => {
  it("ignores case, punctuation and extra spaces", () => {
    expect(normalizeAnswer("  Hello,   World! ")).toBe("hello world");
  });

  it("strips Latin accents", () => {
    expect(normalizeAnswer("Café")).toBe("cafe");
  });

  it("unifies Arabic letter variants and removes tashkeel", () => {
    expect(normalizeAnswer("أَحْمَد")).toBe(normalizeAnswer("احمد"));
    expect(normalizeAnswer("مدرسة")).toBe(normalizeAnswer("مدرسه"));
    expect(normalizeAnswer("إسلام")).toBe(normalizeAnswer("اسلام"));
  });
});

describe("levenshtein", () => {
  it("counts single edits", () => {
    expect(levenshtein("kitten", "sitten")).toBe(1);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("checkTyped", () => {
  it("accepts exact answers after normalization", () => {
    expect(checkTyped("Hello", "hello")).toBe("correct");
    expect(checkTyped("مرحبا", "مَرْحَبًا")).toBe("correct");
  });

  it("accepts a one-letter slip on longer words as a typo", () => {
    expect(checkTyped("beleive", "believe")).toBe("wrong"); // transposition is two edits
    expect(checkTyped("belive", "believe")).toBe("typo");
  });

  it("does not forgive slips on short words", () => {
    expect(checkTyped("cot", "cat")).toBe("wrong");
  });

  it("rejects empty and different answers", () => {
    expect(checkTyped("", "cat")).toBe("wrong");
    expect(checkTyped("dog", "cat")).toBe("wrong");
  });
});
