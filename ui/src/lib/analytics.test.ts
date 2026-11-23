import { describe, expect, it } from "vitest";
import {
  funnelFromEvents,
  median,
  normalizeFunnel,
  normalizeStale,
  normalizeTimeInStage,
  normalizeTimeline,
  percent,
  staleFromEvents,
  timeInStageFromEvents,
} from "./analytics";
import type { StageEvent } from "./types";

const ev = (
  application_id: number,
  from: StageEvent["from_stage"],
  to: StageEvent["to_stage"],
  day: number,
): StageEvent => ({
  application_id,
  from_stage: from,
  to_stage: to,
  occurred_at: new Date(Date.UTC(2026, 10, day)).toISOString(),
});

const events: StageEvent[] = [
  ev(1, null, "applied", 1),
  ev(1, "applied", "screen", 5),
  ev(1, "screen", "interview", 9),
  ev(1, "interview", "rejected", 12),
  ev(2, null, "applied", 2),
  ev(2, "applied", "screen", 4),
  ev(3, null, "applied", 3),
  ev(4, null, "applied", 3),
  ev(4, "applied", null, 6),
];

describe("funnelFromEvents", () => {
  it("counts how many applications reached each stage", () => {
    const funnel = funnelFromEvents(events);
    expect(funnel.total).toBe(3);
    expect(funnel.steps.map((s) => s.count)).toEqual([3, 2, 1, 0]);
    expect(funnel.rejected).toBe(1);
  });

  it("counts earlier stages when an application skipped ahead", () => {
    const funnel = funnelFromEvents([ev(9, null, "interview", 1)]);
    expect(funnel.steps.map((s) => s.count)).toEqual([1, 1, 1, 0]);
  });

  it("is empty with no events, without dividing by zero", () => {
    const funnel = funnelFromEvents([]);
    expect(funnel.total).toBe(0);
    expect(funnel.steps.every((s) => s.count === 0)).toBe(true);
  });

  it("handles events that arrive out of order", () => {
    const shuffled = [...events].reverse();
    expect(funnelFromEvents(shuffled)).toEqual(funnelFromEvents(events));
  });
});

describe("timeInStageFromEvents", () => {
  it("takes the median days spent before leaving each stage", () => {
    const result = timeInStageFromEvents(events);
    expect(result.find((r) => r.stage === "applied")?.medianDays).toBe(3);
    expect(result.find((r) => r.stage === "screen")?.medianDays).toBe(4);
    expect(result.find((r) => r.stage === "interview")?.medianDays).toBe(3);
  });

  it("reports null for a stage with no data", () => {
    expect(timeInStageFromEvents([]).every((r) => r.medianDays === null)).toBe(true);
  });
});

describe("staleFromEvents", () => {
  it("lists open applications idle for longer than the threshold, oldest first", () => {
    const now = new Date(Date.UTC(2026, 10, 30));
    const stale = staleFromEvents(events, 14, now);
    expect(stale.map((s) => s.application_id)).toEqual([3, 2]);
    expect(stale[0].days).toBe(27);
  });

  it("ignores final stages and deleted applications", () => {
    const now = new Date(Date.UTC(2027, 0, 30));
    const ids = staleFromEvents(events, 1, now).map((s) => s.application_id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(4);
  });
});

describe("normalizers", () => {
  it("accepts a stage -> count map", () => {
    const funnel = normalizeFunnel({ applied: 10, screen: 4, interview: 2, offer: 1, rejected: 3 });
    expect(funnel.total).toBe(10);
    expect(funnel.steps.map((s) => s.count)).toEqual([10, 4, 2, 1]);
    expect(funnel.rejected).toBe(3);
  });

  it("accepts a list of rows and an explicit total", () => {
    const funnel = normalizeFunnel({
      total: 12,
      stages: [
        { stage: "applied", count: 12 },
        { stage: "screen", reached: "5" },
      ],
    });
    expect(funnel.total).toBe(12);
    expect(funnel.steps[1].count).toBe(5);
    expect(funnel.steps[3].count).toBe(0);
  });

  it("reads the persisted Insights GET /funnel contract", () => {
    const funnel = normalizeFunnel({
      total_applications: 1,
      stages: [
        { stage: "applied", count: 1, percentage: 100.0 },
        { stage: "screen", count: 0, percentage: 0.0 },
        { stage: "interview", count: 1, percentage: 100.0 },
        { stage: "offer", count: 0, percentage: 0.0 },
        { stage: "rejected", count: 0, percentage: 0.0 },
      ],
    });
    expect(funnel.total).toBe(1);
    expect(funnel.steps.map((s) => s.count)).toEqual([1, 0, 1, 0]);
    expect(funnel.rejected).toBe(0);
  });

  it("prefers total_applications over an inferred stage maximum", () => {
    const funnel = normalizeFunnel({
      total_applications: 0,
      stages: [
        { stage: "applied", count: 0 },
        { stage: "screen", count: 0 },
        { stage: "interview", count: 0 },
        { stage: "offer", count: 0 },
        { stage: "rejected", count: 0 },
      ],
    });
    expect(funnel.total).toBe(0);
  });

  it("ignores unknown stages and junk", () => {
    expect(normalizeFunnel({ foo: 3, applied: "x" }).steps[0].count).toBe(0);
    expect(normalizeFunnel(null).total).toBe(0);
  });

  it("reads time in stage in several shapes", () => {
    expect(normalizeTimeInStage({ applied: 3.5, screen: null }).map((d) => d.medianDays)).toEqual([
      3.5,
      null,
      null,
    ]);
    expect(normalizeTimeInStage([{ stage: "screen", median_days: 7 }])[1].medianDays).toBe(7);
  });

  it("reads stale rows with days or a last event time", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    const stale = normalizeStale(
      {
        applications: [
          { application_id: 2, days: 20 },
          { id: "5", last_event_at: "2026-11-10T00:00:00Z" },
          { nope: 1 },
        ],
      },
      now,
    );
    expect(stale.map((s) => s.days)).toEqual([20, 20]);
    expect(stale.map((s) => s.application_id).sort()).toEqual([2, 5]);
    expect(stale).toHaveLength(2);
  });

  it("reads the persisted Insights GET /stale contract", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    const stale = normalizeStale(
      {
        threshold_days: 7,
        applications: [
          {
            application_id: 1,
            stage: "interview",
            last_activity_at: "2026-11-20T00:00:00Z",
          },
        ],
      },
      now,
    );
    expect(stale).toEqual([{ application_id: 1, days: 10 }]);
  });

  it("reads and sorts a timeline", () => {
    const timeline = normalizeTimeline(
      [
        { from_stage: "applied", to_stage: "screen", occurred_at: "2026-11-05T00:00:00Z" },
        { from_stage: null, to_stage: "applied", occurred_at: "2026-11-01T00:00:00Z" },
        { from_stage: "bogus", to_stage: "screen" },
      ],
      7,
    );
    expect(timeline.map((e) => e.to_stage)).toEqual(["applied", "screen"]);
    expect(timeline[0].application_id).toBe(7);
  });
});

describe("helpers", () => {
  it("median handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("percent never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});
