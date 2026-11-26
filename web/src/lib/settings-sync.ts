import { getSupabase } from "@/lib/supabase";

export interface CloudUserSettings {
  theme?: "light" | "dark" | "system";
  targetLang?: string;
  translateSaveMode?: "manual" | "subtitles_only" | "auto";
  pauseOnClick?: boolean;
  subCustomSize?: number;
  subFontFamily?: string;
  subTextColor?: string;
  subBgStyle?: "none" | "translucent" | "solid";
  subFontWeight?: "400" | "700";
  subBottomOffset?: number;
  volume?: number;
}

export async function fetchCloudSettings(): Promise<CloudUserSettings | null> {
  try {
    const supabase = getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error || !data || !data.settings || typeof data.settings !== "object") {
      return null;
    }
    return data.settings as CloudUserSettings;
  } catch {
    return null;
  }
}

export async function saveCloudSettings(patch: CloudUserSettings): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return false;

    const { error } = await supabase.rpc("upsert_user_settings", {
      p_settings: patch,
    });
    return !error;
  } catch {
    return false;
  }
}
