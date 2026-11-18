import { describe, it, expect } from "vitest";
import {
  isNonEnglishVideoMetadata,
  isNonEnglishVideoTitle,
} from "./video-language-filter";

describe("Non-English Video Filter", () => {
  it("rejects German video 'ADA-Video Mach mit bei Wikipedia.webm'", () => {
    const isNonEnglish = isNonEnglishVideoMetadata({
      title: "File:ADA-Video Mach mit bei Wikipedia.webm",
      categories:
        "Wikipedia Erklärvideo|WebM videos|Alexander Lehmann|Files with closed captioning in English|Video display resolution 1920 x 1080|Files with closed captioning in German|Instructional videos on using Wikipedia in German|Neue Ehrenamtliche",
      description: "Dieses Video zeigt dass und wie du bei Wikipedia mitmachen kannst.",
    });
    expect(isNonEnglish).toBe(true);
  });

  it("rejects German video from title alone", () => {
    expect(isNonEnglishVideoTitle("ADA-Video Mach mit bei Wikipedia")).toBe(true);
    expect(isNonEnglishVideoTitle("Wikipedia Erklärvideo zum Mitmachen")).toBe(true);
  });

  it("accepts genuine English videos", () => {
    expect(
      isNonEnglishVideoMetadata({
        title: "File:Is Polar Ice Melting.webm",
        categories:
          "PD NASA|Polar ice caps|Files with closed captioning in English|Uploaded with video2commons|NASA videos in 2026",
        description: "A NASA scientist explains polar ice melting.",
      }),
    ).toBe(false);

    expect(
      isNonEnglishVideoTitle(
        "Peruvian, U S , Chilean, and Argentinian soldiers participate in Exercise Southern Vanguard",
      ),
    ).toBe(false);

    expect(isNonEnglishVideoTitle("NASA Minute May 22, 2026")).toBe(false);
  });
});
