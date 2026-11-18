import { describe, expect, it } from "vitest";
import { maskWordInSentence } from "../placeholder";
import {
  extractTimestampSeconds,
  extractYouTubeVideoId,
  findVerifiedWordInCues,
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
    expect(match?.timestampSeconds).toBe(11); // 13s - 2s lead-in
    expect(match?.contextSentence).toContain("now-crowded commuter trains");
    expect(match?.captionCues.length).toBe(3); // excludes 80s cue outside window

    const masked = maskWordInSentence(match!.contextSentence, "crowded");
    expect(masked?.placeholder).toBe(".......");
    expect(masked?.letterCount).toBe(7);

    // Must return null if the target word is never actually spoken in the transcript
    expect(findVerifiedWordInCues(cues, "embarrassed", "youtube_supadata")).toBeNull();
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
    youtubeVideoId: id,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}&t=${ts}s`,
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
});
