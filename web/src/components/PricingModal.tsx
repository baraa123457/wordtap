"use client";

import { useState } from "react";
import Link from "next/link";
import {
  activateSubscription,
  formatPrice,
  PRICING_PLANS,
  type PricingCurrency,
} from "@/lib/subscription";
import { CheckIcon, StarIcon } from "@/components/Icons";

export function PricingModal({
  isOpen,
  onClose,
  reason = "Unlock Unlimited Practice",
}: {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}) {
  const [currency] = useState<PricingCurrency>("USD");
  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  if (!isOpen) return null;

  const plan = PRICING_PLANS[currency];

  const handleQuickUpgrade = async () => {
    setUpgrading(true);
    try {
      await activateSubscription({
        tier: "pro",
        currency,
        interval: "yearly",
      });
      setUpgraded(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      // ignore
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="apple-card relative flex w-full max-w-md flex-col overflow-hidden p-6 sm:p-7 shadow-2xl border-2 border-subtitle"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink text-base cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex flex-col gap-4 text-center">
          <div className="inline-flex self-center items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3 py-0.5 text-xs font-bold text-ink">
            <StarIcon size={12} filled className="text-amber-600 dark:text-subtitle" />
            <span>WordTap Fluency Pass</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-ink">{reason}</h2>
            <p className="text-xs text-muted leading-relaxed">
              Accelerate your English with unlimited video reviews, TV show decks, and real-time AI sentence coaching.
            </p>
          </div>

          <div className="rounded-2xl bg-surface border border-line p-4 space-y-2.5 text-left text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <StarIcon size={14} filled className="text-subtitle shrink-0" />
              <span><strong>Unlimited</strong> daily word reviews &amp; FSRS scheduling</span>
            </div>
            <div className="flex items-center gap-2">
              <StarIcon size={14} filled className="text-subtitle shrink-0" />
              <span><strong>Unlimited</strong> subtitle word tapping (YouTube &amp; Netflix)</span>
            </div>
            <div className="flex items-center gap-2">
              <StarIcon size={14} filled className="text-subtitle shrink-0" />
              <span>AI Grammar Evaluation &amp; Naturalness Coaching</span>
            </div>
            <div className="flex items-center gap-2">
              <StarIcon size={14} filled className="text-subtitle shrink-0" />
              <span>Data-Saver Audio-First Mode &amp; High-Definition Playback</span>
            </div>
          </div>

          {upgraded ? (
            <div className="rounded-xl bg-ok/15 border border-ok/30 py-3 text-sm font-bold text-ok-ink animate-in fade-in flex items-center justify-center gap-2">
              <CheckIcon size={16} className="text-ok" />
              <span>Pro Fluency Pass Activated!</span>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={upgrading}
                onClick={() => void handleQuickUpgrade()}
                className="btn btn-primary w-full min-h-11 text-sm font-bold justify-center cursor-pointer shadow-xs"
              >
                {upgrading
                  ? "Activating Pro…"
                  : `Upgrade Now (${formatPrice(plan.yearlyMonthlyEquivalent, currency).display}/mo)`}
              </button>
              <Link
                href="/pricing"
                onClick={onClose}
                className="block text-xs font-semibold text-subtitle hover:underline"
              >
                View all pricing plans &amp; currencies →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
