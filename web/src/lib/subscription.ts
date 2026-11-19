import { getSupabase } from "./supabase";

export type SubscriptionTier = "free" | "pro" | "team";
export type BillingInterval = "monthly" | "yearly";
export type PricingCurrency = "USD" | "SAR" | "EGP";

export type UserSubscription = {
  tier: SubscriptionTier;
  status: "active" | "canceled" | "past_due" | "trialing";
  currency: PricingCurrency;
  billingInterval: BillingInterval;
  currentPeriodEnd: string | null;
  dailyCapturesCount: number;
  dailyReviewsCount: number;
  dailyCapturesLimit: number;
  dailyReviewsLimit: number;
  isPro: boolean;
};

export const PRICING_PLANS: Record<
  PricingCurrency,
  {
    symbol: string;
    currencyCode: PricingCurrency;
    monthlyPrice: number;
    yearlyPrice: number;
    yearlyMonthlyEquivalent: number;
    savingsPercent: number;
    countryLabel: string;
    paymentBadges: string[];
  }
> = {
  USD: {
    symbol: "$",
    currencyCode: "USD",
    monthlyPrice: 7.99,
    yearlyPrice: 59,
    yearlyMonthlyEquivalent: 4.91,
    savingsPercent: 38,
    countryLabel: "Global / International",
    paymentBadges: ["Apple Pay", "Credit Card", "Google Pay"],
  },
  SAR: {
    symbol: "ر.س",
    currencyCode: "SAR",
    monthlyPrice: 29.99,
    yearlyPrice: 225,
    yearlyMonthlyEquivalent: 18.75,
    savingsPercent: 38,
    countryLabel: "Saudi Arabia & GCC",
    paymentBadges: ["Mada", "Apple Pay", "Credit Card"],
  },
  EGP: {
    symbol: "ج.م",
    currencyCode: "EGP",
    monthlyPrice: 149,
    yearlyPrice: 999,
    yearlyMonthlyEquivalent: 83.25,
    savingsPercent: 44,
    countryLabel: "Egypt & North Africa (PPP Discount)",
    paymentBadges: ["Fawry", "Vodafone Cash", "Meeza", "InstaPay"],
  },
};

export const FREE_LIMITS = {
  dailyCaptures: 5,
  dailyReviews: 15,
};

const LOCAL_SUB_KEY = "wordtap_local_subscription";

export function getLocalSubscription(): UserSubscription {
  if (typeof window === "undefined") {
    return {
      tier: "free",
      status: "active",
      currency: "USD",
      billingInterval: "monthly",
      currentPeriodEnd: null,
      dailyCapturesCount: 0,
      dailyReviewsCount: 0,
      dailyCapturesLimit: FREE_LIMITS.dailyCaptures,
      dailyReviewsLimit: FREE_LIMITS.dailyReviews,
      isPro: false,
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_SUB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          tier: parsed.tier || "free",
          status: parsed.status || "active",
          currency: parsed.currency || "USD",
          billingInterval: parsed.billingInterval || "monthly",
          currentPeriodEnd: parsed.currentPeriodEnd || null,
          dailyCapturesCount: Number(parsed.dailyCapturesCount) || 0,
          dailyReviewsCount: Number(parsed.dailyReviewsCount) || 0,
          dailyCapturesLimit: parsed.tier === "pro" ? -1 : FREE_LIMITS.dailyCaptures,
          dailyReviewsLimit: parsed.tier === "pro" ? -1 : FREE_LIMITS.dailyReviews,
          isPro: parsed.tier === "pro" || parsed.tier === "team",
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    tier: "free",
    status: "active",
    currency: "USD",
    billingInterval: "monthly",
    currentPeriodEnd: null,
    dailyCapturesCount: 0,
    dailyReviewsCount: 0,
    dailyCapturesLimit: FREE_LIMITS.dailyCaptures,
    dailyReviewsLimit: FREE_LIMITS.dailyReviews,
    isPro: false,
  };
}

export async function getUserSubscription(): Promise<UserSubscription> {
  const local = getLocalSubscription();

  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return local;

    const { data, error } = await supabase.rpc("get_or_create_user_subscription", {
      p_user_id: user.id,
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return local;
    }

    const row = data[0];
    const isPro = row.tier === "pro" || row.tier === "team";

    const sub: UserSubscription = {
      tier: row.tier || "free",
      status: row.status || "active",
      currency: (row.currency as PricingCurrency) || "USD",
      billingInterval: (row.billing_interval as BillingInterval) || "monthly",
      currentPeriodEnd: row.current_period_end,
      dailyCapturesCount: row.daily_captures_count || 0,
      dailyReviewsCount: row.daily_reviews_count || 0,
      dailyCapturesLimit: isPro ? -1 : FREE_LIMITS.dailyCaptures,
      dailyReviewsLimit: isPro ? -1 : FREE_LIMITS.dailyReviews,
      isPro,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify(sub));
    }

    return sub;
  } catch {
    return local;
  }
}

/**
 * Checks usage quota and increments daily counters.
 * Returns whether the action is allowed and remaining allowance.
 */
export async function checkAndRecordUsage(
  action: "capture" | "review",
): Promise<{ allowed: boolean; used: number; limit: number; tier: SubscriptionTier }> {
  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase.rpc("check_and_record_usage", {
        p_user_id: user.id,
        p_action: action,
      });

      if (!error && data) {
        return data as { allowed: boolean; used: number; limit: number; tier: SubscriptionTier };
      }
    }
  } catch {
    // fallback to local handling
  }

  // Local fallback for guest or unmigrated users
  const sub = getLocalSubscription();
  if (sub.isPro) {
    return { allowed: true, used: 1, limit: -1, tier: sub.tier };
  }

  const limit = action === "capture" ? FREE_LIMITS.dailyCaptures : FREE_LIMITS.dailyReviews;
  const current = action === "capture" ? sub.dailyCapturesCount : sub.dailyReviewsCount;

  if (current >= limit) {
    return { allowed: false, used: current, limit, tier: "free" };
  }

  const nextCount = current + 1;
  if (action === "capture") sub.dailyCapturesCount = nextCount;
  else sub.dailyReviewsCount = nextCount;

  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify(sub));
  }

  return { allowed: true, used: nextCount, limit, tier: "free" };
}

/**
 * Activates or simulates upgrading to WordTap Pro.
 */
export async function activateSubscription(params: {
  tier: "pro";
  currency: PricingCurrency;
  interval: BillingInterval;
}): Promise<void> {
  const periodEnd = new Date(Date.now() + (params.interval === "yearly" ? 365 : 30) * 86400000).toISOString();

  const sub: UserSubscription = {
    tier: "pro",
    status: "active",
    currency: params.currency,
    billingInterval: params.interval,
    currentPeriodEnd: periodEnd,
    dailyCapturesCount: 0,
    dailyReviewsCount: 0,
    dailyCapturesLimit: -1,
    dailyReviewsLimit: -1,
    isPro: true,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_SUB_KEY, JSON.stringify(sub));
    window.dispatchEvent(new CustomEvent("wordtap_subscription_changed", { detail: sub }));
  }

  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("user_subscriptions").upsert({
        user_id: user.id,
        tier: "pro",
        status: "active",
        currency: params.currency,
        billing_interval: params.interval,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // local activated
  }
}
