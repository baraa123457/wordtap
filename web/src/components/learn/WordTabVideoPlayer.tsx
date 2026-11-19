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
          width?: string | number;
          height?: string | number;
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
    case "wikimedia_commons":
      return "Wikimedia Commons Open Video";
    case "user_subtitle":
      return "Your Saved YouTube Clip";
    default:
      return "Verified Video Clip";
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
    const ytMountRef = useRef<HTMLDivElement>(null);
    const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
    const htmlVideoRef = useRef<HTMLVideoElement | null>(null);

    const clipRef = useRef(clip);
    clipRef.current = clip;
    const speedRef = useRef(speed);
    speedRef.current = speed;

    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [embedError, setEmbedError] = useState<string | null>(null);
    const [nativeRatio, setNativeRatio] = useState<number | null>(null);

    const isDirectVideo = clip.mediaType === "direct_video";

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

    const playInternal = useCallback(() => {
      if (!ready) return;
      if (clipRef.current.mediaType === "direct_video") {
        void htmlVideoRef.current?.play().catch(() => {});
      } else {
        try {
          ytPlayerRef.current?.playVideo();
        } catch {
          // ignore
        }
      }
    }, [ready]);

    const pauseInternal = useCallback(() => {
      if (!ready) return;
      if (clipRef.current.mediaType === "direct_video") {
        htmlVideoRef.current?.pause();
      } else {
        try {
          ytPlayerRef.current?.pauseVideo();
        } catch {
          // ignore
        }
      }
    }, [ready]);

    const togglePlayInternal = useCallback(() => {
      if (!ready) return;
      if (playing) pauseInternal();
      else playInternal();
    }, [ready, playing, pauseInternal, playInternal]);

    const replayInternal = useCallback(() => {
      if (!ready) return;
      const start = clipRef.current.timestampSeconds;
      if (clipRef.current.mediaType === "direct_video") {
        const v = htmlVideoRef.current;
        if (!v) return;
        v.currentTime = start;
        void v.play().catch(() => {});
      } else {
        try {
          ytPlayerRef.current?.seekTo(start, true);
          ytPlayerRef.current?.playVideo();
        } catch {
          // ignore
        }
      }
    }, [ready]);

    const rewindInternal = useCallback(
      (seconds = 3) => {
        if (!ready) return;
        if (clipRef.current.mediaType === "direct_video") {
          const v = htmlVideoRef.current;
          if (!v) return;
          v.currentTime = Math.max(0, v.currentTime - seconds);
          void v.play().catch(() => {});
        } else {
          try {
            const cur = ytPlayerRef.current?.getCurrentTime?.() ?? clipRef.current.timestampSeconds;
            ytPlayerRef.current?.seekTo(Math.max(0, cur - seconds), true);
            ytPlayerRef.current?.playVideo();
          } catch {
            // ignore
          }
        }
      },
      [ready],
    );

    useImperativeHandle(
      ref,
      () => ({
        play: playInternal,
        pause: pauseInternal,
        togglePlay: togglePlayInternal,
        replay: replayInternal,
        rewind: rewindInternal,
        setSpeed: (rate: WordTabPlaybackSpeed) => {
          if (clipRef.current.mediaType === "direct_video") {
            if (htmlVideoRef.current) htmlVideoRef.current.playbackRate = rate;
          } else {
            try {
              ytPlayerRef.current?.setPlaybackRate(rate);
            } catch {
              // ignore
            }
          }
        },
      }),
      [playInternal, pauseInternal, togglePlayInternal, replayInternal, rewindInternal],
    );

    // Direct HTML5 Video lifecycle (Wikimedia Commons CC-licensed open videos)
    useEffect(() => {
      if (!isDirectVideo) return;
      setEmbedError(null);
      setNativeRatio(null);
      notifyReady(false);
      notifyPlaying(false);
      onTimeUpdate?.(clip.timestampSeconds);

      const v = htmlVideoRef.current;
      if (!v) return;
      v.playbackRate = speedRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirectVideo, clip.mediaUrl, clip.timestampSeconds]);

    // Official YouTube IFrame Player lifecycle
    useEffect(() => {
      if (isDirectVideo) return;
      let active = true;
      setEmbedError(null);
      notifyReady(false);
      notifyPlaying(false);
      onTimeUpdate?.(clip.timestampSeconds);

      const destroyExisting = () => {
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.destroy();
          } catch {
            // ignore
          }
          ytPlayerRef.current = null;
        }
      };

      loadOfficialYouTubeIframeApi()
        .then(() => {
          if (!active || !ytMountRef.current || !window.YT?.Player) return;
          destroyExisting();

          ytMountRef.current.innerHTML = "";
          const el = document.createElement("div");
          el.id = `wt-yt-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
          ytMountRef.current.appendChild(el);

          ytPlayerRef.current = new window.YT.Player(el, {
            videoId: clip.youtubeVideoId,
            width: "100%",
            height: "100%",
            playerVars: {
              start: clip.timestampSeconds,
              autoplay: 0,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              cc_load_policy: 0,
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
    }, [isDirectVideo, clip.youtubeVideoId, clip.timestampSeconds]);

    // Synchronize playback speed changes
    useEffect(() => {
      if (!ready) return;
      if (isDirectVideo) {
        if (htmlVideoRef.current) htmlVideoRef.current.playbackRate = speed;
      } else {
        try {
          ytPlayerRef.current?.setPlaybackRate(speed);
        } catch {
          // ignore
        }
      }
    }, [speed, ready, isDirectVideo]);

    // High-frequency real-time playback sync (~20fps for HTML5 video, ~13fps for YouTube)
    // so each word highlights immediately as the speaker says it
    useEffect(() => {
      if (!playing || !ready) return;

      if (isDirectVideo) {
        let rafId = 0;
        let lastEmit = 0;
        const tick = (now: number) => {
          if (now - lastEmit >= 45) {
            const cur = htmlVideoRef.current?.currentTime;
            if (typeof cur === "number" && Number.isFinite(cur)) {
              onTimeUpdate?.(cur);
            }
            lastEmit = now;
          }
          rafId = window.requestAnimationFrame(tick);
        };
        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
      }

      const timer = window.setInterval(() => {
        try {
          const cur = ytPlayerRef.current?.getCurrentTime?.();
          if (typeof cur === "number" && Number.isFinite(cur)) {
            onTimeUpdate?.(cur);
          }
        } catch {
          // ignore
        }
      }, 75);
      return () => window.clearInterval(timer);
    }, [isDirectVideo, playing, ready, onTimeUpdate]);

    // Keyboard shortcuts (Space/K = play/pause, R = replay, J = -3s when not focused on an interactive control)
    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A" ||
          target?.isContentEditable ||
          document.querySelector('[aria-modal="true"]')
        ) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey || !ready || embedError) return;

        if (e.key === " " || e.key.toLowerCase() === "k") {
          e.preventDefault();
          togglePlayInternal();
        } else if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          replayInternal();
        } else if (e.key.toLowerCase() === "j") {
          e.preventDefault();
          rewindInternal(3);
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [ready, embedError, togglePlayInternal, replayInternal, rewindInternal]);

    const activeRatio = isDirectVideo && nativeRatio ? nativeRatio : 16 / 9;
    const containerStyle: React.CSSProperties = {
      aspectRatio: `${activeRatio}`,
      maxWidth: `min(100%, ${Math.round(440 * activeRatio)}px)`,
    };

    const sourceLabel = formatSourceLabel(clip.source);
    const channelText = clip.channelName || "Video";
    const showSeparateSource =
      !channelText.toLowerCase().includes("wikimedia commons") ||
      clip.source !== "wikimedia_commons";

    return (
      <div className="flex flex-col gap-2.5 min-w-0 w-full max-w-full">
        {/* Responsive Exact-Aspect-Ratio Custom WordTap Video Container */}
        <div
          data-testid="wordtab-video-player"
          style={containerStyle}
          className="relative mx-auto w-full max-w-full overflow-hidden rounded-2xl border border-line bg-black shadow-md"
        >
          {embedError ? (
            <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
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
          ) : isDirectVideo ? (
            <>
              {!ready ? (
                <div
                  aria-live="polite"
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-white/90"
                >
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-subtitle border-t-transparent" />
                    <span>Preparing video clip…</span>
                  </div>
                </div>
              ) : !playing ? (
                <button
                  type="button"
                  onClick={playInternal}
                  aria-label="Play video clip"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition hover:bg-black/35 cursor-pointer"
                >
                  <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-subtitle text-subtitle-ink shadow-lg text-lg sm:text-xl font-black pl-1">
                    ▶
                  </span>
                </button>
              ) : null}
              <video
                ref={htmlVideoRef}
                key={clip.mediaUrl}
                src={clip.mediaUrl}
                crossOrigin="anonymous"
                preload="metadata"
                playsInline
                onClick={togglePlayInternal}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth > 0 && v.videoHeight > 0) {
                    setNativeRatio(v.videoWidth / v.videoHeight);
                  }
                  v.playbackRate = speedRef.current;
                  if (clipRef.current.timestampSeconds > 0 && v.duration > clipRef.current.timestampSeconds) {
                    v.currentTime = clipRef.current.timestampSeconds;
                  }

                  // Browser-level check: Detect if HTML5 video has no audio tracks
                  const anyVideo = v as HTMLVideoElement & {
                    mozHasAudio?: boolean;
                    audioTracks?: { length: number };
                  };
                  if (
                    anyVideo.mozHasAudio === false ||
                    (anyVideo.audioTracks && anyVideo.audioTracks.length === 0)
                  ) {
                    notifyReady(false);
                    notifyPlaying(false);
                    setEmbedError("This video has no audio track. Skipping to next clip…");
                    onUnavailable?.(clipRef.current);
                    if (onSkipNext) {
                      setTimeout(onSkipNext, 600);
                    }
                    return;
                  }

                  notifyReady(true);
                }}
                onPlay={() => notifyPlaying(true)}
                onPause={() => notifyPlaying(false)}
                onEnded={() => notifyPlaying(false)}
                onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
                onError={() => {
                  notifyReady(false);
                  notifyPlaying(false);
                  setEmbedError("This video stream could not be loaded.");
                  onUnavailable?.(clipRef.current);
                }}
                className="absolute inset-0 block h-full w-full object-contain bg-black cursor-pointer"
              />
            </>
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
                ref={ytMountRef}
                className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
              />
            </>
          )}
        </div>

        {/* Video Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-muted min-w-0 w-full">
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate font-semibold text-ink">{clip.videoTitle}</p>
            <p className="truncate text-[11px] text-muted">
              {channelText}
              {showSeparateSource ? ` · ${sourceLabel}` : ""} · Starts at{" "}
              {formatClipTime(clip.timestampSeconds)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-ok/10 border border-ok/25 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
            ✓ Verified
          </span>
        </div>
      </div>
    );
  },
);
