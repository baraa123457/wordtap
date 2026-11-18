"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "@/lib/schemas";
import {
  buildProgressiveHint,
  parseYouGlishCaption,
  validateMissingWordAnswer,
  type MaskedSentence,
} from "@/lib/placeholder";
import {
  mapWordLangToYouGlish,
  readYouGlishCookieConsent,
  writeYouGlishCookieConsent,
  YOUGLISH_WIDGET_ENABLED,
  YouGlishWidget,
  type YouGlishCaptionChangeEvent,
  type YouGlishErrorCode,
  type YouGlishFetchEvent,
  type YouGlishVideoChangeEvent,
  type YouGlishWidgetHandle,
} from "./YouGlishWidget";

type LockedCaptionExercise = {
  captionId: number;
  plainSentence: string;
  masked: MaskedSentence;
  hasExplicitMarker: boolean;
};

export function Stage2ContextualVideo({
  word,
  onComplete,
}: {
  word: Word;
  onComplete: (result: {
    passedFirstTry: boolean;
    typedAnswer: string;
    usedVideo: boolean;
    attempts: number;
  }) => void;
}) {
  const widgetRef = useRef<YouGlishWidgetHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = word.text.trim();
  const ygLang = useMemo(() => mapWordLangToYouGlish(word.src_lang), [word.src_lang]);

  // Cookie consent state (respects third-party YouGlish/YouTube embed cookie preferences)
  const [cookieConsent, setCookieConsent] = useState<"granted" | "denied" | "prompt">("granted");
  useEffect(() => {
    setCookieConsent(readYouGlishCookieConsent());
  }, []);

  // Official YouGlish Widget state (synchronized strictly from widget events)
  const [reloadNonce, setReloadNonce] = useState(0);
  const [fetchInfo, setFetchInfo] = useState<YouGlishFetchEvent | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [trackNumber, setTrackNumber] = useState<number>(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number>(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [widgetError, setWidgetError] = useState<{
    code: YouGlishErrorCode;
    message: string;
  } | null>(null);

  // Actual YouGlish captions received via onCaptionChange
  const [livePlainCaption, setLivePlainCaption] = useState<string>("");
  const [exerciseCaption, setExerciseCaption] = useState<LockedCaptionExercise | null>(null);

  // Interactive missing-word exercise state
  const [answer, setAnswer] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [totalSubmits, setTotalSubmits] = useState(0);
  const [exerciseState, setExerciseState] = useState<"answering" | "wrong" | "correct">("answering");
  const [completedAnyExample, setCompletedAnyExample] = useState(false);
  const [firstTryPassed, setFirstTryPassed] = useState(true);

  // Reset all Stage 2 state cleanly whenever the active vocabulary word changes
  useEffect(() => {
    setFetchInfo(null);
    setCurrentVideoId(null);
    setTrackNumber(0);
    setPlayerReady(false);
    setPlayerState(-1);
    setPlaybackSpeed(1);
    setWidgetError(null);
    setLivePlainCaption("");
    setExerciseCaption(null);
    setAnswer("");
    setWrongAttempts(0);
    setTotalSubmits(0);
    setExerciseState("answering");
    setCompletedAnyExample(false);
    setFirstTryPassed(true);
  }, [word.id, query]);

  const resetExerciseForTrack = useCallback(() => {
    setLivePlainCaption("");
    setExerciseCaption(null);
    setAnswer("");
    setWrongAttempts(0);
    setExerciseState("answering");
  }, []);

  const handleFetchDone = useCallback((event: YouGlishFetchEvent) => {
    setFetchInfo(event);
    setWidgetError(null);
    if (event.totalResult > 0) {
      setTrackNumber((prev) => (prev > 0 ? prev : 1));
    } else {
      setTrackNumber(0);
    }
  }, []);

  const handleVideoChange = useCallback(
    (event: YouGlishVideoChangeEvent) => {
      setCurrentVideoId(event.video || null);
      setTrackNumber(event.trackNumber);
      setWidgetError(null);
      resetExerciseForTrack();
    },
    [resetExerciseForTrack],
  );

  const handleCaptionChange = useCallback(
    (event: YouGlishCaptionChangeEvent) => {
      const parsed = parseYouGlishCaption(event.caption, query);
      if (parsed.plainSentence) {
        setLivePlainCaption(parsed.plainSentence);
      }
      if (!parsed.masked) return;

      setExerciseCaption((prev) => {
        // Prefer captions where YouGlish explicitly marked [[[target word]]]
        if (prev && prev.hasExplicitMarker && !parsed.hasExplicitMarker) {
          return prev;
        }
        if (prev && prev.captionId === event.id && prev.plainSentence === parsed.plainSentence) {
          return prev;
        }
        return {
          captionId: event.id,
          plainSentence: parsed.plainSentence,
          masked: parsed.masked!,
          hasExplicitMarker: parsed.hasExplicitMarker,
        };
      });
    },
    [query],
  );

  const handlePlayerReady = useCallback(() => {
    setPlayerReady(true);
  }, []);

  const handlePlayerStateChange = useCallback((state: number) => {
    setPlayerState(state);
    if (state === 1 || state === 2 || state === 5) {
      setPlayerReady(true);
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    if (Number.isFinite(speed) && speed > 0) {
      setPlaybackSpeed(speed);
    }
  }, []);

  const handleError = useCallback((code: YouGlishErrorCode, message: string) => {
    setWidgetError({ code, message });
  }, []);

  const handleRetryWidget = () => {
    setWidgetError(null);
    setFetchInfo(null);
    setTrackNumber(0);
    setPlayerReady(false);
    resetExerciseForTrack();
    setReloadNonce((n) => n + 1);
  };

  const handleGrantCookies = () => {
    writeYouGlishCookieConsent("granted");
    setCookieConsent("granted");
  };

  const handleRevokeCookies = () => {
    writeYouGlishCookieConsent("denied");
    setCookieConsent("denied");
    setFetchInfo(null);
    setTrackNumber(0);
    setPlayerReady(false);
    resetExerciseForTrack();
  };

  const masked = exerciseCaption?.masked ?? null;
  const hint = useMemo(
    () => (masked ? buildProgressiveHint(masked.hiddenWord, wrongAttempts) : null),
    [masked, wrongAttempts],
  );

  const isPlaying = playerState === 1;
  const totalResult = fetchInfo?.totalResult ?? 0;
  const hasFetched = fetchInfo !== null;
  const noResults = hasFetched && totalResult === 0;
  const canRenderWidget = YOUGLISH_WIDGET_ENABLED && cookieConsent === "granted";

  const handleTogglePlay = () => {
    if (isPlaying) {
      widgetRef.current?.pause();
    } else {
      widgetRef.current?.play();
    }
  };

  const handleToggleSpeed = () => {
    const target = playbackSpeed < 0.9 ? 1 : 0.75;
    widgetRef.current?.setSpeed(target);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masked || !answer.trim()) return;

    setTotalSubmits((c) => c + 1);
    const ok = validateMissingWordAnswer(answer, masked.hiddenWord, word.text);
    if (ok) {
      setExerciseState("correct");
      setCompletedAnyExample(true);
    } else {
      setWrongAttempts((a) => a + 1);
      setFirstTryPassed(false);
      setExerciseState("wrong");
      inputRef.current?.focus();
    }
  };

  const finishStage = (usedVideo: boolean) => {
    onComplete({
      passedFirstTry: firstTryPassed,
      typedAnswer: masked?.hiddenWord || word.text,
      usedVideo,
      attempts: Math.max(1, totalSubmits),
    });
  };

  return (
    <section
      aria-labelledby="stage2-heading"
      className="apple-card w-full max-w-full overflow-x-hidden p-4 sm:p-7 grid gap-5 min-w-0"
    >
      {/* 1. Stage Header, Current Vocabulary Word & Real YouGlish Example Count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            Stage 2 · Contextual Learning
          </span>
          <h2 id="stage2-heading" className="text-lg sm:text-2xl font-extrabold text-ink">
            {exerciseState === "correct"
              ? `You heard “${word.text}” in real context`
              : "Listen & type the missing word"}
          </h2>
        </div>

        {hasFetched && totalResult > 0 ? (
          <span
            data-testid="youglish-result-count"
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink tabular-nums"
          >
            Example {Math.max(1, trackNumber).toLocaleString()} of {totalResult.toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* 2. Embedded Official YouGlish Widget OR Explicit Policy/Consent/Disabled State */}
      {!YOUGLISH_WIDGET_ENABLED ? (
        <div className="rounded-2xl border border-line bg-surface p-5 grid gap-3">
          <p className="text-sm font-bold text-ink">
            YouGlish embedded video player is currently disabled.
          </p>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Set <code className="font-mono text-xs">NEXT_PUBLIC_YOUGLISH_WIDGET_ENABLED=true</code> once
            commercial licensing is active, or continue directly to Stage 3 without losing your progress.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => finishStage(false)}
              className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Continue to Stage 3 →
            </button>
          </div>
        </div>
      ) : cookieConsent !== "granted" ? (
        <div className="rounded-2xl border border-line bg-surface p-5 grid gap-3">
          <p className="text-sm font-bold text-ink">
            Allow embedded YouGlish &amp; YouTube video playback?
          </p>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Stage 2 embeds real spoken English videos using the official{" "}
            <a
              href="https://youglish.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-ink"
            >
              YouGlish.com
            </a>{" "}
            widget and YouTube player, which may set third-party cookies governed by the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-ink"
            >
              YouTube Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-ink"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleGrantCookies}
              className="btn btn-primary min-h-10 px-4 text-xs sm:text-sm font-bold cursor-pointer"
            >
              Enable YouGlish videos
            </button>
            <button
              type="button"
              onClick={() => finishStage(false)}
              className="btn btn-quiet min-h-10 px-4 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              Continue to Stage 3 without video →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Official YouGlish Embedded Widget (Main Element) */}
          <YouGlishWidget
            ref={widgetRef}
            query={query}
            lang={ygLang}
            reloadNonce={reloadNonce}
            onFetchDone={handleFetchDone}
            onVideoChange={handleVideoChange}
            onCaptionChange={handleCaptionChange}
            onPlayerReady={handlePlayerReady}
            onPlayerStateChange={handlePlayerStateChange}
            onSpeedChange={handleSpeedChange}
            onError={handleError}
          />

          {/* Official Widget Playback & Navigation Controls (Synchronized with YG.Widget API) */}
          {totalResult > 0 && !widgetError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={!playerReady && !currentVideoId}
                  className="btn btn-primary min-h-9 px-3.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isPlaying ? "Pause" : "Play clip"}
                </button>
                <button
                  type="button"
                  onClick={() => widgetRef.current?.replay()}
                  disabled={!playerReady && !currentVideoId}
                  title="Replay current spoken sentence"
                  className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  ↺ Replay
                </button>
                <button
                  type="button"
                  onClick={() => widgetRef.current?.move(-3)}
                  disabled={!playerReady && !currentVideoId}
                  title="Rewind 3 seconds"
                  className="btn btn-quiet min-h-9 px-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  -3s
                </button>
                <button
                  type="button"
                  onClick={handleToggleSpeed}
                  disabled={!playerReady && !currentVideoId}
                  title="Toggle slower speed for listening clarity"
                  className="btn btn-quiet min-h-9 px-2.5 text-xs font-semibold tabular-nums cursor-pointer disabled:opacity-50"
                >
                  {playbackSpeed}x
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => widgetRef.current?.previous()}
                  disabled={trackNumber <= 1}
                  aria-label="Previous YouGlish video example"
                  className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="px-1.5 text-xs font-bold tabular-nums text-muted">
                  {Math.max(1, trackNumber).toLocaleString()} / {totalResult.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => widgetRef.current?.next()}
                  disabled={trackNumber >= totalResult}
                  aria-label="Next YouGlish video example"
                  className="btn min-h-9 px-3 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : null}

          {/* Error Recovery (never breaks sequential learning session) */}
          {widgetError ? (
            <div
              role="alert"
              className="rounded-2xl border border-bad/30 bg-bad-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-bad">YouGlish player could not load</p>
                <p className="text-xs text-ink/80">{widgetError.message}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetryWidget}
                  className="btn min-h-9 px-3.5 text-xs font-bold cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => finishStage(false)}
                  className="btn btn-primary min-h-9 px-4 text-xs font-bold cursor-pointer"
                >
                  Continue to Stage 3 →
                </button>
              </div>
            </div>
          ) : null}

          {/* Zero Search Results Handling */}
          {noResults && !widgetError ? (
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-ink">
                  No YouGlish videos were found for &ldquo;{word.text}&rdquo;
                </p>
                <p className="text-xs text-muted">
                  YouGlish returned 0 matching clips for this word in {ygLang}. Continue to Stage 3
                  to practice using &ldquo;{word.text}&rdquo; in your own sentence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => finishStage(false)}
                className="btn btn-primary shrink-0 min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Continue to Stage 3 →
              </button>
            </div>
          ) : null}

          {/* 3. Actual Caption & Interactive Missing-Word Exercise (Strictly from onCaptionChange) */}
          {!noResults && !widgetError ? (
            masked ? (
              <div
                data-testid="stage2-caption-exercise"
                className="rounded-2xl border border-line bg-surface p-4 sm:p-5 grid gap-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted">
                    {exerciseState === "correct"
                      ? "Actual YouGlish caption (target word highlighted):"
                      : "Listen to the video and type the missing word from the actual caption:"}
                  </span>
                  <span
                    data-testid="stage2-letter-count"
                    className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-muted tabular-nums"
                  >
                    {masked.letterCount} {masked.letterCount === 1 ? "letter" : "letters"}
                  </span>
                </div>

                {/* Actual YouGlish Caption: exact 1-dot-per-character placeholder before solve, highlighted target word after solve */}
                <blockquote
                  data-testid="stage2-caption-quote"
                  className="text-base sm:text-xl font-medium leading-relaxed text-ink"
                >
                  &ldquo;
                  {masked.before}
                  {exerciseState === "correct" ? (
                    <mark className="rounded-lg bg-subtitle/40 px-2 py-0.5 font-extrabold text-ink">
                      {masked.hiddenWord}
                    </mark>
                  ) : (
                    <span
                      data-testid="stage2-missing-placeholder"
                      aria-label={`${masked.letterCount} missing letters`}
                      className="inline-block rounded-lg border-b-2 border-subtitle bg-subtitle/10 px-2 py-0.5 font-mono font-bold tracking-[0.2em] text-ink"
                    >
                      {hint || masked.placeholder}
                    </span>
                  )}
                  {masked.after}
                  &rdquo;
                </blockquote>

                {exerciseState !== "correct" ? (
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        if (exerciseState === "wrong") setExerciseState("answering");
                      }}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={`Type the ${masked.letterCount}-letter word…`}
                      aria-label="Type the missing word"
                      className="field flex-1 text-base font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={!answer.trim()}
                      className="btn btn-primary min-h-11 px-6 text-sm font-bold cursor-pointer disabled:opacity-50"
                    >
                      Submit
                    </button>
                  </form>
                ) : null}

                {exerciseState === "wrong" ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs sm:text-sm text-bad font-medium"
                  >
                    Not quite! Replay the clip and count the dots ({masked.letterCount} letters).
                    {hint ? (
                      <span className="block mt-1 text-ink">
                        Hint:{" "}
                        <span className="font-mono font-bold tracking-widest">{hint}</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {exerciseState === "correct" ? (
                  <div
                    role="status"
                    className="rounded-2xl border border-ok/30 bg-ok/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
                  >
                    <div>
                      <p className="text-sm font-bold text-ok">
                        Spot on! &ldquo;{masked.hiddenWord}&rdquo; matches the spoken caption.
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Replay the clip, explore another real YouGlish example, or continue to Stage 3.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => widgetRef.current?.replay()}
                        className="btn min-h-10 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
                      >
                        ↺ Replay
                      </button>
                      {trackNumber < totalResult ? (
                        <button
                          type="button"
                          onClick={() => widgetRef.current?.next()}
                          className="btn min-h-10 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
                        >
                          Next video →
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => finishStage(true)}
                        className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
                      >
                        Continue to Stage 3 →
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : hasFetched && totalResult > 0 ? (
              /* Waiting strictly for a real onCaptionChange containing [[[target word]]] — NEVER fabricates */
              <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 grid gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-ink">
                      Play the clip to load the real spoken sentence
                    </p>
                    <p className="text-xs text-muted">
                      Your fill-in-the-blank exercise appears automatically as soon as the speaker
                      reaches the sentence with the target word.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="btn btn-primary shrink-0 min-h-10 px-4 text-xs sm:text-sm font-bold cursor-pointer"
                  >
                    {isPlaying ? "Pause clip" : "Play clip"}
                  </button>
                </div>
                {livePlainCaption ? (
                  <p className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 text-xs text-muted italic">
                    Live caption: &ldquo;{livePlainCaption}&rdquo;
                  </p>
                ) : null}
              </div>
            ) : null
          ) : null}

          {/* Allow advancing if user already solved one example and browsed to another track */}
          {completedAnyExample && exerciseState !== "correct" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => finishStage(true)}
                className="btn btn-primary min-h-10 px-5 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Continue to Stage 3 →
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* 4. Required Attribution, YouTube ToS, Google Privacy Policy & Cookie Consent Controls */}
      <footer className="border-t border-line/60 pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>
            Powered by{" "}
            <a
              href="https://youglish.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
            >
              YouGlish.com
            </a>
          </span>
          <span aria-hidden="true">·</span>
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            YouTube Terms of Service
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            Google Privacy Policy
          </a>
        </div>

        {YOUGLISH_WIDGET_ENABLED ? (
          <button
            type="button"
            onClick={canRenderWidget ? handleRevokeCookies : handleGrantCookies}
            className="underline decoration-line underline-offset-2 hover:text-ink cursor-pointer"
          >
            {canRenderWidget ? "Disable video cookies" : "Enable video cookies"}
          </button>
        ) : null}
      </footer>
    </section>
  );
}
