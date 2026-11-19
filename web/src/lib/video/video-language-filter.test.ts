import { describe, it, expect } from "vitest";
import {
  isNonEnglishVideoMetadata,
  isNonEnglishVideoTitle,
  isVerifiedEnglishCollection,
} from "./video-language-filter";

describe("Spoken Language & Speech Media Filter", () => {
  it("rejects German video 'ADA-Video Mach mit bei Wikipedia.webm'", () => {
    const isNonEnglish = isNonEnglishVideoMetadata({
      title: "File:ADA-Video Mach mit bei Wikipedia.webm",
      categories:
        "Wikipedia Erklärvideo|WebM videos|Alexander Lehmann|Files with closed captioning in English|Video display resolution 1920 x 1080|Files with closed captioning in German|Instructional videos on using Wikipedia in German|Neue Ehrenamtliche",
      description: "Dieses Video zeigt dass und wie du bei Wikipedia mitmachen kannst.",
    });
    expect(isNonEnglish).toBe(true);
  });

  it("rejects Chinese car video with English subtitles 'Leapmotor A10- The Chinese Car That Will Shock the World.webm'", () => {
    const isNonEnglish = isNonEnglishVideoMetadata({
      title: "File:Leapmotor A10- The Chinese Car That Will Shock the World.webm",
      categories:
        "Videos from YouTube|Files with closed captioning in English|Videos of 2025|Videos with English subtitles|Videos with Chinese subtitles|Leapmotor A10|AutoLab",
      description: "#leapmotor #leapmotora10 #car #autolab Let's take a look at Leapmotor's latest A-class car.",
    });
    expect(isNonEnglish).toBe(true);
  });

  it("rejects Chinese video from title or channel keywords", () => {
    expect(
      isNonEnglishVideoTitle("Leapmotor A10- The Chinese Car That Will Shock the World", "AutoLab"),
    ).toBe(true);
    expect(isNonEnglishVideoTitle("BYD Yuan Plus Review in Shenzhen")).toBe(true);
  });

  it("rejects silent showcase reels and non-speech media", () => {
    expect(isNonEnglishVideoTitle("REEL- Defender 25 Overall Showcase Reel (967241)")).toBe(true);
    expect(isNonEnglishVideoTitle("Agile Spirit 25 - Overall (Reel) (972993)")).toBe(true);
    expect(isNonEnglishVideoTitle("Northern Lights Timelapse Over Alaska")).toBe(true);
    expect(isNonEnglishVideoTitle("City Traffic B-roll 4K")).toBe(true);
  });

  it("rejects foreign closed captions and non-Latin scripts", () => {
    expect(
      isNonEnglishVideoMetadata({
        title: "File:Katherine greeting for Litteraturhuset Wikipedians.webm",
        categories:
          "Videos from YouTube|Files with closed captioning in English|Files with closed captioning in Swedish",
      }),
    ).toBe(true);

    expect(
      isNonEnglishVideoMetadata({
        title: "File:Tokyo Shibuya Crossing.webm",
        description: "東京の渋谷スクランブル交差点",
      }),
    ).toBe(true);
  });

  it("accepts and verifies genuine spoken-English educational and public broadcasts", () => {
    expect(
      isNonEnglishVideoMetadata({
        title: "File:2018 Minnesota State Fair Sets New Overall Attendance Record.webm",
        categories:
          "WebM videos|Files from external sources with reviewed licenses|Videos from YouTube|Files with closed captioning in English|Videos of 2018",
        description: "News report on Minnesota State Fair attendance.",
      }),
    ).toBe(false);

    expect(
      isNonEnglishVideoMetadata({
        title: "File:Wild Host First Annual Bass Fishing Tournament.webm",
        categories:
          "Files with closed captioning in English|Videos by Lakeland PBS|2017 sports events in Minnesota",
        description: "Lakeland PBS sports feature on the bass fishing tournament.",
      }),
    ).toBe(false);

    expect(
      isVerifiedEnglishCollection(
        "Videos by Lakeland PBS|Political debates in the United States in 2018",
      ),
    ).toBe(true);

    expect(
      isVerifiedEnglishCollection(
        "PD US Army|Files created by the United States Army|Videos by the Defense Visual Information Distribution Service",
      ),
    ).toBe(true);
  });
});
