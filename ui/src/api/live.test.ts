import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http";
import { createBackend } from "./index";
import { createLiveApplicationsApi, createLiveInsightsApi, unconfiguredInsightsApi } from "./live";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("live applications api", () => {
  it("creates an application with a POST and reads back the saved row", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json(201, {
        id: 9,
        company: "Quarry",
        role: "Backend Engineer",
        stage: "applied",
        location: "",
        created_at: "2026-11-20T09:00:00Z",
      }),
    );
    const input = {
      company: "Quarry",
      role: "Backend Engineer",
      url: null,
      location: null,
      salary_range: null,
      applied_at: null,
      stage: "applied" as const,
    };

    const created = await createLiveApplicationsApi("http://api").create(input);

    const [url, init] = spy.mock.calls[0];
    expect(`${init?.method} ${url}`).toBe("POST http://api/applications");
    expect(JSON.parse(init?.body as string)).toEqual(input);
    expect(created).toMatchObject({ id: 9, company: "Quarry", location: null });
    expect(created.updated_at).toBe("2026-11-20T09:00:00Z");
  });

  it("falls back to safe values for an unexpected payload", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(200, { unexpected: true }))
      .mockResolvedValueOnce(json(200, [{ id: "4", stage: "archived" }]));
    const api = createLiveApplicationsApi("http://api");

    expect(await api.list()).toEqual([]);
    const [row] = await api.list();
    expect(row).toMatchObject({ id: 4, company: "", role: "", stage: "applied" });
  });
});

describe("live insights api", () => {
  it("reads time in stage and a timeline from the service", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(200, { applied: 7.7, screen: 9 }))
      .mockResolvedValueOnce(json(200, [{ stage: "applied", changed_at: "2026-11-01T00:00:00Z" }]));
    const api = createLiveInsightsApi("http://insights");

    const durations = await api.timeInStage();
    expect(durations.find((d) => d.stage === "screen")?.medianDays).toBe(9);
    expect(await api.timeline(1)).not.toBeNull();
  });

  it("does not retry a request the service rejected", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(500, { error: "boom" }));
    await expect(createLiveInsightsApi("http://insights").funnel()).rejects.toMatchObject({
      kind: "server",
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("passes on timeline errors other than a missing endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(503, { error: "down" }));
    await expect(createLiveInsightsApi("http://insights").timeline(1)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});

describe("unconfigured insights", () => {
  it("reports insights as unavailable and hides the timeline", async () => {
    await expect(unconfiguredInsightsApi.funnel()).rejects.toBeInstanceOf(ApiError);
    await expect(unconfiguredInsightsApi.timeInStage()).rejects.toBeInstanceOf(ApiError);
    await expect(unconfiguredInsightsApi.stale(14)).rejects.toBeInstanceOf(ApiError);
    expect(await unconfiguredInsightsApi.timeline(1)).toBeNull();
  });
});

describe("createBackend", () => {
  const env = (vars: Partial<ImportMetaEnv>) => vars as ImportMetaEnv;

  it("uses demo data when no applications URL is set", () => {
    expect(createBackend(env({ VITE_APPLICATIONS_API_URL: "  " })).demo).toBe(true);
  });

  it("uses the live services when both URLs are set", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { applied: 2 }));
    const backend = createBackend(
      env({
        VITE_APPLICATIONS_API_URL: "http://apps",
        VITE_INSIGHTS_API_URL: "http://insights",
      }),
    );
    expect(backend.demo).toBe(false);
    await backend.insights.funnel();
    expect(spy.mock.calls[0][0]).toBe("http://insights/funnel");
  });

  it("keeps the board live when only the insights URL is missing", async () => {
    const backend = createBackend(env({ VITE_APPLICATIONS_API_URL: "http://apps" }));
    expect(backend.demo).toBe(false);
    await expect(backend.insights.funnel()).rejects.toMatchObject({ kind: "unavailable" });
  });
});
