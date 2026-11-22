import { describe, it, expect } from "vitest";
import {
  isAllowedMediaUrl,
  isNonEnglishVideoMetadata,
  isNonEnglishVideoTitle,
  isVerifiedEnglishCollection,
  MAX_VIDEO_FILE_SIZE_BYTES,
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

  it("rejects Portuguese video 'Sopa Wiki Podcast - Episódio 5 - Governança inclusiva e participativa na Wiki'", () => {
    expect(
      isNonEnglishVideoTitle(
        "File:Sopa_Wiki_Podcast_-_Episódio_5_-_Governança_inclusiva_e_participativa_na_Wiki.webm",
      ),
    ).toBe(true);

    expect(
      isNonEnglishVideoMetadata({
        title: "File:Sopa_Wiki_Podcast_-_Episódio_5_-_Governança_inclusiva_e_participativa_na_Wiki.webm",
        categories:
          "Sopa Wiki Podcast|WebM videos|Files with closed captioning in English|Podcasts in Portuguese|Wikimedistas de Portugal",
        description: "Episódio 5 do podcast Sopa Wiki sobre Governança inclusiva.",
      }),
    ).toBe(true);
  });

  it("rejects Spanish video with English subtitles", () => {
    expect(
      isNonEnglishVideoTitle("Episodio 3 - Cómo hablar de tecnología en español", "Canal de Educación"),
    ).toBe(true);
    expect(
      isNonEnglishVideoTitle("Temporada 2 Capítulo 1 - Entrevista exclusiva"),
    ).toBe(true);
  });

  it("validates media URLs against trusted secure host whitelist", () => {
    expect(
      isAllowedMediaUrl(
        "https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1a/Sample.webm/Sample.webm.480p.vp9.webm",
      ),
    ).toBe(true);
    expect(isAllowedMediaUrl("https://commons.wikimedia.org/wiki/File:Sample.webm")).toBe(true);
    expect(isAllowedMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isAllowedMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);

    // Untrusted or malicious hosts / protocols rejected
    expect(isAllowedMediaUrl("http://upload.wikimedia.org/insecure.webm")).toBe(false);
    expect(isAllowedMediaUrl("https://malicious-site.com/video.webm")).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedMediaUrl("")).toBe(false);
  });

  it("enforces maximum video file size cap of 150MB", () => {
    expect(MAX_VIDEO_FILE_SIZE_BYTES).toBe(150_000_000);
  });
});
