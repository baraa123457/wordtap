// WordTap Extension Configuration
// Keeps Supabase credentials centralized for extension scripts and adds a live website URL helper.

export const CONFIG = {
  SUPABASE_URL: "https://vjjilwbhvoxfigrokqch.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_YzMg6sNWjpwwfP2T-apa-Q_c3EHVBNa",
  WEBSITE_URL: "https://wordtap.vercel.app",
};

/**
 * Returns the configured WordTap Web App base URL (allows overriding localhost for production deploys
 * via Extension Options -> WordTap Web App URL).
 */
export async function getWebsiteUrl() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      const data = await chrome.storage.sync.get(["websiteUrl"]);
      const custom = typeof data.websiteUrl === "string" ? data.websiteUrl.trim().replace(/\/+$/, "") : "";
      if (custom && /^https?:\/\//i.test(custom)) {
        return custom;
      }
    }
  } catch {}
  return CONFIG.WEBSITE_URL;
}
