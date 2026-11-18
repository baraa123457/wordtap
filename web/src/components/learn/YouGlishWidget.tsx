"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export const YOUGLISH_WIDGET_ENABLED =
  process.env.NEXT_PUBLIC_YOUGLISH_WIDGET_ENABLED !== "false" &&
  process.env.NEXT_PUBLIC_YOUGLISH_WIDGET_ENABLED !== "0";

export const YOUGLISH_REQUIRE_COOKIE_CONSENT =
  process.env.NEXT_PUBLIC_YOUGLISH_REQUIRE_COOKIE_CONSENT === "true";

const COOKIE_CONSENT_KEY = "wordtap_youglish_cookie_consent_v1";

export type YouGlishFetchEvent = {
  query: string;
  lang: string;
  accent: string;
  totalResult: number;
};

export type YouGlishVideoChangeEvent = {
  video: string;
  trackNumber: number;
};

export type YouGlishCaptionChangeEvent = {
  caption: string;
  id: number;
};

export type YouGlishErrorCode = 1 | 2 | 3 | number;

export type YouGlishWidgetHandle = {
  play: () => void;
  pause: () => void;
  replay: () => void;
  next: () => void;
  previous: () => void;
  move: (seconds: number) => void;
  setSpeed: (rate: number) => void;
  refetch: () => void;
};

type YGWidgetInstance = {
  fetch: (query: string, lang: string, accent?: string) => void;
  play: () => void;
  pause: () => void;
  replay: () => void;
  next: () => void;
  previous: () => void;
  move: (seconds: number) => void;
  getSpeed: () => number;
  setSpeed: (suggestedRate: number) => void;
  close: () => void;
};

type YGRawEvent = {
  query?: string;
  lang?: string;
  accent?: string;
  totalResult?: number | string;
  video?: string;
  trackNumber?: number | string;
  caption?: string;
  id?: number | string;
  state?: number;
  speed?: number;
  code?: number;
};

declare global {
  interface Window {
    YG?: {
      Widget: new (
        element: HTMLElement | string,
        options: {
          width?: number;
          height?: number;
          autoStart?: number;
          components?: number;
          backgroundColor?: string;
          linkColor?: string;
          titleColor?: string;
          captionColor?: string;
          markerColor?: string;
          queryColor?: string;
          panelsBackgroundColor?: string;
          textColor?: string;
          keywordColor?: string;
          videoQuality?: "default" | "small" | "medium" | "highres";
          events?: {
            onFetchDone?: (e: YGRawEvent) => void;
            onVideoChange?: (e: YGRawEvent) => void;
            onCaptionChange?: (e: YGRawEvent) => void;
            onCaptionConsumed?: (e: YGRawEvent) => void;
            onPlayerReady?: (e: YGRawEvent) => void;
            onPlayerStateChange?: (e: YGRawEvent) => void;
            onSpeedChange?: (e: YGRawEvent) => void;
            onError?: (e: YGRawEvent) => void;
          };
        },
      ) => YGWidgetInstance;
      PlayerState?: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
      Error?: {
        PLAYER: number;
        OUTDATED_BROWSER: number;
        TIMEOUT: number;
      };
    };
    onYouglishAPIReady?: () => void;
  }
}

let ygScriptPromise: Promise<void> | null = null;

function loadOfficialYouGlishScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YG?.Widget) return Promise.resolve();
  if (ygScriptPromise) return ygScriptPromise;

  ygScriptPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      if (err) {
        ygScriptPromise = null;
        reject(err);
      } else {
        resolve();
      }
    };

    const previousReady = window.onYouglishAPIReady;
    window.onYouglishAPIReady = () => {
      try {
        previousReady?.();
      } catch {
        // ignore prior callback errors
      }
      if (window.YG?.Widget) done();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://youglish.com/public/emb/widget.js"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://youglish.com/public/emb/widget.js";
      tag.async = true;
      tag.charset = "utf-8";
      tag.onerror = () => done(new Error("Could not load the official YouGlish script."));
      const firstScript = document.getElementsByTagName("script")[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(tag, firstScript);
      } else {
        document.head.appendChild(tag);
      }
    }

    const poll = window.setInterval(() => {
      if (window.YG?.Widget) done();
    }, 120);

    const timeout = window.setTimeout(() => {
      done(new Error("YouGlish Widget API took too long to respond."));
    }, 15_000);
  });

  return ygScriptPromise;
}

