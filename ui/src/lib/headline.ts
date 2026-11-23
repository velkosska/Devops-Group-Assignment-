import { percent, type Funnel, type StageDuration } from "./analytics";
import { STAGE_META } from "./stages";

/** Index of the funnel step with the lowest share moving on from the step before it. */
export function biggestDrop(funnel: Funnel): { index: number; rate: number } | null {
  if (funnel.total === 0) return null;
  let worst: { index: number; rate: number } | null = null;
  for (let i = 1; i < funnel.steps.length; i++) {
    const prev = funnel.steps[i - 1];
    if (prev.count === 0) break;
    const rate = percent(funnel.steps[i].count, prev.count);
    if (!worst || rate < worst.rate) worst = { index: i, rate };
  }
  return worst;
}

export function funnelHeadline(funnel: Funnel): string | null {
  const worst = biggestDrop(funnel);
  if (!worst) return null;
  const from = STAGE_META[funnel.steps[worst.index - 1].stage].label;
  const to = STAGE_META[funnel.steps[worst.index].stage].label;
  return `Your biggest drop-off is ${from} → ${to}: ${worst.rate}% move on.`;
}

export function slowestStage(durations: StageDuration[]): StageDuration | null {
  return durations.reduce<StageDuration | null>(
    (slowest, d) =>
      d.medianDays !== null && (slowest === null || d.medianDays > (slowest.medianDays ?? -1))
        ? d
        : slowest,
    null,
  );
}

export function formatDays(days: number): string {
  if (days < 1) return "<1 day";
  const rounded = Math.round(days);
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}
