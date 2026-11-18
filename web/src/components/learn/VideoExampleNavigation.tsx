"use client";

import { formatClipTime, type WordTabPlaybackSpeed } from "./WordTabVideoPlayer";

const SPEED_OPTIONS: WordTabPlaybackSpeed[] = [0.75, 1, 1.25];

export function VideoExampleNavigation({
  index,
  total,
  timestampSeconds,
  ready,
  playing,
  speed,
  onTogglePlay,
  onReplay,
  onRewind,
  onSpeedChange,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  timestampSeconds: number;
  ready: boolean;
  playing: boolean;
  speed: WordTabPlaybackSpeed;
  onTogglePlay: () => void;
  onReplay: () => void;
  onRewind: () => void;
  onSpeedChange: (speed: WordTabPlaybackSpeed) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]!;
    onSpeedChange(next);
  };

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
      </div>
    </div>
  );
}