export function mapWordLangToYouGlish(srcLang?: string | null): string {
  const code = (srcLang || "en").trim().toLowerCase().slice(0, 2);
  const langMap: Record<string, string> = {
    en: "english",
    de: "german",
    fr: "french",
    es: "spanish",
    it: "italian",
    pt: "portuguese",
    nl: "dutch",
    ru: "russian",
    tr: "turkish",
    ar: "arabic",
    ja: "japanese",
    ko: "korean",
    zh: "chinese",
    pl: "polish",
    sv: "swedish",
    el: "greek",
    he: "hebrew",
    hi: "hindi",
    id: "indonesian",
    cs: "czech",
    ro: "romanian",
    th: "thai",
    uk: "ukrainian",
    vi: "vietnamese",
    fa: "persian",
  };
  return langMap[code] || "english";
}

export function readYouGlishCookieConsent(): "granted" | "denied" | "prompt" {
  if (typeof window === "undefined") {
    return YOUGLISH_REQUIRE_COOKIE_CONSENT ? "prompt" : "granted";
  }
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === "granted" || raw === "denied") return raw;
  } catch {
    // ignore storage errors
  }
  return YOUGLISH_REQUIRE_COOKIE_CONSENT ? "prompt" : "granted";
}

export function writeYouGlishCookieConsent(value: "granted" | "denied"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // ignore storage errors
  }
}

export function describeYouGlishError(code: YouGlishErrorCode): string {
  if (code === 1) return "The embedded YouTube player encountered a playback error.";
  if (code === 2) return "Your browser is not supported by the YouGlish video player.";
  if (code === 3) return "YouGlish timed out while loading videos. Please check your connection and retry.";
  return "Could not load YouGlish videos right now.";
}

type YouGlishWidgetProps = {
  query: string;
  lang: string;
  reloadNonce?: number;
  onFetchDone: (e: YouGlishFetchEvent) => void;
  onVideoChange: (e: YouGlishVideoChangeEvent) => void;
  onCaptionChange: (e: YouGlishCaptionChangeEvent) => void;
  onCaptionConsumed?: (id: number) => void;
  onPlayerReady?: () => void;
  onPlayerStateChange?: (state: number) => void;
  onSpeedChange?: (speed: number) => void;
  onError: (code: YouGlishErrorCode, message: string) => void;
};

