"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { VerifiedVideoClip } from "@/lib/learn-api";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      resolve();
    };

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Could not load YouTube IFrame API."));
      document.head.appendChild(script);
    }

    // Safety fallback polling in case script loaded before callback attached
    const timer = window.setInterval(() => {
      if (window.YT && window.YT.Player) {
        window.clearInterval(timer);
        resolve();
      }
    }, 200);
    window.setTimeout(() => window.clearInterval(timer), 12_000);
  });

  return ytApiPromise;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export function YouTubeClipPlayer({
  clip,
  index,
  total,
  onPrev,
  onNext,
  onUnavailable,
}: {
  clip: VerifiedVideoClip;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onUnavailable?: (clipId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const clipRef = useRef(clip);
  clipRef.current = clip;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<0.75 | 1>(1);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const reactId = useId();

  useEffect(() => {
    let active = true;
    setEmbedError(null);
    setReady(false);

    loadYouTubeIframeApi()
      .then(() => {
        if (!active || !containerRef.current || !window.YT?.Player) return;

        // Destroy any existing player cleanly before re-creating
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }

        containerRef.current.innerHTML = "";
        const mount = document.createElement("div");
        mount.id = `yt-player-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        containerRef.current.appendChild(mount);

        playerRef.current = new window.YT.Player(mount, {
          videoId: clip.youtubeVideoId,
          playerVars: {
            start: clip.timestampSeconds,
            autoplay: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            cc_load_policy: 0,
            origin: typeof window !== "undefined" ? window.location.origin : "",
          },
          events: {
            onReady: (e) => {
              if (!active) return;
              setReady(true);
              try {
                e.target.setPlaybackRate(rate);
              } catch {
                // ignore
              }
            },
            onStateChange: (e) => {
              if (!active) return;
              // 1 = PLAYING
              setPlaying(e.data === 1);
            },
            onError: (e) => {
              if (!active) return;
              // 100 = not found, 101/150 = embed disabled by owner
              setEmbedError(
                e.data === 101 || e.data === 150
                  ? "This video owner disabled playback outside YouTube."
                  : "This video clip is currently unavailable.",
              );
              onUnavailable?.(clipRef.current.id);
            },
          },
        });
      })
      .catch(() => {
        if (active) setEmbedError("Could not load the YouTube player.");
      });

    return () => {
      active = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
    // Re-initialize cleanly when video ID or start timestamp changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.youtubeVideoId, clip.timestampSeconds]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    if (playing) {
      p.pauseVideo();
    } else {
      p.playVideo();
    }
  }, [playing, ready]);

  const replayClip = useCallback(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    p.seekTo(clip.timestampSeconds, true);
    p.playVideo();
  }, [clip.timestampSeconds, ready]);

  const rewind3s = useCallback(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    const cur = p.getCurrentTime?.() ?? clip.timestampSeconds;
    p.seekTo(Math.max(0, cur - 3), true);
    p.playVideo();
  }, [clip.timestampSeconds, ready]);

  const toggleRate = useCallback(() => {
    const next: 0.75 | 1 = rate === 1 ? 0.75 : 1;
    setRate(next);
    try {
      playerRef.current?.setPlaybackRate(next);
    } catch {
      // ignore
    }
  }, [rate]);

  return (
    <div className="grid gap-3 min-w-0">
      {/* Responsive 16:9 YouTube IFrame Player */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black shadow-md">
        {embedError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
            <p className="text-sm font-semibold">{embedError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {total > 1 ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="btn btn-primary min-h-9 px-4 text-xs font-bold"
                >
                  Try next clip →
                </button>
              ) : null}
              <a
                href={`https://www.youtube.com/watch?v=${encodeURIComponent(clip.youtubeVideoId)}&t=${clip.timestampSeconds}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn min-h-9 px-4 text-xs font-semibold bg-white/15 text-white border-white/20 hover:bg-white/25"
              >
                Watch on YouTube ↗
              </a>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
          />
        )}
      </div>

      {/* Controls Bar (YouGlish-inspired) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!ready || Boolean(embedError)}
            className="btn btn-primary min-h-9 px-3.5 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {playing ? "Pause" : "Play clip"}
          </button>
          <button
            type="button"
            onClick={replayClip}
            disabled={!ready || Boolean(embedError)}
            title={`Replay from ${formatTime(clip.timestampSeconds)}`}
            className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            ↺ Replay ({formatTime(clip.timestampSeconds)})
          </button>
          <button
            type="button"
            onClick={rewind3s}
            disabled={!ready || Boolean(embedError)}
            title="Rewind 3 seconds"
            className="btn btn-quiet min-h-9 px-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            -3s
          </button>
          <button
            type="button"
            onClick={toggleRate}
            disabled={!ready || Boolean(embedError)}
            title="Toggle slower speed for listening clarity"
            className="btn btn-quiet min-h-9 px-2.5 text-xs font-semibold tabular-nums cursor-pointer disabled:opacity-50"
          >
            {rate}x
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={total <= 1}
            aria-label="Previous video example"
            className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-1.5 text-xs font-bold tabular-nums text-muted">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={total <= 1}
            aria-label="Next video example"
            className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Video Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{clip.videoTitle}</p>
          <p className="truncate text-[11px] text-muted">
            Source: {clip.channelName || "YouTube"} · Verified timestamp {formatTime(clip.timestampSeconds)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-ok/10 border border-ok/25 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
          ✓ Verified transcript
        </span>
      </div>
    </div>
  );
}
