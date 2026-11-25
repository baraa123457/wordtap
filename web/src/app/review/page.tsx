"use client";

import { fetchWords } from "@/lib/api";
import { useLoad } from "@/hooks/useLoad";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { ReviewSession } from "@/components/review/ReviewSession";

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewLoader />
    </RequireAuth>
  );
}

function ReviewLoader() {
  const { state, reload } = useLoad(fetchWords);

  if (state.status === "loading") {
    return <LoadingState label="Preparing your quick review…" />;
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState message={state.message} onRetry={reload} />
      </div>
    );
  }

  return <ReviewSession words={state.data} onReload={reload} />;
}
