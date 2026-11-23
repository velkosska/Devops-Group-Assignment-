import { isStage, PATH_STAGES, STAGES, type Stage } from "./stages";
import type { StageEvent } from "./types";

export interface FunnelStep {
  stage: Stage;
  count: number;
}

export interface Funnel {
  total: number;
  steps: FunnelStep[];
  rejected: number;
}

export interface StageDuration {
  stage: Stage;
  medianDays: number | null;
}

export interface StaleItem {
  application_id: number;
  days: number;
}

const DAY_MS = 86_400_000;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function historyByApplication(events: StageEvent[]): Map<number, StageEvent[]> {
  const byApp = new Map<number, StageEvent[]>();
  for (const event of events) {
    const list = byApp.get(event.application_id) ?? [];
    list.push(event);
    byApp.set(event.application_id, list);
  }
  for (const [id, list] of byApp) {
    list.sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
    if (list.some((e) => e.to_stage === null)) byApp.delete(id);
  }
  return byApp;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function funnelFromEvents(events: StageEvent[]): Funnel {
  const history = historyByApplication(events);
  const reached = new Map<Stage, number>(STAGES.map((s) => [s, 0]));
  for (const list of history.values()) {
    const seen = new Set<Stage>(["applied"]);
    for (const e of list) if (e.to_stage) seen.add(e.to_stage);
    const furthest = Math.max(...[...seen].map((s) => PATH_STAGES.indexOf(s)));
    PATH_STAGES.forEach((s, i) => i <= furthest && seen.add(s));
    for (const s of seen) reached.set(s, reached.get(s)! + 1);
  }
  return {
    total: history.size,
    steps: PATH_STAGES.map((stage) => ({ stage, count: reached.get(stage)! })),
    rejected: reached.get("rejected")!,
  };
}

export function timeInStageFromEvents(events: StageEvent[]): StageDuration[] {
  const spans = new Map<Stage, number[]>(STAGES.map((s) => [s, []]));
  for (const list of historyByApplication(events).values()) {
    for (let i = 0; i < list.length - 1; i++) {
      const stage = list[i].to_stage;
      if (!stage) continue;
      const days = (Date.parse(list[i + 1].occurred_at) - Date.parse(list[i].occurred_at)) / DAY_MS;
      spans.get(stage)!.push(Math.max(0, days));
    }
  }
  return PATH_STAGES.filter((s) => s !== "offer").map((stage) => {
    const m = median(spans.get(stage)!);
    return { stage, medianDays: m === null ? null : Math.round(m * 10) / 10 };
  });
}

export function staleFromEvents(events: StageEvent[], days: number, now = new Date()): StaleItem[] {
  const items: StaleItem[] = [];
  for (const [id, list] of historyByApplication(events)) {
    const last = list.at(-1)!;
    if (last.to_stage === "offer" || last.to_stage === "rejected") continue;
    const idle = Math.floor((now.getTime() - Date.parse(last.occurred_at)) / DAY_MS);
    if (idle > days) items.push({ application_id: id, days: idle });
  }
  return items.sort((a, b) => b.days - a.days);
}

function rowsOf(payload: unknown, listKeys: string[]): Array<Record<string, unknown>> | null {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    for (const key of listKeys) {
      const inner = (payload as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as Array<Record<string, unknown>>;
    }
  }
  return null;
}

function stageMap(
  payload: unknown,
  valueKeys: string[],
  listKeys: string[],
): Map<Stage, number | null> {
  const map = new Map<Stage, number | null>();
  const rows = rowsOf(payload, listKeys);
  if (rows) {
    for (const row of rows) {
      if (!isStage(row.stage)) continue;
      const value = valueKeys.map((k) => asNumber(row[k])).find((v) => v !== null);
      map.set(row.stage, value ?? null);
    }
    return map;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const source = listKeys
      .map((k) => record[k])
      .find((v) => v && typeof v === "object" && !Array.isArray(v)) as
      | Record<string, unknown>
      | undefined;
    for (const [key, value] of Object.entries(source ?? record)) {
      if (isStage(key)) map.set(key, asNumber(value));
    }
  }
  return map;
}

export function normalizeFunnel(payload: unknown): Funnel {
  const map = stageMap(
    payload,
    ["count", "reached", "value", "applications"],
    ["stages", "funnel", "data", "counts"],
  );
  const steps = PATH_STAGES.map((stage) => ({ stage, count: map.get(stage) ?? 0 }));
  const explicitTotal =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? asNumber((payload as Record<string, unknown>).total)
      : null;
  return {
    total: explicitTotal ?? Math.max(steps[0].count, ...steps.map((s) => s.count)),
    steps,
    rejected: map.get("rejected") ?? 0,
  };
}

export function normalizeTimeInStage(payload: unknown): StageDuration[] {
  const map = stageMap(
    payload,
    ["median_days", "medianDays", "days", "median", "value"],
    ["stages", "data", "medians"],
  );
  return PATH_STAGES.filter((s) => s !== "offer").map((stage) => ({
    stage,
    medianDays: map.get(stage) ?? null,
  }));
}

export function normalizeStale(payload: unknown, now = new Date()): StaleItem[] {
  const rows = rowsOf(payload, ["applications", "items", "stale", "data"]) ?? [];
  const items: StaleItem[] = [];
  for (const row of rows) {
    const id = asNumber(row.application_id ?? row.id);
    if (id === null) continue;
    let days = asNumber(row.days ?? row.days_idle ?? row.days_since ?? row.idle_days);
    const last = row.last_event_at ?? row.last_updated ?? row.occurred_at ?? row.updated_at;
    if (days === null && typeof last === "string" && !Number.isNaN(Date.parse(last))) {
      days = Math.floor((now.getTime() - Date.parse(last)) / DAY_MS);
    }
    items.push({ application_id: id, days: days ?? 0 });
  }
  return items.sort((a, b) => b.days - a.days);
}

export function normalizeTimeline(payload: unknown, applicationId: number): StageEvent[] {
  const rows = rowsOf(payload, ["events", "timeline", "items", "data"]) ?? [];
  return rows
    .filter((r) => typeof r.occurred_at === "string")
    .map((r) => ({
      application_id: applicationId,
      from_stage: isStage(r.from_stage) ? r.from_stage : null,
      to_stage: isStage(r.to_stage) ? r.to_stage : null,
      occurred_at: r.occurred_at as string,
    }))
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
