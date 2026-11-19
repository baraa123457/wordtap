import { describe, expect, it } from "vitest";
import { maskWordInSentence } from "../placeholder";
import {
  extractTimestampSeconds,
  extractYouTubeVideoId,
  findVerifiedWordInCues,
  parseSrtOrVttToCues,
} from "./transcript-provider";
import { VideoDiscoveryService } from "./video-discovery-service";
import { VideoRepository } from "./video-repository";
import type { IVideoDiscoveryProvider, VerifiedVideoExample } from "./types";

describe("TranscriptProvider cue verification & URL extraction", () => {
  it("extracts valid 11-char YouTube video IDs and timestamps from all standard URL formats", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=3OgsRa7VDtI&t=1m30s")).toBe(
      "3OgsRa7VDtI",
    );
    expect(extractTimestampSeconds("https://www.youtube.com/watch?v=3OgsRa7VDtI&t=1m30s")).toBe(90);

    expect(extractYouTubeVideoId("https://youtu.be/trr8Sy1wYa0?t=45")).toBe("trr8Sy1wYa0");
    expect(extractTimestampSeconds("https://youtu.be/trr8Sy1wYa0?t=45")).toBe(45);

    expect(extractYouTubeVideoId("https://www.youtube.com/embed/QBO7B1RSR8A")).toBe("QBO7B1RSR8A");
    expect(extractYouTubeVideoId("https://example.com/not-youtube")).toBeNull();
  });

  it("finds verified spoken occurrences, slices synchronized cue windows, and rejects non-matching transcripts", () => {
    const cues = [
      { start: 10, end: 13, text: "Welcome everyone to our city transit podcast." },
      { start: 13, end: 17, text: "On now-crowded commuter trains," },
      { start: 17, end: 21, text: "a frequent conversation topic is where to find cheap gas." },
      { start: 80, end: 85, text: "Thanks for listening to this episode." },
    ];

    const match = findVerifiedWordInCues(cues, "crowded", "youtube_supadata");
    expect(match).not.toBeNull();
    expect(match?.timestampSeconds).toBe(12); // 13s - 1s lead-in
    expect(match?.contextSentence).toContain("now-crowded commuter trains");
    expect(match?.captionCues.length).toBe(3); // excludes 80s cue outside window

    const masked = maskWordInSentence(match!.contextSentence, "crowded");
    expect(masked?.placeholder).toBe(".......");
    expect(masked?.letterCount).toBe(7);

    // Must return null if the target word is never actually spoken in the transcript
    expect(findVerifiedWordInCues(cues, "embarrassed", "youtube_supadata")).toBeNull();
  });

  it("parses SRT captions, ranks clearer complete sentences above fragments, and matches inflections without false positives", () => {
    const srt = `1
00:00:05,000 --> 00:00:06,500
Reluctant.

2
00:01:02,920 --> 00:01:06,360
Many new editors feel reluctant to contribute to open projects.

3
00:02:10,000 --> 00:02:13,500
She stopped the train right before the station.

4
00:02:20,000 --> 00:02:24,000
He began writing his speech early in the morning.
`;
    const cues = parseSrtOrVttToCues(srt);
    expect(cues.length).toBe(4);

    // Should select cue 2 (clear complete sentence at 62s) over cue 1 (1-word fragment at 5s)
    const ranked = findVerifiedWordInCues(cues, "reluctant", "wikimedia_commons", {
      videoTitle: "Wikimedia Open Education Interview",
      durationSec: 200,
    });
    expect(ranked?.contextSentence).toContain("Many new editors feel reluctant");
    expect(ranked?.timestampSeconds).toBe(61);

    // Doubled consonant inflection: stop -> stopped
    expect(findVerifiedWordInCues(cues, "stop", "wikimedia_commons")?.contextSentence).toContain(
      "stopped the train",
    );
    // Irregular verb inflection: begin -> began, write -> writing
    expect(findVerifiedWordInCues(cues, "begin", "wikimedia_commons")?.contextSentence).toContain(
      "began writing",
    );
    expect(findVerifiedWordInCues(cues, "write", "wikimedia_commons")?.contextSentence).toContain(
      "began writing",
    );
    // Must NEVER match unrelated substring ("cat" must NOT match "education" or "catch")
    expect(maskWordInSentence("We tried to catch the morning train.", "cat")).toBeNull();
  });

  it("verifies exact dynamic dot lengths across all 5 mandatory words", () => {
    const cases: Array<[string, string, number]> = [
      ["crowded", "The station was crowded every morning at eight.", 7],
      ["reluctant", "She felt reluctant to share the early draft.", 9],
      ["embarrassed", "He looked embarrassed when everyone started clapping.", 11],
      ["exhausted", "After ten hours of travel they were exhausted.", 9],
      ["probably", "They will probably arrive before the meeting starts.", 8],
    ];

    for (const [word, sentence, expectedDots] of cases) {
      const cues = [{ start: 20, end: 25, text: sentence }];
      const match = findVerifiedWordInCues(cues, word, "youtube_transcriptapi");
      expect(match).not.toBeNull();
      const masked = maskWordInSentence(match!.contextSentence, word);
      expect(masked?.letterCount).toBe(expectedDots);
      expect(masked?.placeholder).toBe(".".repeat(expectedDots));
    }
  });
});

