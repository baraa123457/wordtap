import { describe, expect, test } from "vitest";
import { detectSubtitleLanguage } from "./subtitle-language-checker";

describe("detectSubtitleLanguage", () => {
  test("detects English subtitles with high accuracy", () => {
    const text =
      "The teacher welcomed all of the students to the class and explained that English is essential for their future careers.";
    expect(detectSubtitleLanguage(text)).toBe("en");
  });

  test("detects German subtitles", () => {
    const text =
      "Der Sprecher erklärt die Grundlagen und zeigt mit einem Beispiel, wie das System funktioniert. Wir sind nicht einverstanden.";
    expect(detectSubtitleLanguage(text)).toBe("de");
  });

  test("detects French subtitles", () => {
    const text =
      "Dans cette vidéo, le professeur nous montre les détails et nous explique pourquoi la méthode est importante pour les élèves.";
    expect(detectSubtitleLanguage(text)).toBe("fr");
  });

  test("detects Spanish subtitles", () => {
    const text =
      "En este video, el profesor explica los detalles con una presentación clara para los estudiantes de la universidad.";
    expect(detectSubtitleLanguage(text)).toBe("es");
  });

  test("detects Chinese subtitles containing Hanzi characters", () => {
    const text = "在这次测试中，我们展示了这款电动车的整体外观和性能特点。";
    expect(detectSubtitleLanguage(text)).toBe("zh");
  });

  test("detects foreign non-Latin script subtitles (e.g. Cyrillic)", () => {
    const text = "В этом видео мы покажем вам новую модель автомобиля.";
    expect(detectSubtitleLanguage(text)).toBe("foreign");
  });

  test("returns null for ambiguous or empty input", () => {
    expect(detectSubtitleLanguage("")).toBeNull();
    expect(detectSubtitleLanguage("   ")).toBeNull();
    expect(detectSubtitleLanguage("123 456 789")).toBeNull();
  });
});
