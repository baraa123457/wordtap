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
        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[#151833] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:border-subtitle hover:bg-[#1c2044] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-subtitle"
      >
        <span>{value} XP</span>
        <svg
          className={`h-4 w-4 text-[#a9aed3] transition-transform duration-200 ${
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
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[130px] rounded-2xl border border-[#262a52] bg-[#151833] p-1.5 shadow-2xl shadow-black/90 backdrop-blur-md"
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
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                  isSelected
                    ? "bg-subtitle text-subtitle-ink shadow-sm"
                    : "text-[#a9aed3] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{g} XP</span>
                {isSelected && (
                  <svg
                    className="h-4 w-4 text-subtitle-ink"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
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

      {/* 2. Compact Practice Card directly underneath */}
      <section aria-labelledby="today" className="frame w-full min-w-0 shadow-lg">
        <div className="frame-bar py-2.5">
          <div className="flex items-center gap-2">
            <span id="today" className="font-semibold text-white">Today</span>
            {dueCount > 0 ? (
              <span className="rounded-md bg-subtitle/20 px-2 py-0.5 text-xs font-bold text-subtitle">
                {dueCount} due
              </span>
            ) : null}
          </div>
          <span className="flex items-center gap-1.5 text-xs sm:text-sm">
            {eff.streak > 0 ? (
              <>
                <FireIcon size={17} className="text-orange-500 animate-pulse" />
                <span className="font-semibold text-white">
                  {eff.streak}-day streak{eff.practicedToday ? "" : ": practice to keep it"}
                </span>
              </>
            ) : (
              <span className="text-white/60">No streak yet</span>
            )}
          </span>
        </div>

        {/* Compact stage: sleek responsive row */}
        <div className="frame-stage !py-5 !px-6 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-start space-y-1">
            <p className="sub !text-2xl sm:!text-3xl font-bold tracking-tight">
              {words.length === 0 ? (
                "Start building your vocabulary"
              ) : dueCount > 0 ? (
                <>
                  <span className="sub-hl">{dueCount}</span> {dueCount === 1 ? "word is" : "words are"} ready
                </>
              ) : (
                "You're all caught up"
              )}
            </p>
            <p className="text-xs sm:text-sm text-screen-muted">
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
              className="btn btn-primary !py-2.5 !px-6 text-sm sm:text-base font-bold shadow-md"
            >
              {words.length === 0
                ? "Get extension"
                : dueCount > 0
                ? "Start practice"
                : "Practice anyway"}
            </Link>
          </div>
        </div>

        <div className="frame-bar flex-wrap py-2 text-xs sm:text-sm">
          <span className="flex items-center gap-3">
            <span>
              {eff.todayXp} of {stats.daily_goal} XP today
            </span>
            <span
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goalPct}
              className="h-2 w-28 overflow-hidden rounded-full bg-white/15"
            >
              <span className="block h-full bg-subtitle" style={{ width: `${goalPct}%` }} />
            </span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-screen-muted">Daily goal</span>
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

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 sm:grid-cols-4 min-w-0">
        <Stat
          label="Day streak"
          value={eff.streak}
          icon={eff.streak > 0 ? <FireIcon size={24} className="text-orange-500" /> : undefined}
        />
        <Stat label="Total XP" value={stats.xp} />
        <Stat label="Words saved" value={words.length} />
        <Stat label="Mastered" value={mastered} />
      </dl>

      <section aria-labelledby="recent" className="grid gap-4 min-w-0">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="text-xl font-semibold">
            Latest words
          </h2>
          <Link href="/words" className="font-medium text-muted underline underline-offset-4 hover:text-ink">
            All {words.length} words
          </Link>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface overflow-hidden min-w-0">
          {words.slice(0, 5).map((w) => (
            <li key={w.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 min-w-0">
              <span dir="auto" className="truncate font-semibold text-ink min-w-0">
                {w.text}
              </span>
              <span dir="auto" className="truncate text-muted min-w-0 text-sm sm:text-base">
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
    <div className="grid gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-center gap-2 text-3xl font-bold tabular-nums">
        {icon}
        <span>{value.toLocaleString("en")}</span>
      </dd>
    </div>
  );
}