describe("VideoDiscoveryService provider orchestration & VideoRepository caching", () => {
  const makeClip = (id: string, word: string, ts = 15): VerifiedVideoExample => ({
    id: `test-${id}-${ts}`,
    wordId: null,
    targetWord: word,
    mediaType: "youtube",
    youtubeVideoId: id,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}&t=${ts}s`,
    mediaUrl: `https://www.youtube.com/watch?v=${id}&t=${ts}s`,
    videoTitle: `Clip ${id}`,
    channelName: "Test Channel",
    source: "youglish_rest",
    timestampSeconds: ts,
    verifiedTranscript: `This train is very ${word} today.`,
    contextSentence: `This train is very ${word} today.`,
    targetWordPosition: 19,
    captionCues: [{ start: ts, end: ts + 5, text: `This train is very ${word} today.` }],
    transcriptVerified: true,
    captionAvailable: true,
    videoAvailable: true,
    qualityScore: 80,
    discoveredAt: new Date().toISOString(),
  });

  it("deduplicates results across pluggable providers in priority order", async () => {
    const p1: IVideoDiscoveryProvider = {
      name: "primary",
      isConfigured: () => true,
      discover: async () => [makeClip("AAAAAAAAAAA", "crowded"), makeClip("BBBBBBBBBBB", "crowded")],
    };
    const p2: IVideoDiscoveryProvider = {
      name: "secondary",
      isConfigured: () => true,
      discover: async () => [makeClip("BBBBBBBBBBB", "crowded"), makeClip("CCCCCCCCCCC", "crowded")],
    };

    const service = new VideoDiscoveryService([p1, p2]);
    const res = await service.discover({ word: "crowded", lang: "en", maxResults: 5 });

    expect(res.providersAttempted).toEqual(["primary", "secondary"]);
    expect(res.videos.map((v) => v.youtubeVideoId)).toEqual([
      "AAAAAAAAAAA",
      "BBBBBBBBBBB",
      "CCCCCCCCCCC",
    ]);
  });

  it("deduplicates concurrent in-flight discovery requests for the same word", async () => {
    let callCount = 0;
    const slowProvider: IVideoDiscoveryProvider = {
      name: "slow_mock",
      isConfigured: () => true,
      discover: async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [makeClip("CONCURRENT1", "dedup")];
      },
    };

    const service = new VideoDiscoveryService([slowProvider]);
    const [res1, res2] = await Promise.all([
      service.discover({ word: "dedup", lang: "en", maxResults: 5 }),
      service.discover({ word: "dedup", lang: "en", maxResults: 5 }),
    ]);

    expect(callCount).toBe(1);
    expect(res1.videos.length).toBe(1);
    expect(res2.videos.length).toBe(1);
    expect(res1.videos[0].youtubeVideoId).toBe("CONCURRENT1");
  });

  it("caches verified examples and evicts unavailable videos cleanly", async () => {
    const repo = new VideoRepository();
    const wordKey = `test-cache-${Date.now()}`;
    const c1 = makeClip("DDDDDDDDDDD", wordKey, 10);
    const c2 = makeClip("EEEEEEEEEEE", wordKey, 20);

    await repo.saveMany(wordKey, null, [c1, c2, c1]); // c1 duplicated intentionally
    const hit = await repo.findByWord(wordKey);
    expect(hit.source).toBe("memory_hit");
    expect(hit.clips.length).toBe(2);

    await repo.markUnavailable("DDDDDDDDDDD");
    const afterEvict = await repo.findByWord(wordKey);
    expect(afterEvict.clips.map((c) => c.youtubeVideoId)).toEqual(["EEEEEEEEEEE"]);
  });

  it("filters out non-English videos (e.g. Chinese Leapmotor car review) and non-speech media (reels)", async () => {
    const foreignClip: VerifiedVideoExample = {
      ...makeClip("wm_chinese01", "overall", 137),
      mediaType: "direct_video",
      videoTitle: "Leapmotor A10- The Chinese Car That Will Shock the World",
      channelName: "AutoLab · Wikimedia Commons (CC BY 4.0)",
    };
    const reelClip: VerifiedVideoExample = {
      ...makeClip("wm_reel00001", "overall", 5),
      mediaType: "direct_video",
      videoTitle: "REEL- Defender 25 Overall Showcase Reel (967241)",
      channelName: "DVIDS",
    };
    const validClip: VerifiedVideoExample = {
      ...makeClip("wm_english01", "overall", 42),
      mediaType: "direct_video",
      videoTitle: "2018 Minnesota State Fair Sets New Overall Attendance Record",
      channelName: "Lakeland PBS",
    };

    const repo = new VideoRepository();
    const testWord = `test-filter-${Date.now()}`;
    await repo.saveMany(testWord, null, [foreignClip, reelClip, validClip]);

    const hit = await repo.findByWord(testWord);
    expect(hit.clips.length).toBe(1);
    expect(hit.clips[0]?.videoTitle).toBe(
      "2018 Minnesota State Fair Sets New Overall Attendance Record",
    );
  });
});
