import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthRedirectUrl, getSiteUrl, sanitizeNextPath } from "./supabase";

describe("supabase URL helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prefers browser window.location.origin over env vars", () => {
    vi.stubGlobal("window", { location: { origin: "https://wordtap-prod.vercel.app/" } });
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    expect(getSiteUrl()).toBe("https://wordtap-prod.vercel.app");
    expect(getAuthRedirectUrl()).toBe("https://wordtap-prod.vercel.app/auth/callback");
    expect(getAuthRedirectUrl("/auth/callback?next=/settings%23password")).toBe(
      "https://wordtap-prod.vercel.app/auth/callback?next=/settings%23password",
    );
  });

  it("falls back to NEXT_PUBLIC_SITE_URL and VERCEL_URL when window is absent", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://custom.wordtap.app/");
    expect(getSiteUrl()).toBe("https://custom.wordtap.app");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "wordtap-preview.vercel.app");
    expect(getSiteUrl()).toBe("https://wordtap-preview.vercel.app");
  });

  it("returns undefined redirect url when no origin is available", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getSiteUrl()).toBeNull();
    expect(getAuthRedirectUrl()).toBeUndefined();
  });

  it("sanitizes next paths against external redirects", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/settings#password")).toBe("/settings#password");
    expect(sanitizeNextPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath(null, "/words")).toBe("/words");
  });
});
