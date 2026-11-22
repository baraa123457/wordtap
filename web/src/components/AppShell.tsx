"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { StarIcon, DownloadIcon } from "./Icons";

const AUTH_LINKS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard" },
  { href: "/decks", label: "Decks", shortLabel: "Decks" },
  { href: "/words", label: "My words", shortLabel: "Words" },
  { href: "/history", label: "History", shortLabel: "History" },
  { href: "/download", label: "Downloads", shortLabel: "Downloads", isDownload: true },
  { href: "/pricing", label: "Pro", shortLabel: "Pro", isPro: true },
  { href: "/settings", label: "Settings", shortLabel: "Settings" },
] as const;

const GUEST_LINKS = [
  { href: "/", label: "Home", shortLabel: "Home" },
  { href: "/decks", label: "Decks", shortLabel: "Decks" },
  { href: "/download", label: "Downloads", shortLabel: "Downloads", isDownload: true },
  { href: "/pricing", label: "Pro", shortLabel: "Pro", isPro: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, signOut } = useAuth();
  const isSignedIn = state.status === "signed-in";
  const email = isSignedIn ? state.user.email ?? "" : "";
  const logoHref = isSignedIn ? "/dashboard" : "/";
  const navLinks = isSignedIn ? AUTH_LINKS : GUEST_LINKS;

  return (
    <div className="flex min-h-dvh w-full flex-col">
      {/* Apple Floating Liquid Glass Header with Safe Area support */}
      <header className="sticky top-0 z-40 w-full apple-glass transition-colors pt-safe">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-6 lg:flex-nowrap lg:py-2.5">
          {/* Logo (Left) */}
          <div className="order-1 flex items-center shrink-0">
            <Logo href={logoHref} />
          </div>

          {/* User Controls (Row 1 Right on mobile/tablet, Far Right on desktop) */}
          <div className="order-2 flex items-center gap-1.5 sm:gap-2 xl:gap-2.5 shrink-0 lg:order-3">
            <ThemeToggle />
            {isSignedIn && email ? (
              <>
                <span
                  className="hidden xl:inline max-w-32 2xl:max-w-44 truncate text-xs font-medium text-muted"
                  title={email}
                >
                  {email}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet min-h-9 px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer text-ink hover:text-red-500 transition-colors"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href="/login" className="btn btn-quiet min-h-9 px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary min-h-9 px-2.5 sm:px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0">
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Segmented Navigation Capsule (Row 2 on mobile/tablet, Center on wide desktop) */}
          <nav
            aria-label="Main Navigation"
            className="order-3 flex w-full shrink min-w-0 items-center justify-center py-0.5 lg:order-2 lg:w-auto lg:py-0"
          >
            <div className="apple-segmented-container apple-segmented-fit mx-auto items-center justify-center px-1 sm:px-1.5">
              {navLinks.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href === "/download" &&
                    (pathname === "/download" || pathname === "/downloads"));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : undefined}
                    className="apple-segmented-item whitespace-nowrap min-h-[38px] px-2.5 sm:px-3 lg:px-2.5 xl:px-3.5 py-1 text-xs sm:text-sm flex items-center justify-center"
                  >
                    {("isPro" in link && link.isPro) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StarIcon
                          size={12}
                          filled
                          className="text-amber-500 dark:text-subtitle"
                        />
                        <span>{link.label}</span>
                      </span>
                    ) : ("isDownload" in link && link.isDownload) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <DownloadIcon
                          size={12}
                          className="shrink-0 opacity-80"
                        />
                        <span>{link.label}</span>
                      </span>
                    ) : link.label === link.shortLabel ? (
                      link.label
                    ) : (
                      <>
                        <span className="hidden sm:inline">{link.label}</span>
                        <span className="sm:hidden">{link.shortLabel}</span>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 overflow-x-clip px-3.5 sm:px-6 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-4 sm:pt-6">
        {children}
      </main>
    </div>
  );
}
