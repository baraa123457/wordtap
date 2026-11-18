import { describe, it, expect } from "vitest";
import {
  detectDeterminerIssues,
  buildNaturalAlternative,
  detectFragmentIssue,
  evaluateGrammarLocally,
  isPluralNoun,
} from "./grammar";

describe("Grammar & Determiner Checker", () => {
  it("detects missing articles for singular count nouns in 'i will study portion of lesson'", () => {
    const issues = detectDeterminerIssues("i will study portion of lesson", "portion", "Noun · اسم");
    expect(issues).toHaveLength(2);
    expect(issues[0]?.word).toBe("portion");
    expect(issues[0]?.isTarget).toBe(true);
    expect(issues[1]?.word).toBe("lesson");
    expect(issues[1]?.isTarget).toBe(false);
    expect(issues[1]?.precedingPreposition).toBe("of");

    const alt = buildNaturalAlternative("i will study portion of lesson", issues);
    expect(alt).toBe("I will study a portion of the lesson.");
  });

  it("evaluates 'i will study portion of lesson' with substantial penalty and clear corrections", () => {
    const result = evaluateGrammarLocally({
      sentence: "i will study portion of lesson",
      word: "portion",
      partOfSpeech: "Noun · اسم",
    });

    expect(result.hasStructuralErrors).toBe(true);
    expect(result.scorePenalty).toBeGreaterThanOrEqual(40);
    expect(result.grammarCorrections).toHaveLength(2);
    expect(result.grammarCorrections[0]).toContain('Add an article before "portion"');
    expect(result.grammarCorrections[1]).toContain('Add an article before "lesson"');
    expect(result.naturalAlternative).toBe("I will study a portion of the lesson.");
    expect(result.explanation).toContain("portion");
  });

  it("passes valid sentence with correct determiners: 'i will study a portion of the lesson'", () => {
    const issues = detectDeterminerIssues("i will study a portion of the lesson", "portion", "Noun · اسم");
    expect(issues).toHaveLength(0);

    const result = evaluateGrammarLocally({
      sentence: "i will study a portion of the lesson",
      word: "portion",
      partOfSpeech: "Noun · اسم",
    });
    expect(result.hasStructuralErrors).toBe(false);
    expect(result.scorePenalty).toBe(0);
    expect(result.grammarCorrections).toHaveLength(0);
  });

  it("permits informal phrasing and lowercase when determiners are correct: 'i wanna study a portion of the lesson'", () => {
    const issues = detectDeterminerIssues("i wanna study a portion of the lesson", "portion", "Noun");
    expect(issues).toHaveLength(0);

    const result = evaluateGrammarLocally({
      sentence: "i wanna study a portion of the lesson",
      word: "portion",
      partOfSpeech: "Noun",
    });
    expect(result.hasStructuralErrors).toBe(false);
    expect(result.scorePenalty).toBe(0);
  });

  it("does not flag uncountable mass nouns like cake in 'she gave me a portion of cake'", () => {
    const issues = detectDeterminerIssues("she gave me a portion of cake", "portion", "Noun");
    expect(issues).toHaveLength(0);
  });

  it("does not flag abstract uncountable nouns like redundancy in 'we need to eliminate data redundancy'", () => {
    const issues = detectDeterminerIssues(
      "we need to eliminate data redundancy across our systems",
      "redundancy",
      "Noun · اسم",
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag idiomatic prepositional phrases like 'by bus' and 'to school'", () => {
    const issues = detectDeterminerIssues("i will go to school by bus", "bus", "Noun");
    expect(issues).toHaveLength(0);
  });

  it("correctly identifies plural nouns and irregular plurals", () => {
    expect(isPluralNoun("lessons")).toBe(true);
    expect(isPluralNoun("portions")).toBe(true);
    expect(isPluralNoun("books")).toBe(true);
    expect(isPluralNoun("children")).toBe(true);
    expect(isPluralNoun("people")).toBe(true);
    expect(isPluralNoun("lesson")).toBe(false);
    expect(isPluralNoun("portion")).toBe(false);
    expect(isPluralNoun("class")).toBe(false);
    expect(isPluralNoun("business")).toBe(false);
    expect(isPluralNoun("progress")).toBe(false);
  });

  it("detects sentence fragments missing a main verb", () => {
    const fragment = detectFragmentIssue("a large portion of the lesson");
    expect(fragment).not.toBeNull();
    expect(fragment).toContain("missing a main verb");

    const withVerb = detectFragmentIssue("i studied a large portion of the lesson");
    expect(withVerb).toBeNull();
  });

  it("accepts 'I accumulated a lot of English vocabulary last Thursday' as a 100% valid sentence", () => {
    const fragment = detectFragmentIssue(
      "I accumulated a lot of English vocabulary last Thursday",
      "accumulated",
      "Verb · فعل",
    );
    expect(fragment).toBeNull();

    const result = evaluateGrammarLocally({
      sentence: "I accumulated a lot of English vocabulary last Thursday",
      word: "accumulated",
      partOfSpeech: "Verb · فعل",
    });
    expect(result.hasStructuralErrors).toBe(false);
    expect(result.scorePenalty).toBe(0);
    expect(result.grammarCorrections).toHaveLength(0);
  });
});
