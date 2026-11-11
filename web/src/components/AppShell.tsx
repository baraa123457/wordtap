"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

const AUTH_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/words", label: "My words" },
  { href: "/history", label: "History" },
  { href: "/extension", label: "Extension" },
  { href: "/settings", label: "Settings" },
] as const;

const GUEST_LINKS = [
  { href: "/", label: "Home" },
  { href: "/extension", label: "Extension" },
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
      {/* Apple Floating Liquid Glass Header */}
      <header className="sticky top-0 z-40 w-full apple-glass transition-colors">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
          <Logo href={logoHref} />

          {/* Segmented Navigation Capsule */}
          <nav
            aria-label="Main Navigation"
            className="order-3 flex w-full overflow-x-auto py-1 sm:order-none sm:w-auto"
          >
            <div className="apple-segmented-container mx-auto">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : undefined}
                    className="apple-segmented-item whitespace-nowrap"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            {isSignedIn && email ? (
              <>
                <span
                  className="hidden max-w-36 truncate text-xs font-medium text-muted sm:inline"
                  title={email}
                >
                  {email}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet min-h-9 px-3 py-1 text-xs font-medium cursor-pointer"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href="/login" className="btn btn-quiet min-h-9 px-3 py-1 text-xs font-medium whitespace-nowrap">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary min-h-9 px-3 py-1 text-xs font-semibold whitespace-nowrap">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 overflow-x-hidden px-4 pb-16 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
