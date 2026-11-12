"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Word } from "@/lib/schemas";

export function OnboardingChecklist({ words }: { words: Word[] }) {
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed previously
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("wordtap_onboarding_dismissed");
      if (isDismissed === "true") setDismissed(true);
    }

    // Ping WordTap extension runtime if present
    if (typeof window !== "undefined") {
      const globalChrome = (window as unknown as { chrome?: { runtime?: { sendMessage?: unknown } } }).chrome;
      if (globalChrome?.runtime?.sendMessage) {
        try {
          const extFlag = localStorage.getItem("wordtap_extension_connected");
          if (extFlag) setExtensionConnected(true);
        } catch {
          // safe
        }
      }
    }
  }, []);

  const hasWords = words.length > 0;
  // If user already saved words, steps 1, 2, and 3 are automatically complete!
  const isExtensionInstalled = extensionConnected || hasWords;
  const isExtensionSignedIn = extensionConnected || hasWords;
  const isWordSaved = hasWords;

  const completedCount = (isExtensionInstalled ? 1 : 0) + (isExtensionSignedIn ? 1 : 0) + (isWordSaved ? 1 : 0);

  if (dismissed || completedCount === 3) {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("wordtap_onboarding_dismissed", "true");
    }
  }

  return (
    <div className="apple-card p-5 sm:p-6 border-2 border-subtitle/40 bg-surface space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-subtitle animate-pulse" />
          <h2 className="text-base font-extrabold text-ink">Getting Started with WordTap</h2>
          <span className="text-xs font-bold text-subtitle bg-subtitle/15 px-2 py-0.5 rounded-full">
            {completedCount} of 3 done
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-muted hover:text-ink cursor-pointer"
        >
          Dismiss
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Step 1 */}
        <div className={`p-4 rounded-xl border ${isExtensionInstalled ? "border-ok/40 bg-ok-soft/20" : "border-line bg-surface/50"}`}>
          <div className="flex items-center gap-2 font-bold text-sm text-ink mb-1">
            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${isExtensionInstalled ? "bg-ok text-white" : "bg-line text-muted"}`}>
              {isExtensionInstalled ? "✓" : "1"}
            </span>
            <span>Install Extension</span>
          </div>
          <p className="text-xs text-muted mb-2">
            Add WordTap to Chrome or Edge to tap subtitle words.
          </p>
          {!isExtensionInstalled && (
            <Link href="/extension" className="text-xs font-bold text-subtitle underline">
              Download extension →
            </Link>
          )}
        </div>

        {/* Step 2 */}
        <div className={`p-4 rounded-xl border ${isExtensionSignedIn ? "border-ok/40 bg-ok-soft/20" : "border-line bg-surface/50"}`}>
          <div className="flex items-center gap-2 font-bold text-sm text-ink mb-1">
            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${isExtensionSignedIn ? "bg-ok text-white" : "bg-line text-muted"}`}>
              {isExtensionSignedIn ? "✓" : "2"}
            </span>
            <span>Sign in from popup</span>
          </div>
          <p className="text-xs text-muted">
            Click the puzzle icon in your browser toolbar to log in.
          </p>
        </div>

        {/* Step 3 */}
        <div className={`p-4 rounded-xl border ${isWordSaved ? "border-ok/40 bg-ok-soft/20" : "border-line bg-surface/50"}`}>
          <div className="flex items-center gap-2 font-bold text-sm text-ink mb-1">
            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${isWordSaved ? "bg-ok text-white" : "bg-line text-muted"}`}>
              {isWordSaved ? "✓" : "3"}
            </span>
            <span>Save your first word</span>
          </div>
          <p className="text-xs text-muted">
            Open YouTube or Netflix, turn on captions, and tap any word!
          </p>
        </div>
      </div>
    </div>
  );
}
