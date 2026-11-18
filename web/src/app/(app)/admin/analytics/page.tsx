"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { LoadingState } from "@/components/StateViews";
import { useAuth } from "@/context/AuthContext";

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
  return <AdminAnalyticsContent />;
}

function AccessDeniedView() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="apple-card w-full p-8 border-2 border-bad/30 bg-bad-soft/20 space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bad/10 text-bad">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-bad">403 — Forbidden</span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Admin Privileges Required</h1>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Your account does not have administrator privileges to view system-wide funnel analytics.
          Access to this dashboard is strictly restricted to accounts with the <code className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-ink">admin</code> role.
        </p>
        <div className="pt-2">
          <Link href="/dashboard" className="btn btn-primary inline-flex text-sm font-semibold">
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminAnalyticsContent() {
  const { state } = useAuth();
  const [counts, setCounts] = useState<FunnelCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Authorize only users whose app_metadata.role is "admin"
  const user = state.status === "signed-in" ? state.user : null;
  const isAdmin = user?.app_metadata?.role === "admin";

  useEffect(() => {
    // If auth state is determined and user is not admin, deny immediately
    if (state.status === "signed-in" && !isAdmin) {
      setIsForbidden(true);
      setLoading(false);
      return;
    }

    if (state.status !== "signed-in") {
      return;
    }

    async function loadFunnel() {
      try {
        setLoading(true);
        const supabase = getSupabase();

        // 1. Try aggregated security definer RPC first (migration 008/009)
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_funnel_analytics");

        if (rpcError) {
          // If server reports unauthorized or permission denied (42501), block access
          if (
            rpcError.code === "42501" ||
            rpcError.message.toLowerCase().includes("denied") ||
            rpcError.message.toLowerCase().includes("privilege")
          ) {
            setIsForbidden(true);
            return;
          }
          throw new Error(rpcError.message);
        }

        if (rpcData && typeof rpcData === "object") {
          const res = rpcData as Partial<FunnelCounts>;
          setCounts({
            signups: Number(res.signups || 0),
            extensionConnected: Number(res.extensionConnected || 0),
            firstWordSaved: Number(res.firstWordSaved || 0),
            firstPracticeCompleted: Number(res.firstPracticeCompleted || 0),
            day2Return: Number(res.day2Return || 0),
            day7Return: Number(res.day7Return || 0),
            activePracticers3Days: Number(res.activePracticers3Days || 0),
          });
          return;
        }

        throw new Error("Invalid analytics response format");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
      } finally {
        setLoading(false);
      }
    }

    loadFunnel();
  }, [state.status, isAdmin]);

  if (loading) return <LoadingState label="Verifying admin credentials and loading funnel…" />;

  if (isForbidden) {
    return <AccessDeniedView />;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-subtitle">Admin Overview</span>
          <h1 className="text-xl sm:text-3xl font-extrabold text-ink">WordTap Activation &amp; Funnel</h1>
        </div>
        <Link href="/dashboard" className="btn btn-quiet text-xs font-semibold self-start sm:self-auto">
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
            Ensure migration <code className="font-mono bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">009_security_hardening.sql</code> has been applied to Supabase.
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
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-muted">First practice session completed:</span>
                <span className="font-bold text-ink shrink-0 tabular-nums">{counts.firstPracticeCompleted}</span>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-muted">Day-2 return:</span>
                <span className="font-bold text-ink shrink-0 tabular-nums">{counts.day2Return}</span>
              </div>
              <div className="py-3 flex items-center justify-between gap-3">
                <span className="text-muted">Day-7 return:</span>
                <span className="font-bold text-ink shrink-0 tabular-nums">{counts.day7Return}</span>
              </div>
              <div className="py-3 flex items-center justify-between gap-3 bg-subtitle/10 -mx-6 px-6 rounded-b-xl border-t border-subtitle/30">
                <span className="font-semibold text-ink">Learners practicing on 3+ distinct days:</span>
                <span className="font-extrabold text-amber-700 dark:text-subtitle text-base shrink-0 tabular-nums">{counts.activePracticers3Days}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
