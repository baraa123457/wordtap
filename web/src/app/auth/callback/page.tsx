"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { getSupabase, isSupabaseConfigured, sanitizeNextPath } from "@/lib/supabase";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "recovery",
  "magiclink",
  "invite",
  "email",
  "email_change",
]);

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase environment variables are not configured.");
      return;
    }

    const supabase = getSupabase();
    let active = true;

    async function completeAuth() {
      const hashParams = new URLSearchParams(
        typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "",
      );
      const urlError =
        searchParams.get("error_description") ||
        hashParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error");
      if (urlError) {
        if (active) setError(urlError);
        return;
      }

      const rawType = searchParams.get("type") || hashParams.get("type");
      const defaultNext = rawType === "recovery" ? "/settings#password" : "/dashboard";
      const nextPath = sanitizeNextPath(searchParams.get("next"), defaultNext);

      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");

      // Check whether detectSessionInUrl already hydrated the session from hash tokens
      const { data: existing, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        if (active) setError(sessionErr.message);
        return;
      }

      if (existing.session) {
        if (active) router.replace(nextPath);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
        if (active) router.replace(nextPath);
        return;
      }

      if (tokenHash && rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: rawType as EmailOtpType,
        });
        if (otpError) {
          if (active) setError(otpError.message);
          return;
        }
        if (active) router.replace(nextPath);
        return;
      }

      if (!active) return;

      // Wait briefly for onAuthStateChange in case hash hydration completes asynchronously
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") {
          router.replace(sanitizeNextPath(searchParams.get("next"), "/settings#password"));
        } else if (session) {
          router.replace(nextPath);
        }
      });

      const timer = setTimeout(() => {
        if (active) {
          setError("This confirmation link has expired or was already used. Try signing in.");
        }
      }, 4000);

      return () => {
        clearTimeout(timer);
        sub.subscription.unsubscribe();
      };
    }

    let cleanup: (() => void) | undefined;
    completeAuth().then((fn) => {
      if (typeof fn !== "function") return;
      if (!active) fn();
      else cleanup = fn;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="grid flex-1 content-center pb-16">
        <div className="apple-card p-6 sm:p-8 shadow-sm grid gap-4">
          {error ? (
            <>
              <h1 className="text-2xl font-bold text-ink">Verification issue</h1>
              <p role="alert" className="rounded-xl bg-bad-soft border border-bad/30 px-4 py-3 text-sm text-bad font-medium">
                {error}
              </p>
              <Link href="/login" className="btn btn-primary w-fit">
                Back to sign in
              </Link>
            </>
          ) : (
            <div className="grid gap-2">
              <h1 className="text-2xl font-bold text-ink">Completing sign in…</h1>
              <p className="text-sm text-muted">Verifying your WordTap account link. You will be redirected shortly.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
          <Logo />
          <main className="grid flex-1 content-center pb-16">
            <div className="apple-card p-6 sm:p-8 shadow-sm">
              <h1 className="text-2xl font-bold text-ink">Completing sign in…</h1>
            </div>
          </main>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
