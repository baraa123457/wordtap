"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { VerifiedVideoExample } from "@/lib/video/types";

export type WordTabPlaybackSpeed = 0.75 | 1 | 1.25;

export type WordTabVideoPlayerHandle = {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  replay: () => void;
  rewind: (seconds?: number) => void;
  setSpeed: (rate: WordTabPlaybackSpeed) => void;
};

type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
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
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytIframeApiPromise: Promise<void> | null = null;

function loadOfficialYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytIframeApiPromise) return ytIframeApiPromise;

  ytIframeApiPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      if (err) {
        ytIframeApiPromise = null;
        reject(err);
      } else {
        resolve();
      }
    };

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        // ignore prior callback errors
      }
      if (window.YT?.Player) finish();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => finish(new Error("Could not load the YouTube IFrame Player API."));
      document.head.appendChild(tag);
    }

    const poll = window.setInterval(() => {
      if (window.YT?.Player) finish();
    }, 150);

    const timeout = window.setTimeout(() => {
      finish(new Error("YouTube player took too long to initialize."));
    }, 12_000);
  });

  return ytIframeApiPromise;
}

export function formatClipTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function formatSourceLabel(source: VerifiedVideoExample["source"]): string {
  switch (source) {
    case "youglish_rest":
      return "YouGlish API";
    case "youtube_filmot":
      return "YouTube Captions (Filmot)";
    case "youtube_supadata":
    case "youtube_transcriptapi":
      return "Verified YouTube Transcript";
    case "user_subtitle":
      return "Your Saved YouTube Clip";
    default:
      return "Verified YouTube Clip";
  }
}

type WordTabVideoPlayerProps = {
  clip: VerifiedVideoExample;
  total: number;
  speed: WordTabPlaybackSpeed;
  onReadyChange?: (ready: boolean) => void;
  onPlayingChange?: (playing: boolean) => void;
  onTimeUpdate?: (currentTimeSec: number) => void;
  onUnavailable?: (clip: VerifiedVideoExample) => void;
  onSkipNext?: () => void;
};

