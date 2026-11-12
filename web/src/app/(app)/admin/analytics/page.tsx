"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { RequireAuth } from "@/components/RequireAuth";
import { LoadingState } from "@/components/StateViews";

type FunnelCounts = {
  signups: number;
  extensionConnected: number;
  firstWordSaved: number;
  firstPracticeCompleted: number;
  day2Return: number;
  day7Return: number;
  activePracticers3Days: number;
};

export default function AdminAnalyticsPage() {
  return (
    <RequireAuth>
      <AdminAnalyticsContent />
    </RequireAuth>
  );
}

function AdminAnalyticsContent() {
  const [counts, setCounts] = useState<FunnelCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFunnel() {
      try {
        setLoading(true);
        const supabase = getSupabase();

        // Query real aggregated counts from public.analytics_events
        const { data, error: queryError } = await supabase
          .from("analytics_events")
          .select("event_name, user_id, created_at");

        if (queryError) {
          throw new Error(queryError.message);
        }

        const events = data || [];
        const countByEvent: Record<string, number> = {
          signup: 0,
          extension_connected: 0,
          first_word_saved: 0,
          first_practice_completed: 0,
          day2_return: 0,
          day7_return: 0,
        };

        const practiceDaysByUser = new Map<string, Set<string>>();

        for (const ev of events) {
          if (countByEvent[ev.event_name] !== undefined) {
            countByEvent[ev.event_name]++;
          }
          if (ev.event_name === "first_practice_completed" || ev.event_name === "day2_return" || ev.event_name === "day7_return") {
            const dateStr = new Date(ev.created_at).toISOString().slice(0, 10);
            if (!practiceDaysByUser.has(ev.user_id)) {
              practiceDaysByUser.set(ev.user_id, new Set());
            }
            practiceDaysByUser.get(ev.user_id)!.add(dateStr);
          }
        }

        let usersWith3PlusDays = 0;
        for (const days of practiceDaysByUser.values()) {
          if (days.size >= 3) usersWith3PlusDays++;
        }

        setCounts({
          signups: countByEvent.signup,
          extensionConnected: countByEvent.extension_connected,
          firstWordSaved: countByEvent.first_word_saved,
          firstPracticeCompleted: countByEvent.first_practice_completed,
          day2Return: countByEvent.day2_return,
          day7Return: countByEvent.day7_return,
          activePracticers3Days: usersWith3PlusDays,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
      } finally {
        setLoading(false);
      }
    }

    loadFunnel();
  }, []);

  if (loading) return <LoadingState label="Loading analytics funnel…" />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-center justify-between border-b border-line/60 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-subtitle">Admin Overview</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">WordTap Activation &amp; Funnel</h1>
        </div>
        <Link href="/dashboard" className="btn btn-quiet text-xs font-semibold">
          ← Back to Dashboard
        </Link>
      </div>

      {error ? (
        <div className="apple-card p-6 border-2 border-bad/30 bg-bad-soft/30 space-y-2">
          <h2 className="text-base font-bold text-bad">Analytics Migration Note</h2>
          <p className="text-xs sm:text-sm text-ink leading-relaxed">
            {error}
          </p>
          <p className="text-xs text-muted">
            Run migration <code className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">007_analytics_events.sql</code> in your Supabase SQL Editor to activate live funnel logging.
          </p>
        </div>
      ) : counts ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="apple-card p-5 space-y-1">
              <span className="text-xs font-semibold text-muted">Total Signups</span>
              <div className="text-3xl font-extrabold text-ink">{counts.signups}</div>
            </div>
            <div className="apple-card p-5 space-y-1">
              <span className="text-xs font-semibold text-muted">Extension Connected</span>
              <div className="text-3xl font-extrabold text-ink">{counts.extensionConnected}</div>
            </div>
            <div className="apple-card p-5 space-y-1">
              <span className="text-xs font-semibold text-muted">First Word Saved</span>
              <div className="text-3xl font-extrabold text-ink">{counts.firstWordSaved}</div>
            </div>
          </div>

          <div className="apple-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink">Retention &amp; Habit Formation</h2>
            <div className="divide-y divide-line/40 text-sm">
              <div className="py-3 flex items-center justify-between">
                <span className="text-muted">First practice session completed:</span>
                <span className="font-bold text-ink">{counts.firstPracticeCompleted}</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-muted">Day-2 return:</span>
                <span className="font-bold text-ink">{counts.day2Return}</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-muted">Day-7 return:</span>
                <span className="font-bold text-ink">{counts.day7Return}</span>
              </div>
              <div className="py-3 flex items-center justify-between bg-subtitle/10 -mx-6 px-6 rounded-b-xl border-t border-subtitle/30">
                <span className="font-semibold text-ink">Learners practicing on 3+ distinct days:</span>
                <span className="font-extrabold text-subtitle text-base">{counts.activePracticers3Days}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
