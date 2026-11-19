"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { DownloadIcon, StarIcon } from "./Icons";

const AUTH_LINKS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard" },
  { href: "/decks", label: "Decks", shortLabel: "Decks" },
  { href: "/words", label: "My words", shortLabel: "Words" },
  { href: "/history", label: "History", shortLabel: "History" },
  { href: "/pricing", label: "Pro", shortLabel: "Pro", isPro: true },
  { href: "/settings", label: "Settings", shortLabel: "Settings" },
] as const;

const GUEST_LINKS = [
  { href: "/", label: "Home", shortLabel: "Home" },
  { href: "/decks", label: "Decks", shortLabel: "Decks" },
  { href: "/pricing", label: "Pricing", shortLabel: "Pricing" },
  { href: "/extension", label: "Extension", shortLabel: "Extension" },
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-3.5 py-2 sm:px-6 lg:flex-nowrap lg:py-3">
          {/* Logo (Left) */}
          <div className="order-1 flex items-center shrink-0">
            <Logo href={logoHref} />
          </div>

          {/* User Controls (Row 1 Right on mobile/tablet, Far Right on desktop) */}
          <div className="order-2 flex items-center gap-1.5 sm:gap-3 shrink-0 lg:order-3">
            <ThemeToggle />
            {isSignedIn && email ? (
              <>
                <Link
                  href="/extension"
                  className="btn btn-quiet min-h-9 px-2.5 sm:px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  title="Download & Install Chrome Extension"
                >
                  <DownloadIcon size={13} className="text-muted" />
                  <span className="hidden sm:inline">Extension</span>
                </Link>
                <span
                  className="hidden max-w-36 truncate text-xs font-medium text-muted lg:inline"
                  title={email}
                >
                  {email}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet min-h-9 px-2.5 sm:px-3 py-1 text-xs font-medium cursor-pointer"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href="/login" className="btn btn-quiet min-h-9 px-2.5 sm:px-3 py-1 text-xs font-medium whitespace-nowrap">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary min-h-9 px-2.5 sm:px-3 py-1 text-xs font-semibold whitespace-nowrap">
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Segmented Navigation Capsule (Row 2 on mobile/tablet, Center on wide desktop) */}
          <nav
            aria-label="Main Navigation"
            className="order-3 flex w-full shrink-0 items-center justify-center py-0.5 lg:order-2 lg:w-auto lg:py-0"
          >
            <div className="apple-segmented-container apple-segmented-fit mx-auto items-center justify-center sm:px-1.5">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : undefined}
                    className="apple-segmented-item whitespace-nowrap min-h-[40px] sm:min-h-[38px] sm:px-3.5 sm:py-1.5 sm:text-sm flex items-center justify-center"
                  >
                    {("isPro" in link && link.isPro) ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StarIcon
                          size={12}
                          filled
                          className={active ? "text-subtitle-ink" : "text-amber-500 dark:text-subtitle"}
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
