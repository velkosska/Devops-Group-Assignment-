import { createDemoBackend } from "./demo";
import { createLiveApplicationsApi, createLiveInsightsApi, unconfiguredInsightsApi } from "./live";
import type { ApplicationsApi, InsightsApi } from "./types";

export interface Backend {
  applications: ApplicationsApi;
  insights: InsightsApi;
  demo: boolean;
}

export function createBackend(env: ImportMetaEnv = import.meta.env): Backend {
  const applicationsUrl = env.VITE_APPLICATIONS_API_URL?.trim();
  const insightsUrl = env.VITE_INSIGHTS_API_URL?.trim();

  if (!applicationsUrl) {
    return { ...createDemoBackend(), demo: true };
  }
  return {
    applications: createLiveApplicationsApi(applicationsUrl),
    insights: insightsUrl ? createLiveInsightsApi(insightsUrl) : unconfiguredInsightsApi,
    demo: false,
  };
}

export type { ApplicationsApi, InsightsApi } from "./types";
export { ApiError } from "./http";
