"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchStats, fetchWords, setDailyGoal } from "@/lib/api";
import { effectiveStats, localDateString } from "@/lib/dates";
import { formatDueIn, isDue } from "@/lib/format";
import type { Stats, Word } from "@/lib/schemas";
import { useLoad } from "@/hooks/useLoad";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { MasteryDots } from "@/components/MasteryDots";
import { FireIcon } from "@/components/Icons";
import { TranslatorCard } from "@/components/TranslatorCard";

type DashboardData = { words: Word[]; stats: Stats };

async function loadDashboard(): Promise<DashboardData> {
  const [words, stats] = await Promise.all([fetchWords(), fetchStats()]);
  return { words, stats };
}

const GOALS = [10, 20, 50, 100] as const;

function GoalDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change daily goal"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-subtitle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle cursor-pointer"
      >
        <span>{value} XP</span>
        <svg
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
            open ? "rotate-180 text-subtitle" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Daily goal options"
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[130px] rounded-2xl border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {GOALS.map((g) => {
            const isSelected = g === value;
            return (
              <button
                key={g}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(g);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-subtitle text-subtitle-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span>{g} XP</span>
                {isSelected && (
                  <span className="text-subtitle-ink font-bold">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { state, reload, setData } = useLoad(loadDashboard);
  const [goalError, setGoalError] = useState<string | null>(null);

  if (state.status === "loading") return <LoadingState label="Loading your words…" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={reload} />;

  const { words, stats } = state.data;

  const now = new Date();
  const eff = effectiveStats(stats, localDateString(now));
  const dueCount = words.filter((w) => isDue(w.next_review, now)).length;
  const mastered = words.filter((w) => w.box >= 4).length;
  const nextDue = words
    .map((w) => w.next_review)
    .filter((t) => !isDue(t, now))
    .sort()[0];
  const goalPct = Math.min(100, Math.round((eff.todayXp / stats.daily_goal) * 100));

  async function changeGoal(goal: number) {
    setGoalError(null);
    try {
      await setDailyGoal(goal);
      setData({ words, stats: { ...stats, daily_goal: goal } });
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Could not save your goal.");
    }
  }

  async function refreshDataQuietly() {
    try {
      const freshData = await loadDashboard();
      setData(freshData);
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid min-w-0 max-w-full gap-6">
      {/* 1. Google Translate Component at the very top */}
      <TranslatorCard existingWords={words} onWordSaved={refreshDataQuietly} />

      {/* 2. Today's Practice Card - Unified with the Apple Card Design */}
      <section aria-labelledby="today" className="apple-card overflow-hidden w-full min-w-0 transition-all">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-line/60 bg-black/[0.02] dark:bg-white/[0.03] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span id="today" className="font-bold text-ink text-sm sm:text-base">Today</span>
            {dueCount > 0 ? (
              <span className="rounded-full bg-subtitle/20 border border-subtitle/30 px-2.5 py-0.5 text-xs font-extrabold text-ink dark:text-subtitle">
                {dueCount} due
              </span>
            ) : null}
          </div>
          <span className="flex items-center gap-1.5 text-xs sm:text-sm">
            {eff.streak > 0 ? (
              <>
                <FireIcon size={17} className="text-orange-500 animate-pulse" />
                <span className="font-bold text-ink">
                  {eff.streak}-day streak{eff.practicedToday ? "" : ": practice to keep it"}
                </span>
              </>
            ) : (
              <span className="text-muted text-xs">No streak yet</span>
            )}
          </span>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-start space-y-1 max-w-lg">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              {words.length === 0 ? (
                "Start building your vocabulary"
              ) : dueCount > 0 ? (
                <>
                  <span className="text-subtitle underline decoration-subtitle decoration-4 underline-offset-4">{dueCount}</span> {dueCount === 1 ? "word is" : "words are"} ready
                </>
              ) : (
                "You're all caught up"
              )}
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {words.length === 0
                ? "Translate words above or tap subtitles with the extension to start practicing."
                : dueCount > 0
                ? "Review your words now to reinforce your memory and maintain your streak."
                : nextDue
                ? `Next review ${formatDueIn(nextDue, now)}. Keep up the momentum!`
                : "You have reviewed all available words. Great job!"}
            </p>
          </div>

          <div className="shrink-0 flex items-center justify-start sm:justify-end">
            <Link
              href={words.length === 0 ? "/extension" : "/practice"}
              className="btn btn-primary min-h-11 px-6 text-sm sm:text-base font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              {words.length === 0
                ? "Get extension"
                : dueCount > 0
                ? "Start practice"
                : "Practice anyway"}
            </Link>
          </div>
        </div>

        {/* Bottom Goal Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 bg-black/[0.02] dark:bg-white/[0.03] px-5 py-2.5 text-xs sm:text-sm">
          <span className="flex items-center gap-3">
            <span className="text-muted font-medium">
              <strong className="text-ink font-semibold">{eff.todayXp}</strong> of {stats.daily_goal} XP today
            </span>
            <span
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goalPct}
              className="h-2 w-28 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            >
              <span className="block h-full bg-subtitle rounded-full" style={{ width: `${goalPct}%` }} />
            </span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Daily goal</span>
            <GoalDropdown
              value={stats.daily_goal}
              onChange={(goal) => void changeGoal(goal)}
            />
          </div>
        </div>
      </section>

      {goalError ? (
        <p role="alert" className="-mt-6 rounded-xl bg-bad-soft px-4 py-3 text-bad">
          {goalError}
        </p>
      ) : null}
      {dueCount === 0 && nextDue ? (
        <p className="-mt-6 text-muted">Next review {formatDueIn(nextDue, now)}.</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 min-w-0">
        <Stat
          label="Day streak"
          value={eff.streak}
          icon={eff.streak > 0 ? <FireIcon size={20} className="text-orange-500" /> : undefined}
        />
        <Stat label="Total XP" value={stats.xp} />
        <Stat label="Words saved" value={words.length} />
        <Stat label="Mastered" value={mastered} />
      </dl>

      <section aria-labelledby="recent" className="grid gap-3 min-w-0">
        <div className="flex items-baseline justify-between px-1">
          <h2 id="recent" className="text-lg font-semibold text-ink">
            Latest words
          </h2>
          <Link href="/words" className="text-xs font-semibold text-muted hover:text-ink transition-colors">
            View all {words.length} →
          </Link>
        </div>
        <ul className="apple-card divide-y divide-line/50 overflow-hidden min-w-0">
          {words.slice(0, 5).map((w) => (
            <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 min-w-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors">
              <span dir="auto" className="truncate font-semibold text-ink min-w-0 text-sm sm:text-base">
                {w.text}
              </span>
              <span dir="auto" className="truncate text-muted min-w-0 text-xs sm:text-sm">
                {w.translation}
              </span>
              <div className="shrink-0">
                <MasteryDots box={w.box} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="apple-card p-4 flex flex-col justify-between gap-1 shadow-2xs">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-2xl font-bold tracking-tight text-ink tabular-nums">
        {icon}
        <span>{value.toLocaleString("en")}</span>
      </dd>
    </div>
  );
}
