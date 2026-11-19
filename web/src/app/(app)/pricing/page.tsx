"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  activateSubscription,
  formatPrice,
  getUserSubscription,
  PRICING_PLANS,
  type BillingInterval,
  type PricingCurrency,
  type UserSubscription,
} from "@/lib/subscription";
import {
  CheckIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/Icons";

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("yearly");
  const [currency, setCurrency] = useState<PricingCurrency>("USD");
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void getUserSubscription().then(setSubscription);
  }, []);

  const plan = PRICING_PLANS[currency];
  const currentPrice = interval === "yearly" ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice;
  const formattedMonthlyPrice = formatPrice(currentPrice, currency);
  const formattedYearlyTotal = formatPrice(plan.yearlyPrice, currency);

  const billedPeriodText =
    interval === "yearly"
      ? `billed annually at ${formattedYearlyTotal.display} / year`
      : `billed monthly`;

  const handleUpgrade = async () => {
    setUpgrading(true);
    setSuccessMessage(null);
    try {
      await activateSubscription({
        tier: "pro",
        currency,
        interval,
      });
      const updated = await getUserSubscription();
      setSubscription(updated);
      setSuccessMessage("🎉 Welcome to WordTap Pro! Your unlimited fluency pass is now active.");
    } catch {
      // ignore
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-subtitle/20 border border-subtitle/30 px-3.5 py-1 text-xs font-bold text-ink">
          <SparklesIcon size={14} className="text-amber-800 dark:text-subtitle" />
          <span>WordTap Fluency Pass</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-ink max-w-2xl">
          Speak English Like the Shows You Watch
        </h1>
        <p className="max-w-xl text-sm sm:text-base text-muted">
          Master vocabulary 4x faster with authentic video context, native pronunciation, and unlimited AI sentence coaching.
        </p>

        {/* Currency Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <span className="text-xs font-semibold text-muted">Currency &amp; Region:</span>
          {(["USD", "SAR", "EGP"] as PricingCurrency[]).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => setCurrency(curr)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${
                currency === curr
                  ? "bg-subtitle text-white shadow-xs"
                  : "bg-surface border border-line text-muted hover:text-ink"
              }`}
            >
              {curr} ({PRICING_PLANS[curr].symbol})
            </button>
          ))}
        </div>

        {/* Billing Interval Switcher */}
        <div className="apple-segmented-container mx-auto mt-2 inline-flex items-center p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            data-active={interval === "monthly" ? "true" : undefined}
            className="apple-segmented-item px-4 py-1.5 text-xs sm:text-sm font-bold cursor-pointer"
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            data-active={interval === "yearly" ? "true" : undefined}
            className="apple-segmented-item px-4 py-1.5 text-xs sm:text-sm font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Annual</span>
            <span className="rounded-full bg-subtitle/20 px-1.5 py-0.2 text-[10px] font-extrabold text-amber-900 dark:text-subtitle">
              Save {plan.savingsPercent}%
            </span>
          </button>
        </div>
      </div>

      {successMessage ? (
        <div className="mx-auto w-full max-w-md rounded-2xl bg-ok/15 border border-ok/30 p-4 text-center text-sm font-bold text-ok-ink animate-in fade-in">
          {successMessage}
        </div>
      ) : null}

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto w-full">
        {/* Free Plan */}
        <div className="apple-card flex flex-col justify-between p-6 sm:p-8 border border-line shadow-xs">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink">Explorer</h2>
              <p className="text-xs text-muted mt-1">For casual learners testing the waters.</p>
            </div>
            <div className="text-3xl font-extrabold text-ink">
              Free <span className="text-xs font-normal text-muted">forever</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-ink pt-2">
              <li className="flex items-center gap-2">
                <CheckIcon size={14} className="text-ok shrink-0" />
                <span>Up to 5 subtitle word captures per day</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon size={14} className="text-ok shrink-0" />
                <span>15 daily practice reviews</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon size={14} className="text-ok shrink-0" />
                <span>4-stage smart learning method</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon size={14} className="text-ok shrink-0" />
                <span>Community word cache &amp; dictionary meanings</span>
              </li>
              <li className="flex items-center gap-2 text-muted">
                <span className="opacity-40 text-xs px-1">✕</span>
                <span>Unlimited TV show decks import</span>
              </li>
              <li className="flex items-center gap-2 text-muted">
                <span className="opacity-40 text-xs px-1">✕</span>
                <span>Export to Anki with video audio</span>
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-6 border-t border-line">
            <Link
              href="/practice"
              className="btn btn-quiet w-full min-h-11 text-xs font-bold justify-center"
            >
              Continue with Free
            </Link>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="apple-card relative flex flex-col justify-between p-6 sm:p-8 border-2 border-subtitle shadow-md bg-gradient-to-b from-subtitle/10 via-transparent to-transparent">
          <div className="absolute -top-3 right-6 rounded-full bg-subtitle px-3 py-0.5 text-[11px] font-extrabold text-white uppercase tracking-wider shadow-xs">
            Most Popular
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink flex items-center gap-1.5">
                <span>Fluency Pass</span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold rounded-full bg-subtitle/20 text-amber-900 dark:text-subtitle px-2 py-0.5 border border-subtitle/40">
                  <StarIcon size={11} filled className="text-subtitle" /> Pro
                </span>
              </h2>
              <p className="text-xs text-muted mt-1">
                Fast-track your fluency with zero limits.
              </p>
            </div>

            <div className="py-1">
              <div className="flex items-baseline gap-1.5 text-ink" dir="ltr">
                {formattedMonthlyPrice.isSymbolPrefix ? (
                  <>
                    <span className="text-xl sm:text-2xl font-bold text-muted select-none">
                      {formattedMonthlyPrice.symbol}
                    </span>
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      {formattedMonthlyPrice.amount}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                      {formattedMonthlyPrice.amount}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-muted select-none">
                      {formattedMonthlyPrice.symbol}
                    </span>
                  </>
                )}
                <span className="text-xs font-medium text-muted ml-0.5 self-baseline">/ month</span>
              </div>
              <p className="text-xs text-muted mt-2 leading-relaxed">{billedPeriodText}</p>
            </div>

            <ul className="space-y-2.5 text-xs sm:text-sm text-ink pt-2">
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span><strong>Unlimited</strong> subtitle captures on YouTube &amp; Netflix</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span><strong>Unlimited</strong> daily practice reviews &amp; FSRS spaced repetition</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span>Real-time AI sentence evaluation &amp; grammar polish</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span>High-definition video player (720p/1080p) + Data Saver</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span>Unlimited import of Curated Show &amp; Career Decks</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <StarIcon size={14} filled className="text-subtitle shrink-0" />
                <span>Export to Anki with video audio clips</span>
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-6 border-t border-line space-y-3">
            {subscription?.isPro ? (
              <div className="rounded-xl bg-ok/15 border border-ok/30 py-3 text-center text-xs font-bold text-ok-ink">
                ✓ You are actively subscribed to Pro
              </div>
            ) : (
              <button
                type="button"
                disabled={upgrading}
                onClick={() => void handleUpgrade()}
                className="btn btn-primary w-full min-h-12 text-sm font-extrabold justify-center cursor-pointer shadow-sm"
              >
                {upgrading ? "Activating Fluency Pass…" : `Upgrade to Pro — ${formattedMonthlyPrice.display}/mo`}
              </button>
            )}

            {/* Localized payment methods */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted">
              <span>Accepted:</span>
              {plan.paymentBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded bg-surface border border-line px-1.5 py-0.5 font-medium text-ink"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="max-w-2xl mx-auto w-full pt-6 space-y-4">
        <h3 className="text-lg font-bold text-ink text-center">Frequently Asked Questions</h3>
        <div className="divide-y divide-line/60 rounded-2xl border border-line bg-surface p-4 sm:p-6 text-xs sm:text-sm space-y-3">
          <div className="pt-3 first:pt-0 space-y-1">
            <h4 className="font-bold text-ink">Can I cancel anytime?</h4>
            <p className="text-muted leading-relaxed">
              Yes, absolutely. You can cancel your subscription at any time with a single click in Settings. You will retain Pro access until the end of your billing cycle.
            </p>
          </div>
          <div className="pt-3 space-y-1">
            <h4 className="font-bold text-ink">Do I need a Netflix or YouTube subscription?</h4>
            <p className="text-muted leading-relaxed">
              WordTap integrates with standard YouTube videos and Netflix subtitles. You do not need any special account; you can also practice directly from our curated show decks without any external accounts!
            </p>
          </div>
          <div className="pt-3 space-y-1">
            <h4 className="font-bold text-ink">How does the 4-stage method work?</h4>
            <p className="text-muted leading-relaxed">
              Instead of passive memorization, WordTap trains 1) Understanding, 2) Contextual Video listening, 3) Sentence Creation with AI feedback, and 4) Spaced Repetition (FSRS) to lock words permanently into long-term memory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
