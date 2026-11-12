import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AnalyticsEvent =
  | "signup"
  | "extension_connected"
  | "first_word_saved"
  | "first_practice_completed"
  | "day2_return"
  | "day7_return";

/**
 * Records a privacy-respecting funnel analytics event in Supabase.
 * Fails silently to prevent breaking UI or user workflows if analytics table is not yet migrated.
 */
export async function trackEvent(
  event_name: AnalyticsEvent,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name,
      metadata,
    });
  } catch {
    // Fail silently — analytics must never degrade user experience
  }
}