export const YouGlishWidget = forwardRef<YouGlishWidgetHandle, YouGlishWidgetProps>(
  function YouGlishWidget(
    {
      query,
      lang,
      reloadNonce = 0,
      onFetchDone,
      onVideoChange,
      onCaptionChange,
      onCaptionConsumed,
      onPlayerReady,
      onPlayerStateChange,
      onSpeedChange,
      onError,
    },
    ref,
  ) {
    const reactId = useId();
    const mountId = `yg-stage2-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<YGWidgetInstance | null>(null);
    const [loadingApi, setLoadingApi] = useState(true);

    // Keep latest callbacks in refs so widget never re-initializes on parent re-renders
    const callbacksRef = useRef({
      onFetchDone,
      onVideoChange,
      onCaptionChange,
      onCaptionConsumed,
      onPlayerReady,
      onPlayerStateChange,
      onSpeedChange,
      onError,
    });
    callbacksRef.current = {
      onFetchDone,
      onVideoChange,
      onCaptionChange,
      onCaptionConsumed,
      onPlayerReady,
      onPlayerStateChange,
      onSpeedChange,
      onError,
    };

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          try {
            widgetRef.current?.play();
          } catch {
            // ignore
          }
        },
        pause: () => {
          try {
            widgetRef.current?.pause();
          } catch {
            // ignore
          }
        },
        replay: () => {
          try {
            widgetRef.current?.replay();
          } catch {
            // ignore
          }
        },
        next: () => {
          try {
            widgetRef.current?.next();
          } catch {
            // ignore
          }
        },
        previous: () => {
          try {
            widgetRef.current?.previous();
          } catch {
            // ignore
          }
        },
        move: (seconds: number) => {
          try {
            widgetRef.current?.move(seconds);
          } catch {
            // ignore
          }
        },
        setSpeed: (rate: number) => {
          try {
            widgetRef.current?.setSpeed(rate);
          } catch {
            // ignore
          }
        },
        refetch: () => {
          try {
            widgetRef.current?.fetch(query, lang);
          } catch {
            // ignore
          }
        },
      }),
      [query, lang],
    );

    useEffect(() => {
      let active = true;
      setLoadingApi(true);

      const closeExisting = () => {
        if (widgetRef.current) {
          try {
            widgetRef.current.close();
          } catch {
            // ignore cleanup errors
          }
          widgetRef.current = null;
        }
      };

      loadOfficialYouGlishScript()
        .then(() => {
          if (!active || !hostRef.current || !window.YG?.Widget) return;

          closeExisting();
          hostRef.current.innerHTML = "";
          const mountEl = document.createElement("div");
          mountEl.id = mountId;
          hostRef.current.appendChild(mountEl);

          const isDark =
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark");

          // Official YouGlish widget options:
          // - Omitting `width` uses the documented default ("expand to all its container width"),
          //   keeping the video responsive across desktop and 375px mobile viewports.
          // - `components: 2` shows the Accent selector (All/US/UK/AUS) while avoiding duplicate
          //   control bars and keeping inline captions hidden (bit 8 off) so the missing-word
          //   exercise is never spoiled before solving. Actual captions still arrive via onCaptionChange.
          const widget = new window.YG.Widget(mountId, {
            components: 2,
            autoStart: 0,
            backgroundColor: isDark ? "#121216" : "#FFFFFF",
            panelsBackgroundColor: isDark ? "#1C1C22" : "#F5F5F7",
            titleColor: isDark ? "#F5F5F7" : "#1D1D1F",
            textColor: isDark ? "#D1D5DB" : "#4B5563",
            linkColor: isDark ? "#FACC3B" : "#1D1D1F",
            captionColor: isDark ? "#F5F5F7" : "#1D1D1F",
            markerColor: "#FACC3B",
            queryColor: "#D97706",
            videoQuality: "default",
            events: {
              onFetchDone: (e) => {
                if (!active) return;
                setLoadingApi(false);
                callbacksRef.current.onFetchDone({
                  query: String(e.query ?? query),
                  lang: String(e.lang ?? lang),
                  accent: String(e.accent ?? ""),
                  totalResult: Math.max(0, Number(e.totalResult) || 0),
                });
              },
              onVideoChange: (e) => {
                if (!active) return;
                setLoadingApi(false);
                callbacksRef.current.onVideoChange({
                  video: String(e.video ?? ""),
                  trackNumber: Math.max(1, Number(e.trackNumber) || 1),
                });
              },
              onCaptionChange: (e) => {
                if (!active) return;
                callbacksRef.current.onCaptionChange({
                  caption: String(e.caption ?? ""),
                  id: Number(e.id) || 0,
                });
              },
              onCaptionConsumed: (e) => {
                if (!active) return;
                callbacksRef.current.onCaptionConsumed?.(Number(e.id) || 0);
              },
              onPlayerReady: () => {
                if (!active) return;
                setLoadingApi(false);
                callbacksRef.current.onPlayerReady?.();
              },
              onPlayerStateChange: (e) => {
                if (!active) return;
                if (typeof e.state === "number") {
                  callbacksRef.current.onPlayerStateChange?.(e.state);
                }
              },
              onSpeedChange: (e) => {
                if (!active) return;
                if (typeof e.speed === "number") {
                  callbacksRef.current.onSpeedChange?.(e.speed);
                }
              },
              onError: (e) => {
                if (!active) return;
                setLoadingApi(false);
                const code = Number(e.code) || 0;
                callbacksRef.current.onError(code, describeYouGlishError(code));
              },
            },
          });

          widgetRef.current = widget;
          widget.fetch(query, lang);
        })
        .catch((err) => {
          if (!active) return;
          setLoadingApi(false);
          const msg =
            err instanceof Error
              ? err.message
              : "Could not load the official YouGlish widget.";
          callbacksRef.current.onError(3, msg);
        });

      return () => {
        active = false;
        closeExisting();
      };
    }, [query, lang, reloadNonce, mountId]);

    return (
      <div className="grid gap-2 min-w-0">
        {loadingApi ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-ink"
          >
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-subtitle border-t-transparent shrink-0" />
            <span>
              Loading real YouGlish videos for &ldquo;{query}&rdquo;…
            </span>
          </div>
        ) : null}

        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div
            ref={hostRef}
            className="w-full min-w-0 max-w-full [&>*]:!w-full [&>*]:!max-w-full [&_iframe]:!w-full [&_iframe]:!max-w-full"
          />
        </div>
      </div>
    );
  },
);
