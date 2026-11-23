import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, messageFromBody, request } from "./http";
import { createLiveApplicationsApi, createLiveInsightsApi } from "./live";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("messageFromBody", () => {
  it("reads the proposal's error shape and FastAPI's detail", () => {
    expect(messageFromBody({ error: "Insights down" })).toBe("Insights down");
    expect(messageFromBody({ detail: "Not found" })).toBe("Not found");
    expect(
      messageFromBody({
        detail: [{ loc: ["body", "company"], msg: "Value error, company is required" }],
      }),
    ).toBe("company: company is required");
    expect(messageFromBody("nope")).toBeNull();
  });
});

describe("request", () => {
  it("maps status codes to error kinds", async () => {
    const cases: Array<[number, string]> = [
      [404, "not_found"],
      [422, "validation"],
      [503, "unavailable"],
      [504, "unavailable"],
      [500, "server"],
    ];
    for (const [status, kind] of cases) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(status, { error: "x" }));
      await expect(request("http://api", "/a", { timeoutMs: 1000 })).rejects.toMatchObject({
        kind,
        status,
      });
    }
  });

  it("treats a network failure as unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(request("http://api", "/a", { timeoutMs: 1000 })).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("times out instead of hanging", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    await expect(request("http://api", "/slow", { timeoutMs: 20 })).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("sends JSON and joins the base URL without double slashes", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(201, { ok: true }));
    await request("http://api/", "/applications", {
      method: "POST",
      body: { a: 1 },
      timeoutMs: 1000,
    });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("http://api/applications");
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

describe("live applications api", () => {
  it("calls the endpoints from the proposal", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const row = {
      id: 3,
      company: "Acme",
      role: "Dev",
      stage: "screen",
      created_at: "2026-11-01T00:00:00Z",
    };
    spy.mockResolvedValueOnce(json(200, { items: [row] }));
    spy.mockResolvedValueOnce(json(200, row));
    spy.mockResolvedValueOnce(json(200, row));
    spy.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const api = createLiveApplicationsApi("http://api");
    const list = await api.list();
    expect(list[0]).toMatchObject({
      id: 3,
      stage: "screen",
      url: null,
      updated_at: "2026-11-01T00:00:00Z",
    });
    await api.moveStage(3, "interview");
    await api.update(3, {
      company: "Acme",
      role: "Dev",
      url: null,
      location: null,
      salary_range: null,
      applied_at: null,
      stage: "offer",
    });
    await api.remove(3);

    const calls = spy.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(calls).toEqual([
      "GET http://api/applications",
      "PATCH http://api/applications/3/stage",
      "PUT http://api/applications/3",
      "DELETE http://api/applications/3",
    ]);
    expect(JSON.parse(spy.mock.calls[2][1]!.body as string)).not.toHaveProperty("stage");
  });
});

describe("live insights api", () => {
  it("retries once when the service is waking up", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    spy.mockResolvedValueOnce(json(503, { error: "waking" }));
    spy.mockResolvedValueOnce(json(200, { applied: 4, screen: 1 }));
    const funnel = await createLiveInsightsApi("http://insights").funnel();
    expect(funnel.total).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => json(503, { error: "down" }));
    await expect(createLiveInsightsApi("http://insights").stale(14)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("treats a missing timeline endpoint as not offered", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(404, { detail: "Not Found" }));
    expect(await createLiveInsightsApi("http://insights").timeline(1)).toBeNull();
  });
});
