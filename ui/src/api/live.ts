import {
  normalizeFunnel,
  normalizeStale,
  normalizeTimeInStage,
  normalizeTimeline,
} from "../lib/analytics";
import { isStage, type Stage } from "../lib/stages";
import type { Application } from "../lib/types";
import { ApiError, request } from "./http";
import type { ApplicationsApi, InsightsApi } from "./types";

const APPLICATIONS_TIMEOUT_MS = 10_000;
const INSIGHTS_TIMEOUT_MS = 3_000;

function toApplication(raw: unknown): Application {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
  const now = new Date().toISOString();
  return {
    id: Number(r.id),
    company: String(r.company ?? ""),
    role: String(r.role ?? ""),
    url: text(r.url),
    stage: isStage(r.stage) ? r.stage : "applied",
    location: text(r.location),
    salary_range: text(r.salary_range),
    applied_at: text(r.applied_at),
    created_at: text(r.created_at) ?? now,
    updated_at: text(r.updated_at) ?? text(r.created_at) ?? now,
  };
}

function listOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["items", "applications", "data", "results"]) {
      const inner = (payload as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

export function createLiveApplicationsApi(base: string): ApplicationsApi {
  const call = <T>(path: string, init: Omit<Parameters<typeof request>[2], "timeoutMs"> = {}) =>
    request<T>(base, path, { ...init, timeoutMs: APPLICATIONS_TIMEOUT_MS });

  return {
    async list(signal) {
      return listOf(await call<unknown>("/applications", { signal })).map(toApplication);
    },
    async create(input) {
      return toApplication(await call("/applications", { method: "POST", body: input }));
    },
    async update(id, input) {
      const { stage: _ignored, ...details } = input;
      void _ignored;
      return toApplication(await call(`/applications/${id}`, { method: "PUT", body: details }));
    },
    async moveStage(id, stage: Stage) {
      return toApplication(
        await call(`/applications/${id}/stage`, { method: "PATCH", body: { stage } }),
      );
    },
    async remove(id) {
      await call(`/applications/${id}`, { method: "DELETE" });
    },
  };
}

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ApiError && (error.kind === "timeout" || error.kind === "unavailable")) {
      return fn();
    }
    throw error;
  }
}

export function createLiveInsightsApi(base: string): InsightsApi {
  const get = (path: string, signal?: AbortSignal) =>
    withRetry(
      () => request<unknown>(base, path, { timeoutMs: INSIGHTS_TIMEOUT_MS, signal }),
      signal,
    );

  return {
    async funnel(signal) {
      return normalizeFunnel(await get("/funnel", signal));
    },
    async timeInStage(signal) {
      return normalizeTimeInStage(await get("/time-in-stage", signal));
    },
    async stale(days, signal) {
      return normalizeStale(await get(`/stale?days=${encodeURIComponent(days)}`, signal));
    },
    async timeline(applicationId, signal) {
      try {
        const payload = await request<unknown>(base, `/timeline/${applicationId}`, {
          timeoutMs: INSIGHTS_TIMEOUT_MS,
          signal,
        });
        return normalizeTimeline(payload, applicationId);
      } catch (error) {
        if (error instanceof ApiError && error.kind === "not_found") return null;
        throw error;
      }
    },
  };
}

export const unconfiguredInsightsApi: InsightsApi = {
  funnel: () => Promise.reject(new ApiError("unavailable", "Insights aren't configured.")),
  timeInStage: () => Promise.reject(new ApiError("unavailable", "Insights aren't configured.")),
  stale: () => Promise.reject(new ApiError("unavailable", "Insights aren't configured.")),
  timeline: () => Promise.resolve(null),
};
