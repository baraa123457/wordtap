"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/words", label: "My words" },
  { href: "/history", label: "History" },
  { href: "/extension", label: "Extension" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, signOut } = useAuth();
  const email = state.status === "signed-in" ? state.user.email ?? "" : "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
        <Logo href="/dashboard" />
        <nav aria-label="Main" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-2 font-medium ${
                  active ? "bg-subtitle text-subtitle-ink" : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <span className="hidden max-w-48 truncate text-sm text-muted sm:inline" title={email}>
            {email}
          </span>
          <button type="button" className="btn btn-quiet min-h-10 px-3 py-1.5 text-sm" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden pb-16 pt-4">{children}</main>
    </div>
  );
}
