"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export function AuthActions({ size = "nav" }: { size?: "nav" | "hero" }) {
  const { state } = useAuth();
  const compact = size === "nav";
  const sizing = compact ? "min-h-10 px-4 py-1.5 text-sm" : "";

  if (state.status === "signed-in") {
    return (
      <Link href="/dashboard" className={`btn btn-primary ${sizing}`}>
        Open your dashboard
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* In the header on phones only "Sign in" shows; the hero below has both buttons. */}
      <Link href="/signup" className={`btn btn-primary ${sizing} ${compact ? "hidden sm:inline-flex" : ""}`}>
        Create free account
      </Link>
      <Link href="/login" className={`btn ${compact ? "btn-quiet" : ""} ${sizing}`}>
        Sign in
      </Link>
    </div>
  );
}
