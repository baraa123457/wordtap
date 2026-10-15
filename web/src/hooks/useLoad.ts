"use client";

import { useCallback, useEffect, useState } from "react";

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/**
 * Runs an async loader on mount and whenever `reload` is called.
 * Pass a stable function (module-level or wrapped in useCallback).
 */
export function useLoad<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (active) setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      });
    return () => {
      active = false;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setState({ status: "ready", data }), []);

  return { state, reload, setData };
}
