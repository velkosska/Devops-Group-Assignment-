import { beforeEach, describe, expect, it } from "vitest";
import { createDemoBackend, resetDemo, seedState } from "./demo";
import { createBackend } from "./index";

beforeEach(() => resetDemo());

const input = {
  company: "Acme",
  role: "Dev",
  url: null,
  location: null,
  salary_range: null,
  applied_at: null,
};

describe("demo backend", () => {
  it("starts from realistic seed data", async () => {
    const { applications } = createDemoBackend({ latencyMs: 0 });
    const list = await applications.list();
    expect(list.length).toBe(seedState().applications.length);
    expect(new Set(list.map((a) => a.stage)).size).toBe(5);
  });

  it("creates, moves, edits and deletes like the real API, and persists", async () => {
    const { applications, insights } = createDemoBackend({ latencyMs: 0 });
    const created = await applications.create({ ...input, stage: undefined });
    expect(created.stage).toBe("applied");

    const moved = await applications.moveStage(created.id, "screen");
    expect(moved.stage).toBe("screen");
    await expect(applications.moveStage(created.id, "screen")).rejects.toMatchObject({
      kind: "validation",
    });

    const edited = await applications.update(created.id, { ...input, role: "Senior Dev" });
    expect(edited.role).toBe("Senior Dev");

    const timeline = await insights.timeline(created.id);
    expect(timeline?.map((e) => e.to_stage)).toEqual(["applied", "screen"]);

    const again = createDemoBackend({ latencyMs: 0 });
    expect((await again.applications.list()).some((a) => a.id === created.id)).toBe(true);

    await applications.remove(created.id);
    await expect(applications.remove(created.id)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("applies the same validation as applications-api", async () => {
    const { applications } = createDemoBackend({ latencyMs: 0 });
    await expect(applications.create({ ...input, company: "  " })).rejects.toMatchObject({
      kind: "validation",
    });
  });

  it("computes insights from its events", async () => {
    const { insights } = createDemoBackend({ latencyMs: 0 });
    const funnel = await insights.funnel();
    expect(funnel.total).toBe(seedState().applications.length);
    expect(funnel.steps[0].count).toBeGreaterThanOrEqual(funnel.steps[1].count);
    expect((await insights.stale(14)).length).toBeGreaterThan(0);
  });
});

describe("createBackend", () => {
  it("uses demo data when no applications URL is set", () => {
    expect(createBackend({} as ImportMetaEnv).demo).toBe(true);
  });

  it("uses the live services when configured", () => {
    expect(
      createBackend({
        VITE_APPLICATIONS_API_URL: "http://a",
        VITE_INSIGHTS_API_URL: "http://i",
      } as ImportMetaEnv).demo,
    ).toBe(false);
  });

  it("reports insights as unavailable when only the board is configured", async () => {
    const backend = createBackend({ VITE_APPLICATIONS_API_URL: "http://a" } as ImportMetaEnv);
    await expect(backend.insights.funnel()).rejects.toMatchObject({ kind: "unavailable" });
  });
});
