import { describe, expect, it } from "vitest";
import {
  resolveDirectVideoQualityUrl,
  QUALITY_OPTIONS,
} from "./video-quality";

describe("Video Quality Resolver", () => {
  const sampleCommonsUrl =
    "https://upload.wikimedia.org/wikipedia/commons/7/7e/Intense_String_of_Hurricanes_Seen_From_Space.webm";

  it("returns original URL when quality is original", () => {
    expect(resolveDirectVideoQualityUrl(sampleCommonsUrl, "original")).toBe(sampleCommonsUrl);
  });

  it("resolves to 480p transcode for auto quality (data saving default)", () => {
    const res = resolveDirectVideoQualityUrl(sampleCommonsUrl, "auto");
    expect(res).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/Intense_String_of_Hurricanes_Seen_From_Space.webm/Intense_String_of_Hurricanes_Seen_From_Space.webm.480p.vp9.webm",
    );
  });

  it("resolves to 360p for lowest bandwidth mode", () => {
    const res = resolveDirectVideoQualityUrl(sampleCommonsUrl, "360p");
    expect(res).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/Intense_String_of_Hurricanes_Seen_From_Space.webm/Intense_String_of_Hurricanes_Seen_From_Space.webm.360p.vp9.webm",
    );
  });

  it("resolves to 720p for HD mode", () => {
    const res = resolveDirectVideoQualityUrl(sampleCommonsUrl, "720p");
    expect(res).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/Intense_String_of_Hurricanes_Seen_From_Space.webm/Intense_String_of_Hurricanes_Seen_From_Space.webm.720p.vp9.webm",
    );
  });

  it("preserves non-Wikimedia direct URLs unchanged", () => {
    const customUrl = "https://example.com/videos/lesson1.mp4";
    expect(resolveDirectVideoQualityUrl(customUrl, "480p")).toBe(customUrl);
  });

  it("exports valid quality options metadata", () => {
    expect(QUALITY_OPTIONS.length).toBe(5);
    expect(QUALITY_OPTIONS.map((o) => o.id)).toEqual(["auto", "360p", "480p", "720p", "original"]);
  });
});
