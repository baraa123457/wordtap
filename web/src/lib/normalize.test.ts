import { describe, expect, it } from "vitest";
import { normalizeWordPair } from "./api";

describe("normalizeWordPair", () => {
  it("inverts pairs where Arabic is the word and English is the translation", () => {
    const res = normalizeWordPair({
      text: "عميل",
      translation: "client",
      src_lang: "ar",
      target_lang: "ar",
    });
    expect(res.isInverted).toBe(true);
    expect(res.text).toBe("client");
    expect(res.translation).toBe("عميل");
    expect(res.src_lang).toBe("en");
    expect(res.target_lang).toBe("ar");
  });

  it("inverts pairs where Arabic is the word and English is Compatible", () => {
    const res = normalizeWordPair({
      text: "متوافق",
      translation: "Compatible",
      src_lang: "ar",
      target_lang: "ar",
    });
    expect(res.isInverted).toBe(true);
    expect(res.text).toBe("Compatible");
    expect(res.translation).toBe("متوافق");
    expect(res.src_lang).toBe("en");
    expect(res.target_lang).toBe("ar");
  });

  it("leaves correctly oriented foreign words with Arabic translations alone", () => {
    const res = normalizeWordPair({
      text: "cushions",
      translation: "الوسائد",
      src_lang: "en",
      target_lang: "ar",
    });
    expect(res.isInverted).toBe(false);
    expect(res.text).toBe("cushions");
    expect(res.translation).toBe("الوسائد");
    expect(res.src_lang).toBe("en");
    expect(res.target_lang).toBe("ar");
  });

  it("leaves German words with Arabic translations alone", () => {
    const res = normalizeWordPair({
      text: "Erfahrung",
      translation: "خبرة",
      src_lang: "de",
      target_lang: "ar",
    });
    expect(res.isInverted).toBe(false);
    expect(res.text).toBe("Erfahrung");
    expect(res.translation).toBe("خبرة");
    expect(res.src_lang).toBe("de");
  });

  it("corrects src_lang from ar to en when word text is English", () => {
    const res = normalizeWordPair({
      text: "development",
      translation: "تطوير",
      src_lang: "ar",
      target_lang: "ar",
    });
    expect(res.isInverted).toBe(true);
    expect(res.text).toBe("development");
    expect(res.translation).toBe("تطوير");
    expect(res.src_lang).toBe("en");
  });
});
