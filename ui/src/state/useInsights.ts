import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import type { Funnel, StageDuration, StaleItem } from "../lib/analytics";
import { useBackend } from "./backend";

export interface InsightsData {
  funnel: Funnel;
  timeInStage: StageDuration[];
  stale: StaleItem[];
}

export type InsightsState =
  | { status: "loading"; data: InsightsData | null }
  | { status: "ready"; data: InsightsData }
  | { status: "error"; data: InsightsData | null; message: string };

export function useInsights(staleDays: number, version: number): [InsightsState, () => void] {
  const { insights } = useBackend();
  const [state, setState] = useState<InsightsState>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ status: "loading", data: s.data }));
    Promise.all([
      insights.funnel(controller.signal),
      insights.timeInStage(controller.signal),
      insights.stale(staleDays, controller.signal),
    ])
      .then(([funnel, timeInStage, stale]) =>
        setState({ status: "ready", data: { funnel, timeInStage, stale } }),
      )
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((s) => ({
          status: "error",
          data: s.data,
          message: error instanceof ApiError ? error.message : "Something unexpected went wrong.",
        }));
      });
    return () => controller.abort();
  }, [insights, staleDays, version, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, retry];
}
