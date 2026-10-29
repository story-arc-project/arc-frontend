"use client";

import { useCallback, useEffect, useState } from "react";
import type { SetStateAction } from "react";

/** Shallow string request parameters; keep load stable. Pages own API and mutation policy. */
export function useAnalysisListRequest<Selection extends Record<string, string>, Result>(
  initialSelection: Selection,
  initialResult: Result,
  load: (selection: Selection) => Promise<Result>,
) {
  // Keep the selection and generation atomic, including batched away/back changes.
  const [request, setRequest] = useState({ selection: initialSelection, generation: 0 });
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState(false);
  const [loadedGeneration, setLoadedGeneration] = useState<number | null>(null);

  const setSelection = useCallback((next: SetStateAction<Selection>) => {
    setRequest((previous) => {
      const selection = typeof next === "function" ? next(previous.selection) : next;
      const keys = Object.keys(selection);
      if (keys.length === Object.keys(previous.selection).length &&
        keys.every((key) => selection[key] === previous.selection[key])) return previous;
      return { selection, generation: previous.generation + 1 };
    });
  }, []);

  const retry = useCallback(() => {
    setRequest((previous) => ({ ...previous, generation: previous.generation + 1 }));
  }, []);

  useEffect(() => {
    let ignore = false;
    load(request.selection)
      .then((data) => {
        if (ignore) return;
        setResult(data);
        setError(false);
        setLoadedGeneration(request.generation);
      })
      .catch(() => {
        if (ignore) return;
        setError(true);
        setLoadedGeneration(request.generation);
      });
    return () => { ignore = true; };
  }, [load, request]);

  return {
    selection: request.selection,
    setSelection,
    retry,
    result,
    setResult,
    error,
    loading: loadedGeneration !== request.generation,
  };
}
