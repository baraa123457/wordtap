"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ErrorState, LoadingState } from "./StateViews";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "signed-out") router.replace("/login");
  }, [state.status, router]);

  if (state.status === "error") {
    return (
      <div className="px-4 py-16">
        <ErrorState message={state.message} />
      </div>
    );
  }
  if (state.status !== "signed-in") return <LoadingState label="Checking your account…" />;
  return <>{children}</>;
}
