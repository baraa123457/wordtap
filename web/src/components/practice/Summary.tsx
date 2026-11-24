import Link from "next/link";
import type { Word } from "@/lib/schemas";
import { canSpeak, speak } from "@/lib/speech";
import { FireIcon, SpeakerIcon } from "../Icons";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  xp: number;
  asked: number;
  right: number;
  missed: Word[];
  save: SaveState;
  reviewFailed: boolean;
  onRetrySave: () => void;
  onAgain: () => void;
  onDrillMissed?: () => void;
  onChangeLang?: () => void;
  remainingCount?: number;
  sessionSize?: number;
};

export function Summary({
  xp,
  asked,
  right,
  missed,
  save,
  reviewFailed,
  onRetrySave,
  onAgain,
  onDrillMissed,
  onChangeLang,
  remainingCount,
  sessionSize = 8,
}: Props) {
  const accuracy = asked === 0 ? 100 : Math.round((right / asked) * 100);
  const nextBatchCount = typeof remainingCount === "number" ? Math.min(remainingCount, sessionSize) : 0;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-3.5 sm:px-4 py-8">
      <section className="frame" aria-label="Session summary">
        <div className="frame-bar flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-semibold">
            <FireIcon size={16} className="text-orange-500" />
            <span>Practice complete</span>
          </span>
          <span>
            {asked} {asked === 1 ? "question" : "questions"}
          </span>
        </div>
        <div className="frame-stage gap-2" style={{ minHeight: "11rem" }}>
          <p className="sub text-4xl sm:text-5xl">
            +<span className="sub-hl">{xp}</span> XP
          </p>
          <p className="text-xs sm:text-sm text-white/70">
            {accuracy >= 80 ? "Great memory retention!" : "Good practice session!"}
          </p>
        </div>
        <div className="frame-bar flex flex-wrap items-center justify-between gap-2">
          <span>{accuracy}% right on the first try</span>
          <span aria-live="polite">
            {save === "saving" ? "Saving…" : save === "saved" ? "Progress saved ✓" : save === "error" ? "Not saved" : ""}
          </span>
        </div>
      </section>

      {/* Spaced repetition schedule preview */}
      <div className="apple-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="space-y-0.5">
          <p className="font-semibold text-ink">Spaced Repetition Updated</p>
          <p className="text-muted">Mastered words move to longer intervals. Review words return tomorrow.</p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-xs text-subtitle-edge dark:text-subtitle font-bold bg-subtitle/10 px-3 py-1.5 rounded-full w-fit">
          <span>Streak maintained</span>
        </div>
      </div>

      {/* Remaining Words to Practice Notification */}
      {typeof remainingCount === "number" && (
        <div
          className={`apple-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm transition-all ${
            remainingCount > 0
              ? "bg-subtitle/10 border-subtitle/30 shadow-sm"
              : "bg-surface-elevated/40 border-line/60"
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-subtitle/15 text-amber-800 dark:text-subtitle flex items-center justify-center shrink-0">
              {remainingCount > 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </span>
            <div className="space-y-1 min-w-0">
              {remainingCount > 0 ? (
                <>
                  <p className="font-bold text-ink text-sm sm:text-base">
                    You still have {remainingCount} {remainingCount === 1 ? "word" : "words"} you need to practice!
                  </p>
                  <p className="text-muted text-xs sm:text-sm" dir="rtl">
                    ما زال لديك <strong className="text-amber-700 dark:text-subtitle font-bold">{remainingCount}</strong>{" "}
                    {remainingCount === 1 ? "كلمة تحتاج" : "كلمات تحتاج"} للتدرب عليها
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-ok-ink text-sm sm:text-base">
                    You&apos;re all caught up for today!
                  </p>
                  <p className="text-muted text-xs sm:text-sm" dir="rtl">
                    أحسنت! تدربت على جميع كلماتك اليوم
                  </p>
                </>
              )}
            </div>
          </div>
          {remainingCount > 0 ? (
            <button
              type="button"
              className="btn btn-primary min-h-10 px-4 py-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
              onClick={onAgain}
            >
              Practice next {nextBatchCount} {nextBatchCount === 1 ? "word" : "words"} →
            </button>
          ) : null}
        </div>
      )}

      {save === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-bad-ink">
          <span>Your XP and streak could not be saved.</span>
          <button type="button" className="btn min-h-9 px-3 py-1 text-sm" onClick={onRetrySave}>
            Try again
          </button>
        </div>
      ) : null}
      {reviewFailed ? (
        <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-bad-ink">
          Some answers could not be saved, so those words may come back sooner than planned.
        </p>
      ) : null}

      {missed.length > 0 ? (
        <section aria-labelledby="missed" className="grid gap-3">
          <h2 id="missed" className="text-lg font-semibold text-ink">
            Words to look at again ({missed.length})
          </h2>
          <ul className="apple-card divide-y divide-line overflow-hidden">
            {missed.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                <div className="flex items-center gap-3 min-w-0">
                  <span dir="auto" className="font-semibold text-ink truncate">
                    {w.text}
                  </span>
                  {canSpeak() ? (
                    <button
                      type="button"
                      aria-label={`Hear “${w.text}”`}
                      title={`Pronounce “${w.text}”`}
                      className="p-1 rounded-full text-muted hover:text-ink cursor-pointer"
                      onClick={() => speak(w.text, w.src_lang)}
                    >
                      <SpeakerIcon size={16} />
                    </button>
                  ) : null}
                </div>
                <span dir="auto" className="text-muted truncate text-sm">
                  {w.translation}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="apple-card p-4 text-center text-sm font-semibold text-ok-ink">
          Every word right on the first try! Excellent work.
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
        <button type="button" className="btn btn-primary w-full sm:w-auto text-center justify-center min-h-11 px-5 font-bold shadow-sm" onClick={onAgain}>
          {typeof remainingCount === "number" && remainingCount > 0
            ? `Practice again (${remainingCount} left)`
            : "Practice again"}
        </button>
        {missed.length > 0 ? (
          <button type="button" className="btn w-full sm:w-auto text-center justify-center min-h-11 px-5 font-semibold" onClick={onDrillMissed}>
            Drill missed words ({missed.length})
          </button>
        ) : null}
        {onChangeLang ? (
          <button
            type="button"
            className="btn w-full sm:w-auto text-center justify-center min-h-11 px-5 font-semibold"
            onClick={onChangeLang}
          >
            Change language
          </button>
        ) : null}
        <Link href="/dashboard" className="btn w-full sm:w-auto text-center justify-center min-h-11 px-5 font-semibold">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
