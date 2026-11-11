import { describe, expect, it } from "vitest";
import { formatDueIn, isDue, parseSourceContext, wordStatus } from "./format";

describe("parseSourceContext", () => {
  it("handles null and empty input", () => {
    expect(parseSourceContext(null)).toEqual({ sourceTitle: "" });
    expect(parseSourceContext("")).toEqual({ sourceTitle: "" });
  });

  it("parses quoted subtitle sentence and title", () => {
    expect(parseSourceContext('"What are you doing here?" — Stranger Things S01E01')).toEqual({
      sentence: "What are you doing here?",
      sourceTitle: "Stranger Things S01E01",
    });
    expect(parseSourceContext('“مقارنة أنواع الذكاء الاصطناعي” - YouTube')).toEqual({
      sentence: "مقارنة أنواع الذكاء الاصطناعي",
      sourceTitle: "YouTube",
    });
  });

  it("parses sentence with separator :::", () => {
    expect(parseSourceContext("I will always love you ::: Whitney Houston - The Bodyguard")).toEqual({
      sentence: "I will always love you",
      sourceTitle: "Whitney Houston - The Bodyguard",
    });
  });

  it("handles plain source title without sentence", () => {
    expect(parseSourceContext("BBC News English")).toEqual({
      sourceTitle: "BBC News English",
    });
  });
});

describe("wordStatus and isDue", () => {
  const now = new Date("2026-11-11T12:00:00Z");

  it("marks box >= 4 as mastered", () => {
    expect(wordStatus(4, "2026-11-10T00:00:00Z", now)).toBe("mastered");
    expect(wordStatus(5, "2026-11-12T00:00:00Z", now)).toBe("mastered");
  });

  it("marks overdue words as due", () => {
    expect(wordStatus(1, "2026-11-11T11:59:00Z", now)).toBe("due");
    expect(isDue("2026-11-11T11:59:00Z", now)).toBe(true);
  });

  it("marks future words as learning", () => {
    expect(wordStatus(2, "2026-11-11T14:00:00Z", now)).toBe("learning");
    expect(isDue("2026-11-11T14:00:00Z", now)).toBe(false);
  });
});