export const WordTabVideoPlayer = forwardRef<WordTabVideoPlayerHandle, WordTabVideoPlayerProps>(
  function WordTabVideoPlayer(
    {
      clip,
      total,
      speed,
      onReadyChange,
      onPlayingChange,
      onTimeUpdate,
      onUnavailable,
      onSkipNext,
    },
    ref,
  ) {
    const reactId = useId();
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const clipRef = useRef(clip);
    clipRef.current = clip;
    const speedRef = useRef(speed);
    speedRef.current = speed;

    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [embedError, setEmbedError] = useState<string | null>(null);

    const notifyReady = useCallback(
      (val: boolean) => {
        setReady(val);
        onReadyChange?.(val);
      },
      [onReadyChange],
    );

    const notifyPlaying = useCallback(
      (val: boolean) => {
        setPlaying(val);
        onPlayingChange?.(val);
      },
      [onPlayingChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          if (!ready) return;
          try {
            playerRef.current?.playVideo();
          } catch {
            // ignore
          }
        },
        pause: () => {
          if (!ready) return;
          try {
            playerRef.current?.pauseVideo();
          } catch {
            // ignore
          }
        },
        togglePlay: () => {
          if (!ready || !playerRef.current) return;
          try {
            if (playing) {
              playerRef.current.pauseVideo();
            } else {
              playerRef.current.playVideo();
            }
          } catch {
            // ignore
          }
        },
        replay: () => {
          if (!ready || !playerRef.current) return;
          try {
            playerRef.current.seekTo(clipRef.current.timestampSeconds, true);
            playerRef.current.playVideo();
          } catch {
            // ignore
          }
        },
        rewind: (seconds = 3) => {
          if (!ready || !playerRef.current) return;
          try {
            const cur = playerRef.current.getCurrentTime?.() ?? clipRef.current.timestampSeconds;
            playerRef.current.seekTo(Math.max(0, cur - seconds), true);
            playerRef.current.playVideo();
          } catch {
            // ignore
          }
        },
        setSpeed: (rate: WordTabPlaybackSpeed) => {
          try {
            playerRef.current?.setPlaybackRate(rate);
          } catch {
            // ignore
          }
        },
      }),
      [playing, ready],
    );

    // Initialize official YouTube IFrame Player whenever video ID or start timestamp changes
    useEffect(() => {
      let active = true;
      setEmbedError(null);
      notifyReady(false);
      notifyPlaying(false);
      onTimeUpdate?.(clip.timestampSeconds);

      const destroyExisting = () => {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }
      };

      loadOfficialYouTubeIframeApi()
        .then(() => {
          if (!active || !mountRef.current || !window.YT?.Player) return;
          destroyExisting();

          mountRef.current.innerHTML = "";
          const el = document.createElement("div");
          el.id = `wt-yt-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
          mountRef.current.appendChild(el);

          playerRef.current = new window.YT.Player(el, {
            videoId: clip.youtubeVideoId,
            playerVars: {
              start: clip.timestampSeconds,
              autoplay: 0,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              cc_load_policy: 0, // Use WordTap's custom caption UI instead of native YouTube subtitles
              iv_load_policy: 3,
              origin: typeof window !== "undefined" ? window.location.origin : "",
            },
            events: {
              onReady: (e) => {
                if (!active) return;
                notifyReady(true);
                try {
                  e.target.setPlaybackRate(speedRef.current);
                } catch {
                  // ignore
                }
              },
              onStateChange: (e) => {
                if (!active) return;
                // 1 = PLAYING
                notifyPlaying(e.data === 1);
              },
              onError: (e) => {
                if (!active) return;
                notifyReady(false);
                notifyPlaying(false);
                const msg =
                  e.data === 101 || e.data === 150
                    ? "This video's owner disabled embedded playback."
                    : "This video example is currently unavailable.";
                setEmbedError(msg);
                onUnavailable?.(clipRef.current);
              },
            },
          });
        })
        .catch(() => {
          if (active) setEmbedError("Could not initialize the YouTube player.");
        });

      return () => {
        active = false;
        destroyExisting();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clip.youtubeVideoId, clip.timestampSeconds]);

    // Synchronize playback speed changes cleanly
    useEffect(() => {
      if (!ready) return;
      try {
        playerRef.current?.setPlaybackRate(speed);
      } catch {
        // ignore
      }
    }, [speed, ready]);

    // Real-time playback time sync for custom live caption cues
    useEffect(() => {
      if (!playing || !ready) return;
      const timer = window.setInterval(() => {
        try {
          const cur = playerRef.current?.getCurrentTime?.();
          if (typeof cur === "number" && Number.isFinite(cur)) {
            onTimeUpdate?.(cur);
          }
        } catch {
          // ignore
        }
      }, 250);
      return () => window.clearInterval(timer);
    }, [playing, ready, onTimeUpdate]);

    // Keyboard accessibility (Space/K = play/pause, R = replay, J = -3s when not focused in an input)
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.metaKey || e.ctrlKey || e.altKey || !ready || embedError) return;

        if (e.key === " " || e.key.toLowerCase() === "k") {
          e.preventDefault();
          if (playing) playerRef.current?.pauseVideo();
          else playerRef.current?.playVideo();
        } else if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          playerRef.current?.seekTo(clipRef.current.timestampSeconds, true);
          playerRef.current?.playVideo();
        } else if (e.key.toLowerCase() === "j") {
          e.preventDefault();
          const cur = playerRef.current?.getCurrentTime?.() ?? clipRef.current.timestampSeconds;
          playerRef.current?.seekTo(Math.max(0, cur - 3), true);
          playerRef.current?.playVideo();
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [ready, playing, embedError]);

    return (
      <div className="grid gap-2.5 min-w-0">
        {/* Responsive 16:9 Official YouTube IFrame Container */}
        <div
          data-testid="wordtab-video-player"
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black shadow-md"
        >
          {embedError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
              <p className="text-sm font-semibold">{embedError}</p>
              {total > 1 && onSkipNext ? (
                <button
                  type="button"
                  onClick={onSkipNext}
                  className="btn btn-primary min-h-9 px-4 text-xs font-bold cursor-pointer"
                >
                  Load next video example →
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {!ready ? (
                <div
                  aria-live="polite"
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-white/90"
                >
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-subtitle border-t-transparent" />
                    <span>Loading video player…</span>
                  </div>
                </div>
              ) : null}
              <div
                ref={mountRef}
                className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
              />
            </>
          )}
        </div>

        {/* Video Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-muted">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{clip.videoTitle}</p>
            <p className="truncate text-[11px] text-muted">
              {clip.channelName || "YouTube"} · {formatSourceLabel(clip.source)} · Clip starts at{" "}
              {formatClipTime(clip.timestampSeconds)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-ok/10 border border-ok/25 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
            ✓ Verified transcript
          </span>
        </div>
      </div>
    );
  },
);
