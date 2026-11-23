import { percent, type Funnel, type StageDuration } from "./analytics";
import { STAGE_META } from "./stages";

export function funnelHeadline(funnel: Funnel): string | null {
  if (funnel.total === 0) return null;
  let worst: { from: string; to: string; rate: number } | null = null;
  for (let i = 1; i < funnel.steps.length; i++) {
    const prev = funnel.steps[i - 1];
    const step = funnel.steps[i];
    if (prev.count === 0) break;
    const rate = percent(step.count, prev.count);
    if (!worst || rate < worst.rate) {
      worst = { from: STAGE_META[prev.stage].label, to: STAGE_META[step.stage].label, rate };
    }
  }
  if (!worst) return null;
  return `Your biggest drop-off is ${worst.from} → ${worst.to}: ${worst.rate}% move on.`;
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
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}
