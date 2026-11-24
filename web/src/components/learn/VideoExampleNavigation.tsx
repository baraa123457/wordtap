"use client";

import { formatClipTime, type WordTabPlaybackSpeed } from "./WordTabVideoPlayer";
import { type WordTabVideoQuality } from "@/lib/video/video-quality";

const SPEED_OPTIONS: WordTabPlaybackSpeed[] = [0.75, 1, 1.25];
const QUALITY_CYCLE: WordTabVideoQuality[] = ["auto", "360p", "480p", "720p", "original"];

export function VideoExampleNavigation({
  index,
  total,
  timestampSeconds,
  ready,
  playing,
  speed,
  quality = "auto",
  onTogglePlay,
  onReplay,
  onRewind,
  onSpeedChange,
  onQualityChange,
  onPrev,
  onNext,
  onSkipWrongAudio,
}: {
  index: number;
  total: number;
  timestampSeconds: number;
  ready: boolean;
  playing: boolean;
  speed: WordTabPlaybackSpeed;
  quality?: WordTabVideoQuality;
  onTogglePlay: () => void;
  onReplay: () => void;
  onRewind: () => void;
  onSpeedChange: (speed: WordTabPlaybackSpeed) => void;
  onQualityChange?: (quality: WordTabVideoQuality) => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipWrongAudio?: () => void;
}) {
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]!;
    onSpeedChange(next);
  };

  const cycleQuality = () => {
    if (!onQualityChange) return;
    const idx = QUALITY_CYCLE.indexOf(quality);
    const next = QUALITY_CYCLE[(idx + 1) % QUALITY_CYCLE.length]!;
    onQualityChange(next);
  };

  const qualityBadge =
    quality === "auto"
      ? "Auto (480p)"
      : quality === "original"
      ? "Original"
      : quality;

  return (
    <div
      role="toolbar"
      aria-label="Video playback and example navigation"
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-2.5 sm:px-3 py-2 w-full min-w-0 max-w-full"
    >
      {/* Playback Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!ready}
          aria-label={playing ? "Pause video" : "Play video clip"}
          className="btn btn-primary min-h-10 px-3.5 text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {playing ? "Pause" : "Play clip"}
        </button>
        <button
          type="button"
          onClick={onReplay}
          disabled={!ready}
          title={`Replay from ${formatClipTime(timestampSeconds)} (Shortcut: R)`}
          aria-label={`Replay clip from ${formatClipTime(timestampSeconds)}`}
          className="btn min-h-10 px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          ↺ Replay ({formatClipTime(timestampSeconds)})
        </button>
        <button
          type="button"
          onClick={onRewind}
          disabled={!ready}
          title="Rewind 3 seconds (Shortcut: J)"
          aria-label="Rewind 3 seconds"
          className="btn btn-quiet min-h-10 px-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          -3s
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!ready}
          title="Cycle playback speed (0.75x / 1x / 1.25x)"
          aria-label={`Playback speed ${speed}x`}
          className="btn btn-quiet min-h-10 px-2.5 text-xs font-semibold tabular-nums cursor-pointer disabled:opacity-50"
        >
          {speed}x
        </button>
        {onQualityChange ? (
          <button
            type="button"
            data-testid="video-quality-button"
            onClick={cycleQuality}
            title={`Video Quality (${qualityBadge}) - Click to switch (360p / 480p / 720p / Original)`}
            aria-label={`Video quality: ${qualityBadge}`}
            className="btn btn-quiet min-h-10 px-2.5 text-xs font-semibold tabular-nums cursor-pointer inline-flex items-center gap-1 hover:border-subtitle hover:bg-subtitle/10 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>{qualityBadge}</span>
          </button>
        ) : null}
      </div>

      {/* Multi-Example Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={total <= 1}
          aria-label="Previous video example"
          className="btn min-h-10 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
        >
          ← Prev
        </button>
        <span
          data-testid="video-nav-counter"
          className="px-1.5 text-xs font-bold tabular-nums text-muted"
        >
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={total <= 1}
          aria-label="Next video example"
          className="btn min-h-10 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
        >
          Next →
        </button>
        {onSkipWrongAudio ? (
          <button
            type="button"
            onClick={onSkipWrongAudio}
            title="Spoken audio is not in English? Skip this clip and show another"
            aria-label="Skip clip with wrong audio language"
            className="btn btn-quiet min-h-10 px-2 text-[11px] font-semibold text-muted hover:text-bad cursor-pointer"
          >
            Wrong audio?
          </button>
        ) : null}
      </div>
    </div>
  );
}
