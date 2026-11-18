"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchStats,
  fetchWords,
  setDailyGoal,
  setDailyLearningGoals,
  syncUserStreak,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { effectiveStats, localDateString } from "@/lib/dates";
import { formatDueIn, isDue } from "@/lib/format";
import { deriveWordLearningStatus } from "@/lib/fsrs";
import { fetchRecentReviewHistory, type ReviewHistoryRow } from "@/lib/learn-api";
import { getStoredSettings, saveStoredSettings } from "@/lib/settings";
import type { Stats, Word } from "@/lib/schemas";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/StateViews";
import { MasteryDots } from "@/components/MasteryDots";
import { FireIcon } from "@/components/Icons";
import { TranslatorCard } from "@/components/TranslatorCard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

type DashboardData = {
  words: Word[];
  stats: Stats;
  history: ReviewHistoryRow[];
};

async function loadDashboard(): Promise<DashboardData> {
  const [words, stats, history] = await Promise.all([
    fetchWords(),
    fetchStats(),
    fetchRecentReviewHistory(14),
  ]);
  return { words, stats, history };
}

const GOALS = [10, 20, 50, 100] as const;
const NEW_WORD_LIMITS = [3, 5, 10, 15, 20] as const;
const REVIEW_LIMITS = [10, 20, 30, 50] as const;

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
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localDateString(now), [now]);

  const readyData = state.status === "ready" ? state.data : null;
  const currentWords = readyData?.words;
  const currentStats = readyData?.stats;

  const eff = useMemo(() => {
    if (!currentStats || !currentWords) {
      return { streak: 0, todayXp: 0, practicedToday: false };
    }
    return effectiveStats(currentStats, todayStr, currentWords);
  }, [currentStats, todayStr, currentWords]);

  // Reconcile and persist accurate streak to user_stats if word history proved a higher streak
  useEffect(() => {
    if (readyData && currentStats) {
      if (eff.streak >= 2 && eff.practicedToday) {
        void trackEvent("day2_return", { streak: eff.streak });
      }
      if (eff.streak >= 7 && eff.practicedToday) {
        void trackEvent("day7_return", { streak: eff.streak });
      }

      if (eff.streak > currentStats.streak) {
        const targetDate = eff.practicedToday ? todayStr : currentStats.last_practice_date;
        const newBest = Math.max(currentStats.best_streak, eff.streak);
        syncUserStreak(eff.streak, newBest, targetDate).catch(() => {});
        setData({
          words: readyData.words,
          history: readyData.history,
          stats: {
            ...currentStats,
            streak: eff.streak,
            best_streak: newBest,
            last_practice_date: targetDate,
          },
        });
      }
    }
  }, [eff.streak, readyData, currentStats, eff.practicedToday, todayStr, setData]);

  if (state.status === "loading") {
    return (
      <div className="grid min-w-0 max-w-full gap-6 animate-pulse">
        {/* Skeleton Today Card */}
        <div className="apple-card overflow-hidden h-44 bg-surface/50 border border-line flex flex-col justify-between p-5">
          <div className="flex justify-between items-center">
            <div className="h-5 w-24 bg-line/60 rounded-md" />
            <div className="h-4 w-28 bg-line/40 rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="h-7 w-56 bg-line/60 rounded-lg" />
            <div className="h-4 w-72 bg-line/40 rounded-md" />
          </div>
          <div className="h-4 w-40 bg-line/40 rounded-md" />
        </div>
        {/* Skeleton Translator Card */}
        <div className="apple-card overflow-hidden h-56 bg-surface/50 border border-line p-5">
          <div className="h-6 w-36 bg-line/60 rounded-md mb-4" />
          <div className="h-32 w-full bg-line/30 rounded-xl" />
        </div>
        {/* Skeleton Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="apple-card h-20 bg-surface/50 border border-line p-4 space-y-2">
              <div className="h-3 w-16 bg-line/40 rounded" />
              <div className="h-6 w-12 bg-line/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") return <ErrorState message={state.message} onRetry={reload} />;

  const { words, stats, history } = state.data;
  const storedSettings = getStoredSettings();
  const dailyNewGoal = stats.daily_new_words_goal ?? storedSettings.dailyNewWordsGoal ?? 5;
  const dailyReviewsGoal = stats.daily_reviews_goal ?? storedSettings.dailyReviewsGoal ?? 20;

  const dueCount = words.filter((w) => isDue(w.next_review, now)).length;
  const statusCounts = { new: 0, learning: 0, review: 0, mastered: 0 };
  for (const w of words) {
    const st = deriveWordLearningStatus(w);
    statusCounts[st] += 1;
  }
  const mastered = statusCounts.mastered;
  const learningCount = statusCounts.learning + statusCounts.review;
  const newCount = statusCounts.new;

  // Words learned/practiced today (from review_history + words.last_practiced)
  const practicedTodayIds = new Set<string>();
  for (const h of history) {
    if (localDateString(new Date(h.review_date)) === todayStr) {
      practicedTodayIds.add(h.word_id);
    }
  }
  for (const w of words) {
    if (w.last_practiced && localDateString(new Date(w.last_practiced)) === todayStr) {
      practicedTodayIds.add(w.id);
    }
  }
  const wordsLearnedToday = practicedTodayIds.size;

  // Weekly learning activity (last 7 days)
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i), 12, 0, 0);
    const key = localDateString(d);
    const label = d.toLocaleDateString("en", { weekday: "short" });
    const countFromHistory = history.filter(
      (h) => localDateString(new Date(h.review_date)) === key,
    ).length;
    const countFromWords = words.filter(
      (w) => w.last_practiced && localDateString(new Date(w.last_practiced)) === key,
    ).length;
    return { key, label, count: Math.max(countFromHistory, countFromWords) };
  });
  const weeklyMax = Math.max(1, ...weeklyActivity.map((d) => d.count));

  const totalCorrect = words.reduce((sum, w) => sum + (w.correct_count || 0), 0);
  const totalWrong = words.reduce((sum, w) => sum + (w.wrong_count || 0), 0);
  const totalReviews = totalCorrect + totalWrong;
  const accuracyPct = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : null;
  const troubleWords = [...words]
    .filter((w) => w.wrong_count > 0)
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 5);
  const nextDue = words
    .map((w) => w.next_review)
    .filter((t) => !isDue(t, now))
    .sort()[0];
  const goalPct = Math.min(100, Math.round((eff.todayXp / stats.daily_goal) * 100));

  async function changeGoal(goal: number) {
    setGoalError(null);
    try {
      await setDailyGoal(goal);
      setData({ words, history, stats: { ...stats, daily_goal: goal } });
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : "Could not save your goal.");
    }
  }

  async function changeSessionGoals(nextNew: number, nextReviews: number) {
    saveStoredSettings({ dailyNewWordsGoal: nextNew, dailyReviewsGoal: nextReviews });
    setData({
      words,
      history,
      stats: {
        ...stats,
        daily_new_words_goal: nextNew,
        daily_reviews_goal: nextReviews,
      },
    });
    await setDailyLearningGoals(nextNew, nextReviews);
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
      {/* 0. Onboarding Checklist for Activation */}
      <OnboardingChecklist words={words} />

      {/* 1. Today's Practice Card - FIRST for habit reinforcement */}
      <section aria-labelledby="today" className="apple-card overflow-hidden w-full min-w-0 transition-all">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-line/60 bg-black/[0.02] dark:bg-white/[0.03] px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
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
                  {eff.streak}-day streak
                </span>
              </>
            ) : (
              <span className="text-muted text-xs">No streak yet</span>
            )}
          </span>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-start space-y-1 max-w-lg">
            <h3 className="text-xl sm:text-3xl font-extrabold tracking-tight text-ink">
              {words.length === 0 ? (
                "Start building your vocabulary"
              ) : dueCount > 0 ? (
                <>
                  <span className="text-ink font-black underline decoration-subtitle decoration-4 underline-offset-4">{dueCount}</span> {dueCount === 1 ? "word is" : "words are"} ready
                </>
              ) : (
                "You're all caught up"
              )}
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {words.length === 0
                ? "Translate words below or tap subtitles on YouTube & Netflix to start learning."
                : dueCount > 0
                ? eff.practicedToday
                  ? "Streak maintained today! Keep practicing anytime to reinforce more words."
                  : "Review your words now to reinforce your memory and maintain your streak."
                : nextDue
                ? `Next review ${formatDueIn(nextDue, now)}. Keep up the momentum!`
                : "You have reviewed all available words. Great job!"}
            </p>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex items-center justify-start sm:justify-end">
            <Link
              href={words.length === 0 ? "/extension" : "/practice"}
              className="btn btn-primary w-full sm:w-auto text-center justify-center min-h-11 px-6 text-sm sm:text-base font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 bg-black/[0.02] dark:bg-white/[0.03] px-4 sm:px-5 py-2.5 text-xs sm:text-sm">
          <span className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-muted font-medium whitespace-nowrap">
              <strong className="text-ink font-semibold">{eff.todayXp}</strong> of {stats.daily_goal} XP today
            </span>
            <span
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={goalPct}
              className="h-2 flex-1 min-w-16 max-w-36 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            >
              <span className="block h-full bg-subtitle rounded-full transition-all duration-300" style={{ width: `${goalPct}%` }} />
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted">Daily goal</span>
            <GoalDropdown
              value={stats.daily_goal}
              onChange={(goal) => void changeGoal(goal)}
            />
          </div>
        </div>
      </section>

      {/* 2. Google Translate Component SECOND */}
      <TranslatorCard existingWords={words} onWordSaved={refreshDataQuietly} />

      {words.length === 0 ? (
        <section className="apple-card p-6 bg-surface border border-line">
          <h4 className="text-base font-bold text-ink mb-3">How WordTap works</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtitle/20 font-bold text-ink">1</span>
              <div>
                <strong className="text-ink block mb-0.5">Watch videos</strong>
                <span className="text-muted leading-relaxed">Turn on subtitles on YouTube, Netflix, or web videos.</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtitle/20 font-bold text-ink">2</span>
              <div>
                <strong className="text-ink block mb-0.5">Tap to translate</strong>
                <span className="text-muted leading-relaxed">Click any word to get instant translation and hear its native pronunciation.</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtitle/20 font-bold text-ink">3</span>
              <div>
                <strong className="text-ink block mb-0.5">Review in context</strong>
                <span className="text-muted leading-relaxed">Spaced repetition reviews the exact subtitle sentences until mastered.</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {goalError ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-bad">
          {goalError}
        </p>
      ) : null}

      {/* 3. Key Vocabulary Metrics */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 min-w-0">
        <Stat label="Total words" value={words.length} />
        <Stat label="Learned today" value={wordsLearnedToday} />
        <Stat label="Due for review" value={dueCount} />
        <Stat label="Learning" value={learningCount} />
        <Stat label="Mastered" value={mastered} />
        <div className="apple-card p-3 sm:p-4 flex flex-col justify-between gap-1 shadow-2xs min-w-0">
          <dt className="text-xs font-medium text-muted truncate">Retention</dt>
          <dd className="text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
            {accuracyPct !== null ? `${accuracyPct}%` : "—"}
          </dd>
        </div>
      </dl>

      {/* Daily Learning Session Configurator + Weekly Activity */}
      {words.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] min-w-0">
          <section aria-label="Daily learning session" className="apple-card p-5 grid gap-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Daily Learning Session</h2>
                <p className="text-xs text-muted">
                  Strict sequential learning for new words, separate spaced review for due words
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/practice?mode=learn"
                  className="btn btn-primary min-h-9 px-4 py-1.5 text-xs font-bold shrink-0"
                >
                  Learn new words
                </Link>
                <Link
                  href="/practice?mode=review"
                  className="btn min-h-9 px-3.5 py-1.5 text-xs font-semibold shrink-0"
                >
                  Spaced review ({dueCount})
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-black/[0.015] dark:bg-white/[0.025] p-3 grid gap-2">
                <span className="text-xs font-semibold text-ink">New words / day</span>
                <div className="flex flex-wrap gap-1.5">
                  {NEW_WORD_LIMITS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => void changeSessionGoals(n, dailyReviewsGoal)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition-all cursor-pointer ${
                        dailyNewGoal === n
                          ? "bg-subtitle text-subtitle-ink shadow-2xs"
                          : "bg-surface border border-line text-muted hover:text-ink"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-black/[0.015] dark:bg-white/[0.025] p-3 grid gap-2">
                <span className="text-xs font-semibold text-ink">Reviews / day</span>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_LIMITS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => void changeSessionGoals(dailyNewGoal, r)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition-all cursor-pointer ${
                        dailyReviewsGoal === r
                          ? "bg-subtitle text-subtitle-ink shadow-2xs"
                          : "bg-surface border border-line text-muted hover:text-ink"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Weekly learning activity" className="apple-card p-5 grid gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Weekly Activity</h2>
                <p className="text-xs text-muted">Reviews &amp; exercises completed over the last 7 days</p>
              </div>
              <span className="text-xs font-bold text-ink tabular-nums">
                {weeklyActivity.reduce((s, d) => s + d.count, 0)} total
              </span>
            </div>

            <div className="grid grid-cols-7 items-end gap-2 h-24 pt-2">
              {weeklyActivity.map((day) => {
                const heightPct = day.count === 0 ? 8 : Math.max(16, Math.round((day.count / weeklyMax) * 100));
                const isToday = day.key === todayStr;
                return (
                  <div key={day.key} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-bold text-muted tabular-nums">
                      {day.count > 0 ? day.count : ""}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        title={`${day.label}: ${day.count} reviews`}
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-7 rounded-t-lg transition-all ${
                          day.count > 0
                            ? isToday
                              ? "bg-subtitle"
                              : "bg-ok/75"
                            : "bg-black/8 dark:bg-white/10"
                        }`}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isToday ? "text-ink font-bold" : "text-muted"}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {/* Mastery Breakdown & Tricky Words */}
      {words.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] min-w-0">
          <section aria-label="Mastery breakdown" className="apple-card p-5 grid gap-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Learning Progress Over Time</h2>
                <p className="text-xs text-muted">
                  {accuracyPct !== null
                    ? `${accuracyPct}% retention across ${totalReviews} reviews`
                    : "Complete reviews to unlock retention stats"}
                </p>
              </div>
              <Link
                href="/practice?mode=learn"
                className="btn min-h-8 px-3 py-1 text-xs font-semibold"
              >
                Learn new words
              </Link>
            </div>

            <div className="h-2.5 w-full rounded-full overflow-hidden bg-black/5 dark:bg-white/10 flex">
              {statusCounts.mastered > 0 ? (
                <div
                  className="bg-ok h-full transition-all"
                  style={{ width: `${Math.round((statusCounts.mastered / words.length) * 100)}%` }}
                  title={`${statusCounts.mastered} mastered`}
                />
              ) : null}
              {statusCounts.review > 0 ? (
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${Math.round((statusCounts.review / words.length) * 100)}%` }}
                  title={`${statusCounts.review} in review`}
                />
              ) : null}
              {statusCounts.learning > 0 ? (
                <div
                  className="bg-subtitle h-full transition-all"
                  style={{ width: `${Math.round((statusCounts.learning / words.length) * 100)}%` }}
                  title={`${statusCounts.learning} learning`}
                />
              ) : null}
              {newCount > 0 ? (
                <div
                  className="bg-muted/35 h-full transition-all"
                  style={{ width: `${Math.round((newCount / words.length) * 100)}%` }}
                  title={`${newCount} new`}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ok" />
                <span>Mastered ({statusCounts.mastered})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Review ({statusCounts.review})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-subtitle" />
                <span>Learning ({statusCounts.learning})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted/40" />
                <span>New ({newCount})</span>
              </span>
            </div>
          </section>

          <section aria-label="Tricky words" className="apple-card p-5 grid gap-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Tricky words</h2>
                <p className="text-xs text-muted">Most missed during review</p>
              </div>
              {troubleWords.length > 0 ? (
                <Link
                  href="/practice?mode=missed"
                  className="btn btn-primary min-h-8 px-3 py-1 text-xs font-semibold shrink-0"
                >
                  Drill ({troubleWords.length})
                </Link>
              ) : null}
            </div>

            {troubleWords.length === 0 ? (
              <p className="text-xs text-muted py-2">
                No missed words yet. Tricky words you miss during sessions will appear here for focused drills.
              </p>
            ) : (
              <ul className="divide-y divide-line/40 text-xs">
                {troubleWords.map((tw) => (
                  <li key={tw.id} className="flex items-center justify-between gap-3 py-1.5 min-w-0">
                    <span dir="auto" className="font-semibold text-ink truncate">
                      {tw.text}
                    </span>
                    <span className="shrink-0 text-bad font-semibold tabular-nums">
                      {tw.wrong_count} {tw.wrong_count === 1 ? "miss" : "misses"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {/* 4. Latest Words */}
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
    <div className="apple-card p-3 sm:p-4 flex flex-col justify-between gap-1 shadow-2xs min-w-0">
      <dt className="text-xs font-medium text-muted truncate">{label}</dt>
      <dd className="flex items-center gap-1.5 sm:gap-2 text-xl sm:text-2xl font-bold tracking-tight text-ink tabular-nums">
        {icon}
        <span className="truncate">{value.toLocaleString("en")}</span>
      </dd>
    </div>
  );
}
